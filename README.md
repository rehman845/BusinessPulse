# BusinessPulse - Context-Aware RAG System

A production-grade **Retrieval-Augmented Generation (RAG)** system for intelligent document analysis and customer requirement management. This system enables AI-powered question answering across customer documents, automated questionnaire generation, and proposal creation.

## 🚀 Features

### Core Capabilities
- **Intelligent Document Search**: Multi-stage RAG pipeline with semantic search, hybrid search, and re-ranking
- **Customer Document Management**: Upload, view, download, and manage documents (PDF, DOCX, TXT)
- **AI-Powered Chatbot**: Ask questions across all customer documents with accurate, cited responses
- **Automated Questionnaire Generation**: Generate engineering-focused clarification questions based on customer requirements
- **Proposal Generation**: Create comprehensive proposals from customer requirements and questionnaire responses
- **Chat History**: Save and manage conversation sessions
- **Temporal Filtering**: Query documents by date (e.g., "requirements before January 10th")
- **Customer Isolation**: Secure data separation between customers

### Advanced RAG Features
- **Query Enhancement**: Automatic query expansion with synonyms and context
- **Hybrid Search**: Combines semantic (vector) and keyword matching
- **LLM Re-ranking**: Uses GPT-4o-mini to score and re-order results
- **Document Type Awareness**: Distinguishes between requirements, proposals, meeting minutes, etc.
- **Template Filtering**: Automatically filters out generic templates from general queries

## 🛠️ Tech Stack

### Backend
- **FastAPI**: Modern Python web framework
- **PostgreSQL**: Relational database for metadata
- **Pinecone**: Vector database for embeddings
- **OpenAI**: GPT-4o-mini for LLM, text-embedding-3-small for embeddings
- **SQLAlchemy**: ORM for database operations
- **Docker**: Containerization

### Frontend
- **Next.js 15**: React framework
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS**: Utility-first CSS
- **React Query**: Data fetching and caching
- **Shadcn/ui**: UI component library

### Infrastructure
- **Docker Compose**: Multi-container orchestration
- **PgAdmin**: Database administration

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Docker** and **Docker Compose** (for backend services)
- **Node.js** 18+ and **npm** (for frontend)
- **Python 3.11+** (optional, for local development)
- **Git**

