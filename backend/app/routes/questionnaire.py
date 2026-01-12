from fastapi import APIRouter, HTTPException, Depends, Request, UploadFile
from sqlalchemy.orm import Session
from datetime import datetime
from pathlib import Path
import os
import sys
import uuid

from fastapi.responses import StreamingResponse
from io import BytesIO


from ..db import get_db
from .. import models
from ..services.questionnaire_gen import generate_questionnaire
from ..services.pdfGEN import build_questionnaire_pdf
from .. import schemas
from ..settings import settings
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/{customer_id}/questionnaire/generate")
def generate(customer_id: str, db: Session = Depends(get_db)):
    try:
        data = generate_questionnaire(customer_id=customer_id)

        # 1) Create Questionnaire record
        qn = models.Questionnaire(
            customer_id=customer_id,
            title=data.get("title") or "Requirements Clarification Questionnaire",
            status="draft",
        )
        db.add(qn)
        db.commit()
        db.refresh(qn)

        # 2) Create Question records
        for sec in data.get("sections", []):
            topic_default = sec.get("title")
            for item in sec.get("questions", []):
                db.add(models.Question(
                    questionnaire_id=qn.id,
                    text=item.get("q", ""),
                    answer=None,
                    priority=item.get("priority"),
                    topic_category=item.get("topic_category") or topic_default,
                    source_chunk_id=item.get("source_chunk_id"),  # optional; usually None for MVP
                ))
        db.commit()

        # 3) Generate PDF and save as Document
        logger.info(f"Starting PDF generation for questionnaire {qn.id}")
        try:
            # Load customer for PDF generation
            customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
            if not customer:
                print(f"Warning: Customer {customer_id} not found for PDF generation")
            if customer:
                # Convert data to sections format for PDF
                sections = []
                for sec in data.get("sections", []):
                    sections.append({
                        "title": sec.get("title", "Questions"),
                        "questions": [{"q": item.get("q", ""), "why": "", "priority": item.get("priority", "medium")} for item in sec.get("questions", [])]
                    })
                
                pdf_bytes = build_questionnaire_pdf(
                    customer_name=customer.name,
                    title=qn.title or "Requirements Clarification Questionnaire",
                    notes="",
                    sections=sections,
                )
                
                # Save PDF to file system (use same logic as ingest_document)
                from ..services.ingest import _ensure_dir
                base_dir = settings.UPLOAD_DIR
                customer_dir = os.path.join(base_dir, customer_id)
                _ensure_dir(customer_dir)
                
                pdf_filename = f"Questionnaire_{qn.id}.pdf"
                pdf_file_path = os.path.join(customer_dir, pdf_filename)
                
                with open(pdf_file_path, "wb") as f:
                    f.write(pdf_bytes)
                
                # Create Document record for the questionnaire PDF
                questionnaire_doc = models.Document(
                    customer_id=customer_id,
                    doc_type="questionnaire",
                    filename=pdf_filename,
                    storage_path=pdf_file_path,
                    file_size=len(pdf_bytes),
                    mime_type="application/pdf",
                    processing_status="completed",
                    uploaded_at=datetime.utcnow(),
                )
                db.add(questionnaire_doc)
                db.commit()
                sys.stderr.write(f"SUCCESS: Saved questionnaire PDF as document: {pdf_filename}\n")
                sys.stderr.flush()
                logger.info(f"Successfully saved questionnaire PDF as document: {pdf_filename}")
        except Exception as e:
            # Don't fail questionnaire generation if PDF saving fails
            # But log the error for debugging
            import traceback
            sys.stderr.write(f"ERROR: Failed to save questionnaire PDF as document: {e}\n")
            traceback.print_exc(file=sys.stderr)
            sys.stderr.flush()
            logger.error(f"ERROR: Failed to save questionnaire PDF as document: {e}", exc_info=True)

        # 4) Return with created question ids for later answer submissions
        questions_payload = [
            {
                "id": item.id,
                "text": item.text,
                "priority": item.priority,
                "topic_category": item.topic_category,
            }
            for item in db.query(models.Question).filter(models.Question.questionnaire_id == qn.id).all()
        ]

        return {"questionnaire_id": qn.id, "data": data, "questions": questions_payload}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{customer_id}/questionnaire/{questionnaire_id}/answers")
def submit_answers(
    customer_id: str,
    questionnaire_id: str,
    payload: list[schemas.QuestionAnswer],
    db: Session = Depends(get_db),
):
    # Validate questionnaire
    qn = (
        db.query(models.Questionnaire)
        .filter(models.Questionnaire.id == questionnaire_id, models.Questionnaire.customer_id == customer_id)
        .first()
    )
    if not qn:
        raise HTTPException(status_code=404, detail="Questionnaire not found for this customer")

    # Update answers
    question_map = {
        q.id: q for q in db.query(models.Question).filter(models.Question.questionnaire_id == questionnaire_id).all()
    }
    updated = 0
    for item in payload:
        q = question_map.get(item.question_id)
        if q:
            q.answer = item.answer
            updated += 1
    db.commit()
    return {"updated": updated}


@router.get("/{customer_id}/questionnaire/{questionnaire_id}/pdf")
def download_questionnaire_pdf(customer_id: str, questionnaire_id: str, request: Request, db: Session = Depends(get_db)):
    # 1) Load customer
    customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # 2) Load questionnaire
    qn = (
        db.query(models.Questionnaire)
        .filter(models.Questionnaire.id == questionnaire_id, models.Questionnaire.customer_id == customer_id)
        .first()
    )
    if not qn:
        raise HTTPException(status_code=404, detail="Questionnaire not found for this customer")

    # 3) Load questions
    qs = db.query(models.Question).filter(models.Question.questionnaire_id == qn.id).all()

    # 4) Convert DB rows into sections format for PDF
    # If you store topic_category, group by that; else put all into one section.
    sections_map: dict[str, list[dict]] = {}
    for item in qs:
        sec = item.topic_category or "Questions"
        sections_map.setdefault(sec, []).append(
            {
                "q": item.text,
                "why": "",  # We didn't persist 'why' in DB earlier; keep empty or add column later.
                "priority": item.priority or "medium",
            }
        )

    sections = [{"title": k, "questions": v} for k, v in sections_map.items()]

    # 5) Build PDF bytes
    pdf_bytes = build_questionnaire_pdf(
        customer_name=customer.name,
        title=qn.title or "Requirements Clarification Questionnaire",
        notes="",
        sections=sections,
    )

    # 6) Log access
    try:
        ip_address = None
        if request and hasattr(request, "client") and request.client:
            ip_address = request.client.host
        access_log = models.QuestionnaireAccessLog(
            questionnaire_id=questionnaire_id,
            access_type="download",
            ip_address=ip_address
        )
        db.add(access_log)
        db.commit()
    except Exception:
        db.rollback()
        pass

    # 7) Return as downloadable PDF
    filename = f"Questionnaire_{customer.name.replace(' ', '_')}_{qn.id}.pdf"
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

