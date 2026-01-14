from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional

from ..db import get_db
from .. import models, schemas

router = APIRouter()


@router.post("/team/employees", response_model=schemas.EmployeeOut)
def create_employee(payload: schemas.EmployeeCreate, db: Session = Depends(get_db)):
    employee = models.Employee(
        full_name=payload.full_name,
        role=payload.role,
        hourly_rate=payload.hourly_rate,
        hours_per_day=payload.hours_per_day,
        days_per_week=payload.days_per_week,
        is_active=payload.is_active,
    )
    db.add(employee)
    db.commit()
    db.refresh(employee)
    return employee


@router.get("/team/employees", response_model=List[schemas.EmployeeOut])
def list_employees(
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(models.Employee).order_by(models.Employee.created_at.desc())
    if is_active is not None:
        query = query.filter(models.Employee.is_active == is_active)
    return query.all()


@router.get("/team/employees/{employee_id}", response_model=schemas.EmployeeOut)
def get_employee(employee_id: str, db: Session = Depends(get_db)):
    employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return employee


@router.patch("/team/employees/{employee_id}", response_model=schemas.EmployeeOut)
def update_employee(employee_id: str, payload: schemas.EmployeeUpdate, db: Session = Depends(get_db)):
    employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    if payload.full_name is not None:
        employee.full_name = payload.full_name
    if payload.role is not None:
        employee.role = payload.role
    if payload.hourly_rate is not None:
        employee.hourly_rate = payload.hourly_rate
    if payload.hours_per_day is not None:
        employee.hours_per_day = payload.hours_per_day
    if payload.days_per_week is not None:
        employee.days_per_week = payload.days_per_week
    if payload.is_active is not None:
        employee.is_active = payload.is_active

    db.commit()
    db.refresh(employee)
    return employee


@router.delete("/team/employees/{employee_id}")
def delete_employee(employee_id: str, db: Session = Depends(get_db)):
    employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    db.delete(employee)
    db.commit()
    return {"deleted": True}


@router.post("/team/time-entries", response_model=schemas.TimeEntryOut)
def create_time_entry(payload: schemas.TimeEntryCreate, db: Session = Depends(get_db)):
    employee = db.query(models.Employee).filter(models.Employee.id == payload.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    entry = models.TimeEntry(
        employee_id=payload.employee_id,
        project_id=payload.project_id,
        work_date=payload.work_date or None,
        hours=payload.hours,
        description=payload.description,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    entry.employee = employee
    return entry


@router.get("/team/time-entries", response_model=List[schemas.TimeEntryOut])
def list_time_entries(
    project_id: Optional[str] = Query(None),
    employee_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(models.TimeEntry).order_by(models.TimeEntry.work_date.desc())
    if project_id:
        query = query.filter(models.TimeEntry.project_id == project_id)
    if employee_id:
        query = query.filter(models.TimeEntry.employee_id == employee_id)
    entries = query.all()
    # Attach employee (lightweight)
    for e in entries:
        e.employee = db.query(models.Employee).filter(models.Employee.id == e.employee_id).first()
    return entries


# -----------------------------
# Project Employee assignments
# -----------------------------
@router.post("/projects/{project_id}/employees", response_model=schemas.ProjectEmployeeOut)
def assign_employee_to_project(
    project_id: str,
    assignment: schemas.ProjectEmployeeCreate,
    db: Session = Depends(get_db),
):
    """Assign an employee to a project"""
    if assignment.project_id != project_id:
        raise HTTPException(status_code=400, detail="Project ID mismatch")

    employee = db.query(models.Employee).filter(models.Employee.id == assignment.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Check if already assigned
    existing = (
        db.query(models.ProjectEmployee)
        .filter(
            models.ProjectEmployee.project_id == project_id,
            models.ProjectEmployee.employee_id == assignment.employee_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Employee is already assigned to this project")

    db_assignment = models.ProjectEmployee(
        project_id=project_id,
        employee_id=employee.id,
    )
    db.add(db_assignment)
    db.commit()
    db.refresh(db_assignment)
    db_assignment.employee = employee
    return db_assignment


@router.get("/projects/{project_id}/employees", response_model=List[schemas.ProjectEmployeeOut])
def list_project_employees(
    project_id: str,
    db: Session = Depends(get_db),
):
    """List all employees assigned to a project"""
    assignments = (
        db.query(models.ProjectEmployee)
        .options(joinedload(models.ProjectEmployee.employee))
        .filter(models.ProjectEmployee.project_id == project_id)
        .order_by(models.ProjectEmployee.created_at.desc())
        .all()
    )
    return assignments


@router.delete("/projects/{project_id}/employees/{assignment_id}")
def remove_employee_from_project(
    project_id: str,
    assignment_id: str,
    db: Session = Depends(get_db),
):
    """Remove an employee assignment from a project"""
    assignment = (
        db.query(models.ProjectEmployee)
        .filter(
            models.ProjectEmployee.id == assignment_id,
            models.ProjectEmployee.project_id == project_id,
        )
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=404, detail="Employee assignment not found")

    db.delete(assignment)
    db.commit()
    return {"deleted": True}

