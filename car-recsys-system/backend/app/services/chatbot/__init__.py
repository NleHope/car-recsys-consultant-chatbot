"""Agentic car-shopping chatbot (chatbot_2 LangGraph), integrated into the backend.

Exposes:
    initialize_resources() -> (llm, vector_store)   # build once, cache in the route
    generate_response(llm, vector_store, history, user_input, session_id)
        -> (answer, updated_history)

Vector store: Qdrant `car_vectorize` (env CHATBOT_QDRANT_COLLECTION).
SQL: gold.* on AlloyDB (env WAREHOUSE_DSN / DATABASE_URL).
"""
from .generate_response import generate_response, initialize_resources

__all__ = ["generate_response", "initialize_resources"]
