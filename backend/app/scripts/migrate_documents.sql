-- Migration: Add project_id column to documents table
-- Run this SQL directly in your PostgreSQL database

-- Check if column exists and add it if it doesn't
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'documents' 
        AND column_name = 'project_id'
    ) THEN
        ALTER TABLE documents ADD COLUMN project_id VARCHAR;
        RAISE NOTICE 'Column project_id added to documents table';
    ELSE
        RAISE NOTICE 'Column project_id already exists in documents table';
    END IF;
END $$;


