# RAG System Architecture & Flow Explanation

## Overview
Your system uses a **Retrieval-Augmented Generation (RAG)** architecture to enable AI-powered question answering across customer documents. Here's how it works:

---

## 🏗️ System Architecture

### **1. Data Storage Layers**

#### **PostgreSQL (Relational Database)**
- **Purpose**: Stores document metadata and relationships
- **Tables**:
  - `documents`: Document metadata (id, customer_id, project_id, doc_type, filename, etc.)
  - `document_text`: Full extracted text from documents
  - `chunks`: Chunk records linking to documents (chunk_index, chunk_text, pinecone_vector_id)
  - `customers`: Customer information
  - `chatbot_conversations`: Chat history

#### **Pinecone (Vector Database)**
- **Purpose**: Stores document embeddings for semantic search
- **What's stored**:
  - **Vector embeddings**: 1536-dimensional vectors (from OpenAI `text-embedding-3-small`)
  - **Metadata**: customer_id, document_id, chunk_index, doc_type, text, uploaded_at, etc.
  - **Vector ID format**: `{document_id}_{chunk_index}` (e.g., `doc123_0`, `doc123_1`)
- **Namespace**: Configurable via `PINECONE_NAMESPACE` (default: "default")

---

## 📥 **Document Ingestion Pipeline** (When you upload a document)

### **Step 1: File Upload** (`ingest_document` in `services/ingest.py`)
```
User uploads document → FastAPI receives file
```

### **Step 2: Text Extraction**
- Extracts text from PDF, DOCX, or TXT files
- Uses `pypdf` for PDFs, `python-docx` for DOCX
- Stores full text in `document_text` table

### **Step 3: Document Categorization**
- **Only "project" documents are indexed** (customer documents are NOT indexed)
- Document category determines if it goes into RAG:
  - ✅ `document_category="project"` → Indexed in Pinecone
  - ❌ `document_category="customer"` → NOT indexed (only stored in DB)

### **Step 4: Chunking** (`services/chunking.py` or `chunking_improved.py`)
- Splits long documents into smaller chunks
- **Default settings**:
  - `chunk_size = 900` characters
  - `overlap = 150` characters (ensures context continuity)
- **Why chunking?**
  - Large documents don't fit in LLM context
  - Smaller chunks improve search precision
  - Overlap prevents losing context at boundaries

**Example:**
```
Original text (2000 chars) →
  Chunk 0: chars 0-900
  Chunk 1: chars 750-1650 (150 char overlap)
  Chunk 2: chars 1500-2000
```

### **Step 5: Embedding Generation** (`services/embeddings.py`)
- Each chunk is converted to a vector embedding
- Uses **OpenAI `text-embedding-3-small`** model
- Produces 1536-dimensional vector representing semantic meaning

### **Step 6: Storage in Pinecone**
- Each chunk stored as a vector with metadata:
  ```python
  {
    "id": "doc123_0",  # document_id + chunk_index
    "values": [0.123, -0.456, ...],  # 1536-dim vector
    "metadata": {
      "customer_id": "cust-123",
      "document_id": "doc123",
      "chunk_index": 0,
      "doc_type": "requirements",
      "document_category": "project",
      "text": "The actual chunk text...",
      "uploaded_at": "2026-01-13T10:00:00",
      "customer_name": "Acme Corp",
      "document_filename": "requirements.pdf",
      "project_id": "proj-456"  # optional
    }
  }
  ```

### **Step 7: Local Database Storage**
- Stores chunk record in PostgreSQL `chunks` table:
  - Links to document
  - Stores `pinecone_vector_id` for traceability
  - Enables deletion/updates

---

## 🔍 **Query/Retrieval Pipeline** (When user asks a question)

### **Step 1: Query Enhancement** (`services/query_enhancement.py`)
- **Extracts query intent**:
  - Document types mentioned (proposal, requirements, etc.)
  - Question type (what, who, when, etc.)
  - Time references
  - Customer references
- **Enhances query**:
  - Adds synonyms and context
  - Expands query for better semantic matching
  - Example: "what did customer say" → "what did customer say response answers replied"

### **Step 2: Vector Search** (`services/chatbot_rag.py`)
- Converts user query to embedding vector
- Searches Pinecone for similar chunks:
  ```python
  query_vector = embed_text(enhanced_query)
  results = pinecone_index.query(
    vector=query_vector,
    top_k=20,  # Get top 20 results
    filter={"document_category": {"$eq": "project"}},  # Only project docs
    include_metadata=True
  )
  ```
- Returns chunks ranked by similarity score (0.0-1.0)

### **Step 3: Hybrid Search** (Optional, `services/hybrid_search.py`)
- Combines semantic (vector) search with keyword matching
- **Semantic weight**: 70% (vector similarity)
- **Keyword weight**: 30% (exact keyword matches)
- Improves results for queries with specific terms

### **Step 4: Re-ranking** (Optional, `services/reranking.py`)
- Uses GPT-4o-mini to score relevance of top results
- Re-orders results based on LLM's understanding
- Only applied if >3 results found

### **Step 5: Context Building**
- Takes top-k chunks (default: 20)
- Formats them with metadata:
  ```
  [requirements | chunk 0]
  Customer: Acme Corp
  Uploaded: 2026-01-13
  Text: The system must support...
  ```

