# Cloudflare R2 Storage Migration Guide

## Overview
This document describes the changes made to implement Cloudflare R2 storage for documents.

## Backend Changes

### 1. Database Migration
Run the migration script to add required columns:

```bash
cd backend
python -m app.scripts.migrate_documents_to_r2
```

Or run SQL directly:
```sql
ALTER TABLE documents ADD COLUMN project_id VARCHAR;
ALTER TABLE documents ADD COLUMN storage_provider VARCHAR(20) DEFAULT 'local';
ALTER TABLE documents ADD COLUMN storage_key VARCHAR(500);
ALTER TABLE documents ALTER COLUMN storage_path DROP NOT NULL;
```

### 2. Environment Variables
Ensure these are set in `backend/.env`:

```env
R2_ACCESS_KEY_ID='your-access-key'
R2_SECRET_ACCESS_KEY='your-secret-key'
R2_ENDPOINT='https://your-account-id.r2.cloudflarestorage.com'
R2_BUCKET_NAME='business-pulse'
R2_PUBLIC_DOMAIN='https://your-public-domain.r2.dev'
STORAGE_PROVIDER=r2
R2_SIGNED_URL_EXPIRES_SECONDS=60
```

### 3. Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

## Frontend Changes

### 1. Document Download
The frontend now automatically uses signed URLs for R2 documents. No changes needed in existing code - the `downloadDocument` function handles both R2 and local storage.

### 2. Document Upload
Uploads now automatically go to R2 if `STORAGE_PROVIDER=r2` is set. The scope (customer-docs vs project-docs) is automatically derived from `document_category`.

## Storage Key Structure

Documents are stored in R2 with the following key structure:

```
customers/{customer_id}/projects/{project_id}/{scope}/{doc_type}/{document_id}_{filename}
```

Where:
- `scope` is either `customer-docs` or `project-docs`
- `doc_type` is mapped to folder names (e.g., `invoice`, `meeting-minutes`)

## API Endpoints

### New Endpoints

1. **GET /documents/{document_id}/download-url**
   - Returns a presigned download URL for R2 documents
   - Response: `{ "download_url": "...", "expires_in_seconds": 60 }`

2. **DELETE /customers/{customer_id}/projects/{project_id}/documents**
   - Bulk delete documents by prefix
   - Query params:
     - `scope` (optional): `customer-docs` or `project-docs`
     - `doc_type` (optional): Document type folder name
   - Deletes from both R2 and marks DB as deleted

### Updated Endpoints

- **POST /customers/{customer_id}/documents/upload**: Now uploads to R2
- **GET /customers/{customer_id}/documents/{document_id}/download**: Redirects to signed URL for R2 documents
- **GET /customers/{customer_id}/documents/{document_id}/view**: Redirects to signed URL for R2 documents

## Document Types

### Customer Docs (`customer-docs`)
- invoice
- payment-docs
- nda
- contract
- correspondence
- other

### Project Docs (`project-docs`)
- meeting-minutes
- requirements
- questionnaire
- questionnaire-response
- proposal
- design-sdd
- instructions
- maintenance-manual

## Testing

1. **Upload Test**:
   - Upload a document from the project or customer page
   - Check R2 bucket to verify file is stored with correct key structure
   - Verify DB has `storage_provider='r2'` and `storage_key` populated

2. **Download Test**:
   - Click download on an R2-stored document
   - Verify it opens/downloads correctly using signed URL

3. **Bulk Delete Test**:
   - Use the bulk delete endpoint to remove documents by prefix
   - Verify files are deleted from R2 and DB records are soft-deleted

## Rollback

If you need to rollback to local storage:

1. Set `STORAGE_PROVIDER=local` in `.env`
2. Restart backend
3. New uploads will use local storage
4. Existing R2 documents will still be accessible via signed URLs

## Notes

- The system falls back to local storage if R2 is not configured
- Existing local documents continue to work
- R2 documents use signed URLs (60s expiration by default)
- Bulk delete supports prefix-based deletion for efficient cleanup

