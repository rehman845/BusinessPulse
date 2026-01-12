from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional
from datetime import datetime
from ..services.chatbot_rag import chatbot_query
from ..db import get_db
from .. import models
import uuid

router = APIRouter()


class ChatbotRequest(BaseModel):
    query: str
    top_k: int = 20  # Number of chunks to retrieve
    min_score: float = 0.3  # Low confidence threshold


class ChatbotResponse(BaseModel):
    response: str
    sources: list[dict]
    chunks_found: int
    session_id: str | None = None


class ChatMessage(BaseModel):
    id: str
    query: str
    response: str
    created_at: datetime
    chunks_found: int
    sources_count: int


class ChatSession(BaseModel):
    session_id: str
    first_query: str
    last_message_at: datetime
    message_count: int


@router.post("/chat", response_model=ChatbotResponse)
def chat(request: ChatbotRequest, db: Session = Depends(get_db), session_id: str | None = Query(None)):
    """
    Chatbot endpoint that uses RAG to search across ALL customer documents.
    Low confidence threshold (min_score=0.3) ensures more results are returned.
    Optionally accepts session_id to group conversations.
    """
    try:
        result = chatbot_query(
            user_query=request.query,
            top_k=request.top_k,
            min_score=request.min_score,
            db_session=db,
        )
        
        # Generate session_id if not provided
        if not session_id:
            session_id = str(uuid.uuid4())
        
        # Save conversation to database
        try:
            conversation = models.ChatbotConversation(
                session_id=session_id,
                query=request.query,
                response=result["response"],
                chunks_found=result["chunks_found"],
                sources_count=len(result["sources"]),
            )
            db.add(conversation)
            db.commit()
        except Exception:
            # Don't fail the request if logging fails
            db.rollback()
            pass
        
        return ChatbotResponse(
            response=result["response"],
            sources=result["sources"],
            chunks_found=result["chunks_found"],
            session_id=session_id,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chatbot error: {str(e)}")


@router.get("/chat/sessions", response_model=List[ChatSession])
def list_chat_sessions(db: Session = Depends(get_db), limit: int = Query(50, ge=1, le=100)):
    """
    List all chat sessions with their metadata.
    Returns sessions ordered by most recent message first.
    """
    try:
        # Group conversations by session_id and get metadata
        sessions_query = (
            db.query(
                models.ChatbotConversation.session_id,
                func.min(models.ChatbotConversation.query).label("first_query"),
                func.max(models.ChatbotConversation.created_at).label("last_message_at"),
                func.count(models.ChatbotConversation.id).label("message_count")
            )
            .filter(models.ChatbotConversation.session_id.isnot(None))
            .group_by(models.ChatbotConversation.session_id)
            .order_by(desc("last_message_at"))
            .limit(limit)
        )
        
        sessions = sessions_query.all()
        
        return [
            ChatSession(
                session_id=session.session_id,
                first_query=session.first_query[:100] + "..." if len(session.first_query) > 100 else session.first_query,
                last_message_at=session.last_message_at,
                message_count=session.message_count
            )
            for session in sessions
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching chat sessions: {str(e)}")


@router.get("/chat/sessions/{session_id}/messages", response_model=List[ChatMessage])
def get_chat_history(session_id: str, db: Session = Depends(get_db)):
    """
    Get all messages for a specific chat session.
    Returns messages ordered by creation time (oldest first).
    """
    try:
        conversations = (
            db.query(models.ChatbotConversation)
            .filter(models.ChatbotConversation.session_id == session_id)
            .order_by(models.ChatbotConversation.created_at)
            .all()
        )
        
        return [
            ChatMessage(
                id=conv.id,
                query=conv.query,
                response=conv.response,
                created_at=conv.created_at,
                chunks_found=conv.chunks_found,
                sources_count=conv.sources_count
            )
            for conv in conversations
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching chat history: {str(e)}")


@router.delete("/chat/sessions/{session_id}")
def delete_chat_session(session_id: str, db: Session = Depends(get_db)):
    """
    Delete a chat session and all its messages.
    """
    try:
        # Delete all conversations with this session_id
        deleted_count = (
            db.query(models.ChatbotConversation)
            .filter(models.ChatbotConversation.session_id == session_id)
            .delete()
        )
        
        db.commit()
        
        return {"message": f"Deleted chat session with {deleted_count} messages", "deleted_count": deleted_count}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting chat session: {str(e)}")
