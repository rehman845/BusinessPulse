from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import List, Optional

from ..db import get_db
from .. import models, schemas

router = APIRouter()


def _compute_line_total(quantity: float, unit_price: float) -> float:
    return float(quantity) * float(unit_price)


def _next_invoice_number(db: Session) -> str:
    # Simple sequence: INV-YYYY-0001 ... (best-effort, not perfect under high concurrency)
    year = datetime.utcnow().year
    prefix = f"INV-{year}-"
    existing = (
        db.query(models.Invoice.invoice_number)
        .filter(models.Invoice.invoice_number.like(f"{prefix}%"))
        .order_by(models.Invoice.invoice_number.desc())
        .first()
    )
    if not existing or not existing[0]:
        return f"{prefix}0001"
    try:
        last = int(existing[0].replace(prefix, ""))
    except Exception:
        last = 0
    return f"{prefix}{str(last + 1).zfill(4)}"


@router.get("/invoices", response_model=List[schemas.InvoiceOut])
def list_invoices(
    status: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    customer_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = (
        db.query(models.Invoice)
        .options(joinedload(models.Invoice.line_items))
        .order_by(models.Invoice.issue_date.desc())
    )
    if status:
        query = query.filter(models.Invoice.status == status)
    if project_id:
        query = query.filter(models.Invoice.project_id == project_id)
    if customer_id:
        query = query.filter(models.Invoice.customer_id == customer_id)
    return query.all()


@router.get("/invoices/{invoice_id}", response_model=schemas.InvoiceOut)
def get_invoice(invoice_id: str, db: Session = Depends(get_db)):
    invoice = (
        db.query(models.Invoice)
        .options(joinedload(models.Invoice.line_items))
        .filter(models.Invoice.id == invoice_id)
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


@router.post("/invoices", response_model=schemas.InvoiceOut)
def create_invoice(payload: schemas.InvoiceCreate, db: Session = Depends(get_db)):
    issue_date = payload.issue_date or datetime.utcnow()
    due_date = payload.due_date or (issue_date + timedelta(days=14))

    invoice = models.Invoice(
        invoice_number=payload.invoice_number,
        customer_id=payload.customer_id,
        customer_name=payload.customer_name or "",
        customer_email=payload.customer_email or "",
        project_id=payload.project_id,
        project_name=payload.project_name,
        status=payload.status,
        issue_date=issue_date,
        due_date=due_date,
        notes=payload.notes,
        subtotal=0,
        tax=payload.tax or 0,
        total=0,
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)

    subtotal = 0.0
    for li in payload.line_items:
        total = _compute_line_total(li.quantity, li.unit_price)
        subtotal += total
        db.add(
            models.InvoiceLineItem(
                invoice_id=invoice.id,
                category=li.category,
                description=li.description,
                quantity=li.quantity,
                unit_price=li.unit_price,
                total=total,
            )
        )
    db.commit()

    invoice.subtotal = subtotal
    invoice.total = float(subtotal) + float(invoice.tax or 0)
    db.commit()
    db.refresh(invoice)
    invoice.line_items = (
        db.query(models.InvoiceLineItem).filter(models.InvoiceLineItem.invoice_id == invoice.id).all()
    )
    return invoice


@router.patch("/invoices/{invoice_id}", response_model=schemas.InvoiceOut)
def update_invoice(invoice_id: str, payload: schemas.InvoiceUpdate, db: Session = Depends(get_db)):
    invoice = (
        db.query(models.Invoice)
        .options(joinedload(models.Invoice.line_items))
        .filter(models.Invoice.id == invoice_id)
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if payload.status is not None:
        invoice.status = payload.status
    if payload.due_date is not None:
        invoice.due_date = payload.due_date
    if payload.paid_date is not None:
        invoice.paid_date = payload.paid_date
    if payload.notes is not None:
        invoice.notes = payload.notes

    db.commit()
    db.refresh(invoice)
    return invoice


@router.delete("/invoices/{invoice_id}")
def delete_invoice(invoice_id: str, db: Session = Depends(get_db)):
    invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    db.query(models.InvoiceLineItem).filter(models.InvoiceLineItem.invoice_id == invoice_id).delete()
    db.delete(invoice)
    db.commit()
    return {"deleted": True}


@router.post("/invoices/generate", response_model=schemas.InvoiceOut)
def generate_invoice(payload: schemas.InvoiceGenerateRequest, db: Session = Depends(get_db)):
    invoice_number = payload.invoice_number or _next_invoice_number(db)

    customer_name = payload.customer_name or ""
    customer_email = payload.customer_email or ""
    if payload.customer_id:
        customer = db.query(models.Customer).filter(models.Customer.id == payload.customer_id).first()
        if customer:
            customer_name = customer_name or customer.name

    # Build line items
    line_items: list[models.InvoiceLineItem] = []
    subtotal = 0.0

    # Time entries -> labor
    if payload.include_time_entries:
        te_query = db.query(models.TimeEntry).filter(models.TimeEntry.project_id == payload.project_id)
        if payload.from_date:
            te_query = te_query.filter(models.TimeEntry.work_date >= payload.from_date)
        if payload.to_date:
            te_query = te_query.filter(models.TimeEntry.work_date <= payload.to_date)
        entries = te_query.all()

        for e in entries:
            emp = db.query(models.Employee).filter(models.Employee.id == e.employee_id).first()
            if not emp:
                continue
            qty = float(e.hours or 0)
            unit = float(emp.hourly_rate or 0)
            total = qty * unit
            if total <= 0:
                continue
            subtotal += total
            line_items.append(
                models.InvoiceLineItem(
                    category="labor",
                    description=f"{emp.full_name} ({emp.role}) - {qty} hours",
                    quantity=qty,
                    unit_price=unit,
                    total=total,
                )
            )

    # Project-linked expenses -> vendor/subscription/etc
    if payload.include_project_expenses:
        exp_query = db.query(models.BillingExpense).filter(models.BillingExpense.project_id == payload.project_id)
        if payload.from_date:
            exp_query = exp_query.filter(
                (models.BillingExpense.due_date.is_(None)) | (models.BillingExpense.due_date >= payload.from_date)
            )
        if payload.to_date:
            exp_query = exp_query.filter(
                (models.BillingExpense.due_date.is_(None)) | (models.BillingExpense.due_date <= payload.to_date)
            )
        expenses = exp_query.all()
        for ex in expenses:
            amt = float(ex.amount or 0)
            if amt <= 0:
                continue
            subtotal += amt
            cat = "vendor" if ex.expense_type in ["vendor", "consultant", "outsourcing"] else "subscription"
            line_items.append(
                models.InvoiceLineItem(
                    category=cat,
                    description=f"{ex.vendor_name}: {ex.description}".strip(": "),
                    quantity=1,
                    unit_price=amt,
                    total=amt,
                )
            )

    tax = float(subtotal) * float(payload.tax_rate or 0)
    total = float(subtotal) + float(tax)

    invoice = models.Invoice(
        invoice_number=invoice_number,
        customer_id=payload.customer_id,
        customer_name=customer_name,
        customer_email=customer_email,
        project_id=payload.project_id,
        project_name=payload.project_name,
        status="draft",
        issue_date=datetime.utcnow(),
        due_date=datetime.utcnow() + timedelta(days=14),
        subtotal=subtotal,
        tax=tax,
        total=total,
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)

    for li in line_items:
        li.invoice_id = invoice.id
        db.add(li)
    db.commit()
    db.refresh(invoice)
    invoice.line_items = db.query(models.InvoiceLineItem).filter(models.InvoiceLineItem.invoice_id == invoice.id).all()
    return invoice

