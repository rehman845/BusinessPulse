from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Query, Request
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
import os

from ..db import get_db
from .. import models, schemas
from ..services.ingest import ingest_document
from ..settings import settings
from ..services.pinecone_client import index as pinecone_index
from ..services.r2_storage import get_r2_storage
from ..services.meeting_summary import generate_meeting_summary

router = APIRouter()


@router.post("/{customer_id}/documents/upload", response_model=schemas.DocumentOut)
def upload_document(
    customer_id: str,
    doc_type: schemas.DocType = Form(...),
    document_category: schemas.DocumentCategory = Form(...),
    file: UploadFile = File(...),
    project_id: str | None = Form(None),
    scope: str | None = Form(None, description="Scope: 'customer-docs' or 'project-docs' (auto-derived from document_category if not provided)"),
    db: Session = Depends(get_db),
):
    customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Validate: project docs must have project_id
    if document_category == "project" and not project_id:
        raise HTTPException(status_code=400, detail="Project documents must have a project_id")
    
    # Validate scope if provided
    if scope and scope not in ["customer-docs", "project-docs"]:
        raise HTTPException(status_code=400, detail="scope must be 'customer-docs' or 'project-docs'")
    
    try:
        doc = ingest_document(
            db=db,
            customer_id=customer_id,
            doc_type=doc_type,
            upload_file=file,
            project_id=project_id,
            document_category=document_category
        )
        return doc
    except Exception as e:
        # Update document status to failed if it exists
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Document upload failed: {str(e)}")


@router.get("/{customer_id}/documents", response_model=List[schemas.DocumentOut])
def list_customer_documents(
    customer_id: str,
    project_id: str | None = Query(None, description="Filter documents by project ID"),
    document_category: str | None = Query(None, description="Filter by document category: 'project' or 'customer'"),
    db: Session = Depends(get_db),
):
    """List all documents for a customer, optionally filtered by project_id and/or document_category. Excludes soft-deleted documents."""
    customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    query = db.query(models.Document).filter(
        models.Document.customer_id == customer_id,
        models.Document.deleted_at.is_(None)  # Exclude soft-deleted documents
    )
    if project_id:
        query = query.filter(models.Document.project_id == project_id)
    if document_category:
        query = query.filter(models.Document.document_category == document_category)
    
    docs = query.all()
    return docs


def _get_document_file(customer_id: str, document_id: str, request: Request, db: Session, access_type: str = "download"):
    """Helper function to get document file - returns document and file info"""
    customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    document = (
        db.query(models.Document)
        .filter(
            models.Document.id == document_id,
            models.Document.customer_id == customer_id,
            models.Document.deleted_at.is_(None)  # Cannot access deleted documents
        )
        .first()
    )
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Log access
    try:
        ip_address = None
        if request and hasattr(request, "client") and request.client:
            ip_address = request.client.host
        access_log = models.DocumentAccessLog(
            document_id=document_id,
            access_type=access_type,
            ip_address=ip_address
        )
        db.add(access_log)
        db.commit()
    except Exception:
        db.rollback()
        pass
    
    # Determine media type based on file extension
    ext = os.path.splitext(document.filename)[1].lower()
    media_types = {
        '.pdf': 'application/pdf',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.doc': 'application/msword',
        '.txt': 'text/plain',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.xls': 'application/vnd.ms-excel',
    }
    media_type = media_types.get(ext, document.mime_type or 'application/octet-stream')
    
    return document, media_type