### **Step 6: LLM Response Generation** (`services/chatbot_rag.py`)
- Sends context + user query to GPT-4o-mini
- **System prompt** includes:
  - Instructions on document types
  - Formatting guidelines
  - Accuracy requirements
- LLM generates answer based on retrieved context
- Response is returned to user

---

## 📊 **What Goes Into RAG?**

### **✅ Indexed (In Pinecone)**
- **Project Documents** (`document_category="project"`):
  - Meeting minutes
  - Requirements documents
  - Questionnaires (generated)
  - Questionnaire responses (customer answers)
  - Proposals
  - Design documents (SDD)
  - Instruction manuals
  - Maintenance docs

### **❌ NOT Indexed (Only in PostgreSQL)**
- **Customer Documents** (`document_category="customer"`):
  - Invoices
  - Payment documents
  - NDAs
  - Contracts
  - Correspondence
  - Other customer-specific docs

**Why?** Customer documents are typically financial/legal and don't need semantic search. Project documents contain requirements, discussions, and technical content that benefit from RAG.

---

## 🔄 **Data Flow Diagram**

```
┌─────────────────┐
│  User Uploads   │
│    Document     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Extract Text   │
│  (PDF/DOCX/TXT) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│  Is Project     │ NO   │ Store in DB  │
│   Document?     ├─────▶│ Only (No RAG)│
└────────┬────────┘      └──────────────┘
         │ YES
         ▼
┌─────────────────┐
│  Chunk Text     │
│  (900 chars,    │
│   150 overlap) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Generate       │
│ Embeddings     │
│ (1536-dim)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│ Store in       │      │ Store in     │
│ Pinecone       │      │ PostgreSQL   │
│ (Vector DB)    │      │ (Metadata)   │
└─────────────────┘      └──────────────┘

         ═══════════════════════════════

┌─────────────────┐
│  User Asks     │
│   Question      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Enhance Query  │
│ (Add context)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Convert to     │
│ Embedding      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Search Pinecone│
│ (Vector Search)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Hybrid Search  │
│ (Optional)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Re-rank Results│
│ (Optional)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Build Context  │
│ (Top-k chunks) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Generate Answer│
│ (GPT-4o-mini)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Return to User │
└─────────────────┘
```

---

## 🎯 **Key Configuration**

### **Chunking Parameters** (`services/chunking.py`)
- `chunk_size = 900`: Characters per chunk
- `overlap = 150`: Overlap between chunks
- **To change**: Modify in `ingest.py` line 200 or `chunking.py`

### **Embedding Model** (`services/embeddings.py`)
- Model: `text-embedding-3-small`
- Dimensions: 1536
- **To change**: Modify `embed_text()` function

### **Search Parameters** (`services/chatbot_rag.py`)
- `top_k = 20`: Number of chunks to retrieve
- `min_score = 0.3`: Minimum similarity threshold (lower = more results)
- **To change**: Modify `search_all_documents()` function

### **LLM Model** (`settings.py`)
- Model: `gpt-4o-mini` (default)
- **To change**: Set `OPENAI_MODEL` in `.env`

---

## 🔧 **Common Modifications**

### **1. Change Chunk Size**
```python
# In services/ingest.py, line 200
chunks = chunk_text(extracted, chunk_size=1200, overlap=200)  # Larger chunks
```

### **2. Index Customer Documents**
```python
# In services/ingest.py, line 195
# Change from:
if document_category == "project":
# To:
if document_category in ["project", "customer"]:  # Also index customer docs
```

### **3. Change Search Threshold**
```python
# In routes/chatbot.py, line 18
min_score: float = 0.2  # Lower threshold = more results
```

### **4. Add Custom Metadata**
```python
# In services/ingest.py, line 209
metadata = {
    # ... existing fields ...
    "custom_field": "value",  # Add your field
}
```

### **5. Filter by Project**
```python
# In services/chatbot_rag.py, line 51
filter={
    "document_category": {"$eq": "project"},
    "project_id": {"$eq": specific_project_id}  # Add project filter
}
```

---

## 🗑️ **Deletion Flow**

When a document is deleted:
1. **Soft delete** in PostgreSQL (`deleted_at` timestamp)
2. **Delete vectors** from Pinecone (using `pinecone_vector_id`)
3. **Delete chunks** from PostgreSQL
4. Document no longer appears in searches

---

## 📝 **Summary**

**What's in RAG:**
- ✅ Project documents (requirements, proposals, meeting minutes, etc.)
- ✅ Chunked into 900-char pieces with 150-char overlap
- ✅ Stored as 1536-dim vectors in Pinecone
- ✅ Metadata includes customer_id, doc_type, text, dates

**What's NOT in RAG:**
- ❌ Customer documents (invoices, contracts, etc.)
- ❌ Documents with `document_category="customer"`

**Query Flow:**
1. User question → Query enhancement
2. Enhanced query → Vector embedding
3. Vector search in Pinecone → Top-k chunks
4. Optional: Hybrid search + Re-ranking
5. Context + Query → LLM → Answer

This architecture enables semantic search across all project documents while keeping customer documents private and searchable only via direct database queries.

