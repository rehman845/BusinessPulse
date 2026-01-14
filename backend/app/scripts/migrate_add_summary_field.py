"""
Migration script to add summary field to document_texts table
Run this once to update the database schema
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.db import engine

def migrate():
    """Add summary column to document_texts table"""
    try:
        with engine.begin() as conn:  # begin() auto-commits
            # Check if column exists
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='document_texts' AND column_name='summary'
            """))
            
            if result.fetchone():
                print("✓ Column 'summary' already exists in 'document_texts' table")
                return
            
            # Add the column
            print("Adding 'summary' column to 'document_texts' table...")
            conn.execute(text("""
                ALTER TABLE document_texts 
                ADD COLUMN summary TEXT
            """))
            print("✓ Successfully added 'summary' column to 'document_texts' table")
            
    except Exception as e:
        print(f"✗ Error: {e}")
        raise

if __name__ == "__main__":
    try:
        migrate()
        print("\n✓ Migration completed successfully!")
    except Exception as e:
        print(f"\n✗ Migration failed: {e}")
        sys.exit(1)

