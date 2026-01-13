import os
import mimetypes
from pathlib import Path
from fastapi import UploadFile
from sqlalchemy.orm import Session

from docx import Document as DocxDocument
from pypdf import PdfReader

from app import db

from ..settings import settings
from .. import models
from .chunking import chunk_text
# Try to use improved chunking if available
try:
    from .chunking_improved import chunk_text_improved
    USE_IMPROVED_CHUNKING = True
except ImportError:
    USE_IMPROVED_CHUNKING = False

from .embeddings import embed_text
from .pinecone_client import index as pinecone_index

def _ensure_dir(path: str) -> None:
    Path(path).mkdir(parents=True, exist_ok=True)


def _save_upload(customer_id: str, upload_file: UploadFile) -> str:
    base_dir = settings.UPLOAD_DIR
    customer_dir = os.path.join(base_dir, customer_id)
    _ensure_dir(customer_dir)

    file_path = os.path.join(customer_dir, upload_file.filename)
    with open(file_path, "wb") as f:
        f.write(upload_file.file.read())
    return file_path


def _extract_text(file_path: str) -> tuple[str, int | None]:
    """
    Extract text from file and return (text, page_count).
    For PDFs, page_count is the number of pages; for others, None.
    """
    ext = Path(file_path).suffix.lower()
    page_count = None

    if ext == ".docx":
        doc = DocxDocument(file_path)
        text = "\n".join([p.text for p in doc.paragraphs if p.text.strip()])
        return text.strip(), page_count

    if ext == ".pdf":
        reader = PdfReader(file_path)
        pages = []
        page_count = len(reader.pages)
        for page in reader.pages:
            pages.append(page.extract_text() or "")
        return "\n".join(pages).strip(), page_count

    try:
        text = Path(file_path).read_text(encoding="utf-8", errors="ignore").strip()
        return text, page_count
    except Exception:
        return "", page_count


def ingest_document(db: Session, customer_id: str, doc_type: str, upload_file: UploadFile, project_id: str | None = None, document_category: str = "project") -> models.Document:
    
    # 1) Save file
    file_path = _save_upload(customer_id, upload_file)
    
    # Get file metadata
    file_size = os.path.getsize(file_path) if os.path.exists(file_path) else None
    mime_type, _ = mimetypes.guess_type(upload_file.filename)
    if not mime_type:
        # Fallback to common types
        ext = Path(file_path).suffix.lower()
        mime_type_map = {
            ".pdf": "application/pdf",
            ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".doc": "application/msword",
            ".txt": "text/plain",
        }
        mime_type = mime_type_map.get(ext, "application/octet-stream")

    # 2) Document row (set processing_status to "processing")
    doc = models.Document(
        customer_id=customer_id,
        project_id=project_id,
        document_category=document_category,
        doc_type=doc_type,
        filename=upload_file.filename,
        storage_path=file_path,
        file_size=file_size,
        mime_type=mime_type,
        processing_status="processing",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # 3) Extract text
    extracted, page_count = _extract_text(file_path)
    if not extracted:
        extracted = "(No text extracted from this file. Try a .txt/.docx/.pdf with selectable text.)"

    # Update document with page_count and set status to "completed"
    doc.page_count = page_count
    doc.processing_status = "completed"
    db.commit()

    # 4) Store extracted text
    doc_text = models.DocumentText(document_id=doc.id, extracted_text=extracted)
    db.add(doc_text)
    db.commit()

    # 5) Get customer name for metadata enrichment
    customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    customer_name = customer.name if customer else None
    
    # Only index project documents in Pinecone (skip customer documents)
    if document_category == "project":
        # 5) Chunk and store chunks (use improved chunking if available)
        if USE_IMPROVED_CHUNKING:
            chunks = chunk_text_improved(extracted, chunk_size=900, overlap=150)
        else:
            chunks = chunk_text(extracted, chunk_size=900, overlap=150)
        
        for i, ch in enumerate(chunks):
            vector = embed_text(ch)

            vector_id = f"{doc.id}_{i}"
            namespace = (settings.PINECONE_NAMESPACE or "").strip()

            # Build metadata with enrichment (customer_name, document_filename)
            metadata = {
                "customer_id": customer_id,
                "document_id": doc.id,
                "chunk_index": i,
                "doc_type": doc_type,
                "document_category": "project",  # Always "project" for indexed documents
                "uploaded_at": doc.uploaded_at.isoformat(),
                "text": ch,
            }
            
            # Add enriched metadata
            if customer_name:
                metadata["customer_name"] = customer_name
            if doc.filename:
                metadata["document_filename"] = doc.filename
            
            # Only include project_id if it's not None
            if project_id is not None:
                metadata["project_id"] = project_id

            pinecone_index.upsert(
                vectors=[
                    {
                        "id": vector_id,
                        "values": vector,
                        "metadata": metadata,
                    }
                ],
                # ✅ This is what creates "context" namespace
                namespace=namespace if namespace else None,
            )

            row = models.Chunk(
                document_id=doc.id,
                chunk_index=i,
                chunk_text=ch,
                pinecone_vector_id=vector_id,
            )
            db.add(row)

        db.commit()
    else:
        # Customer documents are not indexed in Pinecone
        # Still store the document in the database, but no chunks/embeddings
        pass
    

    return doc
