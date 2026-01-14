"""
Storage utility functions for generating R2 keys and handling file operations
"""
import re
from pathlib import Path
from typing import Optional


# Document type mappings to folder names
DOC_TYPE_TO_FOLDER = {
    # Customer docs
    "invoice": "invoice",
    "payment_doc": "payment-docs",
    "nda": "nda",
    "contract": "contract",
    "correspondence": "correspondence",
    "other": "other",
    # Project docs
    "meeting_minutes": "meeting-minutes",
    "requirements": "requirements",
    "questionnaire": "questionnaire",
    "questionnaire_response": "questionnaire-response",
    "proposal": "proposal",
    "design_sdd": "design-sdd",
    "instruction_manual": "instructions",
    "maintenance_doc": "maintenance-manual",
    # Legacy mappings
    "email": "correspondence",
}


def sanitize_filename(filename: str) -> str:
    """
    Sanitize filename for use in R2 keys
    Removes or replaces unsafe characters
    """
    # Remove path components
    filename = Path(filename).name
    
    # Replace unsafe characters with underscores
    # Keep alphanumeric, dots, hyphens, underscores
    sanitized = re.sub(r'[^a-zA-Z0-9._-]', '_', filename)
    
    # Remove multiple consecutive underscores
    sanitized = re.sub(r'_+', '_', sanitized)
    
    # Remove leading/trailing underscores and dots
    sanitized = sanitized.strip('._')
    
    return sanitized or "file"


def generate_storage_key(
    customer_id: str,
    project_id: Optional[str],
    scope: str,  # "customer-docs" or "project-docs"
    doc_type: str,
    document_id: str,
    filename: str
) -> str:
    """
    Generate R2 storage key following the required hierarchy:
    customers/{customer_id}/projects/{project_id}/{scope}/{doc_type}/{document_id}_{safeFilename}
    
    Args:
        customer_id: Customer ID
        project_id: Project ID (can be None for customer docs)
        scope: "customer-docs" or "project-docs"
        doc_type: Document type (will be mapped to folder name)
        document_id: Document ID
        filename: Original filename
        
    Returns:
        R2 storage key (object key)
    """
    # Map doc_type to folder name
    folder_name = DOC_TYPE_TO_FOLDER.get(doc_type, doc_type.replace("_", "-"))
    
    # Sanitize filename
    safe_filename = sanitize_filename(filename)
    
    # Build key
    if project_id:
        key = f"customers/{customer_id}/projects/{project_id}/{scope}/{folder_name}/{document_id}_{safe_filename}"
    else:
        # For customer docs without project, use a default project path or just customer
        # Using "no-project" as placeholder
        key = f"customers/{customer_id}/projects/no-project/{scope}/{folder_name}/{document_id}_{safe_filename}"
    
    return key


def get_scope_from_category(document_category: str) -> str:
    """
    Convert document_category to scope
    "customer" -> "customer-docs"
    "project" -> "project-docs"
    """
    if document_category == "customer":
        return "customer-docs"
    elif document_category == "project":
        return "project-docs"
    else:
        # Default to project-docs for backward compatibility
        return "project-docs"

