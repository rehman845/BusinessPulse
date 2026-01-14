"""
Migration script to add hours_per_day and days_per_week columns to employees table
Run this once to update the database schema

Usage:
    python -m app.scripts.migrate_add_employee_schedule_fields
    OR
    python app/scripts/migrate_add_employee_schedule_fields.py
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.db import engine

def migrate():
    """Add hours_per_day and days_per_week columns to employees table"""
    try:
        with engine.begin() as conn:  # begin() auto-commits
            # Check if hours_per_day column exists
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='employees' AND column_name='hours_per_day'
            """))
            
            if not result.fetchone():
                print("Adding 'hours_per_day' column to 'employees' table...")
                conn.execute(text("""
                    ALTER TABLE employees 
                    ADD COLUMN hours_per_day NUMERIC(4, 2) NOT NULL DEFAULT 8.0
                """))
                print("✓ Added 'hours_per_day' column")
            else:
                print("✓ Column 'hours_per_day' already exists")
            
            # Check if days_per_week column exists
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='employees' AND column_name='days_per_week'
            """))
            
            if not result.fetchone():
                print("Adding 'days_per_week' column to 'employees' table...")
                conn.execute(text("""
                    ALTER TABLE employees 
                    ADD COLUMN days_per_week NUMERIC(3, 1) NOT NULL DEFAULT 5.0
                """))
                print("✓ Added 'days_per_week' column")
            else:
                print("✓ Column 'days_per_week' already exists")
            
            print("\n✓ Migration completed successfully!")
    except Exception as e:
        print(f"\n✗ Migration failed: {e}")
        raise

if __name__ == "__main__":
    try:
        migrate()
    except Exception as e:
        sys.exit(1)