### API Keys Required
- **OpenAI API Key**: Get from [OpenAI Platform](https://platform.openai.com/api-keys)
- **Pinecone API Key**: Get from [Pinecone Console](https://app.pinecone.io/)
- **Pinecone Index**: Create a vector index in Pinecone (recommended: 1536 dimensions for text-embedding-3-small)

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/rehman845/BusinessPulse.git
cd BusinessPulse
```

### 2. Backend Setup

#### Option A: Using Docker (Recommended)

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Create `.env` file:**
   ```bash
   cp .env.example .env  # If you have an example file
   # Or create .env manually
   ```

3. **Configure environment variables in `.env`:**
   ```env
   DATABASE_URL=postgresql://app:app@context_postgres:5432/contextdb
   OPENAI_API_KEY=your_openai_api_key_here
   OPENAI_MODEL=gpt-4o-mini
   PINECONE_API_KEY=your_pinecone_api_key_here
   PINECONE_INDEX=your_pinecone_index_name
   PINECONE_NAMESPACE=default
   UPLOAD_DIR=app/storage/uploads
   ```

4. **Start PostgreSQL and PgAdmin:**
   ```bash
   cd infra
   docker-compose up -d
   ```

5. **Build and run the backend container:**
   ```bash
   cd ..
   docker build -t businesspulse-backend .
   docker run -d \
     --name businesspulse-backend \
     -p 8001:8000 \
     -v "$(pwd)/app/storage/uploads:/app/app/storage/uploads" \
     --network context_default \
     -e DATABASE_URL="postgresql://app:app@context_postgres:5432/contextdb" \
     -e OPENAI_API_KEY="${OPENAI_API_KEY}" \
     -e PINECONE_API_KEY="${PINECONE_API_KEY}" \
     -e PINECONE_INDEX="${PINECONE_INDEX}" \
     -e PINECONE_NAMESPACE="${PINECONE_NAMESPACE:-default}" \
     businesspulse-backend
   ```

#### Option B: Local Development

1. **Create virtual environment:**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Create `.env` file** (same as above, but use localhost for DATABASE_URL):
   ```env
   DATABASE_URL=postgresql://app:app@localhost:5432/contextdb
   OPENAI_API_KEY=your_openai_api_key_here
   OPENAI_MODEL=gpt-4o-mini
   PINECONE_API_KEY=your_pinecone_api_key_here
   PINECONE_INDEX=your_pinecone_index_name
   PINECONE_NAMESPACE=default
   UPLOAD_DIR=app/storage/uploads
   ```

4. **Start PostgreSQL** (using Docker Compose):
   ```bash
   cd infra
   docker-compose up -d
   ```

5. **Run database migrations** (if needed):
   ```bash
   cd ..
   # The app will create tables automatically on first run
   ```

6. **Start the backend server:**
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
   ```

### 3. Frontend Setup

The frontend (`crmDashboard-nextjs`) should be in a separate directory. If you have it:

1. **Navigate to frontend directory:**
   ```bash
   cd ../crmDashboard-nextjs  # Adjust path as needed
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create `.env.local` file:**
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8001
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

The frontend will be available at `http://localhost:3000`

## 📁 Project Structure

```
BusinessPulse/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI application entry point
│   │   ├── db.py                # Database connection
│   │   ├── models.py            # SQLAlchemy models
│   │   ├── schemas.py           # Pydantic schemas
│   │   ├── settings.py          # Configuration settings
│   │   ├── routes/               # API routes
│   │   │   ├── chatbot.py       # Chatbot endpoints
│   │   │   ├── customers.py     # Customer management
│   │   │   ├── documents.py     # Document upload/download
│   │   │   ├── proposal.py      # Proposal generation
│   │   │   └── questionnaire.py # Questionnaire generation
│   │   ├── services/             # Business logic
│   │   │   ├── chatbot_rag.py   # Main RAG orchestrator
│   │   │   ├── embeddings.py    # Text embedding generation
│   │   │   ├── retrieval.py     # Document retrieval
│   │   │   ├── hybrid_search.py # Hybrid search implementation
│   │   │   ├── reranking.py     # Result re-ranking
│   │   │   ├── query_enhancement.py # Query understanding
│   │   │   ├── ingest.py        # Document ingestion
│   │   │   ├── chunking.py      # Text chunking
│   │   │   ├── pinecone_client.py # Pinecone integration
│   │   │   ├── proposal_gen.py  # Proposal generation logic
│   │   │   └── questionnaire_gen.py # Questionnaire generation
│   │   ├── prompts/              # LLM prompts
│   │   │   ├── engineer_persona.txt
│   │   │   └── proposal_persona.txt
│   │   ├── scripts/              # Utility scripts
│   │   │   └── reindex_all_missing.py
│   │   └── storage/
│   │       └── uploads/          # Uploaded documents
│   ├── infra/
│   │   └── docker-compose.yml   # Docker Compose configuration
│   ├── Dockerfile               # Backend Docker image
│   └── requirements.txt         # Python dependencies
├── RAG_TEST_QUERIES.md          # Test queries for RAG system
└── README.md                     # This file
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Yes | - |
| `OPENAI_API_KEY` | OpenAI API key | Yes | - |
| `OPENAI_MODEL` | OpenAI model to use | No | `gpt-4o-mini` |
| `PINECONE_API_KEY` | Pinecone API key | Yes | - |
| `PINECONE_INDEX` | Pinecone index name | Yes | - |
| `PINECONE_NAMESPACE` | Pinecone namespace | No | `default` |
| `UPLOAD_DIR` | Directory for uploaded files | No | `app/storage/uploads` |

### Pinecone Index Setup

1. Go to [Pinecone Console](https://app.pinecone.io/)
2. Create a new index with:
   - **Dimensions**: `1536` (for text-embedding-3-small)
   - **Metric**: `cosine`
   - **Pod Type**: Choose based on your needs

## 📡 API Documentation

Once the backend is running, access the interactive API documentation:

- **Swagger UI**: http://localhost:8001/docs
- **ReDoc**: http://localhost:8001/redoc

### Key Endpoints

#### Customers
- `GET /api/customers` - List all customers
- `POST /api/customers` - Create a new customer
- `GET /api/customers/{id}` - Get customer details
- `DELETE /api/customers/{id}` - Delete a customer

#### Documents
- `GET /api/customers/{id}/documents` - List customer documents
- `POST /api/customers/{id}/documents` - Upload a document
- `GET /api/customers/{id}/documents/{doc_id}/view` - View document (inline)
- `GET /api/customers/{id}/documents/{doc_id}/download` - Download document
- `DELETE /api/customers/{id}/documents/{doc_id}` - Delete document

#### Chatbot
- `POST /api/chat` - Send a chat message
- `GET /api/chat/sessions` - List all chat sessions
- `GET /api/chat/sessions/{session_id}/messages` - Get chat history
- `DELETE /api/chat/sessions/{session_id}` - Delete a chat session

#### Questionnaires
- `POST /api/customers/{id}/questionnaire/generate` - Generate questionnaire
- `GET /api/customers/{id}/questionnaire` - Get questionnaire

#### Proposals
- `POST /api/customers/{id}/proposal/generate` - Generate proposal
- `GET /api/customers/{id}/proposal` - Get proposal

## 🎯 Usage Examples

### 1. Create a Customer

```bash
curl -X POST http://localhost:8001/api/customers \
  -H "Content-Type: application/json" \
  -d '{"name": "Acme Corp", "email": "contact@acme.com"}'
```

### 2. Upload a Document

```bash
curl -X POST http://localhost:8001/api/customers/{customer_id}/documents \
  -F "file=@requirements.pdf" \
  -F "doc_type=requirements"
```

### 3. Ask a Question via Chatbot

```bash
curl -X POST http://localhost:8001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are the requirements for customer P10?",
    "session_id": "optional-session-id"
  }'
```

### 4. Generate a Questionnaire

```bash
curl -X POST http://localhost:8001/api/customers/{customer_id}/questionnaire/generate
```

## 🔍 RAG System Details

### Query Processing Pipeline

1. **Query Understanding**: Analyzes intent, extracts customer references, detects document types
2. **Query Enhancement**: Expands query with synonyms and context
3. **Multi-Stage Retrieval**:
   - Semantic search (vector similarity)
   - Hybrid search (semantic + keyword)
   - Direct filtered search (for specific document types)
4. **Re-ranking**: LLM-based relevance scoring
5. **Context Assembly**: Formats retrieved chunks for LLM
6. **Response Generation**: GPT-4o-mini generates answer with citations

### Document Types

- `requirements`: Customer requirements documents
- `meeting_minutes`: Meeting notes and discussions
- `email`: Email communications
- `questionnaire`: Generated questionnaire (template)
- `questionnaire_response`: Customer's filled responses
- `proposal`: Generated proposal document

### Supported Query Types

- **General Queries**: "What are customers saying?"
- **Customer-Specific**: "What did customer P10 say?"
- **Document Type**: "Show me all requirements"
- **Temporal**: "Requirements before January 10th"
- **Analytical**: "Compare requirements between customers"

## 🐛 Troubleshooting

### Backend Issues

**Problem**: Backend container won't start
- **Solution**: Check Docker logs: `docker logs businesspulse-backend`
- Verify environment variables are set correctly
- Ensure PostgreSQL container is running: `docker ps`

**Problem**: "File not found" when viewing documents
- **Solution**: Ensure volume mount is correct in Docker run command
- Check file permissions in `app/storage/uploads`

**Problem**: Pinecone connection errors
- **Solution**: Verify `PINECONE_API_KEY` and `PINECONE_INDEX` are correct
- Check Pinecone index exists and has correct dimensions (1536)

**Problem**: Database connection errors
- **Solution**: Verify `DATABASE_URL` matches Docker Compose configuration
- Ensure PostgreSQL container is running: `docker-compose ps`

### Frontend Issues

**Problem**: Frontend can't connect to backend
- **Solution**: Check `NEXT_PUBLIC_API_URL` in `.env.local`
- Verify backend is running on port 8001
- Check CORS settings if needed

**Problem**: Port 3000 already in use
- **Solution**: Kill the process: `lsof -ti:3000 | xargs kill` (Mac/Linux) or `netstat -ano | findstr :3000` then `taskkill /PID <pid> /F` (Windows)
- Or use a different port: `npm run dev -- -p 3001`

### RAG Issues

**Problem**: Chatbot returns irrelevant results
- **Solution**: Check if documents are properly indexed in Pinecone
- Verify embeddings are being generated correctly
- Try adjusting `min_score` threshold in query

**Problem**: Empty responses
- **Solution**: Check if documents exist for the customer
- Verify document text extraction was successful
- Check Pinecone index has vectors

## 🧪 Testing

Test queries are available in `RAG_TEST_QUERIES.md`. Use these to verify the RAG system is working correctly.

Example test:
```bash
curl -X POST http://localhost:8001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"query": "What are the common themes across all customer requirements?"}'
```

## 📝 Development

### Running Tests

Currently, manual testing via API endpoints is recommended. See `RAG_TEST_QUERIES.md` for test cases.

### Code Structure

- **Routes**: Handle HTTP requests/responses
- **Services**: Business logic and RAG orchestration
- **Models**: Database schema definitions
- **Schemas**: API request/response validation

### Adding New Features

1. Add database models in `app/models.py`
2. Create Pydantic schemas in `app/schemas.py`
3. Implement business logic in `app/services/`
4. Create API routes in `app/routes/`
5. Register routes in `app/main.py`

## 🔒 Security Considerations

- **API Keys**: Never commit `.env` files to version control
- **Customer Isolation**: System enforces strict customer data separation
- **File Uploads**: Validate file types and sizes
- **Database**: Use strong passwords in production
- **CORS**: Configure CORS appropriately for production

## 📄 License

This project is private and proprietary.

## 🤝 Contributing

This is a private repository. For contributions, please contact the repository owner.

## 📧 Support

For issues or questions, please open an issue in the GitHub repository.

## 🎉 Acknowledgments

Built with:
- FastAPI
- OpenAI GPT-4o-mini
- Pinecone
- Next.js
- PostgreSQL

---

**Happy Coding! 🚀**
