import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, ForeignKey, Text, Integer, BigInteger
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, onupdate=datetime.utcnow)

    documents: Mapped[list["Document"]] = relationship("Document", back_populates="customer")

    # NEW
    analyses: Mapped[list["ProjectAnalysis"]] = relationship("ProjectAnalysis", back_populates="customer")
    questionnaires: Mapped[list["Questionnaire"]] = relationship("Questionnaire", back_populates="customer")
    proposals: Mapped[list["Proposal"]] = relationship("Proposal", back_populates="customer")


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    customer_id: Mapped[str] = mapped_column(String, ForeignKey("customers.id"), nullable=False)
    project_id: Mapped[str | None] = mapped_column(String, nullable=True)  # Optional project association

    document_category: Mapped[str] = mapped_column(String(20), nullable=False, default="project")  # "project" or "customer"
    doc_type: Mapped[str] = mapped_column(String(50), nullable=False)  # meeting_minutes, requirements, email, questionnaire, etc.
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_path: Mapped[str] = mapped_column(String(500), nullable=True)  # Legacy local path (nullable for R2)
    
    # R2 Storage fields
    storage_provider: Mapped[str] = mapped_column(String(20), nullable=False, default="r2")  # "r2" or "local"
    storage_key: Mapped[str | None] = mapped_column(String(500), nullable=True)  # R2 object key (e.g., "customers/123/projects/456/customer-docs/invoice/doc_id_filename.pdf")
    
    # New metadata fields
    file_size: Mapped[int | None] = mapped_column(BigInteger, nullable=True)  # File size in bytes
    mime_type: Mapped[str | None] = mapped_column(String(100), nullable=True)  # MIME type (e.g., "application/pdf")
    page_count: Mapped[int | None] = mapped_column(Integer, nullable=True)  # Page count (for PDFs)
    processing_status: Mapped[str | None] = mapped_column(String(20), nullable=True, default="completed")  # uploading, processing, completed, failed

    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, onupdate=datetime.utcnow)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)  # Soft delete timestamp

    customer: Mapped["Customer"] = relationship("Customer", back_populates="documents")
    text: Mapped["DocumentText"] = relationship("DocumentText", back_populates="document", uselist=False)
    chunks: Mapped[list["Chunk"]] = relationship("Chunk", back_populates="document")


class DocumentText(Base):
    __tablename__ = "document_texts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    document_id: Mapped[str] = mapped_column(String, ForeignKey("documents.id"), nullable=False, unique=True)
    extracted_text: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)  # Summary for meeting minutes (RAG optimization)

    document: Mapped["Document"] = relationship("Document", back_populates="text")


class Chunk(Base):
    __tablename__ = "chunks"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    document_id: Mapped[str] = mapped_column(String, ForeignKey("documents.id"), nullable=False)

    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    chunk_text: Mapped[str] = mapped_column(Text, nullable=False)

    pinecone_vector_id: Mapped[str] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    document: Mapped["Document"] = relationship("Document", back_populates="chunks")

    # NEW (traceability from questions -> chunk)
    sourced_questions: Mapped[list["Question"]] = relationship("Question", back_populates="source_chunk")


# =========================
# NEW TABLES (Step additions)
# =========================

class ProjectAnalysis(Base):
    """
    Stores AI’s breakdown/analysis of requirements for a customer.
    Keep it simple for MVP; you can store constraints as text or JSON string.
    """
    __tablename__ = "project_analysis"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    customer_id: Mapped[str] = mapped_column(String, ForeignKey("customers.id"), nullable=False)

    summary: Mapped[str] = mapped_column(Text, nullable=False)
    detected_constraints: Mapped[str] = mapped_column(Text, nullable=True)  # JSON-like string for MVP
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    customer: Mapped["Customer"] = relationship("Customer", back_populates="analyses")


