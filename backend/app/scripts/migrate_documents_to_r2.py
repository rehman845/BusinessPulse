"""
Migration script to add R2 storage columns and project_id to documents table
Run this once to update the database schema
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.db import engine

def migrate():
    """Add missing columns to documents table"""
    try:
        with engine.begin() as conn:  # begin() auto-commits
            # Check and add project_id column
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='documents' AND column_name='project_id'
            """))
            
            if not result.fetchone():
                print("Adding 'project_id' column to 'documents' table...")
                conn.execute(text("""
                    ALTER TABLE documents 
                    ADD COLUMN project_id VARCHAR
                """))
                print("✓ Added 'project_id' column")
            else:
                print("✓ Column 'project_id' already exists")
            
            # Check and add storage_provider column
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='documents' AND column_name='storage_provider'
            """))
            
            if not result.fetchone():
                print("Adding 'storage_provider' column to 'documents' table...")
                conn.execute(text("""
                    ALTER TABLE documents 
                    ADD COLUMN storage_provider VARCHAR(20) DEFAULT 'local'
                """))
                # Update existing rows to 'local'
                conn.execute(text("""
                    UPDATE documents 
                    SET storage_provider = 'local' 
                    WHERE storage_provider IS NULL
                """))
                print("✓ Added 'storage_provider' column")
            else:
                print("✓ Column 'storage_provider' already exists")
            
            # Check and add storage_key column
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='documents' AND column_name='storage_key'
            """))
            
            if not result.fetchone():
                print("Adding 'storage_key' column to 'documents' table...")
                conn.execute(text("""
                    ALTER TABLE documents 
                    ADD COLUMN storage_key VARCHAR(500)
                """))
                print("✓ Added 'storage_key' column")
            else:
                print("✓ Column 'storage_key' already exists")
            
            # Make storage_path nullable (for R2-only documents)
            try:
                conn.execute(text("""
                    ALTER TABLE documents 
                    ALTER COLUMN storage_path DROP NOT NULL
                """))
                print("✓ Made 'storage_path' nullable")
            except Exception as e:
                # Column might already be nullable or error for other reasons
                if "does not exist" not in str(e).lower() and "not null" not in str(e).lower():
                    print(f"  Note: Could not modify storage_path: {e}")
            
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

