# AlloyDB (GCP) — Setup & Operations

Prod PostgreSQL giờ chạy trên **AlloyDB for PostgreSQL** (thay Cloud SQL — đã xóa
Cloud SQL `free-trial-first-project` để cắt phí). Data đã migrate sang đây
(2026-06-01). Doc cũ: [cloud-sql.md](cloud-sql.md) (DEPRECATED).

> **Bí mật KHÔNG nằm trong doc này.** Connection thật (DSN + password) ở
> `car-recsys-system/.env.cloud` (gitignored) và Secret Manager. Doc chỉ ghi cấu trúc + lệnh.

---

## 1. Thông số cluster/instance

| Mục | Giá trị |
|---|---|
| Project | `cobalt-bond-494609-a6` |
| Cluster | `free-trial-cluster` |
| Instance | `primary` (PRIMARY) |
| Region | `us-central1` |
| Version | PostgreSQL **17.7** |
| **Public IP** | `104.155.166.86` : `5432` |
| Authorized networks | `0.0.0.0/0` (mở internet — xem Lưu ý §6) |
| SSL | **Bắt buộc** (`sslmode=require`) |

### Users
| User | Ghi chú |
|---|---|
| `postgres` | built-in. **KHÔNG phải superuser** trên AlloyDB (khác Cloud SQL). Đã `GRANT admin TO postgres`. |
| `admin` (`admin123`) | role chính của app/dbt; owner các schema bronze/silver/gold |
| `alloydbsuperuser` | owner schema `public` (managed bởi AlloyDB) |

### Databases
- `car_recsys` — DB chính (đã migrate đủ data)

### Schemas (sau migrate)
| Schema | Owner | Nội dung |
|---|---|---|
| `bronze` | admin | `raw_listings` (7068 rows) |
| `silver` / `silver_staging` | admin | dbt staging/silver |
| `gold` | admin | vehicles (**5337**) + app tables (users/interactions/chat_*/item_similarity) + `ensure_price_history_partition` |
| `public` | alloydbsuperuser | function `update_updated_at_column()` + extensions |

---

## 2. Connect

AlloyDB primary đã bật public IP + authorized `0.0.0.0/0`, nên connect giống Cloud SQL
(không cần VPC connector). Luôn `sslmode=require`.

### psql (qua docker — máy chưa cài psql client)
```bash
docker run --rm -it -e PGPASSWORD=admin123 postgres:18 \
  psql "host=104.155.166.86 port=5432 dbname=car_recsys user=admin sslmode=require"
```

### DSN
```
# backend / load_bronze / scripts (psycopg2)
postgresql+psycopg2://admin:admin123@104.155.166.86:5432/car_recsys?sslmode=require
# plain (psql / pg_dump)
postgresql://admin:admin123@104.155.166.86:5432/car_recsys?sslmode=require
```

---

## 3. Consumers (datasource) — tất cả env-driven

| Consumer | Cấu hình | Host |
|---|---|---|
| **Backend** (Cloud Run `car-backend`) | Secret Manager `database-url` (version 2) | `104.155.166.86` (public IP, KHÔNG còn `--add-cloudsql-instances`) |
| **VM worker** (`temporal-worker`) | `worker.env`: `WAREHOUSE_DSN` + `DBT_PG_HOST` + `DBT_PG_SSLMODE=require` | `104.155.166.86` |
| **Local dev** | `car-recsys-system/.env.cloud` | `104.155.166.86` |

Đổi datasource = đổi host trong các chỗ trên. **Pipeline/dbt/backend KHÔNG cần đổi code.**

---

## 4. AlloyDB khác Cloud SQL (gotchas đã gặp khi migrate)

1. **`postgres` không phải superuser.** Tạo DB `OWNER admin` báo `must be able to SET ROLE
   "admin"` → fix: `GRANT admin TO postgres;` trước.
2. **`ensure_partition` cần OWNERSHIP.** Sau restore, re-own bronze/silver/gold tables +
   functions về `admin` (block `DO $reown$`, chạy bằng `postgres`). Nếu không, partition
   `CREATE TABLE ... PARTITION OF` báo "must be owner".
3. **Schema `public` siết quyền.** `admin` bị `permission denied for schema public` khi tạo
   function → tạo `public.update_updated_at_column()` bằng `postgres`.
4. **Restore trigger thiếu function.** pg_dump với `--no-owner` có thể restore trigger trước
   function `public.update_updated_at_column()` → 5 trigger `updated_at` lỗi; tạo lại
   function + trigger thủ công sau restore (cosmetic, không ảnh hưởng data/pipeline).

---

## 5. Thao tác vận hành (gcloud)

```bash
P="--project=cobalt-bond-494609-a6"
C="--cluster=free-trial-cluster --region=us-central1"

gcloud alloydb instances describe primary $C $P            # info instance (publicIpAddress...)
gcloud alloydb users list $C $P                            # users
gcloud alloydb users set-password postgres $C $P --password=<new>   # reset pw

# authorized networks (public IP)
gcloud alloydb instances update primary $C $P \
  --authorized-external-networks=0.0.0.0/0 --assign-inbound-public-ip=ASSIGN_IPV4
```

---

## 6. ⚠️ Lưu ý quan trọng

1. **Free-trial ~1 tháng.** AlloyDB free-trial có HẠN — hết hạn sẽ tính phí (đáng kể).
   Theo dõi billing; đây là lý do move khỏi Cloud SQL nhưng cũng là đồng hồ chi phí mới.
2. **`0.0.0.0/0` mở internet.** DB lộ ra internet, chỉ che bằng SSL + password. **Chỉ hợp
   free-trial/đồ án.** Prod: dùng private IP + VPC connector, hoặc Cloud NAT IP cố định.
3. **SSL bắt buộc** — mọi DSN phải có `?sslmode=require`.
4. **Backup**: kiểm tra continuous backup của AlloyDB (mặc định có) trước khi có data quan trọng.

---

## 7. Migration từ Cloud SQL (đã làm — 2026-06-01)

`pg_dump -Fc --no-owner --no-privileges` từ Cloud SQL (PG18) → `pg_restore --role=admin`
vào AlloyDB (PG17) qua public IP. Re-own về admin, vá function/trigger, verify:
`gold.vehicles=5337`, `bronze.raw_listings=7068`. Backend redeploy `--clear-cloudsql-instances`;
worker.env đổi host; pipeline `transform` chạy green (load_bronze→dbt_build→ensure_partition→
refresh_matviews). Cloud SQL đã xóa sau khi verify. Chi tiết:
[plan](superpowers/plans/2026-05-31-cloudsql-to-alloydb-migration.md).
