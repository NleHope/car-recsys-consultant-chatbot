# CLAUDE.md

Guidance for Claude Code working in this repo. Detailed runbooks live in `docs/`:
[architecture](docs/architecture/diagrams.md) · [alloydb](docs/alloydb.md) ·
[vm-worker](docs/vm-worker.md).

---

## Project Layout

```
crawler/                      # cars.com scraper + Temporal orchestration
├── crawler/                  # scraper package
│   ├── config.py             # env-driven config (bucket, page, browser mode)
│   ├── browser.py            # SeleniumBase UC nav + Cloudflare Turnstile solve
│   ├── link_crawler.py · detail_scraper.py · gcs_uploader.py
│   └── parsers/              # post / seller / car HTML → dict
├── temporal_app/             # Temporal workflows / activities / workers
│   ├── workflows.py          # WeeklyCrawlWorkflow · TransformWorkflow · MLWorkflow · WeeklyPipelineWorkflow (chain)
│   ├── activities.py         # crawl_links / scrape_details / upload_gcs (crawl tasks)
│   │                         # + load_bronze / dbt_build / refresh_matviews /
│   │                         #   compute_item_similarity / embed_vehicles / embed_chatbot_vehicles (pipeline tasks)
│   ├── pipeline/
│   │   ├── bronze.py         # GCS → bronze.raw_listings loader
│   │   ├── similarity.py     # gold.item_similarity cosine builder
│   │   ├── embeddings.py     # embed gold.vehicles → Qdrant (car_chatbot_vectors)
│   │   └── chatbot_embeddings.py # embed gold.vehicles (chunked) → Qdrant (car_vectorize)
│   ├── client.py             # connect: localhost / Temporal Cloud (API-key auth)
│   ├── worker.py             # CRAWL_TASK_QUEUE worker (host, needs Chrome)
│   ├── pipeline_worker.py    # PIPELINE_TASK_QUEUE worker (Docker, no Chrome)
│   ├── shared.py             # task queue name constants
│   └── scripts/              # trigger_once.py · create_schedule.py · backfill_initial.py
├── run_local.sh              # run one crawl stage standalone (debug)
├── run_worker.sh             # start a Temporal worker (reads temporal_app/.env)
└── Dockerfile.pipeline       # pipeline-worker image (no Chrome)

car-recsys-system/
├── backend/                  # FastAPI backend
│   ├── app/
│   │   ├── main.py           # app factory, router registration, startup/shutdown
│   │   ├── core/
│   │   │   ├── config.py     # Settings (pydantic-settings) — all env vars here
│   │   │   ├── database.py   # SQLAlchemy engine + get_db dependency
│   │   │   └── security.py   # JWT (HS256), bcrypt, get_current_user_id*
│   │   ├── api/v1/
│   │   │   ├── auth.py            # POST /register, /login, /google, /me, /logout
│   │   │   ├── search.py          # GET  /search  (full-text + facet filters)
│   │   │   ├── listings.py        # GET  /listing/{id}, /listings/featured, /listings/similar/{id}
│   │   │   ├── recommendations.py # GET  /reco/for-you, /reco/popular, /reco/similar/{id}
│   │   │   ├── chat.py            # POST /chat, GET/DELETE /chat/sessions/*
│   │   │   ├── interactions.py    # POST /interactions  (view/click/compare/save/…)
│   │   │   ├── feedback.py        # POST /feedback
│   │   │   ├── reviews.py         # GET/POST /reviews, /vehicle/{id}/reviews
│   │   │   └── price_estimate.py  # (placeholder — not yet implemented)
│   │   ├── models/
│   │   │   ├── user.py            # SQLAlchemy User ORM (gold.users)
│   │   │   ├── vehicle.py         # SQLAlchemy Vehicle ORM (gold.vehicles)
│   │   │   └── interaction.py     # SQLAlchemy UserInteraction ORM
│   │   ├── schemas/               # Pydantic request/response schemas
│   │   └── services/
│   │       ├── reco/              # Multi-stage hybrid recommendation engine
│   │       │   ├── candidates.py  # 4 recallers: Collaborative · Content · Vector · Popularity
│   │       │   ├── engine.py      # RecommendationEngine orchestrator
│   │       │   ├── ranker.py      # WeightedLinearRanker (7 features)
│   │       │   ├── reranker.py    # MMRReranker (diversity + brand/model caps)
│   │       │   ├── features.py    # FeatureAssembler (price_fit, recency, model_rating…)
│   │       │   ├── config.py      # get_reco_config() reads reco_config.yaml
│   │       │   └── reco_config.yaml  # All weights / thresholds (no magic numbers in code)
│   │       └── chatbot/           # Agentic LangGraph chatbot (chatbot_2)
│   │           ├── generate_response.py  # LangGraph StateGraph, all nodes + routing
│   │           ├── user_profile.py       # UserProfile Pydantic model + in-memory store
│   │           └── __init__.py           # Exports initialize_resources, generate_response
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                 # Vite + React + TypeScript + Tailwind + shadcn/ui
│   ├── src/
│   │   ├── App.tsx           # Router, providers (Google OAuth, ThemeProvider, QueryClient)
│   │   ├── pages/
│   │   │   ├── Index.tsx · SearchPage.tsx · VehicleDetailPage.tsx
│   │   │   ├── ComparePage.tsx · SellPage.tsx · ChatPage.tsx
│   │   │   ├── LoginPage.tsx · ReviewsPage.tsx · FavoritesPage.tsx
│   │   │   └── ProfilePage.tsx · NotFound.tsx
│   │   └── components/
│   │       ├── Header.tsx · Footer.tsx · Hero.tsx
│   │       ├── VehicleCard.tsx · FeaturedVehicles.tsx · PopularCategories.tsx
│   │       ├── ChatPopup.tsx        # Floating chat widget (all pages)
│   │       ├── ChatVehicleCards.tsx # Vehicle cards rendered inside chat replies
│   │       ├── CompareModal.tsx
│   │       ├── UserReviewSection.tsx · ReviewCard.tsx
│   │       ├── MarkdownMessage.tsx  # react-markdown + remark-gfm for chat replies
│   │       └── ui/                  # shadcn/ui components
│   ├── Dockerfile            # nginx production image (port 8080)
│   └── nginx.conf            # proxy /api → backend; serve SPA from /
├── dbt/                      # dbt medallion project (car_recsys)
│   ├── models/
│   │   ├── staging/          # stg_raw_latest (DISTINCT ON vin) → stg_listings (view, silver_staging)
│   │   ├── silver/           # fct_listing (incremental delete+insert) · dim_* · bridge_* (tables)
│   │   └── gold/             # vehicles (merge by VIN) · vehicle_price_history
│   │                         # car_models · sellers · reviews · vehicle_features · vehicle_images · matviews
│   └── profiles.yml          # reads DBT_PG_HOST/USER/PASSWORD/DBNAME env vars
├── database/
│   └── init/
│       ├── 01-init-bytebase.sql  # Bytebase service account
│       └── 02-create-schema.sql  # bronze schema + gold user-domain tables
│                                  # (gold.users, user_interactions, item_similarity,
│                                  #  chat_sessions, chat_messages, favorites, reviews, feedback)
└── docker-compose.yml
```

