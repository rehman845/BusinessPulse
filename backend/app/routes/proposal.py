import json
import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from fastapi.responses import StreamingResponse
from io import BytesIO

from ..db import get_db
from .. import models, schemas
from ..services.proposal_gen import generate_proposal
from ..services.proposal_pdf import build_proposal_pdf
from ..settings import settings

router = APIRouter()


@router.post("/{customer_id}/proposal/generate", response_model=schemas.ProposalOut)
def generate_proposal_route(
    customer_id: str,
    db: Session = Depends(get_db),
):
    customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Proposal is generated purely from all customer documents (including uploaded questionnaire answers)
    proposal_data = generate_proposal(customer)

    proposal = models.Proposal(
        customer_id=customer_id,
        questionnaire_id=None,
        content=json.dumps(proposal_data),
    )
    db.add(proposal)
    db.commit()
    db.refresh(proposal)

    # Generate PDF and save as Document
    try:
        pdf_bytes = build_proposal_pdf(customer_name=customer.name, proposal=proposal_data)
        
        # Save PDF to file system (use same logic as ingest_document)
        from ..services.ingest import _ensure_dir
        base_dir = settings.UPLOAD_DIR
        customer_dir = os.path.join(base_dir, customer_id)
        _ensure_dir(customer_dir)
        
        pdf_filename = f"Proposal_{proposal.id}.pdf"
        pdf_file_path = os.path.join(customer_dir, pdf_filename)
        
        with open(pdf_file_path, "wb") as f:
            f.write(pdf_bytes)
        
        # Create Document record for the proposal PDF
        proposal_doc = models.Document(
            customer_id=customer_id,
            doc_type="proposal",
            filename=pdf_filename,
            storage_path=pdf_file_path,
            file_size=len(pdf_bytes),
            mime_type="application/pdf",
            processing_status="processing",
        )
        db.add(proposal_doc)
        db.commit()
        db.refresh(proposal_doc)
        
        # Extract text from PDF and index into Pinecone
        try:
            from ..services.ingest import _extract_text, chunk_text
            from ..services.embeddings import embed_text
            from ..services.pinecone_client import index as pinecone_index
            
            # Extract text from the PDF
            extracted, page_count = _extract_text(pdf_file_path)
            if not extracted:
                # If PDF extraction fails, use the proposal content as text
                extracted = json.dumps(proposal_data, indent=2)
            
            # Store extracted text
            doc_text = models.DocumentText(
                document_id=proposal_doc.id,
                extracted_text=extracted
            )
            db.add(doc_text)
            
            # Update document with page_count
            proposal_doc.page_count = page_count
            proposal_doc.processing_status = "completed"
            db.commit()
            
            # Chunk and index into Pinecone
            chunks = chunk_text(extracted, chunk_size=900, overlap=150)
            namespace = (settings.PINECONE_NAMESPACE or "").strip()
            
            for i, ch in enumerate(chunks):
                vector = embed_text(ch)
                vector_id = f"{proposal_doc.id}_{i}"
                
                metadata = {
                    "customer_id": customer_id,
                    "document_id": proposal_doc.id,
                    "chunk_index": i,
                    "doc_type": "proposal",
                    "uploaded_at": proposal_doc.uploaded_at.isoformat(),
                    "text": ch,
                }
                
                # Add enriched metadata
                if customer.name:
                    metadata["customer_name"] = customer.name
                if proposal_doc.filename:
                    metadata["document_filename"] = proposal_doc.filename
                
                pinecone_index.upsert(
                    vectors=[{"id": vector_id, "values": vector, "metadata": metadata}],
                    namespace=namespace if namespace else None,
                )
                
                chunk_row = models.Chunk(
                    document_id=proposal_doc.id,
                    chunk_index=i,
                    chunk_text=ch,
                    pinecone_vector_id=vector_id,
                )
                db.add(chunk_row)
            
            db.commit()
        except Exception as e:
            # Don't fail proposal generation if indexing fails
            import sys
            sys.stderr.write(f"Warning: Failed to index proposal PDF: {e}\n")
            sys.stderr.flush()
            proposal_doc.processing_status = "completed"  # Mark as completed even if indexing failed
            db.commit()
    except Exception as e:
        # Don't fail proposal generation if PDF saving fails
        db.rollback()
        print(f"Warning: Failed to save proposal PDF as document: {e}")

    return proposal


@router.get("/{customer_id}/proposal/{proposal_id}/pdf")
def download_proposal_pdf(customer_id: str, proposal_id: str, request: Request, db: Session = Depends(get_db)):
    proposal = (
        db.query(models.Proposal)
        .filter(models.Proposal.id == proposal_id, models.Proposal.customer_id == customer_id)
        .first()
    )
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found for this customer")

    customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    try:
        data = json.loads(proposal.content)
    except Exception:
        data = {"summary": "Proposal content unavailable"}

    pdf_bytes = build_proposal_pdf(customer_name=customer.name, proposal=data)
    filename = f"Proposal_{customer.name.replace(' ', '_')}_{proposal.id}.pdf"
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

