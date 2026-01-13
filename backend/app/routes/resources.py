from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List

from ..db import get_db
from .. import models, schemas

router = APIRouter()


# -----------------------------
# Global Resource CRUD
# -----------------------------
@router.post("/resources", response_model=schemas.ResourceOut)
def create_global_resource(
    resource: schemas.ResourceCreate,
    db: Session = Depends(get_db),
):
    """Create a global outsourcing resource"""
    db_resource = models.Resource(
        resource_name=resource.resource_name,
        company_name=resource.company_name,
        total_hours=resource.total_hours,
        available_hours=resource.total_hours,
    )
    db.add(db_resource)
    db.commit()
    db.refresh(db_resource)
    return db_resource


@router.get("/resources", response_model=List[schemas.ResourceOut])
def list_global_resources(db: Session = Depends(get_db)):
    """List all global resources with accurate available hours (excluding uncommitted assignments)"""
    resources = (
        db.query(models.Resource)
        .options(joinedload(models.Resource.assignments))
        .order_by(models.Resource.created_at.desc())
        .all()
    )
    
    # Calculate available hours excluding uncommitted assignments
    for resource in resources:
        committed_hours = sum(
            pr.allocated_hours 
            for pr in resource.assignments 
            if pr.hours_committed
        )
        # Available = total - committed (uncommitted assignments don't reduce availability)
        resource.available_hours = resource.total_hours - committed_hours
    
    return resources


