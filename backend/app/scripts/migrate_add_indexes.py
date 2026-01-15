"""
Migration script to add performance indexes to the database.
This is a safe, additive change that improves query performance.

Run this script after the database is up:
  docker-compose exec backend python -m app.scripts.migrate_add_indexes
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.db import engine


# List of indexes to create
# Format: (index_name, table_name, column_name(s), is_unique)
INDEXES = [
    # Projects table
    ("idx_projects_customer_id", "projects", "customer_id", False),
    ("idx_projects_status", "projects", "status", False),
    ("idx_projects_created_at", "projects", "created_at", False),
    
    # Documents table
    ("idx_documents_customer_id", "documents", "customer_id", False),
    ("idx_documents_project_id", "documents", "project_id", False),
    ("idx_documents_doc_type", "documents", "doc_type", False),
    ("idx_documents_deleted_at", "documents", "deleted_at", False),
    
    # Invoices table
    ("idx_invoices_status", "invoices", "status", False),
    ("idx_invoices_customer_id", "invoices", "customer_id", False),
    ("idx_invoices_project_id", "invoices", "project_id", False),
    ("idx_invoices_issue_date", "invoices", "issue_date", False),
    
    # Time entries table
    ("idx_time_entries_employee_id", "time_entries", "employee_id", False),
    ("idx_time_entries_project_id", "time_entries", "project_id", False),
    ("idx_time_entries_work_date", "time_entries", "work_date", False),
    
    # Billing expenses table
    ("idx_billing_expenses_project_id", "billing_expenses", "project_id", False),
    ("idx_billing_expenses_expense_type", "billing_expenses", "expense_type", False),
    ("idx_billing_expenses_due_date", "billing_expenses", "due_date", False),
    
    # Tasks table
    ("idx_tasks_project_id", "tasks", "project_id", False),
    ("idx_tasks_status", "tasks", "status", False),
    
    # Project resources table
    ("idx_project_resources_project_id", "project_resources", "project_id", False),
    ("idx_project_resources_resource_id", "project_resources", "resource_id", False),
    
    # Project employees table
    ("idx_project_employees_project_id", "project_employees", "project_id", False),
    ("idx_project_employees_employee_id", "project_employees", "employee_id", False),
    
    # Questionnaires table
    ("idx_questionnaires_customer_id", "questionnaires", "customer_id", False),
    ("idx_questionnaires_project_id", "questionnaires", "project_id", False),
    
    # Chunks table
    ("idx_chunks_document_id", "chunks", "document_id", False),
    
    # Chatbot conversations
    ("idx_chatbot_conversations_session_id", "chatbot_conversations", "session_id", False),
]


def index_exists(conn, index_name: str) -> bool:
    """Check if an index already exists"""
    result = conn.execute(text("""
        SELECT 1 FROM pg_indexes WHERE indexname = :index_name
    """), {"index_name": index_name})
    return result.fetchone() is not None


def table_exists(conn, table_name: str) -> bool:
    """Check if a table exists"""
    result = conn.execute(text("""
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = :table_name
    """), {"table_name": table_name})
    return result.fetchone() is not None


def migrate():
    """Add performance indexes to the database"""
    print("=" * 60)
    print("Adding Performance Indexes")
    print("=" * 60)
    
    created = 0
    skipped = 0
    errors = 0
    
    with engine.begin() as conn:
        for index_name, table_name, columns, is_unique in INDEXES:
            try:
                # Check if table exists
                if not table_exists(conn, table_name):
                    print(f"⏭️  Skipping {index_name}: table '{table_name}' does not exist")
                    skipped += 1
                    continue
                
                # Check if index already exists
                if index_exists(conn, index_name):
                    print(f"✓  Index {index_name} already exists")
                    skipped += 1
                    continue
                
                # Create the index
                unique_clause = "UNIQUE " if is_unique else ""
                sql = f"CREATE {unique_clause}INDEX {index_name} ON {table_name} ({columns})"
                
                print(f"Creating index: {index_name} on {table_name}({columns})...")
                conn.execute(text(sql))
                print(f"✓  Created {index_name}")
                created += 1
                
            except Exception as e:
                print(f"✗  Error creating {index_name}: {e}")
                errors += 1
    
    print("=" * 60)
    print(f"Summary: {created} created, {skipped} skipped, {errors} errors")
    print("=" * 60)
    
    return errors == 0


if __name__ == "__main__":
    success = migrate()
    sys.exit(0 if success else 1)