@router.get("/{customer_id}/documents/{document_id}/view")
def view_document(
    customer_id: str,
    document_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """View the document inline in browser (for PDFs and DOCX)"""
    document, media_type = _get_document_file(customer_id, document_id, request, db, access_type="view")
    
    # If R2 storage, redirect to signed URL
    if document.storage_provider == "r2" and document.storage_key:
        try:
            r2 = get_r2_storage()
            if r2._is_configured():
                signed_url = r2.generate_presigned_get_url(document.storage_key)
                return RedirectResponse(url=signed_url)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to generate download URL: {str(e)}")
    
    # Fallback to local file
    file_path = document.storage_path
    if not file_path or not os.path.exists(file_path):
        # Try to resolve path
        if not os.path.isabs(file_path):
            if file_path.startswith("app/"):
                file_path = os.path.join("/app", file_path)
            else:
                file_path = os.path.join("/app", file_path)
    
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {document.storage_path}")
    
    headers = {
        "Content-Disposition": f'inline; filename="{document.filename}"'
    }
    
    return FileResponse(
        path=file_path,
        media_type=media_type,
        headers=headers,
    )


@router.get("/{customer_id}/documents/{document_id}/download")
def download_document(
    customer_id: str,
    document_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """Download the original uploaded document file"""
    document, media_type = _get_document_file(customer_id, document_id, request, db, access_type="download")
    
    # If R2 storage, redirect to signed URL
    if document.storage_provider == "r2" and document.storage_key:
        try:
            r2 = get_r2_storage()
            if r2._is_configured():
                signed_url = r2.generate_presigned_get_url(document.storage_key)
                return RedirectResponse(url=signed_url)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to generate download URL: {str(e)}")
    
    # Fallback to local file
    file_path = document.storage_path
    if not file_path or not os.path.exists(file_path):
        # Try to resolve path
        if not os.path.isabs(file_path):
            if file_path.startswith("app/"):
                file_path = os.path.join("/app", file_path)
            else:
                file_path = os.path.join("/app", file_path)
    
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {document.storage_path}")
    
    headers = {
        "Content-Disposition": f'attachment; filename="{document.filename}"'
    }
    
    return FileResponse(
        path=file_path,
        media_type=media_type,
        headers=headers,
    )


@router.put("/{customer_id}/documents/{document_id}", response_model=schemas.DocumentOut)
def update_document(
    customer_id: str,
    document_id: str,
    payload: schemas.DocumentUpdate,
    db: Session = Depends(get_db),
):
    """Update document metadata"""
    customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    document = (
        db.query(models.Document)
        .filter(
            models.Document.id == document_id,
            models.Document.customer_id == customer_id,
            models.Document.deleted_at.is_(None)  # Cannot update deleted documents
        )
        .first()
    )
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Update fields
    if payload.doc_type is not None:
        document.doc_type = payload.doc_type
    if payload.filename is not None:
        document.filename = payload.filename
    if payload.project_id is not None:
        document.project_id = payload.project_id
    
    document.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(document)
    
    return document




@router.post("/{customer_id}/documents/{document_id}/reindex")
def reindex_document(
    customer_id: str,
    document_id: str,
    db: Session = Depends(get_db),
):
    """Re-index a document into Pinecone (useful if document wasn't properly indexed)"""
    customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    document = (
        db.query(models.Document)
        .filter(
            models.Document.id == document_id,
            models.Document.customer_id == customer_id,
            models.Document.deleted_at.is_(None)
        )
        .first()
    )
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # For proposals, skip file check and use content from database
    # For other documents, check if file exists
    file_path = None
    if document.doc_type == "proposal":
        # Proposals can be indexed from database content, skip file check
        pass
    else:
        file_path = document.storage_path
        if not os.path.isabs(file_path):
            # storage_path is stored as "app/storage/uploads/..."
            # Docker WORKDIR is /app, so files are at /app/app/storage/uploads/...
            # But check both possible locations
            if file_path.startswith("app/"):
                # Try /app/app/storage/... first (if UPLOAD_DIR = "app/storage/uploads")
                alt_path = os.path.join("/app", file_path)
                if os.path.exists(alt_path):
                    file_path = alt_path
                else:
                    # Try /app/storage/... (if stored differently)
                    file_path = os.path.join("/app", file_path)
            else:
                file_path = os.path.join("/app", file_path)
        
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail=f"File not found on server: {file_path}")
    
    # Delete existing chunks and vectors
    existing_chunks = db.query(models.Chunk).filter(models.Chunk.document_id == document_id).all()
    namespace = (settings.PINECONE_NAMESPACE or "").strip()
    vector_ids = [chunk.pinecone_vector_id for chunk in existing_chunks if chunk.pinecone_vector_id]
    
    if vector_ids:
        try:
            pinecone_index.delete(ids=vector_ids, namespace=namespace if namespace else None)
        except Exception as e:
            print(f"Warning: Failed to delete existing vectors: {e}")
    
    # Delete existing chunks from DB
    for chunk in existing_chunks:
        db.delete(chunk)
    db.commit()
    
    # Re-extract text and re-index
    from ..services.ingest import _extract_text, chunk_text
    from ..services.embeddings import embed_text
    import json
    
    # Special handling for proposals - use proposal content from database
    extracted = None
    page_count = None
    
    if document.doc_type == "proposal":
        # Try to get proposal content from proposals table
        proposal = db.query(models.Proposal).filter(
            models.Proposal.customer_id == customer_id
        ).order_by(models.Proposal.created_at.desc()).first()
        
        if proposal:
            try:
                proposal_data = json.loads(proposal.content)
                # Convert proposal JSON to readable text format
                text_parts = []
                if isinstance(proposal_data, dict):
                    for key, value in proposal_data.items():
                        if isinstance(value, (dict, list)):
                            text_parts.append(f"{key}:\n{json.dumps(value, indent=2)}")
                        else:
                            text_parts.append(f"{key}: {value}")
                    extracted = "\n\n".join(text_parts)
                else:
                    extracted = json.dumps(proposal_data, indent=2)
                page_count = 1  # Estimate
            except Exception as e:
                import sys
                sys.stderr.write(f"Warning: Failed to parse proposal content: {e}\n")
    
    # If we don't have extracted text yet, try to extract from file
    if not extracted:
        if file_path and os.path.exists(file_path):
            extracted, page_count = _extract_text(file_path)
        
        if not extracted:
            extracted = "(No text extracted from this file. Try a .txt/.docx/.pdf with selectable text.)"
    
    # Update document text
    doc_text = db.query(models.DocumentText).filter(models.DocumentText.document_id == document_id).first()
    
    # Generate summary for meeting minutes if needed
    summary = None
    if document.doc_type == "meeting_minutes" and len(extracted.strip()) > 200:
        try:
            summary = generate_meeting_summary(extracted)
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"Generated summary for meeting minutes document {document_id}")
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to generate meeting summary: {e}")
            summary = None
    
    if doc_text:
        doc_text.extracted_text = extracted
        if summary:
            doc_text.summary = summary
    else:
        doc_text = models.DocumentText(
            document_id=document_id,
            extracted_text=extracted,
            summary=summary
        )
        db.add(doc_text)
    
    document.page_count = page_count
    document.processing_status = "processing"
    db.commit()
    
    # Only index project documents in Pinecone (skip customer documents)
    if document.document_category == "project":
        # For meeting minutes, use summary instead of full text for RAG indexing
        text_to_index = summary if (document.doc_type == "meeting_minutes" and summary) else extracted
        
        # Chunk and index
        chunks = chunk_text(text_to_index, chunk_size=900, overlap=150)
        
        for i, ch in enumerate(chunks):
            vector = embed_text(ch)
            vector_id = f"{document.id}_{i}"
            
            metadata = {
                "customer_id": customer_id,
                "document_id": document.id,
                "chunk_index": i,
                "doc_type": document.doc_type,
                "document_category": "project",  # Always "project" for indexed documents
                "uploaded_at": document.uploaded_at.isoformat(),
                "text": ch,
            }
            
            # Add enriched metadata
            if customer:
                if customer.name:
                    metadata["customer_name"] = customer.name
            if document.filename:
                metadata["document_filename"] = document.filename
            
            if document.project_id is not None:
                metadata["project_id"] = document.project_id
            
            pinecone_index.upsert(
                vectors=[{"id": vector_id, "values": vector, "metadata": metadata}],
                namespace=namespace if namespace else None,
            )
            
            chunk_row = models.Chunk(
                document_id=document.id,
                chunk_index=i,
                chunk_text=ch,
                pinecone_vector_id=vector_id,
            )
            db.add(chunk_row)
    else:
        # Customer documents are not indexed in Pinecone
        pass
    
    document.processing_status = "completed"
    db.commit()
    
    return {"reindexed": True, "document_id": document_id, "chunks_created": len(chunks)}


