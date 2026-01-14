# Meeting Minutes Summarization Implementation

## Overview
Meeting minutes are now automatically summarized when uploaded. The summary is used for RAG indexing instead of the full text, improving efficiency and performance.

## Storage Decision: PostgreSQL Only (NOT R2)

**Decision**: Summaries are stored in PostgreSQL `document_texts.summary` field, **NOT in Cloudflare R2**.

**Reasoning**:
- Summaries are **internal processing artifacts** for RAG optimization
- Users access the **original meeting minutes** file (stored in R2)
- Summaries are only used during RAG indexing/retrieval
- No need to store summaries in object storage - they're database metadata

## Implementation Details

### 1. Database Schema
- Added `summary` field to `document_texts` table (TEXT, nullable)
- Stores AI-generated summary of meeting minutes

### 2. Summarization Service (`services/meeting_summary.py`)
- Uses OpenAI model from `OPENAI_MODEL` env variable (default: `gpt-4o-mini`)
- Generates structured summaries with:
  - **Action Items**: What needs to be done, responsible parties, deadlines
  - **Tool Integrations**: Tools, software, platforms mentioned
  - **Important Dates**: Deadlines, milestones, meeting dates
  - **Key Decisions**: Important decisions made
  - **Key Discussion Points**: Critical topics and outcomes

### 3. Processing Flow

#### **On Upload** (`services/ingest.py`):
1. Extract text from meeting minutes document
2. **If `doc_type == "meeting_minutes"`**:
   - Generate summary using `generate_meeting_summary()`
   - Store summary in `document_texts.summary`
   - Store full text in `document_texts.extracted_text`
3. **For RAG indexing**:
   - Use **summary** instead of full text for meeting minutes
   - Use full text for all other document types

#### **On Reindex** (`routes/documents.py`):
- Same logic: Generate summary if meeting minutes, use summary for indexing

### 4. RAG Indexing Behavior

**Before** (Full Text):
```
Meeting Minutes (5000 chars) → Chunked into 6 chunks → Indexed in Pinecone
```

**After** (Summary):
```
Meeting Minutes (5000 chars) → Summary (1000 chars) → Chunked into 2 chunks → Indexed in Pinecone
```

**Benefits**:
- ✅ Fewer chunks = faster retrieval
- ✅ More focused content = better relevance
- ✅ Reduced token usage in LLM context
- ✅ Improved search precision

## Migration

Run the migration script to add the `summary` field:

```bash
cd backend
python -m app.scripts.migrate_add_summary_field
```

Or run SQL directly:
```sql
ALTER TABLE document_texts ADD COLUMN summary TEXT;
```

## Configuration

The summarization uses:
- **Model**: `OPENAI_MODEL` from `.env` (default: `gpt-4o-mini`)
- **Temperature**: 0.3 (for consistent summaries)
- **Max Tokens**: 2000 (allows comprehensive summaries)

## Example Summary Format

```
## Action Items
- Integrate payment gateway: Development Team - January 20, 2026
- Review security requirements: Security Team - January 15, 2026
- Schedule follow-up meeting: Project Manager - January 18, 2026

## Tool Integrations
- Stripe API: Payment processing integration
- AWS S3: Document storage solution
- Slack: Team communication platform

## Important Dates
- January 20, 2026: Payment integration deadline
- January 25, 2026: Project milestone review
- February 1, 2026: Final delivery date

## Key Decisions
- Approved use of Stripe for payment processing
- Decided on AWS S3 for document storage
- Confirmed project timeline and milestones

## Key Discussion Points
- Payment integration approach and timeline
- Security requirements and compliance
- Resource allocation and team assignments
```

## Fallback Behavior

- If summarization fails: Uses full text for indexing (no data loss)
- If text too short (< 200 chars): Skips summarization, uses full text
- Original meeting minutes file: Always preserved in R2/local storage

## Testing

1. **Upload a meeting minutes document**
2. **Check database**: `document_texts.summary` should contain summary
3. **Check RAG**: Query should return results based on summary content
4. **Verify original file**: Still accessible for download/viewing

## Notes

- Summaries are generated **asynchronously** during document processing
- Original meeting minutes text is **always preserved** in `extracted_text`
- Users can still download/view the **original full document**
- Only the **RAG indexing** uses the summary (for efficiency)

