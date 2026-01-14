"""
Migration script to add project_id column to documents table
Run this once to update the database schema

Usage:
    python -m app.scripts.add_project_id_to_documents
    OR
    python app/scripts/add_project_id_to_documents.py
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.db import engine

def migrate():
    """Add project_id column to documents table if it doesn't exist"""
    try:
        with engine.begin() as conn:  # begin() auto-commits
            # Check if column exists
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='documents' AND column_name='project_id'
            """))
            
            if result.fetchone():
                print("✓ Column 'project_id' already exists in 'documents' table")
                return
            
            # Add the column
            print("Adding 'project_id' column to 'documents' table...")
            conn.execute(text("""
                ALTER TABLE documents 
                ADD COLUMN project_id VARCHAR
            """))
            print("✓ Successfully added 'project_id' column to 'documents' table")
    except Exception as e:
        print(f"✗ Error: {e}")
        raise

if __name__ == "__main__":
    try:
        migrate()
        print("\n✓ Migration completed successfully!")
    except Exception as e:
        print(f"\n✗ Migration failed: {e}")
        print("\nYou can also run the SQL directly:")
        print("  See: backend/app/scripts/migrate_documents.sql")
        sys.exit(1)