@router.get("/documents/{document_id}/download-url")
def get_document_download_url(
    document_id: str,
    db: Session = Depends(get_db),
):
    """Get a presigned download URL for a document (R2 only)"""
    document = (
        db.query(models.Document)
        .filter(
            models.Document.id == document_id,
            models.Document.deleted_at.is_(None)
        )
        .first()
    )
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if document.storage_provider != "r2" or not document.storage_key:
        raise HTTPException(status_code=400, detail="Document is not stored in R2")
    
    try:
        r2 = get_r2_storage()
        if not r2._is_configured():
            raise HTTPException(status_code=500, detail="R2 storage is not configured")
        
        signed_url = r2.generate_presigned_get_url(document.storage_key)
        return {"download_url": signed_url, "expires_in_seconds": r2.signed_url_expires}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate download URL: {str(e)}")


@router.delete("/{customer_id}/documents/{document_id}")
def delete_document(
    customer_id: str,
    document_id: str,
    db: Session = Depends(get_db),
):
    """Soft delete a document (marks as deleted, removes from Pinecone and R2, but keeps DB record)"""
    customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    document = (
        db.query(models.Document)
        .filter(
            models.Document.id == document_id,
            models.Document.customer_id == customer_id,
            models.Document.deleted_at.is_(None)  # Cannot delete already deleted documents
        )
        .first()
    )
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Delete from R2 if stored there
    if document.storage_provider == "r2" and document.storage_key:
        try:
            r2 = get_r2_storage()
            if r2._is_configured():
                r2.delete_key(document.storage_key)
        except Exception as e:
            # Log but continue
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to delete from R2: {e}")
    
    # Get all chunks for this document
    chunks = db.query(models.Chunk).filter(models.Chunk.document_id == document_id).all()
    
    # Delete vectors from Pinecone
    namespace = (settings.PINECONE_NAMESPACE or "").strip()
    vector_ids = [chunk.pinecone_vector_id for chunk in chunks if chunk.pinecone_vector_id]
    
    if vector_ids:
        try:
            pinecone_index.delete(ids=vector_ids, namespace=namespace if namespace else None)
        except Exception as e:
            # Log error but continue with soft delete
            print(f"Warning: Failed to delete vectors from Pinecone: {e}")
    
    # Soft delete: set deleted_at timestamp
    document.deleted_at = datetime.utcnow()
    db.commit()
    
    return {"deleted": True, "document_id": document_id}


