"""Re-ingest gold.vehicles (+ features) into the chatbot's Qdrant collection
(`car_vectorize`) as chatbot_2-style chunked documents. Pure function called by
the embed_chatbot_vehicles activity and (optionally) the standalone script.

This is a FULL re-ingest (reads all of gold.vehicles every run), so by default
it drops and recreates the collection first (`recreate=True`). That keeps the
weekly run idempotent — no duplicate chunks accumulate and stale/sold vehicles
are dropped. Pass `recreate=False` for append-only behaviour (e.g. a one-shot
backfill that adds to an existing collection).
"""
from __future__ import annotations

from collections import defaultdict
from typing import Optional
from uuid import uuid4


def embed_chatbot_vehicles(
    warehouse_dsn: str,
    qdrant_url: str,
    openai_api_key: str,
    collection: str = "car_vectorize",
    qdrant_api_key: Optional[str] = None,
    embedding_model: str = "text-embedding-3-large",
    embedding_dim: int = 3072,
    chunk_size: int = 250,
    chunk_overlap: int = 30,
    batch_size: int = 128,
    recreate: bool = True,
) -> dict[str, int]:
    from sqlalchemy import create_engine, text
    from langchain_core.documents import Document
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    from langchain_openai import OpenAIEmbeddings
    from langchain_qdrant import QdrantVectorStore
    from qdrant_client import QdrantClient
    from qdrant_client.models import Distance, VectorParams

    engine = create_engine(warehouse_dsn)
    with engine.connect() as con:
        vehicles = con.execute(text("""
            SELECT vin, new_used AS status, title, brand, car_name, car_model,
                   price, monthly_payment, mileage, mpg,
                   exterior_color, interior_color, drivetrain, fuel_type,
                   transmission, engine, vehicle_url
            FROM gold.vehicles WHERE title IS NOT NULL
        """)).mappings().all()
        feats = con.execute(text("""
            SELECT vehicle_id, feature_category, feature_name
            FROM gold.vehicle_features WHERE feature_name IS NOT NULL
        """)).all()
    by_vin: dict = defaultdict(lambda: defaultdict(list))
    for vid, cat, name in feats:
        if name not in by_vin[vid][cat or "Other"]:
            by_vin[vid][cat or "Other"].append(name)

    docs = []
    for v in vehicles:
        d = dict(v)
        feat = {k: list(vs) for k, vs in by_vin.get(d["vin"], {}).items()}
        page_content = (
            f"status: {d.get('status','')}. title: {d.get('title','')}"
            f". brand: {d.get('brand','')}. interior_color: {d.get('interior_color','')}"
            f". exterior_color: {d.get('exterior_color','')}. drivetrain: {d.get('drivetrain','')}"
            f". fuel_type: {d.get('fuel_type','')}. transmission: {d.get('transmission','')}"
            f". engine: {d.get('engine','')}. features: {feat}"
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
        docs.append(Document(page_content=page_content, metadata=metadata))

    splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    chunks = splitter.split_documents(docs)

    client = QdrantClient(url=qdrant_url, api_key=qdrant_api_key or None, timeout=120)
    existing = {c.name for c in client.get_collections().collections}
    if recreate and collection in existing:
        # Full re-ingest: drop the old collection so a weekly run never piles up
        # duplicate chunks (the uuid4 ids below are not stable across runs).
        client.delete_collection(collection_name=collection)
        existing.discard(collection)
    if collection not in existing:
        client.create_collection(
            collection_name=collection,
            vectors_config=VectorParams(size=embedding_dim, distance=Distance.COSINE),
        )
    embeddings = OpenAIEmbeddings(model=embedding_model, api_key=openai_api_key)
    store = QdrantVectorStore(client=client, collection_name=collection, embedding=embeddings)

    added = 0
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i + batch_size]
        store.add_documents(documents=batch, ids=[str(uuid4()) for _ in batch])
        added += len(batch)
    return {"chunks": added, "vehicles": len(vehicles)}
