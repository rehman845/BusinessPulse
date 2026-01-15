"""
Migration script to add email and company_name columns to customers table
Run this once to update the database schema

Usage:
    python -m app.scripts.migrate_add_customer_email_company
    OR
    python app/scripts/migrate_add_customer_email_company.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.db import engine

def migrate():
    """Add email and company_name columns to customers table if they don't exist"""
    try:
        with engine.begin() as conn:
            # Check and add email column
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='customers' AND column_name='email'
            """))
            if not result.fetchone():
                print("Adding 'email' column to 'customers' table...")
                conn.execute(text("ALTER TABLE customers ADD COLUMN email VARCHAR(200)"))
                print("✓ Added 'email' column")
            else:
                print("✓ Column 'email' already exists")

            # Check and add company_name column
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='customers' AND column_name='company_name'
            """))
            if not result.fetchone():
                print("Adding 'company_name' column to 'customers' table...")
                conn.execute(text("ALTER TABLE customers ADD COLUMN company_name VARCHAR(200)"))
                print("✓ Added 'company_name' column")
            else:
                print("✓ Column 'company_name' already exists")

        print("Migration completed successfully!")
    except Exception as e:
        print(f"✗ Error during migration: {e}")
        raise

if __name__ == "__main__":
    try:
        migrate()
    except Exception:
        sys.exit(1)
