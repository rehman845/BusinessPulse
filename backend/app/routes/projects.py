from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from ..db import get_db
from .. import models, schemas

router = APIRouter()


@router.post("/", response_model=schemas.ProjectOut)
def create_project(payload: schemas.ProjectCreate, db: Session = Depends(get_db)):
    # Verify customer exists
    customer = db.query(models.Customer).filter(models.Customer.id == payload.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Check if project_number already exists
    existing = db.query(models.Project).filter(models.Project.project_number == payload.project_number).first()
    if existing:
        raise HTTPException(status_code=400, detail="Project number already exists")
    
    project = models.Project(
        project_number=payload.project_number,
        project_name=payload.project_name,
        customer_id=payload.customer_id,
        customer_name=payload.customer_name or customer.name,
        email=payload.email,
        status=payload.status,
        start_date=payload.start_date,
        end_date=payload.end_date,
        budget=payload.budget,
        description=payload.description,
        assigned_to=payload.assigned_to,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/", response_model=list[schemas.ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    return db.query(models.Project).order_by(models.Project.created_at.desc()).all()


@router.get("/{project_id}", response_model=schemas.ProjectOut)
def get_project(project_id: str, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.put("/{project_id}", response_model=schemas.ProjectOut)
def update_project(project_id: str, payload: schemas.ProjectUpdate, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if customer_id is being updated and verify it exists
    if payload.customer_id is not None and payload.customer_id != project.customer_id:
        customer = db.query(models.Customer).filter(models.Customer.id == payload.customer_id).first()
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
    
    # Check if project_number is being updated and verify it's unique
    if payload.project_number is not None and payload.project_number != project.project_number:
        existing = db.query(models.Project).filter(models.Project.project_number == payload.project_number).first()
        if existing:
            raise HTTPException(status_code=400, detail="Project number already exists")
    
    # Update fields
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)
    
    project.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}")
def delete_project(project_id: str, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check for related data (optional - you might want to allow cascade deletes)
    # For now, we'll allow deletion but warn if there's related data
    # This can be customized based on requirements
    
    db.delete(project)
    db.commit()
    return {"deleted": True}
