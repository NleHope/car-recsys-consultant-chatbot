"""Chat API — agentic car-shopping assistant (chatbot_2 LangGraph).

POST /api/v1/chat  {session_id?, message, reset?} -> {session_id, answer}
In-memory per-session history + profile (Cloud Run runs max-instances=1, so a
session stays on one instance). Logged-in users persist history to gold.chat_*.
"""
from __future__ import annotations

import json
import logging
import threading
import uuid
from typing import Optional

import anyio
from fastapi import APIRouter, Depends, HTTPException, status
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user_id, get_current_user_id_optional

logger = logging.getLogger(__name__)
router = APIRouter()

# Global resources (LLM + Qdrant vector store), built once on first use.
_llm = None
_vector_store = None
_init_lock = threading.Lock()

# In-memory chat history per session_id.
_histories: dict[str, list[BaseMessage]] = {}
_hist_lock = threading.Lock()


def _resources():
    global _llm, _vector_store
    if _llm is None or _vector_store is None:
        with _init_lock:
            if _llm is None or _vector_store is None:
                from app.services.chatbot import initialize_resources
                _llm, _vector_store = initialize_resources()
    return _llm, _vector_store


def _load_db_history(db: Session, session_id: str) -> list[BaseMessage]:
    """Rebuild LangChain history from persisted messages (oldest first)."""
    rows = db.execute(text("""
        SELECT role, content FROM gold.chat_messages
        WHERE session_id = :sid ORDER BY created_at ASC, id ASC
    """), {"sid": session_id}).fetchall()
    out: list[BaseMessage] = []
    for role, content in rows:
        if role == "user":
            out.append(HumanMessage(content=content or ""))
        elif role == "assistant":
            out.append(AIMessage(content=content or ""))
    return out


def _owned_session(db: Session, session_id: str, user_id: str) -> bool:
    r = db.execute(text(
        "SELECT 1 FROM gold.chat_sessions WHERE id = :sid AND user_id = :uid"
    ), {"sid": session_id, "uid": user_id}).fetchone()
    return r is not None


class ChatRequest(BaseModel):
    session_id: Optional[str] = None
    message: str = Field(..., min_length=1, max_length=5000)
    reset: bool = False


class ChatResponse(BaseModel):
    session_id: str
    answer: str
    vehicles: list = []


class ChatSessionSummary(BaseModel):
    id: str
    title: Optional[str] = None
    updated_at: Optional[str] = None


class ChatMessageOut(BaseModel):
    role: str
    content: str
    created_at: Optional[str] = None
    vehicles: list = []


@router.post("", response_model=ChatResponse)
@router.post("/", response_model=ChatResponse)
async def chat(
    req: ChatRequest,
    user_id: Optional[str] = Depends(get_current_user_id_optional),
    db: Session = Depends(get_db),
):
    """One consultation turn. Logged-in users persist to gold.chat_*; guests stay in-memory."""
    try:
        llm, vector_store = _resources()
    except Exception as exc:  # noqa: BLE001
        logger.error("chatbot init failed: %s", exc)
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail=f"Chatbot unavailable: {exc}")

    # ---- Guest path: unchanged in-memory behaviour ----
    if not user_id:
        session_id = req.session_id or str(uuid.uuid4())
        if req.reset:
            with _hist_lock:
                _histories.pop(session_id, None)
            from app.services.chatbot.user_profile import delete_profile
            delete_profile(session_id)
        with _hist_lock:
            history = list(_histories.get(session_id, []))
        try:
            from app.services.chatbot import generate_response
            answer, updated_history, vehicles = await anyio.to_thread.run_sync(
                generate_response, llm, vector_store, history, req.message, session_id,
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("chat generate_response failed")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                detail=f"Failed to process message: {exc}")
        with _hist_lock:
            _histories[session_id] = updated_history
        return ChatResponse(session_id=session_id, answer=answer, vehicles=vehicles)

    # ---- Logged-in path: persist to gold.chat_* ----
    session_id = req.session_id
    if session_id:
        if not _owned_session(db, session_id, user_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    else:
        session_id = str(uuid.uuid4())
        db.execute(text("""
            INSERT INTO gold.chat_sessions (id, user_id, title, created_at, updated_at)
            VALUES (:sid, :uid, :title, now(), now())
        """), {"sid": session_id, "uid": user_id, "title": req.message[:60]})
        db.commit()

    history = _load_db_history(db, session_id)
    try:
        from app.services.chatbot import generate_response
        answer, _updated, vehicles = await anyio.to_thread.run_sync(
            generate_response, llm, vector_store, history, req.message, session_id,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("chat generate_response failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Failed to process message: {exc}")

    db.execute(text("""
        INSERT INTO gold.chat_messages (session_id, role, content, created_at)
        VALUES (:sid, 'user', :c, now())
    """), {"sid": session_id, "c": req.message})
    db.execute(text("""
        INSERT INTO gold.chat_messages (session_id, role, content, vehicles, created_at)
        VALUES (:sid, 'assistant', :a, CAST(:veh AS jsonb), now())
    """), {"sid": session_id, "a": answer, "veh": json.dumps(vehicles)})
    db.execute(text("UPDATE gold.chat_sessions SET updated_at = now() WHERE id = :sid"),
               {"sid": session_id})
    db.commit()
    return ChatResponse(session_id=session_id, answer=answer, vehicles=vehicles)


@router.get("/sessions", response_model=list[ChatSessionSummary])
async def list_chat_sessions(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """The current user's chat sessions, newest first."""
    rows = db.execute(text("""
        SELECT id, title, updated_at FROM gold.chat_sessions
        WHERE user_id = :uid ORDER BY updated_at DESC NULLS LAST
    """), {"uid": user_id}).fetchall()
    return [ChatSessionSummary(id=str(r[0]), title=r[1],
                               updated_at=str(r[2]) if r[2] else None) for r in rows]


@router.get("/sessions/{session_id}", response_model=list[ChatMessageOut])
async def get_chat_session_messages(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Messages of one session (must belong to the user)."""
    if not _owned_session(db, session_id, user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    rows = db.execute(text("""
        SELECT role, content, created_at, vehicles FROM gold.chat_messages
        WHERE session_id = :sid ORDER BY created_at ASC, id ASC
    """), {"sid": session_id}).fetchall()
    out = []
    for r in rows:
        veh = r[3]
        if isinstance(veh, str):
            try:
                veh = json.loads(veh)
            except Exception:
                veh = []
        out.append(ChatMessageOut(role=r[0], content=r[1] or "",
                                  created_at=str(r[2]) if r[2] else None,
                                  vehicles=veh or []))
    return out


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chat_session(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Delete a session + its messages (must belong to the user)."""
    if not _owned_session(db, session_id, user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    db.execute(text("DELETE FROM gold.chat_messages WHERE session_id = :sid"), {"sid": session_id})
    db.execute(text("DELETE FROM gold.chat_sessions WHERE id = :sid AND user_id = :uid"),
               {"sid": session_id, "uid": user_id})
    db.commit()


@router.get("/health")
async def chat_health():
    """Confirms the chatbot resources can initialize."""
    try:
        _resources()
        return {"status": "healthy", "chatbot": "initialized"}
    except Exception as exc:  # noqa: BLE001
        return {"status": "degraded", "error": str(exc)}