---

## Running the Stack

**All backend services (Postgres, Qdrant, Redis, Temporal, pipeline-worker, backend):**
```bash
cd car-recsys-system && docker compose up -d
```

**Frontend (live-reload dev, host):**
```bash
cd car-recsys-system/frontend && npm run dev   # → http://localhost:3000
```

**Frontend (production nginx container):**
```bash
cd car-recsys-system && docker compose --profile frontend up -d frontend
```

**Backend hot-reload (host, skips Docker):**
```bash
cd car-recsys-system/backend && uvicorn app.main:app --reload
```

**Bytebase (opt-in DB schema management):**
```bash
docker compose --profile tools up -d bytebase   # → http://localhost:8080
```

**Temporal crawl worker (host only — needs Chrome + Xvfb):**
```bash
cd crawler && ./run_worker.sh
```

**dbt parse / validate (via Docker image, no local dbt):**
```bash
docker run --rm -v "$PWD/car-recsys-system/dbt:/app/dbt" \
  -e DBT_PG_HOST=localhost -e DBT_PG_USER=admin \
  -e DBT_PG_PASSWORD=admin123 -e DBT_PG_DBNAME=car_recsys \
  car-pipeline-worker:latest dbt parse --profiles-dir /app/dbt --project-dir /app/dbt
```

---

## Service Ports

| Service | Port |
|---|---|
| Frontend (dev / nginx) | 3000 |
| Backend (FastAPI) | 8000 |
| Postgres | 5432 |
| PostgREST | 3001 |
| Qdrant REST | 6333 |
| Qdrant gRPC | 6334 |
| Redis | 6379 |
| Temporal gRPC | 7233 |
| Temporal UI | 8233 |
| Bytebase | 8080 |

**DB creds:** `admin` / `admin123`, database `car_recsys`.

