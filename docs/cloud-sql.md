# Cloud SQL (GCP) — Setup & Operations

> ⚠️ **DEPRECATED (2026-06-01).** Prod DB đã migrate sang **AlloyDB** và Cloud SQL
> instance `free-trial-first-project` đã **xóa** (cắt phí). Doc hiện hành:
> [alloydb.md](alloydb.md). Giữ file này làm lịch sử/tham khảo.

Doc theo dõi mọi thứ liên quan đến PostgreSQL trên Cloud SQL: thông số instance,
cách connect, init schema, chuyển môi trường local↔cloud, và các thao tác vận hành.

> **Bí mật KHÔNG nằm trong doc này.** Connection thật (DSN + password) ở
> `car-recsys-system/.env.cloud` (gitignored). Doc này chỉ ghi cấu trúc + lệnh.

---

## 1. Thông số instance

| Mục | Giá trị |
|---|---|
| Project | `cobalt-bond-494609-a6` |
| Instance | `free-trial-first-project` |
| Connection name | `cobalt-bond-494609-a6:us-central1:free-trial-first-project` |
| Region / zone | `us-central1` (us-central1-a, single zone) |
| Version | PostgreSQL **18.3** |
| Tier | `db-perf-optimized-N-8` (8 vCPU / 64 GB / 100 GB SSD) |
| **Public IP** | `34.66.189.61` : `5432` |
| Outgoing IP | `35.188.1.75` |
| Private IP | Disabled |
| SSL | **Bắt buộc** (`sslmode=require`) |
| IAM auth | Bật (`cloudsql.iam_authentication=on`) — hiện vẫn dùng password auth |

### Users
| User | Password | Ghi chú |
|---|---|---|
| `postgres` | (xem `.env.cloud`) | built-in superuser |
| `admin` | (xem `.env.cloud`) | tạo thêm để đồng bộ local; có CREATE trên bronze/silver/gold |

### Databases
- `car_recsys` — DB chính của dự án (đã init schema)
- `postgres` — mặc định

---

## 2. Connect

### Điều kiện
IP công cộng của máy bạn phải nằm trong **authorized networks** của instance.
Hiện cho phép: `171.253.158.82/32`.

> **IP nhà đổi** (restart router, đổi mạng) → connect sẽ timeout. Cập nhật:
> ```bash
> # lấy IP hiện tại
> curl -s https://api.ipify.org
> # thêm vào authorized networks (GHI ĐÈ danh sách — liệt kê hết IP cần)
> gcloud sql instances patch free-trial-first-project \
>   --authorized-networks=<IP-MỚI>/32 \
>   --project=cobalt-bond-494609-a6
> ```

### psql (qua docker — máy chưa cài psql client)
```bash
docker run --rm -it -e PGPASSWORD=$DB_PASS postgres:15-alpine \
  psql "host=34.66.189.61 port=5432 dbname=car_recsys user=admin sslmode=require"
```

### DSN
```
postgresql://admin:<PASS>@34.66.189.61:5432/car_recsys?sslmode=require
```

---

## 3. Init schema (đã làm)

Cloud có schema **giống hệt local**. Đã chạy `database/init/02-create-schema.sql`
(bỏ qua `01-init-bytebase.sql` — bytebase là tool local).

```bash
# chạy lại nếu cần (idempotent — CREATE ... IF NOT EXISTS):
docker run --rm -e PGPASSWORD=$DB_PASS \
  -v "$PWD/car-recsys-system/database/init:/sql:ro" postgres:15-alpine \
  psql "host=34.66.189.61 port=5432 dbname=car_recsys user=postgres sslmode=require" \
  -v ON_ERROR_STOP=1 -f /sql/02-create-schema.sql
```

### Đã có trên cloud
| Schema | Nội dung |
|---|---|
| `bronze` | `raw_listings` (+ crawl_date/source/run_id) |
| `silver` | rỗng — **dbt tạo** khi build (đúng thiết kế) |
| `gold` | 8 bảng app: users · user_interactions · user_favorites · user_searches · chat_sessions · chat_messages · item_similarity · vehicle_price_history (partitioned) + function `ensure_price_history_partition` |

### Quyền cho `admin` (đã cấp — để dbt tạo marts)
```sql
GRANT USAGE, CREATE ON SCHEMA bronze, silver, gold TO admin;
GRANT ALL ON ALL TABLES IN SCHEMA bronze, gold TO admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA silver GRANT ALL ON TABLES TO admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA gold   GRANT ALL ON TABLES TO admin;
GRANT EXECUTE ON FUNCTION gold.ensure_price_history_partition(date) TO admin;
```

---

## 4. Chuyển local ↔ cloud

Pipeline/dbt/backend đọc connection từ env. Đổi môi trường = đổi env.