@router.delete("/{customer_id}/projects/{project_id}/documents")
def bulk_delete_documents(
    customer_id: str,
    project_id: str,
    scope: str | None = Query(None, description="Scope: 'customer-docs' or 'project-docs'"),
    doc_type: str | None = Query(None, description="Document type folder name"),
    db: Session = Depends(get_db),
):
    """Bulk delete documents by prefix (deletes from R2 and marks DB as deleted)"""
    customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Build prefix for R2 deletion
    from ..services.storage_utils import DOC_TYPE_TO_FOLDER
    
    if scope:
        if scope not in ["customer-docs", "project-docs"]:
            raise HTTPException(status_code=400, detail="scope must be 'customer-docs' or 'project-docs'")
    else:
        # Default to project-docs if not specified
        scope = "project-docs"
    
    prefix_parts = [f"customers/{customer_id}/projects/{project_id}/{scope}"]
    
    if doc_type:
        folder_name = DOC_TYPE_TO_FOLDER.get(doc_type, doc_type.replace("_", "-"))
        prefix_parts.append(folder_name)
    
    prefix = "/".join(prefix_parts) + "/"
    
    # Delete from R2
    deleted_from_r2 = 0
    try:
        r2 = get_r2_storage()
        if r2._is_configured():
            deleted_from_r2 = r2.delete_by_prefix(prefix)
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"Failed to bulk delete from R2: {e}")
    
    # Mark documents as deleted in DB
    query = db.query(models.Document).filter(
        models.Document.customer_id == customer_id,
        models.Document.project_id == project_id,
        models.Document.deleted_at.is_(None)
    )
    
    # Filter by scope (document_category)
    if scope == "customer-docs":
        query = query.filter(models.Document.document_category == "customer")
    else:
        query = query.filter(models.Document.document_category == "project")
    
    # Filter by doc_type if provided
    if doc_type:
        query = query.filter(models.Document.doc_type == doc_type)
    
    documents = query.all()
    deleted_count = len(documents)
    
    # Soft delete all matching documents
    for doc in documents:
        doc.deleted_at = datetime.utcnow()
    
    # Also delete chunks and vectors
    document_ids = [doc.id for doc in documents]
    if document_ids:
        chunks = db.query(models.Chunk).filter(models.Chunk.document_id.in_(document_ids)).all()
        vector_ids = [chunk.pinecone_vector_id for chunk in chunks if chunk.pinecone_vector_id]
        
        if vector_ids:
            namespace = (settings.PINECONE_NAMESPACE or "").strip()
            try:
                pinecone_index.delete(ids=vector_ids, namespace=namespace if namespace else None)
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"Failed to delete vectors: {e}")
    
    db.commit()
    
    return {
        "deleted": True,
        "documents_deleted": deleted_count,
        "r2_objects_deleted": deleted_from_r2,
        "prefix": prefix
    }