**Required `.env` / environment variables (backend):**

| Var | Notes |
|---|---|
| `OPENAI_API_KEY` | Required for chatbot + embeddings |
| `DATABASE_URL` | `postgresql://admin:admin123@localhost:5432/car_recsys` |
| `QDRANT_URL` | `http://localhost:6333` |
| `QDRANT_COLLECTION` | `car_chatbot_vectors` (reco vector recall) |
| `CHATBOT_QDRANT_COLLECTION` | `car_vectorize` (chatbot RAG — chunked docs) |
| `REDIS_URL` | `redis://localhost:6379` |
| `SECRET_KEY` | JWT signing key |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |

---

## Architecture

### Data Pipeline (Temporal)

Crawler runs on the **host** (`./run_worker.sh` — needs real Chrome/Xvfb; Docker can't solve cars.com Turnstile). Transform + ML run in the Dockerized `pipeline-worker`.

**Four workflows chained by `WeeklyPipelineWorkflow` (fail-stop):**
1. `WeeklyCrawlWorkflow` — crawl_links → scrape_details → upload_gcs (CRAWL_TASK_QUEUE)
2. `TransformWorkflow` — ensure_partition → load_bronze → dbt_build → refresh_matviews (PIPELINE_TASK_QUEUE)
3. `MLWorkflow` — compute_item_similarity ∥ embed_vehicles (parallel, PIPELINE_TASK_QUEUE)
   - `embed_vehicles`: embeds `gold.vehicles` → Qdrant `car_chatbot_vectors` (reco recall)
   - `embed_chatbot_vehicles`: embeds chunked vehicle docs → Qdrant `car_vectorize` (chatbot RAG)

**Incremental, idempotent:** each run uses a `crawl_date`; GCS stores `dt=YYYY-MM-DD/`, `load_bronze` reads only that day's slice. Bronze dedup by `file_hash`; `gold.vehicles` merge by VIN; Qdrant upsert by `point_id=uuid5(vin)`.

### dbt Medallion

```
bronze.raw_listings (JSONB, append-only)
  → staging: stg_raw_latest (DISTINCT ON vin, ingested_at) → stg_listings (view)
  → silver:  fct_listing (incremental delete+insert) · dim_brand · dim_seller · bridge_features
  → gold:    vehicles (merge by VIN) · vehicle_price_history (partitioned by day)
             car_models · sellers · reviews · vehicle_features · vehicle_images
             + materialized views: popularity_mv, rating_mv (refreshed each pipeline run)
```

silver / gold vehicle tables are **dbt-created**; `02-create-schema.sql` only creates `bronze.raw_listings` + gold user-domain tables (`users`, `user_interactions`, `item_similarity`, `chat_sessions`, `chat_messages`, `favorites`, `reviews`, `feedback`).

### Recommendation Engine (`backend/app/services/reco/`)

3-stage hybrid pipeline, constructed per request:

1. **Candidate generation** (`candidates.py`) — 4 recallers in parallel:
   - `CollaborativeRecaller`: `gold.item_similarity` neighbours of the user's seed VINs
   - `ContentRecaller`: same segment / ±30% price window
   - `VectorRecaller`: Qdrant semantic search on `car_chatbot_vectors`
   - `PopularityRecaller`: `popularity_mv` matview
2. **Ranking** (`ranker.py`) — `WeightedLinearRanker` scores 7 features
   (cf_score, content_score, vector_score, popularity, price_fit, model_rating, recency).
   Weights in `reco_config.yaml`.
3. **Re-ranking** (`reranker.py`) — `MMRReranker` for diversity; caps 3 per brand, 2 per model.

Cold users fall back to `popular()`. Config: `reco_config.yaml` (all thresholds / weights, no magic numbers in code).

### Chatbot (`backend/app/services/chatbot/`)

**Agentic LangGraph graph** (`generate_response.py`), powered by `gpt-4o-mini`.
RAG vector store: Qdrant `car_vectorize` (chunked docs, `text-embedding-3-large`).

**Graph nodes (entry → END):**

```
update_profile (UserProfile extraction) → route_intent
  ├── compare    → compare_retrieve  → compare_answer  → END
  ├── analytics  → analytics_retrieve → analytics_answer → END
  ├── specs      → spec_retrieve     → spec_answer     → END
  ├── specific   → hybrid_retrieve   → consult         → END
  ├── vague (core slots complete) → hybrid_retrieve → consult → END
  ├── vague (slots missing)       → ask_slot        → END
  ├── chitchat   → consult                           → END
  └── off_topic  → redirect_topic                   → END
```

**Intent types:** `compare` · `analytics` · `specs` · `specific` · `vague` · `chitchat` · `off_topic`

**`hybrid_retrieve`:** SQL hard-filter (`gold.vehicles`) ∥ Qdrant vector search with brand exclusions → RRF-style merged context → `consult` node generates the answer.

**User profile** (`user_profile.py`): `UserProfile` (core_slots: budget, body_type, fuel_type, brand, condition; soft_preferences: features, vibe; excluded_brands; viewed_models). Stored in-memory per `session_id` (ephemeral — Cloud Run fs). Logged-in users also persist history to `gold.chat_sessions` / `gold.chat_messages`.

**Note:** uses `LangChain` + `LangGraph` (chatbot only). The rest of the backend avoids LangChain.

### Frontend (`car-recsys-system/frontend/`)

Vite + React 18 + TypeScript + Tailwind CSS + shadcn/ui (Radix UI primitives).
State: TanStack Query (server state). Dark mode default via `next-themes`.
Auth: JWT stored in-memory + Google OAuth via `@react-oauth/google`.

**Routes:**
`/` (home) · `/search` · `/vehicle/:id` · `/compare` · `/sell` · `/login`
`/chat` · `/reviews` · `/favorites` · `/profile`

Global `<ChatPopup>` floating widget is rendered on every route.

### Backend (`car-recsys-system/backend/`)

FastAPI 0.109, Pydantic v2, SQLAlchemy 2.0, Python 3.11+.

**API prefix:** `/api/v1/`

| Router | Prefix | Key endpoints |
|---|---|---|
| auth | `/api/v1/auth` | POST /register, /login, /google; GET /me |
| search | `/api/v1` | GET /search (paginated, full-text + facets) |
| listings | `/api/v1` | GET /listing/{id}, /listings/featured, /listings/similar/{id} |
| recommendations | `/api/v1/reco` | GET /for-you, /popular, /similar/{id} |
| chat | `/api/v1/chat` | POST /, GET /sessions, GET/DELETE /sessions/{id} |
| interactions | `/api/v1/interactions` | POST (view/click/compare/save/favorite/contact/inquiry) |
| feedback | `/api/v1` | POST /feedback |
| reviews | `/api/v1` | GET/POST /reviews, /vehicle/{id}/reviews |

---

## Deployment (Production)

> GCP Project: `cobalt-bond-494609-a6` · Region: `us-central1`

### Component map

| Component | Where it runs | URL / Endpoint |
|---|---|---|
| **Frontend** (React/nginx) | Google Cloud Run | https://carsalesfinder.com/ |
| **Backend** (FastAPI) | Google Cloud Run | https://car-backend-893613114700.us-central1.run.app |
| **Database** (PostgreSQL 17) | AlloyDB (`free-trial-cluster/primary`) | Public IP `104.155.166.86`, SSL required |
| **Vector DB** (Qdrant) | Qdrant Cloud (managed) | Config via `QDRANT_URL` + `QDRANT_API_KEY` env vars |
| **Cache** (Redis) | Unknown / not confirmed | Config via `REDIS_URL` env var |
| **Temporal server** | Self-hosted trên GCE VM `temporal-worker` | gRPC :7233 (internal to VM) |
| **Crawl worker** (Chrome/Xvfb) | Cùng GCE VM với Temporal server | host process (`./run_worker.sh`) |
| **Pipeline worker** (dbt, embeddings) | Docker container trên cùng GCE VM | `car-pipeline-worker` image |
| **GCS bucket** | Google Cloud Storage | `incremental_raw` (`dt=YYYY-MM-DD/<page>/`) |
| **Artifact Registry** | GCR us-central1 | `us-central1-docker.pkg.dev/cobalt-bond-494609-a6/car-recsys/pipeline-worker` |

> **PostgREST không có trên production** — chỉ dùng khi chạy local Docker stack.

### Cloud Run details

- **Backend Cloud Run:**
  - Image: `backend/Dockerfile` (FastAPI + uvicorn)
  - Secrets: `database-url`, `openai-api-key`, `secret-key` via Secret Manager
  - Env: `DATABASE_URL` trỏ AlloyDB IP, `QDRANT_URL` trỏ Qdrant Cloud, `REDIS_URL`
  - `max-instances=1` (giữ session in-memory stable cho chatbot)
- **Frontend Cloud Run:**
  - Image: `frontend/Dockerfile` (nginx, port 8080)
  - `BACKEND_URL` → backend Cloud Run URL (proxy `/api` pass-through)
  - Custom domain: `carsalesfinder.com`

### GCE VM `temporal-worker`

Chạy **3 tiến trình** trên cùng 1 VM:
1. **Temporal server** (Docker, self-hosted) — `temporalio/auto-setup`, gRPC :7233
2. **Crawl worker** (host process, `./run_worker.sh`) — cần Chrome + Xvfb, kết nối Temporal :7233
3. **Pipeline worker** (Docker, `car-pipeline-worker`) — Transform + ML tasks, kết nối Temporal :7233

> Temporal mode: **self-hosted** (không phải Temporal Cloud). Namespace `default`.
> (CLAUDE.md cũ ghi Temporal Cloud / `car-recsys.islko` — đã được sửa lại.)

### AlloyDB

- Cluster: `free-trial-cluster`, instance `primary`, PG17
- Public IP: `104.155.166.86`, authorized networks `0.0.0.0/0`
- SSL: `sslmode=require`, backend kết nối bằng IP (không dùng Cloud SQL proxy)
- Prod data: `gold.vehicles` ≈ 5337 rows
- Xem thêm: [docs/alloydb.md](docs/alloydb.md)
- (Cloud SQL đã xóa 2026-06-01; `docs/cloud-sql.md` là lịch sử)

### GCS

- Bucket: `incremental_raw`
- Layout: `dt=YYYY-MM-DD/<page>/<vin>.json` (JSON) + images
- Auth: Application Default Credentials mount vào pipeline-worker (`/gcp/adc.json`)

---

## Gotchas

- **Crawler is host-only** — never expect it to run in Docker (Cloudflare Turnstile defeats headless Chrome).
- **Two Qdrant collections, two purposes:**
  - `car_chatbot_vectors` — per-vehicle embeddings used by the **recommendation engine** `VectorRecaller`.
  - `car_vectorize` — chunked vehicle documents used by the **chatbot** RAG retriever.
  Confusing these breaks either the reco engine or the chatbot.
- **pipeline-worker bakes the dbt project** — edit a dbt model → rebuild the image
  (`docker build -f crawler/Dockerfile.pipeline ...`) or mount the live `dbt/` dir for `dbt parse`.
- **dbt model edits affect both local + cloud** — always `dbt parse` before committing; large datasets
  expose dedup bugs absent on small local data (e.g. add `DISTINCT ON` in staging).
- **`price_estimate.py` is an empty placeholder** — the endpoint is not yet implemented.
- **`user_profile.py` uses in-memory storage** — profiles are lost on Container restart.
  Cloud Run `max-instances=1` keeps sessions stable, but a restart clears all guest profiles.
- **DB ownership (AlloyDB):** `ensure_partition` (run as `admin`) needs table OWNERSHIP, not just GRANT
  — re-own objects to admin (`DO $reown$` block). On AlloyDB `postgres` isn't superuser:
  `GRANT admin TO postgres` first; schema `public` is locked (create funcs as `postgres`).
- **Temporal là self-hosted, không phải Temporal Cloud** — server chạy trên GCE VM (`temporalio/auto-setup`),
  namespace `default`. CLAUDE.md cũ ghi sai là Temporal Cloud namespace `car-recsys.islko`.
  Khi crawl worker / pipeline worker kết nối, `TEMPORAL_ADDRESS=<vm-ip>:7233` (hoặc `localhost:7233` nếu trên cùng VM).

- **`OPENAI_API_KEY` / `QDRANT_URL` unset** → `embed_vehicles` and chatbot skip gracefully at startup
  but the chat endpoint returns HTTP 503.
- **Secrets:** never commit. `.env*`, `crawler/certs/`, `worker.env` are gitignored; docs use placeholders.
  Verify with `grep -rE 'sk-proj|admin123' <file>` before commit.
- **Frontend proxy (nginx):** in the Docker container, `/api` is proxy-passed to `$BACKEND_URL`
  (set via `envsubst` at startup). In dev, Vite forwards `/api` to `http://localhost:8000` via
  `vite.config.ts` proxy.
- **Verify, don't assume:** render Mermaid via `mermaid-cli`, run sandbox check
  (`WorkflowEnvironment.start_time_skipping`) for workflow edits, `dbt build` to confirm transforms.

---

## Skills

| Area | Skill |
|------|-------|
| Debugging | `superpowers:systematic-debugging` |
| New feature / behavior | `superpowers:brainstorming` then `superpowers:writing-plans` |
| Plan execution | `superpowers:subagent-driven-development` |
| Before claiming done | `superpowers:verification-before-completion` |
| Code review | `superpowers:requesting-code-review` |
