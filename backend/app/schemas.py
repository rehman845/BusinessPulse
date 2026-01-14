from pydantic import BaseModel, Field
from typing import Literal, List, Optional
from datetime import datetime


# Document categories
DocumentCategory = Literal["project", "customer"]

# Project document types
ProjectDocType = Literal[
    "meeting_minutes",
    "requirements",
    "questionnaire",
    "questionnaire_response",
    "proposal",
    "design_sdd",  # System Design Document
    "kickoff_meeting",
    "instruction_manual",
    "maintenance_doc"
]

# Customer document types
CustomerDocType = Literal[
    "invoice",
    "payment_doc",
    "nda",
    "contract",
    "correspondence",
    "other"
]

# Combined doc type (for backward compatibility and general use)
DocType = Literal[
    "meeting_minutes",
    "requirements",
    "email",  # Legacy, can be mapped to correspondence
    "questionnaire",
    "questionnaire_response",
    "proposal",
    "design_sdd",
    "kickoff_meeting",
    "instruction_manual",
    "maintenance_doc",
    "invoice",
    "payment_doc",
    "nda",
    "contract",
    "correspondence",
    "other"
]


class CustomerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class CustomerUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class CustomerOut(BaseModel):
    id: str
    name: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DocumentUpdate(BaseModel):
    doc_type: Optional[DocType] = None
    filename: Optional[str] = Field(None, max_length=255)
    project_id: Optional[str] = None
    document_category: Optional[DocumentCategory] = None


class DocumentOut(BaseModel):
    id: str
    customer_id: str
    project_id: Optional[str] = None
    document_category: str
    doc_type: str
    filename: str
    storage_path: Optional[str] = None  # Legacy, nullable for R2
    storage_provider: str = "r2"
    storage_key: Optional[str] = None  # R2 object key
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    page_count: Optional[int] = None
    processing_status: Optional[str] = None
    uploaded_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class QuestionnaireQuestion(BaseModel):
    q: str
    why: str
    priority: Literal["high", "medium", "low"] = "medium"


class QuestionnaireSection(BaseModel):
    title: str
    questions: List[QuestionnaireQuestion]


class QuestionnaireOut(BaseModel):
    customer_id: str
    sections: List[QuestionnaireSection]
    notes: Optional[str] = None


class QuestionAnswer(BaseModel):
    question_id: str
    answer: str


class ProposalOut(BaseModel):
    id: str
    customer_id: str
    questionnaire_id: Optional[str] = None
    content: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# Project Resource Schemas
class ResourceBase(BaseModel):
    resource_name: str = Field(min_length=1, max_length=200)
    company_name: str = Field(min_length=1, max_length=200)
    total_hours: int = Field(gt=0)


class ResourceCreate(ResourceBase):
    pass


class ResourceUpdate(BaseModel):
    resource_name: Optional[str] = Field(None, min_length=1, max_length=200)
    company_name: Optional[str] = Field(None, min_length=1, max_length=200)
    total_hours: Optional[int] = Field(None, gt=0)
    available_hours: Optional[int] = Field(None, ge=0)


class ResourceOut(BaseModel):
    id: str
    resource_name: str
    company_name: str
    total_hours: int
    available_hours: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProjectResourceCreate(BaseModel):
    project_id: str
    resource_id: str
    allocated_hours: int = Field(gt=0)


class ProjectResourceUpdate(BaseModel):
    resource_id: Optional[str] = None
    allocated_hours: Optional[int] = Field(None, gt=0)


class ProjectResourceOut(BaseModel):
    id: str
    project_id: str
    resource_id: str
    allocated_hours: int
    hours_committed: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    resource: Optional[ResourceOut] = None

    class Config:
        from_attributes = True


# Task Schemas
class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    description: Optional[str] = None
    status: str = Field(default="Todo")  # Todo, In Progress, Done, Blocked
    due_date: Optional[datetime] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = None
    due_date: Optional[datetime] = None


class TaskStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(Todo|In Progress|Done|Blocked)$")


class TaskOut(BaseModel):
    id: str
    project_id: str
    title: str
    description: Optional[str] = None
    status: str
    due_date: Optional[datetime] = None
    notion_page_id: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    last_synced_at: Optional[datetime] = None

    class Config:
        from_attributes = True