@router.get("/resources/{resource_id}", response_model=schemas.ResourceOut)
def get_global_resource(resource_id: str, db: Session = Depends(get_db)):
    resource = db.query(models.Resource).filter(models.Resource.id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    return resource


@router.put("/resources/{resource_id}", response_model=schemas.ResourceOut)
def update_global_resource(
    resource_id: str,
    resource_update: schemas.ResourceUpdate,
    db: Session = Depends(get_db),
):
    resource = db.query(models.Resource).filter(models.Resource.id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    if resource_update.resource_name is not None:
        resource.resource_name = resource_update.resource_name
    if resource_update.company_name is not None:
        resource.company_name = resource_update.company_name
    if resource_update.total_hours is not None:
        if resource_update.total_hours < 0:
            raise HTTPException(status_code=400, detail="Total hours must be positive")
        allocated = resource.total_hours - resource.available_hours
        if resource_update.total_hours < allocated:
            raise HTTPException(
                status_code=400,
                detail="Total hours cannot be less than hours already allocated to projects",
            )
        # Adjust available hours to preserve allocated portion
        resource.available_hours = max(
            0, resource_update.total_hours - allocated
        )
        resource.total_hours = resource_update.total_hours
    if resource_update.available_hours is not None:
        if resource_update.available_hours < 0:
            raise HTTPException(status_code=400, detail="Available hours cannot be negative")
        if resource_update.available_hours > resource.total_hours:
            raise HTTPException(
                status_code=400,
                detail="Available hours cannot exceed total hours",
            )
        allocated = resource.total_hours - resource.available_hours
        min_available = resource.total_hours - allocated
        if resource_update.available_hours < min_available:
            raise HTTPException(
                status_code=400,
                detail="Available hours cannot be less than allocated hours",
            )
        resource.available_hours = resource_update.available_hours

    db.commit()
    db.refresh(resource)
    return resource


@router.delete("/resources/{resource_id}")
def delete_global_resource(resource_id: str, db: Session = Depends(get_db)):
    resource = (
        db.query(models.Resource)
        .options(joinedload(models.Resource.assignments))
        .filter(models.Resource.id == resource_id)
        .first()
    )
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    if resource.assignments:
        raise HTTPException(
            status_code=400,
            detail="Resource is assigned to projects. Remove assignments first.",
        )
    db.delete(resource)
    db.commit()
    return {"deleted": True}


# -----------------------------
# Project Resource assignments
# -----------------------------
@router.post("/projects/{project_id}/resources", response_model=schemas.ProjectResourceOut)
def assign_resource_to_project(
    project_id: str,
    resource_assignment: schemas.ProjectResourceCreate,
    db: Session = Depends(get_db),
):
    """Assign resource hours to a project (hours are reserved but not deducted until project enters execution)"""
    if resource_assignment.project_id != project_id:
        raise HTTPException(status_code=400, detail="Project ID mismatch")

    resource = (
        db.query(models.Resource)
        .options(joinedload(models.Resource.assignments))
        .filter(models.Resource.id == resource_assignment.resource_id)
        .first()
    )
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    
    # Check available hours (only committed hours reduce availability)
    committed_hours = sum(
        pr.allocated_hours 
        for pr in resource.assignments 
        if pr.hours_committed
    )
    available_for_new = resource.total_hours - committed_hours
    
    if available_for_new < resource_assignment.allocated_hours:
        raise HTTPException(
            status_code=400,
            detail=f"Not enough available hours. {available_for_new} hours available, {resource_assignment.allocated_hours} requested.",
        )

    # Create assignment WITHOUT deducting hours (hours_committed=False)
    db_assignment = models.ProjectResource(
        project_id=project_id,
        resource_id=resource.id,
        allocated_hours=resource_assignment.allocated_hours,
        hours_committed=False,  # Hours not deducted yet
        # Legacy snapshot data
        resource_name=resource.resource_name,
        company_name=resource.company_name,
        availability_hours=resource.total_hours,
    )
    db.add(db_assignment)
    db.commit()
    db.refresh(db_assignment)
    db.refresh(resource)
    db_assignment.resource = resource
    return db_assignment


@router.get("/projects/{project_id}/resources", response_model=List[schemas.ProjectResourceOut])
def list_project_resources(
    project_id: str,
    db: Session = Depends(get_db),
):
    """List all resource allocations for a project"""
    resources = (
        db.query(models.ProjectResource)
        .options(joinedload(models.ProjectResource.resource))
        .filter(models.ProjectResource.project_id == project_id)
        .order_by(models.ProjectResource.created_at.desc())
        .all()
    )
    return resources


@router.put("/projects/{project_id}/resources/{assignment_id}", response_model=schemas.ProjectResourceOut)
def update_project_resource(
    project_id: str,
    assignment_id: str,
    resource_update: schemas.ProjectResourceUpdate,
    db: Session = Depends(get_db),
):
    """Update resource allocation (hours or resource)"""
    assignment = (
        db.query(models.ProjectResource)
        .options(joinedload(models.ProjectResource.resource))
        .filter(
            models.ProjectResource.id == assignment_id,
            models.ProjectResource.project_id == project_id,
        )
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=404, detail="Resource assignment not found")

    current_resource = assignment.resource
    if not current_resource:
        current_resource = (
            db.query(models.Resource)
            .filter(models.Resource.id == assignment.resource_id)
            .first()
        )

    # Handle resource switch
    if resource_update.resource_id and resource_update.resource_id != assignment.resource_id:
        new_resource = (
            db.query(models.Resource)
            .filter(models.Resource.id == resource_update.resource_id)
            .first()
        )
        if not new_resource:
            raise HTTPException(status_code=404, detail="New resource not found")

        # Return hours to previous resource
        if current_resource:
            current_resource.available_hours += assignment.allocated_hours

        # Check availability on new resource
        hours_needed = resource_update.allocated_hours or assignment.allocated_hours
        if new_resource.available_hours < hours_needed:
            raise HTTPException(
                status_code=400,
                detail="Not enough hours available on the new resource",
            )
        new_resource.available_hours -= hours_needed

        assignment.resource_id = new_resource.id
        assignment.resource = new_resource
        current_resource = new_resource

    # Handle hour update
    if resource_update.allocated_hours is not None:
        new_hours = resource_update.allocated_hours
        diff = new_hours - assignment.allocated_hours
        if diff > 0:
            if not current_resource or current_resource.available_hours < diff:
                raise HTTPException(
                    status_code=400,
                    detail="Not enough available hours to increase allocation",
                )
            current_resource.available_hours -= diff
        elif diff < 0:
            if current_resource:
                current_resource.available_hours += abs(diff)
        assignment.allocated_hours = new_hours

    db.commit()
    db.refresh(assignment)
    if assignment.resource_id:
        assignment.resource = (
            db.query(models.Resource)
            .filter(models.Resource.id == assignment.resource_id)
            .first()
        )
    return assignment


@router.post("/projects/{project_id}/resources/activate")
def activate_project_resources(
    project_id: str,
    db: Session = Depends(get_db),
):
    """Deduct hours for all resource assignments when project enters execution"""
    assignments = (
        db.query(models.ProjectResource)
        .filter(
            models.ProjectResource.project_id == project_id,
            models.ProjectResource.hours_committed == False,
        )
        .all()
    )
    
    if not assignments:
        return {"message": "No uncommitted assignments to activate", "activated": 0}
    
    activated_count = 0
    for assignment in assignments:
        resource = (
            db.query(models.Resource)
            .filter(models.Resource.id == assignment.resource_id)
            .first()
        )
        if resource and resource.available_hours >= assignment.allocated_hours:
            resource.available_hours -= assignment.allocated_hours
            assignment.hours_committed = True
            activated_count += 1
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Not enough available hours for resource {resource.resource_name if resource else 'unknown'}",
            )
    
    db.commit()
    return {"message": f"Activated {activated_count} resource assignments", "activated": activated_count}


@router.post("/projects/{project_id}/resources/deactivate")
def deactivate_project_resources(
    project_id: str,
    db: Session = Depends(get_db),
):
    """Return hours for all resource assignments when project leaves execution"""
    assignments = (
        db.query(models.ProjectResource)
        .filter(
            models.ProjectResource.project_id == project_id,
            models.ProjectResource.hours_committed == True,
        )
        .all()
    )
    
    if not assignments:
        return {"message": "No committed assignments to deactivate", "deactivated": 0}
    
    deactivated_count = 0
    for assignment in assignments:
        resource = (
            db.query(models.Resource)
            .filter(models.Resource.id == assignment.resource_id)
            .first()
        )
        if resource:
            resource.available_hours += assignment.allocated_hours
            assignment.hours_committed = False
            deactivated_count += 1
    
    db.commit()
    return {"message": f"Deactivated {deactivated_count} resource assignments", "deactivated": deactivated_count}


@router.delete("/projects/{project_id}/resources/{assignment_id}")
def delete_project_resource(
    project_id: str,
    assignment_id: str,
    db: Session = Depends(get_db),
):
    """Remove an allocation and return hours only if they were committed"""
    assignment = (
        db.query(models.ProjectResource)
        .filter(
            models.ProjectResource.id == assignment_id,
            models.ProjectResource.project_id == project_id,
        )
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=404, detail="Resource assignment not found")

    # Only return hours if they were committed (deducted)
    if assignment.hours_committed:
        resource = (
            db.query(models.Resource)
            .filter(models.Resource.id == assignment.resource_id)
            .first()
        )
        if resource:
            resource.available_hours += assignment.allocated_hours

    db.delete(assignment)
    db.commit()
    return {"deleted": True}
