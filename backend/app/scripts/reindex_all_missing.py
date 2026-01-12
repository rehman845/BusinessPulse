"""
Script to reindex all documents that are marked as completed but have no chunks.
Run this to ensure all documents are accessible by RAG.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy import create_engine, text
from app.settings import settings
from app.db import get_db
from app import models

def reindex_all_missing():
    """Reindex all documents that need indexing."""
    engine = create_engine(settings.DATABASE_URL.replace('+psycopg2', ''))
    conn = engine.connect()
    
    # Get all documents that need reindexing
    result = conn.execute(text("""
        SELECT d.id, d.customer_id, d.filename, d.doc_type, d.storage_path
        FROM documents d
        LEFT JOIN chunks c ON d.id = c.document_id
        WHERE d.deleted_at IS NULL
        AND d.processing_status = 'completed'
        AND c.id IS NULL
        ORDER BY d.uploaded_at DESC
    """))
    
    docs_to_reindex = list(result)
    print(f"Found {len(docs_to_reindex)} documents that need reindexing")
    
    if not docs_to_reindex:
        print("All documents are indexed!")
        return
    
    # Use the reindex endpoint logic
    from app.routes.documents import reindex_document
    from app.db import SessionLocal
    
    db = SessionLocal()
    success_count = 0
    error_count = 0
    
    for doc_id, customer_id, filename, doc_type, storage_path in docs_to_reindex:
        try:
            print(f"Reindexing: {filename} (Type: {doc_type})...")
            # Call the reindex logic directly
            # We'll use a simplified version here
            from app.services.ingest import _extract_text, chunk_text
            from app.services.embeddings import embed_text
            from app.services.pinecone_client import index as pinecone_index
            import json
            import os
            
            document = db.query(models.Document).filter(models.Document.id == doc_id).first()
            if not document:
                print(f"  ❌ Document not found: {doc_id}")
                error_count += 1
                continue
            
            # Delete existing chunks if any
            existing_chunks = db.query(models.Chunk).filter(models.Chunk.document_id == doc_id).all()
            namespace = (settings.PINECONE_NAMESPACE or "").strip()
            vector_ids = [chunk.pinecone_vector_id for chunk in existing_chunks if chunk.pinecone_vector_id]
            
            if vector_ids:
                try:
                    pinecone_index.delete(ids=vector_ids, namespace=namespace if namespace else None)
                except Exception as e:
                    print(f"  Warning: Failed to delete old vectors: {e}")
            
            for chunk in existing_chunks:
                db.delete(chunk)
            db.commit()
            
            # Extract text
            extracted = None
            page_count = None
            
            if document.doc_type == "proposal":
                # Use proposal content from database
                proposal = db.query(models.Proposal).filter(
                    models.Proposal.customer_id == customer_id
                ).order_by(models.Proposal.created_at.desc()).first()
                
                if proposal:
                    try:
                        proposal_data = json.loads(proposal.content)
                        text_parts = []
                        if isinstance(proposal_data, dict):
                            for key, value in proposal_data.items():
                                if isinstance(value, (dict, list)):
                                    text_parts.append(f"{key}:\n{json.dumps(value, indent=2)}")
                                else:
                                    text_parts.append(f"{key}: {value}")
                            extracted = "\n\n".join(text_parts)
                        else:
                            extracted = json.dumps(proposal_data, indent=2)
                        page_count = 1
                    except Exception as e:
                        print(f"  Warning: Failed to parse proposal content: {e}")
            
            if not extracted:
                file_path = storage_path
                if not os.path.isabs(file_path):
                    if file_path.startswith("app/"):
                        alt_path = os.path.join("/app", file_path)
                        if os.path.exists(alt_path):
                            file_path = alt_path
                        else:
                            file_path = os.path.join("/app", file_path)
                    else:
                        file_path = os.path.join("/app", file_path)
                
                if os.path.exists(file_path):
                    extracted, page_count = _extract_text(file_path)
            
            if not extracted:
                extracted = "(No text extracted from this file. Try a .txt/.docx/.pdf with selectable text.)"
            
            # Update document text
            doc_text = db.query(models.DocumentText).filter(models.DocumentText.document_id == doc_id).first()
            if doc_text:
                doc_text.extracted_text = extracted
            else:
                doc_text = models.DocumentText(document_id=doc_id, extracted_text=extracted)
                db.add(doc_text)
            
            document.page_count = page_count
            document.processing_status = "processing"
            db.commit()
            
            # Chunk and index
            chunks = chunk_text(extracted, chunk_size=900, overlap=150)
            
            for i, ch in enumerate(chunks):
                vector = embed_text(ch)
                vector_id = f"{doc_id}_{i}"
                
                metadata = {
                    "customer_id": customer_id,
                    "document_id": doc_id,
                    "chunk_index": i,
                    "doc_type": doc_type,
                    "uploaded_at": document.uploaded_at.isoformat(),
                    "text": ch,
                }
                if document.project_id is not None:
                    metadata["project_id"] = document.project_id
                
                pinecone_index.upsert(
                    vectors=[{"id": vector_id, "values": vector, "metadata": metadata}],
                    namespace=namespace if namespace else None,
                )
                
                chunk_row = models.Chunk(
                    document_id=doc_id,
                    chunk_index=i,
                    chunk_text=ch,
                    pinecone_vector_id=vector_id,
                )
                db.add(chunk_row)
            
            document.processing_status = "completed"
            db.commit()
            
            print(f"  ✅ Successfully indexed {len(chunks)} chunks")
            success_count += 1
            
        except Exception as e:
            print(f"  ❌ Error reindexing {filename}: {e}")
            error_count += 1
            db.rollback()
    
    db.close()
    conn.close()
    
    print(f"\n✅ Reindexing complete!")
    print(f"   Success: {success_count}")
    print(f"   Errors: {error_count}")

if __name__ == "__main__":
    reindex_all_missing()