class Questionnaire(Base):
    __tablename__ = "questionnaires"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    customer_id: Mapped[str] = mapped_column(String, ForeignKey("customers.id"), nullable=False)
    project_id: Mapped[str | None] = mapped_column(String, nullable=True)  # Optional project association

    title: Mapped[str] = mapped_column(String(200), nullable=False, default="Requirements Clarification Questionnaire")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft")  # draft/sent/completed
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    status_updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)  # When status was last updated

    customer: Mapped["Customer"] = relationship("Customer", back_populates="questionnaires")
    questions: Mapped[list["Question"]] = relationship("Question", back_populates="questionnaire")


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    questionnaire_id: Mapped[str] = mapped_column(String, ForeignKey("questionnaires.id"), nullable=False)

    text: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=True)

    # Optional but very useful (even if Pinecone doesn’t store these yet)
    priority: Mapped[str] = mapped_column(String(10), nullable=True)        # high/medium/low
    topic_category: Mapped[str] = mapped_column(String(50), nullable=True)  # Security/Database/Frontend/etc.

    # Traceability back to chunk
    source_chunk_id: Mapped[str] = mapped_column(String, ForeignKey("chunks.id"), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    questionnaire: Mapped["Questionnaire"] = relationship("Questionnaire", back_populates="questions")
    source_chunk: Mapped["Chunk"] = relationship("Chunk", back_populates="sourced_questions")


class Proposal(Base):
    __tablename__ = "proposals"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    customer_id: Mapped[str] = mapped_column(String, ForeignKey("customers.id"), nullable=False)
    project_id: Mapped[str | None] = mapped_column(String, nullable=True)  # Optional project association
    questionnaire_id: Mapped[str | None] = mapped_column(String, ForeignKey("questionnaires.id"), nullable=True)

    content: Mapped[str] = mapped_column(Text, nullable=False)  # store JSON/text blob
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    customer: Mapped["Customer"] = relationship("Customer", back_populates="proposals")
    questionnaire: Mapped["Questionnaire"] = relationship("Questionnaire")


class Resource(Base):
    """Global pool of outsourcing resources"""
    __tablename__ = "resources"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    resource_name: Mapped[str] = mapped_column(String(200), nullable=False)
    company_name: Mapped[str] = mapped_column(String(200), nullable=False)
    total_hours: Mapped[int] = mapped_column(Integer, nullable=False)
    available_hours: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, onupdate=datetime.utcnow)

    assignments: Mapped[list["ProjectResource"]] = relationship(
        "ProjectResource", back_populates="resource", cascade="all, delete-orphan"
    )


class ProjectResource(Base):
    """Stores outsourcing resources associated with projects"""
    __tablename__ = "project_resources"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(String, nullable=False)  # Project ID (from frontend localStorage)
    resource_id: Mapped[str] = mapped_column(String, ForeignKey("resources.id"), nullable=False)
    allocated_hours: Mapped[int] = mapped_column(Integer, nullable=False)
    hours_committed: Mapped[bool] = mapped_column(default=False)  # True when hours are deducted (project in execution)

    # Legacy snapshot fields (kept nullable for backward compatibility)
    resource_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    company_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    availability_hours: Mapped[int | None] = mapped_column(Integer, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, onupdate=datetime.utcnow)

    resource: Mapped["Resource"] = relationship("Resource", back_populates="assignments")


class Task(Base):
    """Stores tasks synced with Notion"""
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(String, nullable=False)  # Project ID (from frontend localStorage)
    
    # Task fields
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="Todo")  # Todo, In Progress, Done, Blocked
    due_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    
    # Notion integration
    notion_page_id: Mapped[str | None] = mapped_column(String(200), nullable=True, unique=True)  # Notion page ID for sync
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, onupdate=datetime.utcnow)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)  # Last sync with Notion


# =========================
# NEW AUDIT & LOGGING TABLES
# =========================

class ChatbotConversation(Base):
    """Stores chatbot conversation history"""
    __tablename__ = "chatbot_conversations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    session_id: Mapped[str | None] = mapped_column(String, nullable=True)  # For grouping conversations
    query: Mapped[str] = mapped_column(Text, nullable=False)  # User's query
    response: Mapped[str] = mapped_column(Text, nullable=False)  # Bot's response
    chunks_found: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # Number of chunks retrieved
    sources_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # Number of source documents
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class DocumentAccessLog(Base):
    """Logs document access (download/view)"""
    __tablename__ = "document_access_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    document_id: Mapped[str] = mapped_column(String, ForeignKey("documents.id"), nullable=False)
    access_type: Mapped[str] = mapped_column(String(20), nullable=False)  # "download" or "view"
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)  # IPv4 or IPv6
    accessed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    document: Mapped["Document"] = relationship("Document")


class QuestionnaireAccessLog(Base):
    """Logs questionnaire PDF downloads"""
    __tablename__ = "questionnaire_access_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    questionnaire_id: Mapped[str] = mapped_column(String, ForeignKey("questionnaires.id"), nullable=False)
    access_type: Mapped[str] = mapped_column(String(20), nullable=False, default="download")
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    accessed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    questionnaire: Mapped["Questionnaire"] = relationship("Questionnaire")


class ProposalAccessLog(Base):
    """Logs proposal PDF downloads"""
    __tablename__ = "proposal_access_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    proposal_id: Mapped[str] = mapped_column(String, ForeignKey("proposals.id"), nullable=False)
    access_type: Mapped[str] = mapped_column(String(20), nullable=False, default="download")
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    accessed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    proposal: Mapped["Proposal"] = relationship("Proposal")


class CustomerActivityLog(Base):
    """Logs customer page views/access"""
    __tablename__ = "customer_activity_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    customer_id: Mapped[str] = mapped_column(String, ForeignKey("customers.id"), nullable=False)
    activity_type: Mapped[str] = mapped_column(String(50), nullable=False, default="view")  # view, edit, etc.
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    accessed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    customer: Mapped["Customer"] = relationship("Customer")
