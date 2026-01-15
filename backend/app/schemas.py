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
    email: Optional[str] = Field(None, max_length=200)
    company_name: Optional[str] = Field(None, max_length=200)


class CustomerUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    email: Optional[str] = Field(None, max_length=200)
    company_name: Optional[str] = Field(None, max_length=200)


class CustomerOut(BaseModel):
    id: str
    name: str
    email: Optional[str] = None
    company_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


ProjectStatus = Literal["planning", "execution", "on_hold", "completed", "cancelled"]


class ProjectCreate(BaseModel):
    project_number: str = Field(min_length=1, max_length=50)
    project_name: str = Field(min_length=1, max_length=200)
    customer_id: str
    customer_name: str = Field(default="", max_length=200)
    email: str = Field(default="", max_length=200)
    status: ProjectStatus = "planning"
    start_date: datetime
    end_date: Optional[datetime] = None
    budget: Optional[float] = Field(None, ge=0)
    description: Optional[str] = None
    assigned_to: Optional[str] = Field(None, max_length=500)


class ProjectUpdate(BaseModel):
    project_number: Optional[str] = Field(None, min_length=1, max_length=50)
    project_name: Optional[str] = Field(None, min_length=1, max_length=200)
    customer_id: Optional[str] = None
    customer_name: Optional[str] = Field(None, max_length=200)
    email: Optional[str] = Field(None, max_length=200)
    status: Optional[ProjectStatus] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    budget: Optional[float] = Field(None, ge=0)
    description: Optional[str] = None
    assigned_to: Optional[str] = Field(None, max_length=500)


class ProjectOut(BaseModel):
    id: str
    project_number: str
    project_name: str
    customer_id: str
    customer_name: str
    email: str
    status: str
    start_date: datetime
    end_date: Optional[datetime] = None
    budget: Optional[float] = None
    description: Optional[str] = None
    assigned_to: Optional[str] = None
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


# =========================
# Billing / Team / Invoicing
# =========================

class EmployeeCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=200)
    role: str = Field(default="Employee", max_length=120)
    hourly_rate: float = Field(ge=0)
    hours_per_day: float = Field(default=8.0, ge=0, le=24)
    days_per_week: float = Field(default=5.0, ge=0, le=7)
    is_active: bool = True


class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=200)
    role: Optional[str] = Field(None, max_length=120)
    hourly_rate: Optional[float] = Field(None, ge=0)
    hours_per_day: Optional[float] = Field(None, ge=0, le=24)
    days_per_week: Optional[float] = Field(None, ge=0, le=7)
    is_active: Optional[bool] = None


class EmployeeOut(BaseModel):
    id: str
    full_name: str
    role: str
    hourly_rate: float
    hours_per_day: float
    days_per_week: float
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TimeEntryCreate(BaseModel):
    employee_id: str
    project_id: str = Field(min_length=1, max_length=120)
    work_date: Optional[datetime] = None
    hours: float = Field(ge=0)
    description: Optional[str] = None


class TimeEntryOut(BaseModel):
    id: str
    employee_id: str
    project_id: str
    work_date: Optional[datetime] = None
    hours: float
    description: Optional[str] = None
    created_at: Optional[datetime] = None
    employee: Optional[EmployeeOut] = None

    class Config:
        from_attributes = True


class ProjectEmployeeCreate(BaseModel):
    project_id: str
    employee_id: str


class ProjectEmployeeOut(BaseModel):
    id: str
    project_id: str
    employee_id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    employee: Optional[EmployeeOut] = None

    class Config:
        from_attributes = True


class BillingExpenseCreate(BaseModel):
    expense_type: str = Field(default="subscription", max_length=40)
    vendor_name: str = Field(default="", max_length=200)
    description: str = Field(default="")
    amount: float = Field(ge=0)
    currency: str = Field(default="USD", max_length=10)
    frequency: str = Field(default="one_time", max_length=20)  # one_time/monthly/yearly
    due_date: Optional[datetime] = None
    paid_date: Optional[datetime] = None
    project_id: Optional[str] = Field(default=None, max_length=120)


class BillingExpenseUpdate(BaseModel):
    expense_type: Optional[str] = Field(None, max_length=40)
    vendor_name: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    amount: Optional[float] = Field(None, ge=0)
    currency: Optional[str] = Field(None, max_length=10)
    frequency: Optional[str] = Field(None, max_length=20)
    due_date: Optional[datetime] = None
    paid_date: Optional[datetime] = None
    project_id: Optional[str] = Field(default=None, max_length=120)


class BillingExpenseOut(BaseModel):
    id: str
    expense_type: str
    vendor_name: str
    description: str
    amount: float
    currency: str
    frequency: str
    due_date: Optional[datetime] = None
    paid_date: Optional[datetime] = None
    project_id: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


InvoiceStatus = Literal["draft", "sent", "paid", "overdue", "cancelled"]
InvoiceLineCategory = Literal["labor", "subscription", "vendor", "other"]


class InvoiceLineItemCreate(BaseModel):
    category: InvoiceLineCategory = "other"
    description: str = Field(min_length=1)
    quantity: float = Field(gt=0)
    unit_price: float = Field(ge=0)


class InvoiceLineItemOut(BaseModel):
    id: str
    category: str
    description: str
    quantity: float
    unit_price: float
    total: float

    class Config:
        from_attributes = True


class InvoiceCreate(BaseModel):
    invoice_number: str = Field(min_length=1, max_length=50)
    customer_id: Optional[str] = None
    customer_name: str = Field(default="", max_length=200)
    customer_email: str = Field(default="", max_length=200)
    project_id: Optional[str] = Field(default=None, max_length=120)
    project_name: Optional[str] = Field(default=None, max_length=200)
    status: InvoiceStatus = "draft"
    issue_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    notes: Optional[str] = None
    tax: float = Field(default=0, ge=0)
    line_items: List[InvoiceLineItemCreate] = Field(default_factory=list)


class InvoiceUpdate(BaseModel):
    status: Optional[InvoiceStatus] = None
    due_date: Optional[datetime] = None
    paid_date: Optional[datetime] = None
    notes: Optional[str] = None


class InvoiceOut(BaseModel):
    id: str
    invoice_number: str
    customer_id: Optional[str] = None
    customer_name: str
    customer_email: str
    project_id: Optional[str] = None
    project_name: Optional[str] = None
    status: str
    issue_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    paid_date: Optional[datetime] = None
    subtotal: float
    tax: float
    total: float
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    line_items: List[InvoiceLineItemOut] = []

    class Config:
        from_attributes = True


class InvoiceGenerateRequest(BaseModel):
    project_id: str = Field(min_length=1, max_length=120)
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    project_name: Optional[str] = None
    from_date: Optional[datetime] = None
    to_date: Optional[datetime] = None
    tax_rate: float = Field(default=0, ge=0)  # e.g. 0.13
    include_project_expenses: bool = True
    include_time_entries: bool = True
    invoice_number: Optional[str] = None