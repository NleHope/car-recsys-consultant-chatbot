"""Ingest gold.vehicles (+ features) from AlloyDB into a Qdrant collection for the
chatbot_2 agentic retriever. Chatbot-2-style chunked documents (page_content +
metadata), embedded with text-embedding-3-large, written to Qdrant `car_vectorize`.
"""
import os
from collections import defaultdict
from uuid import uuid4

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_qdrant import QdrantVectorStore
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams

load_dotenv()

WAREHOUSE_DSN = os.getenv("WAREHOUSE_DSN") or os.getenv("DATABASE_URL")
QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
COLLECTION_NAME = os.getenv("CHATBOT_QDRANT_COLLECTION", "car_vectorize")
EMBED_MODEL = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-large")
EMBED_DIM = int(os.getenv("OPENAI_EMBEDDING_DIM", "3072"))

CHUNK_SIZE = 250
CHUNK_OVERLAP = 30
BATCH_SIZE = 64


def _load_rows():
    """One dict per vehicle, with features grouped by category (mirrors the old
    feature_type -> [feature_name] shape)."""
    engine = create_engine(WAREHOUSE_DSN)
    with engine.connect() as con:
        vehicles = con.execute(text("""
            SELECT vin, new_used AS status, title, brand, car_name, car_model,
                   price, monthly_payment, mileage, mpg,
                   exterior_color, interior_color, drivetrain, fuel_type,
                   transmission, engine, vehicle_url
            FROM gold.vehicles
            WHERE title IS NOT NULL
        """)).mappings().all()
        feats = con.execute(text("""
            SELECT vehicle_id, feature_category, feature_name
            FROM gold.vehicle_features
            WHERE feature_name IS NOT NULL
        """)).all()
    by_vin = defaultdict(lambda: defaultdict(list))
    for vid, cat, name in feats:
        if name not in by_vin[vid][cat or "Other"]:
            by_vin[vid][cat or "Other"].append(name)
    out = []
    for v in vehicles:
        d = dict(v)
        d["features"] = {k: list(vs) for k, vs in by_vin.get(d["vin"], {}).items()}
        out.append(d)
    return out


def _to_document(d: dict) -> Document:
    page_content = (
        f"status: {d.get('status', '')}. title: {d.get('title', '')}"
        f". brand: {d.get('brand', '')}. interior_color: {d.get('interior_color', '')}"
        f". exterior_color: {d.get('exterior_color', '')}. drivetrain: {d.get('drivetrain', '')}"
        f". fuel_type: {d.get('fuel_type', '')}. transmission: {d.get('transmission', '')}"
        f". engine: {d.get('engine', '')}. features: {d.get('features', '')}"
    )
    metadata = {
        "VIN": d.get("vin"),
        "Price": float(d["price"]) if d.get("price") is not None else None,
        "Monthly Payment": float(d["monthly_payment"]) if d.get("monthly_payment") is not None else None,
        "Mileage": int(d["mileage"]) if d.get("mileage") is not None else None,
        "Miles Per Gallon": d.get("mpg"),
        "Post Link": d.get("vehicle_url"),
        "Status": d.get("status", ""),
        "Title": d.get("title", ""),
        "Brand": d.get("brand", ""),
        "Interior Color": d.get("interior_color", ""),
        "Exterior Color": d.get("exterior_color", ""),
        "Drivetrain": d.get("drivetrain", ""),
        "Fuel Type": d.get("fuel_type", ""),
        "Transmission": d.get("transmission", ""),
        "Engine": d.get("engine", ""),
    }
    return Document(page_content=page_content, metadata=metadata)


def _ensure_collection(client: QdrantClient):
    existing = {c.name for c in client.get_collections().collections}
    if COLLECTION_NAME not in existing:
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=EMBED_DIM, distance=Distance.COSINE),
        )
        print(f"created Qdrant collection {COLLECTION_NAME}")


def main():
    if not (WAREHOUSE_DSN and QDRANT_URL):
        raise SystemExit("WAREHOUSE_DSN and QDRANT_URL are required")
    print("loading rows from gold.vehicles ...")
    rows = _load_rows()
    print(f"loaded {len(rows)} vehicles")
    docs = [_to_document(d) for d in rows]
    splitter = RecursiveCharacterTextSplitter(chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP)
    chunks = splitter.split_documents(docs)
    print(f"split into {len(chunks)} chunks")

    client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY or None, timeout=120)
    _ensure_collection(client)
    embeddings = OpenAIEmbeddings(model=EMBED_MODEL)
    store = QdrantVectorStore(client=client, collection_name=COLLECTION_NAME, embedding=embeddings)

    import time
    total = len(chunks)
    for i in range(0, total, BATCH_SIZE):
        batch = chunks[i:i + BATCH_SIZE]
        ids = [str(uuid4()) for _ in batch]
        for attempt in range(3):
            try:
                store.add_documents(documents=batch, ids=ids)
                break
            except Exception as exc:  # noqa: BLE001 — Qdrant/network timeouts; retry the batch
                if attempt == 2:
                    raise
                print(f"  batch {i} failed ({exc}); retry {attempt + 1}/2 ...")
                time.sleep(3 * (attempt + 1))
        print(f"added {min(i + BATCH_SIZE, total)}/{total}")
    print("ingest complete")


if __name__ == "__main__":
    main()
