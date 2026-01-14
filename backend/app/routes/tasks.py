"""
Tasks Routes
Handles task CRUD operations and Notion synchronization
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from datetime import datetime
from typing import List, Optional
import logging

from ..db import get_db
from .. import models, schemas
from ..services.notion_client import get_notion_client

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/projects/{project_id}/tasks", response_model=List[schemas.TaskOut])
def get_project_tasks(project_id: str, db: Session = Depends(get_db)):
    """Get all tasks for a specific project"""
    try:
        tasks = db.query(models.Task).filter(models.Task.project_id == project_id).all()
        return tasks
    except Exception as e:
        logger.error(f"Error fetching tasks for project {project_id}: {e}", exc_info=True)
        # If table doesn't exist, return empty list
        return []


@router.get("/projects/tasks/counts")
def get_task_counts_by_project(db: Session = Depends(get_db)):
    """Get task counts grouped by project_id"""
    try:
        # Count total tasks per project
        counts = db.query(
            models.Task.project_id,
            func.count(models.Task.id).label('total'),
            func.sum(case((models.Task.status == 'Todo', 1), else_=0)).label('todo'),
            func.sum(case((models.Task.status == 'In Progress', 1), else_=0)).label('in_progress'),
            func.sum(case((models.Task.status == 'Done', 1), else_=0)).label('done'),
            func.sum(case((models.Task.status == 'Blocked', 1), else_=0)).label('blocked'),
        ).group_by(models.Task.project_id).all()
        
        result = {}
        for project_id, total, todo, in_progress, done, blocked in counts:
            result[project_id] = {
                'total': total or 0,
                'todo': todo or 0,
                'in_progress': in_progress or 0,
                'done': done or 0,
                'blocked': blocked or 0,
                'pending': (todo or 0) + (in_progress or 0) + (blocked or 0)
            }
        return result
    except Exception as e:
        logger.error(f"Error fetching task counts: {e}", exc_info=True)
        # If table doesn't exist, return empty dict
        return {}


@router.post("/projects/{project_id}/tasks", response_model=schemas.TaskOut)
def create_task(
    project_id: str,
    task_data: schemas.TaskCreate,
    db: Session = Depends(get_db)
):
    """Create a new task and sync with Notion"""
    try:
        notion_client = get_notion_client()
        
        # Create task in Notion first (if configured)
        notion_page_id = None
        if notion_client._is_configured():
            try:
                notion_page_id = notion_client.create_task_in_notion(
                    title=task_data.title,
                    project_id=project_id,
                    description=task_data.description,
                    status=task_data.status,
                    due_date=task_data.due_date
                )
            except Exception as e:
                # Log but don't fail if Notion sync fails
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"Failed to create task in Notion, continuing with local creation: {e}")
        
        # Create task in local database
        task = models.Task(
            project_id=project_id,
            title=task_data.title,
            description=task_data.description,
            status=task_data.status or "Todo",
            due_date=task_data.due_date,
            notion_page_id=notion_page_id,
            last_synced_at=datetime.utcnow() if notion_page_id else None
        )
        
        db.add(task)
        db.commit()
        db.refresh(task)
        
        return task
    except Exception as e:
        db.rollback()
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error creating task: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create task: {str(e)}")


@router.put("/tasks/{task_id}", response_model=schemas.TaskOut)
def update_task(
    task_id: str,
    task_data: schemas.TaskUpdate,
    db: Session = Depends(get_db)
):
    """Update task fields and sync with Notion"""
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    notion_client = get_notion_client()
    
    # Update local task
    if task_data.title is not None:
        task.title = task_data.title
    if task_data.description is not None:
        task.description = task_data.description
    if task_data.due_date is not None:
        task.due_date = task_data.due_date
    
    task.updated_at = datetime.utcnow()
    
    # Update in Notion if synced
    if task.notion_page_id and notion_client._is_configured():
        success = notion_client.update_task_in_notion(
            notion_page_id=task.notion_page_id,
            title=task_data.title,
            description=task_data.description,
            due_date=task_data.due_date
        )
        if success:
            task.last_synced_at = datetime.utcnow()
    
    db.commit()
    db.refresh(task)
    
    return task


@router.patch("/tasks/{task_id}/status", response_model=schemas.TaskOut)
def update_task_status(
    task_id: str,
    status_data: schemas.TaskStatusUpdate,
    db: Session = Depends(get_db)
):
    """Update task status and sync with Notion"""
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    notion_client = get_notion_client()
    
    # Update local status
    task.status = status_data.status
    task.updated_at = datetime.utcnow()
    
    # Update in Notion if synced
    if task.notion_page_id and notion_client._is_configured():
        success = notion_client.update_status_in_notion(
            notion_page_id=task.notion_page_id,
            status=status_data.status
        )
        if success:
            task.last_synced_at = datetime.utcnow()
    
    db.commit()
    db.refresh(task)
    
    return task


@router.delete("/tasks/{task_id}")
def delete_task(
    task_id: str,
    db: Session = Depends(get_db)
):
    """Delete a task and remove from Notion if synced"""
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    notion_client = get_notion_client()
    
    # Delete from Notion if synced (optional - Notion doesn't have a delete endpoint in the API)
    # We'll just delete from local database
    # Note: Notion API doesn't support deleting pages, so we just remove the local record
    
    db.delete(task)
    db.commit()
    
    logger.info(f"Deleted task {task_id} for project {task.project_id}")
    return {"message": "Task deleted successfully", "deleted": True}


@router.delete("/projects/{project_id}/tasks")
def delete_all_project_tasks(
    project_id: str,
    db: Session = Depends(get_db)
):
    """Delete all tasks for a project (cascade delete)"""
    try:
        tasks = db.query(models.Task).filter(models.Task.project_id == project_id).all()
        task_count = len(tasks)
        
        for task in tasks:
            db.delete(task)
        
        db.commit()
        logger.info(f"Deleted {task_count} tasks for project {project_id}")
        return {
            "message": f"Deleted {task_count} task(s) for project",
            "deleted_count": task_count
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting tasks for project {project_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to delete tasks: {str(e)}")


@router.get("/notion/tasks", response_model=List[schemas.TaskOut])
def get_all_tasks(
    status: Optional[str] = Query(None, description="Filter by status"),
    due_before: Optional[str] = Query(None, description="Filter tasks due before date (ISO format)"),
    overdue: bool = Query(False, description="Filter overdue tasks"),
    db: Session = Depends(get_db)
):
    """Get all tasks across all projects with optional filters"""
    query = db.query(models.Task)
    
    if status:
        query = query.filter(models.Task.status == status)
    
    if due_before:
        try:
            due_date = datetime.fromisoformat(due_before.replace("Z", "+00:00"))
            query = query.filter(models.Task.due_date < due_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format")
    
    if overdue:
        from datetime import date
        today = datetime.combine(date.today(), datetime.min.time())
        query = query.filter(
            models.Task.due_date < today,
            models.Task.status != "Done"
        )
    
    tasks = query.all()
    return tasks


@router.post("/projects/{project_id}/notion/sync")
def sync_project_tasks_from_notion(
    project_id: str,
    db: Session = Depends(get_db)
):
    """Pull tasks from Notion for a specific project and upsert into local database"""
    notion_client = get_notion_client()
    
    if not notion_client._is_configured():
        raise HTTPException(status_code=400, detail="Notion integration not configured")
    
    # Query tasks from Notion
    notion_pages = notion_client.query_tasks_by_project(project_id)
    
    synced_count = 0
    created_count = 0
    updated_count = 0
    
    for page in notion_pages:
        task_data = notion_client._extract_task_from_notion_page(page)
        notion_page_id = task_data["notion_page_id"]
        
        if not notion_page_id:
            continue
        
        # Find existing task by notion_page_id
        existing_task = db.query(models.Task).filter(
            models.Task.notion_page_id == notion_page_id
        ).first()
        
        if existing_task:
            # Update existing task (Notion wins)
            existing_task.title = task_data["title"]
            existing_task.description = task_data["description"]
            existing_task.status = task_data["status"]
            existing_task.due_date = task_data["due_date"]
            existing_task.project_id = task_data["project_id"]
            existing_task.last_synced_at = datetime.utcnow()
            updated_count += 1
        else:
            # Create new task
            new_task = models.Task(
                project_id=task_data["project_id"],
                title=task_data["title"],
                description=task_data["description"],
                status=task_data["status"],
                due_date=task_data["due_date"],
                notion_page_id=notion_page_id,
                last_synced_at=datetime.utcnow()
            )
            db.add(new_task)
            created_count += 1
        
        synced_count += 1
    
    db.commit()
    
    return {
        "message": f"Synced {synced_count} tasks from Notion",
        "created": created_count,
        "updated": updated_count,
        "total": synced_count
    }


@router.post("/notion/sync")
def sync_all_tasks_from_notion(
    status: Optional[str] = Query(None, description="Filter by status"),
    due_before: Optional[str] = Query(None, description="Filter tasks due before date (ISO format)"),
    overdue: bool = Query(False, description="Filter overdue tasks"),
    db: Session = Depends(get_db)
):
    """Pull all tasks from Notion and upsert into local database"""
    notion_client = get_notion_client()
    
    if not notion_client._is_configured():
        raise HTTPException(status_code=400, detail="Notion integration not configured")
    
    # Parse filters
    due_before_dt = None
    if due_before:
        try:
            due_before_dt = datetime.fromisoformat(due_before.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format")
    
    # Query tasks from Notion
    notion_pages = notion_client.query_all_tasks(
        status=status,
        due_before=due_before_dt,
        overdue=overdue
    )
    
    synced_count = 0
    created_count = 0
    updated_count = 0
    
    for page in notion_pages:
        task_data = notion_client._extract_task_from_notion_page(page)
        notion_page_id = task_data["notion_page_id"]
        
        if not notion_page_id:
            continue
        
        # Find existing task by notion_page_id
        existing_task = db.query(models.Task).filter(
            models.Task.notion_page_id == notion_page_id
        ).first()
        
        if existing_task:
            # Update existing task (Notion wins)
            existing_task.title = task_data["title"]
            existing_task.description = task_data["description"]
            existing_task.status = task_data["status"]
            existing_task.due_date = task_data["due_date"]
            existing_task.project_id = task_data["project_id"]
            existing_task.last_synced_at = datetime.utcnow()
            updated_count += 1
        else:
            # Create new task
            new_task = models.Task(
                project_id=task_data["project_id"],
                title=task_data["title"],
                description=task_data["description"],
                status=task_data["status"],
                due_date=task_data["due_date"],
                notion_page_id=notion_page_id,
                last_synced_at=datetime.utcnow()
            )
            db.add(new_task)
            created_count += 1
        
        synced_count += 1
    
    db.commit()
    
    return {
        "message": f"Synced {synced_count} tasks from Notion",
        "created": created_count,
        "updated": updated_count,
        "total": synced_count
    }

