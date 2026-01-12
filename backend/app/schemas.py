from pydantic import BaseModel, Field
from typing import Literal, List, Optional
from datetime import datetime


DocType = Literal["meeting_minutes", "requirements", "email", "questionnaire", "questionnaire_response", "proposal"]


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


class DocumentOut(BaseModel):
    id: str
    customer_id: str
    project_id: Optional[str] = None
    doc_type: str
    filename: str
    storage_path: str
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