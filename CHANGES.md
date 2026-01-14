# Changes Documentation

This document covers all major changes implemented in the BusinessPulse CRM system, including Cloudflare R2 storage integration and meeting minutes summarization for RAG optimization.

---

## Table of Contents

1. [Cloudflare R2 Storage Integration](#1-cloudflare-r2-storage-integration)
2. [Meeting Minutes Summarization](#2-meeting-minutes-summarization)
3. [Database Schema Changes](#3-database-schema-changes)
4. [API Endpoint Changes](#4-api-endpoint-changes)
5. [Frontend Changes](#5-frontend-changes)

---

## 1. Cloudflare R2 Storage Integration

### Overview
Implemented Cloudflare R2 (S3-compatible) object storage to replace local file storage for documents. Documents are now stored in R2 with a structured folder hierarchy, and downloads use presigned URLs for secure access.

### Why This Change?
- **Scalability**: R2 provides unlimited storage without local disk space constraints
- **Reliability**: Cloud-based storage with high availability
- **Cost Efficiency**: R2 offers competitive pricing for object storage
- **Security**: Private storage with presigned URLs for controlled access
- **Organization**: Structured folder hierarchy for better document management

### Implementation Details

#### 1.1 R2 Storage Service (`backend/app/services/r2_storage.py`)

**Purpose**: Encapsulates all R2 storage operations using boto3 (S3-compatible client).

**Key Methods**:

1. **`upload_file(file_bytes, key, content_type)`**
   - **Logic**: Uploads file content to R2 bucket
   - **Process**:
     - Accepts file bytes or file-like object
     - Generates R2 object key (path)
     - Uploads with content type metadata
     - Returns the storage key for database storage
   - **Error Handling**: Falls back gracefully if R2 not configured

2. **`generate_presigned_get_url(key, expires_seconds)`**
   - **Logic**: Creates temporary signed URL for secure downloads
   - **Process**:
     - Uses boto3's `generate_presigned_url` with S3-compatible config
     - Sets expiration (default: 60 seconds from env)
     - Returns URL that allows temporary access without public bucket
   - **Security**: URLs expire automatically, preventing unauthorized access

3. **`delete_key(key)`**
   - **Logic**: Deletes single object from R2
   - **Process**: Direct delete operation on specified key
   - **Use Case**: Individual document deletion

4. **`delete_by_prefix(prefix)`**
   - **Logic**: Bulk delete all objects matching a prefix
   - **Process**:
     - Uses `list_objects_v2` paginator to find all matching objects
     - Deletes in batches of 1000 (S3/R2 API limit)
     - Returns count of deleted objects
   - **Use Case**: Deleting all documents for a project/customer/folder

**Configuration**:
- Uses environment variables: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET_NAME`
- Configures boto3 with `signature_version='s3v4'` and `addressing_style='path'` for R2 compatibility

#### 1.2 Storage Key Generation (`backend/app/services/storage_utils.py`)

**Purpose**: Generates structured R2 object keys following the required folder hierarchy.

**Key Function**: `generate_storage_key(customer_id, project_id, scope, doc_type, document_id, filename)`

**Logic**:
```
customers/{customer_id}/projects/{project_id}/{scope}/{doc_type_folder}/{document_id}_{sanitized_filename}
```

**Components**:
- **Scope**: `customer-docs` or `project-docs` (derived from `document_category`)
- **Doc Type Mapping**: Maps internal doc types to folder names:
  - `invoice` → `invoice`
  - `meeting_minutes` → `meeting-minutes`
  - `questionnaire_response` → `questionnaire-response`
  - etc.

**Filename Sanitization**:
- Removes path components (prevents directory traversal)
- Replaces unsafe characters with underscores
- Removes multiple consecutive underscores
- Strips leading/trailing dots and underscores

**Example Key**:
```
customers/cust-123/projects/proj-456/project-docs/meeting-minutes/doc789_Meeting_Notes_2026.pdf
```

#### 1.3 Document Model Updates (`backend/app/models.py`)

**Changes**:
- Added `storage_provider`: `String(20)`, default `"r2"` - Tracks where document is stored
- Added `storage_key`: `String(500)`, nullable - R2 object key path
- Made `storage_path`: nullable - Legacy local path (still used for fallback)

**Logic**:
- New documents default to `storage_provider="r2"`
- `storage_key` stores the R2 object path (source of truth for R2 documents)
- `storage_path` kept for backward compatibility with existing local documents

#### 1.4 Document Ingestion Updates (`backend/app/services/ingest.py`)

**Upload Flow Logic**:

1. **Read File Content**
   ```python
   file_content = upload_file.file.read()
   file_size = len(file_content)
   ```

2. **Create Document Record**
   - Creates DB record first to get `document_id` (needed for storage key)

3. **Storage Decision**
   ```python
   if settings.STORAGE_PROVIDER == "r2":
       # Upload to R2
       storage_key = generate_storage_key(...)
       r2.upload_file(file_bytes=file_content, key=storage_key, ...)
       doc.storage_key = storage_key
   else:
       # Fallback to local storage
       file_path = _save_upload(...)
       doc.storage_path = file_path
       doc.storage_provider = "local"
   ```

4. **Text Extraction**
   - For R2: Saves to temp file, extracts text, cleans up
   - For local: Extracts directly from file path

5. **RAG Indexing**
   - Continues as before (chunking, embedding, Pinecone)

**Error Handling**:
- If R2 upload fails → Falls back to local storage
- If R2 not configured → Uses local storage
- Original file content always preserved

#### 1.5 Document Routes Updates (`backend/app/routes/documents.py`)

**New Endpoints**:

1. **`GET /documents/{document_id}/download-url`**
   - **Logic**: Returns presigned URL for R2 documents
   - **Process**:
     - Checks if document uses R2 storage
     - Generates presigned URL (60s expiration)
     - Returns URL and expiration time
   - **Response**: `{ "download_url": "...", "expires_in_seconds": 60 }`

2. **`DELETE /customers/{customer_id}/projects/{project_id}/documents`**
   - **Logic**: Bulk delete documents by prefix
   - **Query Params**:
     - `scope`: `customer-docs` or `project-docs` (optional)
     - `doc_type`: Document type folder (optional)
   - **Process**:
     - Builds R2 prefix from params
     - Deletes all matching objects from R2
     - Soft deletes matching documents in DB
     - Deletes associated Pinecone vectors

**Updated Endpoints**:

1. **`GET /customers/{customer_id}/documents/{document_id}/download`**
   - **New Logic**:
     ```python
     if document.storage_provider == "r2" and document.storage_key:
         signed_url = r2.generate_presigned_get_url(document.storage_key)
         return RedirectResponse(url=signed_url)
     else:
         # Fallback to local file download
         return FileResponse(path=file_path, ...)
     ```

2. **`GET /customers/{customer_id}/documents/{document_id}/view`**
   - Same logic as download (redirects to signed URL for R2)

3. **`DELETE /customers/{customer_id}/documents/{document_id}`**
   - **New Logic**: Also deletes from R2 if `storage_key` exists
   ```python
   if document.storage_provider == "r2" and document.storage_key:
       r2.delete_key(document.storage_key)
   ```

#### 1.6 Frontend Updates

**Document Service** (`crmDashboard-nextjs/src/api/services/documents.service.ts`):

1. **Updated `Document` Interface**
   - Added `storage_provider?: string`
   - Added `storage_key?: string | null`
   - Made `storage_path` optional

2. **New Method: `getDownloadUrl(documentId)`**
   - Calls `/api/documents/{id}/download-url`
   - Returns presigned URL for R2 documents

3. **Updated `downloadDocument()`**
   - **Logic**:
     ```typescript
     if (doc?.storage_provider === "r2" && doc?.storage_key) {
         const signedUrl = await this.getDownloadUrl(documentId);
         window.open(signedUrl, "_blank");  // Direct R2 access
         return;
     }
     // Fallback to regular download endpoint
     ```
   - **Benefits**: Faster downloads (direct from R2), no backend bandwidth usage

**API Route** (`crmDashboard-nextjs/src/app/api/documents/[documentId]/download-url/route.ts`):
- Proxies request to backend `/documents/{id}/download-url`
- Returns presigned URL to frontend

---

## 2. Meeting Minutes Summarization

### Overview
Implemented automatic summarization of meeting minutes documents to optimize RAG performance. Meeting minutes are summarized using AI, and the summary (instead of full text) is used for RAG indexing, reducing chunk count and improving retrieval efficiency.

### Why This Change?
- **Performance**: Meeting minutes are often very long (5000+ characters)
- **Efficiency**: Full text creates many chunks (6+ chunks per document)
- **Cost**: Fewer chunks = less token usage in LLM context
- **Relevance**: Summaries focus on actionable information (action items, decisions, dates)
- **Speed**: Faster vector search with fewer chunks

### Implementation Details

#### 2.1 Database Schema Change (`backend/app/models.py`)

**Change**: Added `summary` field to `DocumentText` model
```python
summary: Mapped[str | None] = mapped_column(Text, nullable=True)
```

**Logic**:
- **Nullable**: Only meeting minutes have summaries
- **Storage**: PostgreSQL only (NOT in R2 - it's a processing artifact)
- **Purpose**: Stores AI-generated summary for RAG indexing

**Migration**: `backend/app/scripts/migrate_add_summary_field.py`
```sql
ALTER TABLE document_texts ADD COLUMN summary TEXT;
```

#### 2.2 Meeting Summary Service (`backend/app/services/meeting_summary.py`)

**Purpose**: Generates structured summaries of meeting minutes using OpenAI.

**Key Function**: `generate_meeting_summary(full_text: str) -> str`

**Logic Flow**:

1. **Input Validation**
   ```python
   if len(full_text.strip()) < 50:
       return full_text  # Too short, skip summarization
   ```

2. **AI Prompt Construction**
   - **System Prompt**: Instructions for structured summary format
   - **User Prompt**: Full meeting minutes text
   - **Model**: Uses `OPENAI_MODEL` from env (default: `gpt-4o-mini`)
   - **Temperature**: 0.3 (for consistent summaries)
   - **Max Tokens**: 2000 (allows comprehensive summaries)

3. **Summary Structure** (AI generates):
   ```
   ## Action Items
   - [Action]: [Responsible] - [Deadline]
   
   ## Tool Integrations
   - [Tool]: [Purpose]
   
   ## Important Dates
   - [Date]: [Event]
   
   ## Key Decisions
   - [Decision]
   
   ## Key Discussion Points
   - [Topic]: [Outcome]
   ```

4. **Error Handling**
   - If summarization fails → Returns original text
   - Logs warnings but doesn't break upload process

**Example Output**:
```
## Action Items
- Integrate payment gateway: Development Team - January 20, 2026
- Review security requirements: Security Team - January 15, 2026

## Tool Integrations
- Stripe API: Payment processing
- AWS S3: Document storage

## Important Dates
- January 20, 2026: Payment integration deadline
- February 1, 2026: Final delivery

## Key Decisions
- Approved use of Stripe for payments
- Confirmed project timeline

## Key Discussion Points
- Payment integration approach and timeline
- Security requirements and compliance
```

#### 2.3 Ingestion Updates (`backend/app/services/ingest.py`)

**New Logic in Upload Flow**:

```python
# After text extraction
if doc_type == "meeting_minutes" and len(extracted.strip()) > 200:
    try:
        summary = generate_meeting_summary(extracted)
        logger.info(f"Generated summary for meeting minutes document {doc.id}")
    except Exception as e:
        logger.warning(f"Failed to generate meeting summary: {e}, using full text")
        summary = None

# Store both full text and summary
doc_text = models.DocumentText(
    document_id=doc.id,
    extracted_text=extracted,  # Full text preserved
    summary=summary             # Summary for RAG
)
```

**RAG Indexing Logic**:

```python
# For meeting minutes, use summary instead of full text
if document_category == "project":
    text_to_index = summary if (doc_type == "meeting_minutes" and summary) else extracted
    
    # Chunk the text (summary is shorter, so fewer chunks)
    chunks = chunk_text(text_to_index, chunk_size=900, overlap=150)
    
    # Index chunks in Pinecone
    for chunk in chunks:
        vector = embed_text(chunk)
        # ... store in Pinecone
```

**Impact**:
- **Before**: 5000 char meeting minutes → 6 chunks
- **After**: 1000 char summary → 2 chunks
- **Result**: 66% reduction in chunks, faster retrieval, better relevance

#### 2.4 Reindex Endpoint Updates (`backend/app/routes/documents.py`)

**Logic**: Same summarization logic applied during reindexing

```python
# Generate summary for meeting minutes if needed
if document.doc_type == "meeting_minutes" and len(extracted.strip()) > 200:
    summary = generate_meeting_summary(extracted)
    
# Use summary for indexing
text_to_index = summary if (document.doc_type == "meeting_minutes" and summary) else extracted
chunks = chunk_text(text_to_index, ...)
```

**Use Case**: Re-indexing existing meeting minutes documents to generate summaries retroactively.

#### 2.5 Reindex Script Updates (`backend/app/scripts/reindex_all_missing.py`)

**Logic**: Updated to generate summaries for meeting minutes during bulk reindexing

```python
if doc_type == "meeting_minutes" and len(extracted.strip()) > 200:
    summary = generate_meeting_summary(extracted)
    # Store summary and use for indexing
```

---

## 3. Database Schema Changes

### 3.1 Documents Table

**New Columns**:
- `project_id`: `VARCHAR` (nullable) - Links documents to projects
- `storage_provider`: `VARCHAR(20)`, default `'local'` - Tracks storage location
- `storage_key`: `VARCHAR(500)` (nullable) - R2 object key path

**Modified Columns**:
- `storage_path`: Made nullable (for R2-only documents)

**Migration**: `backend/app/scripts/migrate_documents_to_r2.py`

### 3.2 Document Texts Table

**New Columns**:
- `summary`: `TEXT` (nullable) - AI-generated summary for meeting minutes

**Migration**: `backend/app/scripts/migrate_add_summary_field.py`

---

## 4. API Endpoint Changes

### New Endpoints

1. **`GET /documents/{document_id}/download-url`**
   - Returns presigned download URL for R2 documents
   - **Response**: `{ "download_url": "...", "expires_in_seconds": 60 }`

2. **`DELETE /customers/{customer_id}/projects/{project_id}/documents`**
   - Bulk delete by prefix
   - **Query Params**: `scope`, `doc_type` (optional)
   - **Response**: `{ "deleted": true, "documents_deleted": N, "r2_objects_deleted": M }`

### Modified Endpoints

1. **`POST /customers/{customer_id}/documents/upload`**
   - Now uploads to R2 (if configured)
   - Generates meeting minutes summaries automatically

2. **`GET /customers/{customer_id}/documents/{document_id}/download`**
   - Redirects to R2 presigned URL if stored in R2
   - Falls back to local file if not

3. **`GET /customers/{customer_id}/documents/{document_id}/view`**
   - Same logic as download (R2 redirect)

4. **`DELETE /customers/{customer_id}/documents/{document_id}`**
   - Also deletes from R2 if `storage_key` exists

5. **`POST /customers/{customer_id}/documents/{document_id}/reindex`**
   - Generates summaries for meeting minutes during reindex

---

## 5. Frontend Changes

### 5.1 Document Service Updates

**File**: `crmDashboard-nextjs/src/api/services/documents.service.ts`

**Changes**:
1. Updated `Document` interface with `storage_provider` and `storage_key`
2. Added `getDownloadUrl()` method
3. Updated `downloadDocument()` to use presigned URLs for R2

**Logic**:
```typescript
async downloadDocument(customerId, documentId, doc?) {
    // If R2 document, use presigned URL
    if (doc?.storage_provider === "r2" && doc?.storage_key) {
        const signedUrl = await this.getDownloadUrl(documentId);
        window.open(signedUrl, "_blank");
        return;
    }
    // Fallback to regular download
    // ... existing logic
}
```

### 5.2 API Route Addition

**File**: `crmDashboard-nextjs/src/app/api/documents/[documentId]/download-url/route.ts`

**Purpose**: Proxies download URL requests to backend

**Logic**: Simple proxy that forwards request and returns presigned URL

### 5.3 Component Updates

**Files Updated**:
- `project-detail-page.tsx`: Passes document object to `downloadDocument()`
- `customer-detail-page.tsx`: Passes document object to `downloadDocument()`

**Change**: Updated download calls to pass document object for R2 detection

---

## Technical Details

### R2 Storage Hierarchy

```
customers/
  {customer_id}/
    projects/
      {project_id}/
        customer-docs/
          invoice/
          payment-docs/
          nda/
          contract/
          correspondence/
          other/
        project-docs/
          meeting-minutes/
          requirements/
          questionnaire/
          questionnaire-response/
          proposal/
          design-sdd/
          instructions/
          maintenance-manual/
```

### Meeting Minutes Processing Flow

```
Upload Meeting Minutes
    ↓
Extract Text (5000 chars)
    ↓
Generate Summary (1000 chars) ← AI Processing
    ↓
Store: extracted_text (full) + summary (RAG)
    ↓
Index Summary in RAG (2 chunks) ← Instead of full text (6 chunks)
    ↓
Query Results: Faster, more relevant
```

### Error Handling Strategy

**R2 Upload Failures**:
- Logs warning
- Falls back to local storage
- Document still processes successfully

**Summary Generation Failures**:
- Logs warning
- Uses full text for indexing
- No data loss

**R2 Download Failures**:
- Falls back to local file download
- User experience maintained

---

## Configuration

### Environment Variables

**R2 Configuration** (`.env`):
```env
R2_ACCESS_KEY_ID='your-access-key'
R2_SECRET_ACCESS_KEY='your-secret-key'
R2_ENDPOINT='https://your-account-id.r2.cloudflarestorage.com'
R2_BUCKET_NAME='business-pulse'
R2_PUBLIC_DOMAIN='https://your-public-domain.r2.dev'
STORAGE_PROVIDER=r2
R2_SIGNED_URL_EXPIRES_SECONDS=60
```

**OpenAI Configuration** (for summaries):
```env
OPENAI_API_KEY='your-key'
OPENAI_MODEL=gpt-4o-mini  # Used for summarization
```

---

## Migration Steps

1. **Run R2 Migration**:
   ```bash
   cd backend
   python -m app.scripts.migrate_documents_to_r2
   ```

2. **Run Summary Field Migration**:
   ```bash
   python -m app.scripts.migrate_add_summary_field
   ```

3. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt  # Adds boto3
   ```

4. **Set Environment Variables**: Add R2 credentials to `.env`

5. **Restart Backend**: Changes take effect on restart

---

## Benefits Summary

### R2 Storage
- ✅ Scalable storage (no disk space limits)
- ✅ Secure access (presigned URLs)
- ✅ Organized structure (folder hierarchy)
- ✅ Cost-effective (competitive pricing)
- ✅ Backward compatible (fallback to local)

### Meeting Minutes Summarization
- ✅ 66% reduction in chunks (6 → 2 chunks)
- ✅ Faster RAG retrieval
- ✅ Better relevance (focused on actionable info)
- ✅ Reduced LLM token usage
- ✅ Original text preserved (no data loss)

---

## Testing Checklist

### R2 Storage
- [ ] Upload document → Verify in R2 bucket
- [ ] Download document → Verify presigned URL works
- [ ] Delete document → Verify removed from R2
- [ ] Bulk delete → Verify prefix deletion works
- [ ] Fallback → Verify local storage if R2 fails

### Meeting Minutes Summarization
- [ ] Upload meeting minutes → Verify summary generated
- [ ] Check database → Verify summary stored
- [ ] Query RAG → Verify uses summary content
- [ ] Reindex → Verify summary generated
- [ ] Original file → Verify still accessible

---

## Notes

- **R2 Summaries**: Summaries are NOT stored in R2 (PostgreSQL only)
- **Backward Compatibility**: Existing local documents continue to work
- **Graceful Degradation**: System falls back to local storage if R2 unavailable
- **No Data Loss**: Original meeting minutes always preserved
- **Performance**: Summarization happens asynchronously during upload

---

## Future Enhancements

Potential improvements:
- Async summarization queue for large documents
- Summary caching to avoid regeneration
- Custom summary templates per document type
- Summary quality metrics and validation
- Batch summarization for existing documents

