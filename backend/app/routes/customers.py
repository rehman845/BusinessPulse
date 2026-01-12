from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from datetime import datetime

from ..db import get_db
from .. import models, schemas

router = APIRouter()


@router.post("/", response_model=schemas.CustomerOut)
def create_customer(payload: schemas.CustomerCreate, db: Session = Depends(get_db)):
    customer = models.Customer(name=payload.name)
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


@router.get("/", response_model=list[schemas.CustomerOut])
def list_customers(db: Session = Depends(get_db)):
    return db.query(models.Customer).order_by(models.Customer.created_at.desc()).all()


@router.get("/{customer_id}", response_model=schemas.CustomerOut)
def get_customer(customer_id: str, request: Request, db: Session = Depends(get_db)):
    customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Log customer view activity
    try:
        ip_address = None
        if request and hasattr(request, "client") and request.client:
            ip_address = request.client.host
        activity_log = models.CustomerActivityLog(
            customer_id=customer_id,
            activity_type="view",
            ip_address=ip_address
        )
        db.add(activity_log)
        db.commit()
    except Exception:
        # Don't fail the request if logging fails
        db.rollback()
        pass
    
    return customer


@router.put("/{customer_id}", response_model=schemas.CustomerOut)
def update_customer(customer_id: str, payload: schemas.CustomerUpdate, db: Session = Depends(get_db)):
    customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    customer.name = payload.name
    customer.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(customer)
    return customer


@router.delete("/{customer_id}")
def delete_customer(customer_id: str, db: Session = Depends(get_db)):
    customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # For safety, block delete if there is related data (excluding soft-deleted documents)
    has_docs = (
        db.query(models.Document)
        .filter(
            models.Document.customer_id == customer_id,
            models.Document.deleted_at.is_(None)  # Only count non-deleted documents
        )
        .first() is not None
    )
    has_qn = db.query(models.Questionnaire).filter(models.Questionnaire.customer_id == customer_id).first() is not None
    has_props = db.query(models.Proposal).filter(models.Proposal.customer_id == customer_id).first() is not None

    if has_docs or has_qn or has_props:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete customer with existing documents, questionnaires, or proposals. Delete related data first.",
        )

    db.delete(customer)
    db.commit()
    return {"deleted": True}
