from fastapi import FastAPI, Depends, APIRouter
from sqlalchemy.orm import Session
from sqlalchemy import text
from .db import engine, Base, get_db
from .routes.customers import router as customers_router
from .routes.documents import router as documents_router
from .routes.questionnaire import router as questionnaire_router
from .routes.proposal import router as proposal_router
from .routes.chatbot import router as chatbot_router
from fastapi.middleware.cors import CORSMiddleware   #newline


app = FastAPI(title="Context-Aware System Prototype")

# Create DB tables on startup (simple prototype approach)
@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)

@app.get("/health")
def health():
    return {"status": "ok"}

app.include_router(customers_router, prefix="/customers", tags=["customers"])
app.include_router(documents_router, prefix="/customers", tags=["documents"])
app.include_router(questionnaire_router, prefix="/customers", tags=["questionnaire"])
app.include_router(proposal_router, prefix="/customers", tags=["proposal"])
app.include_router(chatbot_router, prefix="", tags=["chatbot"])

# Admin endpoints
admin_router = APIRouter()

@admin_router.post("/documents/reindex-all")
def reindex_all_missing_documents(db: Session = Depends(get_db)):
    """Re-index all documents that are marked as completed but have no chunks."""
    # Get all documents that need reindexing
    result = db.execute(text("""
        SELECT d.id, d.customer_id, d.filename, d.doc_type
        FROM documents d
        LEFT JOIN chunks c ON d.id = c.document_id
        WHERE d.deleted_at IS NULL
        AND d.processing_status = 'completed'
        AND c.id IS NULL
        ORDER BY d.uploaded_at DESC
    """))
    
    docs_to_reindex = list(result)
    
    if not docs_to_reindex:
        return {"message": "All documents are indexed", "reindexed": 0, "total": 0}
    
    return {
        "message": f"Found {len(docs_to_reindex)} documents to reindex",
        "total": len(docs_to_reindex),
        "documents": [
            {
                "id": str(doc_id),
                "customer_id": str(customer_id),
                "filename": filename,
                "doc_type": doc_type,
                "reindex_url": f"/customers/{customer_id}/documents/{doc_id}/reindex"
            }
            for doc_id, customer_id, filename, doc_type in docs_to_reindex[:50]
        ]
    }

app.include_router(admin_router, tags=["admin"])

#newblock
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
