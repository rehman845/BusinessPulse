"""
Notion API Client Service
Handles all interactions with Notion API for task management
"""
import httpx
from datetime import datetime
from typing import Optional, List, Dict, Any
from ..settings import settings
import logging

logger = logging.getLogger(__name__)


class NotionClient:
    """Client for interacting with Notion API"""
    
    BASE_URL = "https://api.notion.com/v1"
    
    def __init__(self):
        self.token = settings.NOTION_TOKEN
        self.database_id = settings.NOTION_TASKS_DB_ID
        self.version = settings.NOTION_VERSION
        
        if not self.token:
            logger.warning("NOTION_TOKEN not set. Notion integration will not work.")
        if not self.database_id:
            logger.warning("NOTION_TASKS_DB_ID not set. Notion integration will not work.")
    
    def _get_headers(self) -> Dict[str, str]:
        """Get headers for Notion API requests"""
        return {
            "Authorization": f"Bearer {self.token}",
            "Notion-Version": self.version,
            "Content-Type": "application/json",
        }
    
    def _is_configured(self) -> bool:
        """Check if Notion is properly configured"""
        return bool(self.token and self.database_id)
    
    def create_task_in_notion(self, title: str, project_id: str, description: Optional[str] = None, 
                             status: str = "Todo", due_date: Optional[datetime] = None) -> Optional[str]:
        """
        Create a task page in Notion database
        
        Returns: notion_page_id if successful, None otherwise
        """
        if not self._is_configured():
            logger.warning("Notion not configured, skipping task creation")
            return None
        
        try:
            # Build properties for the Notion page
            properties: Dict[str, Any] = {
                "Name": {
                    "title": [
                        {"text": {"content": title}}
                    ]
                },
                "Status": {
                    "select": {
                        "name": status
                    }
                },
                "ProjectId": {
                    "rich_text": [
                        {"text": {"content": project_id}}
                    ]
                }
            }
            
            # Add description if provided
            if description:
                properties["Description"] = {
                    "rich_text": [
                        {"text": {"content": description}}
                    ]
                }
            
            # Add due date if provided
            if due_date:
                properties["Due"] = {
                    "date": {
                        "start": due_date.isoformat()
                    }
                }
            
            # Create page in Notion database
            response = httpx.post(
                f"{self.BASE_URL}/pages",
                headers=self._get_headers(),
                json={
                    "parent": {"database_id": self.database_id},
                    "properties": properties
                },
                timeout=30.0
            )
            
            response.raise_for_status()
            data = response.json()
            notion_page_id = data.get("id")
            logger.info(f"Created task in Notion: {notion_page_id}")
            return notion_page_id
            
        except httpx.HTTPError as e:
            logger.error(f"Failed to create task in Notion: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error creating task in Notion: {e}")
            return None
    
    def update_task_in_notion(self, notion_page_id: str, title: Optional[str] = None,
                             description: Optional[str] = None, due_date: Optional[datetime] = None) -> bool:
        """
        Update task properties in Notion
        
        Returns: True if successful, False otherwise
        """
        if not self._is_configured():
            logger.warning("Notion not configured, skipping task update")
            return False
        
        try:
            properties: Dict[str, Any] = {}
            
            if title is not None:
                properties["Name"] = {
                    "title": [
                        {"text": {"content": title}}
                    ]
                }
            
            if description is not None:
                properties["Description"] = {
                    "rich_text": [
                        {"text": {"content": description}}
                    ]
                }
            
            if due_date is not None:
                properties["Due"] = {
                    "date": {
                        "start": due_date.isoformat()
                    }
                }
            elif due_date is False:  # Explicitly clear due date
                properties["Due"] = {
                    "date": None
                }
            
            if not properties:
                return True  # Nothing to update
            
            response = httpx.patch(
                f"{self.BASE_URL}/pages/{notion_page_id}",
                headers=self._get_headers(),
                json={"properties": properties},
                timeout=30.0
            )
            
            response.raise_for_status()
            logger.info(f"Updated task in Notion: {notion_page_id}")
            return True
            
        except httpx.HTTPError as e:
            logger.error(f"Failed to update task in Notion: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error updating task in Notion: {e}")
            return False
    
    def update_status_in_notion(self, notion_page_id: str, status: str) -> bool:
        """
        Update task status in Notion
        
        Returns: True if successful, False otherwise
        """
        if not self._is_configured():
            logger.warning("Notion not configured, skipping status update")
            return False
        
        try:
            response = httpx.patch(
                f"{self.BASE_URL}/pages/{notion_page_id}",
                headers=self._get_headers(),
                json={
                    "properties": {
                        "Status": {
                            "select": {
                                "name": status
                            }
                        }
                    }
                },
                timeout=30.0
            )
            
            response.raise_for_status()
            logger.info(f"Updated task status in Notion: {notion_page_id} -> {status}")
            return True
            
        except httpx.HTTPError as e:
            logger.error(f"Failed to update status in Notion: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error updating status in Notion: {e}")
            return False
    
    def query_tasks_by_project(self, project_id: str) -> List[Dict[str, Any]]:
        """
        Query tasks from Notion filtered by ProjectId
        
        Returns: List of task pages from Notion
        """
        if not self._is_configured():
            logger.warning("Notion not configured, returning empty list")
            return []
        
        try:
            response = httpx.post(
                f"{self.BASE_URL}/databases/{self.database_id}/query",
                headers=self._get_headers(),
                json={
                    "filter": {
                        "property": "ProjectId",
                        "rich_text": {
                            "equals": project_id
                        }
                    }
                },
                timeout=30.0
            )
            
            response.raise_for_status()
            data = response.json()
            return data.get("results", [])
            
        except httpx.HTTPError as e:
            logger.error(f"Failed to query tasks from Notion: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error querying tasks from Notion: {e}")
            return []
    
    def query_all_tasks(self, status: Optional[str] = None, due_before: Optional[datetime] = None,
                       overdue: bool = False) -> List[Dict[str, Any]]:
        """
        Query all tasks from Notion with optional filters
        
        Args:
            status: Filter by status (Todo, In Progress, Done, Blocked)
            due_before: Filter tasks due before this date
            overdue: If True, filter tasks that are overdue (due date < today and status != Done)
        
        Returns: List of task pages from Notion
        """
        if not self._is_configured():
            logger.warning("Notion not configured, returning empty list")
            return []
        
        try:
            filters: List[Dict[str, Any]] = []
            
            if status:
                filters.append({
                    "property": "Status",
                    "select": {
                        "equals": status
                    }
                })
            
            if due_before:
                filters.append({
                    "property": "Due",
                    "date": {
                        "before": due_before.isoformat()
                    }
                })
            
            if overdue:
                from datetime import date
                today = date.today().isoformat()
                filters.extend([
                    {
                        "property": "Due",
                        "date": {
                            "before": today
                        }
                    },
                    {
                        "property": "Status",
                        "select": {
                            "does_not_equal": "Done"
                        }
                    }
                ])
            
            query_body: Dict[str, Any] = {}
            if filters:
                if len(filters) == 1:
                    query_body["filter"] = filters[0]
                else:
                    query_body["filter"] = {
                        "and": filters
                    }
            
            response = httpx.post(
                f"{self.BASE_URL}/databases/{self.database_id}/query",
                headers=self._get_headers(),
                json=query_body,
                timeout=30.0
            )
            
            response.raise_for_status()
            data = response.json()
            return data.get("results", [])
            
        except httpx.HTTPError as e:
            logger.error(f"Failed to query tasks from Notion: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error querying tasks from Notion: {e}")
            return []
    
    def _extract_task_from_notion_page(self, page: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract task data from a Notion page object
        
        Returns: Dict with title, description, status, due_date, project_id, notion_page_id
        """
        props = page.get("properties", {})
        
        # Extract title
        title_prop = props.get("Name", {})
        title = ""
        if title_prop.get("title") and len(title_prop["title"]) > 0:
            title = title_prop["title"][0].get("plain_text", "")
        
        # Extract description
        desc_prop = props.get("Description", {})
        description = None
        if desc_prop.get("rich_text") and len(desc_prop["rich_text"]) > 0:
            description = desc_prop["rich_text"][0].get("plain_text", "")
        
        # Extract status
        status_prop = props.get("Status", {})
        status = "Todo"
        if status_prop.get("select"):
            status = status_prop["select"].get("name", "Todo")
        
        # Extract due date
        due_prop = props.get("Due", {})
        due_date = None
        if due_prop.get("date") and due_prop["date"].get("start"):
            try:
                due_date = datetime.fromisoformat(due_prop["date"]["start"].replace("Z", "+00:00"))
            except Exception:
                pass
        
        # Extract project_id
        project_id_prop = props.get("ProjectId", {})
        project_id = ""
        if project_id_prop.get("rich_text") and len(project_id_prop["rich_text"]) > 0:
            project_id = project_id_prop["rich_text"][0].get("plain_text", "")
        
        return {
            "title": title,
            "description": description,
            "status": status,
            "due_date": due_date,
            "project_id": project_id,
            "notion_page_id": page.get("id"),
            "last_edited_time": page.get("last_edited_time"),
        }


# Singleton instance
_notion_client = None

def get_notion_client() -> NotionClient:
    """Get or create Notion client instance"""
    global _notion_client
    if _notion_client is None:
        _notion_client = NotionClient()
    return _notion_client

