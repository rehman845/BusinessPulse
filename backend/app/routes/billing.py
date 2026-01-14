from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from ..db import get_db
from .. import models, schemas

router = APIRouter()


@router.post("/billing/expenses", response_model=schemas.BillingExpenseOut)
def create_expense(payload: schemas.BillingExpenseCreate, db: Session = Depends(get_db)):
    expense = models.BillingExpense(
        expense_type=payload.expense_type,
        vendor_name=payload.vendor_name,
        description=payload.description,
        amount=payload.amount,
        currency=payload.currency,
        frequency=payload.frequency,
        due_date=payload.due_date,
        paid_date=payload.paid_date,
        project_id=payload.project_id,
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@router.get("/billing/expenses", response_model=List[schemas.BillingExpenseOut])
def list_expenses(
    expense_type: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    unpaid_only: bool = Query(False),
    db: Session = Depends(get_db),
):
    query = db.query(models.BillingExpense).order_by(models.BillingExpense.created_at.desc())
    if expense_type:
        query = query.filter(models.BillingExpense.expense_type == expense_type)
    if project_id:
        query = query.filter(models.BillingExpense.project_id == project_id)
    if unpaid_only:
        query = query.filter(models.BillingExpense.paid_date.is_(None))
    return query.all()


@router.get("/billing/expenses/{expense_id}", response_model=schemas.BillingExpenseOut)
def get_expense(expense_id: str, db: Session = Depends(get_db)):
    expense = db.query(models.BillingExpense).filter(models.BillingExpense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    return expense


@router.patch("/billing/expenses/{expense_id}", response_model=schemas.BillingExpenseOut)
def update_expense(expense_id: str, payload: schemas.BillingExpenseUpdate, db: Session = Depends(get_db)):
    expense = db.query(models.BillingExpense).filter(models.BillingExpense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    if payload.expense_type is not None:
        expense.expense_type = payload.expense_type
    if payload.vendor_name is not None:
        expense.vendor_name = payload.vendor_name
    if payload.description is not None:
        expense.description = payload.description
    if payload.amount is not None:
        expense.amount = payload.amount
    if payload.currency is not None:
        expense.currency = payload.currency
    if payload.frequency is not None:
        expense.frequency = payload.frequency
    if payload.due_date is not None:
        expense.due_date = payload.due_date
    if payload.paid_date is not None:
        expense.paid_date = payload.paid_date
    # project_id may be explicitly nulled
    expense.project_id = payload.project_id

    db.commit()
    db.refresh(expense)
    return expense


@router.delete("/billing/expenses/{expense_id}")
def delete_expense(expense_id: str, db: Session = Depends(get_db)):
    expense = db.query(models.BillingExpense).filter(models.BillingExpense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    db.delete(expense)
    db.commit()
    return {"deleted": True}

