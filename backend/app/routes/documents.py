from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Query, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
import os

from ..db import get_db
from .. import models, schemas
from ..services.ingest import ingest_document
from ..settings import settings
from ..services.pinecone_client import index as pinecone_index

router = APIRouter()


@router.post("/{customer_id}/documents/upload", response_model=schemas.DocumentOut)
def upload_document(
    customer_id: str,
    doc_type: schemas.DocType = Form(...),
    file: UploadFile = File(...),
    project_id: str | None = Form(None),
    db: Session = Depends(get_db),
):
    customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    try:
        doc = ingest_document(db=db, customer_id=customer_id, doc_type=doc_type, upload_file=file, project_id=project_id)
        return doc
    except Exception as e:
        # Update document status to failed if it exists
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Document upload failed: {str(e)}")


@router.get("/{customer_id}/documents", response_model=List[schemas.DocumentOut])
def list_customer_documents(
    customer_id: str,
    project_id: str | None = Query(None, description="Filter documents by project ID"),
    db: Session = Depends(get_db),
):
    """List all documents for a customer, optionally filtered by project_id. Excludes soft-deleted documents."""
    customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    query = db.query(models.Document).filter(
        models.Document.customer_id == customer_id,
        models.Document.deleted_at.is_(None)  # Exclude soft-deleted documents
    )
    if project_id:
        query = query.filter(models.Document.project_id == project_id)
    
    docs = query.all()
    return docs


def _get_document_file(customer_id: str, document_id: str, request: Request, db: Session, access_type: str = "download"):
    """Helper function to get document file with proper path resolution"""
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
    
    # Check if file exists (convert relative path to absolute if needed)
    file_path = document.storage_path
    
    # Try multiple possible locations
    possible_paths = []
    
    if os.path.isabs(file_path):
        # If absolute path, try as-is
        possible_paths.append(file_path)
    else:
        # storage_path is stored as "app/storage/uploads/{customer_id}/{filename}"
        # Docker WORKDIR is /app, so files are at /app/app/storage/uploads/{customer_id}/{filename}
        
        # Try /app/app/storage/uploads/... first (if UPLOAD_DIR = "app/storage/uploads")
        if file_path.startswith("app/"):
            possible_paths.append(os.path.join("/app", file_path))
            # Also try without the leading "app/"
            possible_paths.append(os.path.join("/app", file_path[4:]))  # Remove "app/"
        else:
            # Try /app/{path}
            possible_paths.append(os.path.join("/app", file_path))
            # Also try /app/app/storage/uploads/{path} if it looks like a storage path
            if "storage" in file_path or "uploads" in file_path:
                possible_paths.append(os.path.join("/app", "app", file_path))
    
    # Find the first path that exists
    file_path = None
    for path in possible_paths:
        if os.path.exists(path):
            file_path = path
            break
    
    if not file_path or not os.path.exists(file_path):
        # Return helpful error with all attempted paths
        attempted = ", ".join(possible_paths[:3])  # Show first 3 attempts
        raise HTTPException(
            status_code=404, 
            detail=f"File not found on server. Attempted paths: {attempted}. Original storage_path: {document.storage_path}"
        )
    
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
    media_type = media_types.get(ext, 'application/octet-stream')
    
    return document, file_path, media_type


@router.get("/{customer_id}/documents/{document_id}/view")
def view_document(
    customer_id: str,
    document_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """View the document inline in browser (for PDFs and DOCX)"""
    document, file_path, media_type = _get_document_file(customer_id, document_id, request, db, access_type="view")
    
    # Use inline disposition for viewing in browser
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
    document, file_path, media_type = _get_document_file(customer_id, document_id, request, db, access_type="download")
    
    # Use attachment disposition for downloading
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
    if doc_text:
        doc_text.extracted_text = extracted
    else:
        doc_text = models.DocumentText(document_id=document_id, extracted_text=extracted)
        db.add(doc_text)
    
    document.page_count = page_count
    document.processing_status = "processing"
    db.commit()
    
    # Chunk and index
    chunks = chunk_text(extracted, chunk_size=900, overlap=150)
    
    for i, ch in enumerate(chunks):
        vector = embed_text(ch)
        vector_id = f"{document.id}_{i}"
        
        metadata = {
            "customer_id": customer_id,
            "document_id": document.id,
            "chunk_index": i,
            "doc_type": document.doc_type,
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
    
    document.processing_status = "completed"
    db.commit()
    
    return {"reindexed": True, "document_id": document_id, "chunks_created": len(chunks)}


@router.delete("/{customer_id}/documents/{document_id}")
def delete_document(
    customer_id: str,
    document_id: str,
    db: Session = Depends(get_db),
):
    """Soft delete a document (marks as deleted, removes from Pinecone, but keeps file and DB record)"""
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