```bash
# trỏ MỌI THỨ lên cloud trong shell hiện tại:
set -a; . car-recsys-system/.env.cloud; set +a
# từ đây dbt / scripts dùng DSN cloud
```

`.env.cloud` (gitignored) chứa: `WAREHOUSE_DSN`, `DATABASE_URL`, `DBT_PG_*`,
`DBT_PG_SSLMODE=require`.

### dbt lên cloud
```bash
docker run --rm -v "$PWD/car-recsys-system/dbt:/app/dbt" \
  -e DBT_PG_HOST=34.66.189.61 -e DBT_PG_USER=admin -e DBT_PG_PASSWORD=<PASS> \
  -e DBT_PG_DBNAME=car_recsys -e DBT_PG_SSLMODE=require \
  car-pipeline-worker:latest dbt debug --profiles-dir /app/dbt --project-dir /app/dbt
# Connection test: OK connection ok   ← đã verify
```

`profiles.yml` đã sửa: `sslmode: "{{ env_var('DBT_PG_SSLMODE', 'prefer') }}"`
→ local dùng `prefer`, cloud set `require`.

---

## 5. Thao tác vận hành (gcloud)

```bash
P="--project=cobalt-bond-494609-a6"
I="free-trial-first-project"

gcloud sql instances describe $I $P            # info instance
gcloud sql users list --instance=$I $P         # users
gcloud sql databases list --instance=$I $P     # databases

# reset password
gcloud sql users set-password admin --instance=$I --password=<new> $P

# bật/tắt instance (TIẾT KIỆM credit khi không dùng)
gcloud sql instances patch $I --activation-policy=NEVER  $P   # STOP
gcloud sql instances patch $I --activation-policy=ALWAYS $P   # START
```

---

## 6. ⚠️ Lưu ý quan trọng

1. **Bảo mật**: public IP + password đơn giản lộ trên internet → **chỉ dùng
   free-trial/dev**. Prod: password mạnh + Cloud SQL Auth Proxy (mTLS, không cần
   mở IP).
2. **Chi phí**: tier `db-perf-optimized-N-8` (8 vCPU/64GB) là cấu hình LỚN, đốt
   credit nhanh. **Tắt instance** (`activation-policy=NEVER`) khi không dùng.
3. **IP authorized**: chỉ 1 IP nhà bạn. Đổi mạng → mất kết nối → patch lại.
4. **Backup**: hiện **automatic backup tắt**. Cân nhắc bật trước khi có data thật:
   `gcloud sql instances patch $I --backup-start-time=03:00 $P`.
5. **Free-trial**: instance/credit có hạn — theo dõi billing.

---

## 7. Backfill data INITIAL (đã làm — 1 lần)

Data Colab gốc ở `gs://bronze-car-recsys/raw_data/` (7065 JSON, không có `dt=`)
đã được load 1 lần vào Cloud SQL với `source='initial'`, rồi dbt build.

```bash
# 1. load full bucket → bronze (source='initial'):
set -a; . car-recsys-system/.env.cloud; set +a
GCS_BUCKET=bronze-car-recsys \
  crawler/.venv/bin/python -m temporal_app.scripts.backfill_initial
# → inserted 7044 (idempotent qua file_hash)

# 2. dbt build → silver + gold:
docker run --rm -v "$PWD/car-recsys-system/dbt:/app/dbt" \
  -e DBT_PG_HOST=34.66.189.61 -e DBT_PG_USER=admin -e DBT_PG_PASSWORD=<PASS> \
  -e DBT_PG_DBNAME=car_recsys -e DBT_PG_SSLMODE=require \
  car-pipeline-worker:latest dbt build --profiles-dir /app/dbt --project-dir /app/dbt
# → PASS=68 / 0 error
```

Kết quả gold: vehicles **5318** · car_models 1214 · sellers 2255 · reviews 9918
· vehicle_features 111137 · vehicle_images 26516.

> Backfill chạy TRÊN LOCAL (đọc bucket bằng ADC, ghi Cloud SQL qua public IP).
> Cùng project GCP nên ADC có quyền đọc bucket. Idempotent — chạy lại an toàn.

## 8. Trạng thái hiện tại (2026-05-30)

- ✅ Connection (public IP + authorized network) — verified
- ✅ Schema init (bronze/silver/gold giống local) — verified
- ✅ User `admin` + quyền CREATE — verified
- ✅ dbt connect cloud (sslmode=require) — verified
- ✅ **Data INITIAL đã load + transform** (gold.vehicles=5318) — verified
- ⬜ Incremental pipeline (weekly) chưa trỏ cloud — vẫn ghi local mặc định
- ⬜ ML (embeddings/similarity) chưa chạy trên cloud (cần OPENAI_API_KEY)
