from fastapi import FastAPI, Depends, APIRouter, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from .db import engine, Base, get_db
from .routes.customers import router as customers_router
from .routes.documents import router as documents_router
from .routes.questionnaire import router as questionnaire_router
from .routes.proposal import router as proposal_router
from .routes.chatbot import router as chatbot_router
from .routes.resources import router as resources_router
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
app.include_router(resources_router, prefix="", tags=["resources"])

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

@admin_router.delete("/documents/delete-all")
def delete_all_documents_endpoint(db: Session = Depends(get_db), delete_files: bool = True):
    """Delete all documents from all customers. WARNING: This is irreversible!"""
    from . import models
    from .services.pinecone_client import index as pinecone_index
    from .settings import settings
    import os
    
    try:
        # Get all chunks to delete from Pinecone
        all_chunks = db.query(models.Chunk).all()
        vector_ids = [chunk.pinecone_vector_id for chunk in all_chunks if chunk.pinecone_vector_id]
        
        # Delete vectors from Pinecone
        if vector_ids:
            namespace = (settings.PINECONE_NAMESPACE or "").strip()
            try:
                batch_size = 1000
                for i in range(0, len(vector_ids), batch_size):
                    batch = vector_ids[i:i + batch_size]
                    pinecone_index.delete(ids=batch, namespace=namespace if namespace else None)
            except Exception as e:
                pass  # Continue even if Pinecone deletion fails
        
        # Delete all chunks
        chunk_count = db.query(models.Chunk).count()
        db.query(models.Chunk).delete()
        
        # Delete all document_texts
        text_count = db.query(models.DocumentText).count()
        db.query(models.DocumentText).delete()
        
        # Get document count before deletion
        doc_count = db.query(models.Document).count()
        
        # Delete all documents
        db.query(models.Document).delete()
        db.commit()
        
        # Optionally delete physical files
        files_deleted = 0
        if delete_files:
            base_dir = settings.UPLOAD_DIR
            if os.path.exists(base_dir):
                for customer_dir in os.listdir(base_dir):
                    customer_path = os.path.join(base_dir, customer_dir)
                    if os.path.isdir(customer_path):
                        for root, dirs, files in os.walk(customer_path):
                            for file in files:
                                try:
                                    os.remove(os.path.join(root, file))
                                    files_deleted += 1
                                except Exception:
                                    pass
        
        return {
            "deleted": True,
            "documents": doc_count,
            "chunks": chunk_count,
            "document_texts": text_count,
            "vectors": len(vector_ids),
            "files_deleted": files_deleted if delete_files else 0
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting documents: {str(e)}")

app.include_router(admin_router, tags=["admin"])

#newblock
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
