"""
Script to delete all documents from all customers.
This will:
1. Delete all chunks from database
2. Delete all vectors from Pinecone
3. Delete all document_texts
4. Delete all documents (hard delete)
5. Optionally delete physical files
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy import create_engine, text
from app.settings import settings
from app.db import SessionLocal
from app import models
from app.services.pinecone_client import index as pinecone_index
import shutil

def delete_all_documents(delete_files=True):
    """Delete all documents from all customers."""
    db = SessionLocal()
    
    try:
        print("Starting deletion of all documents...")
        
        # 1. Get all chunks to delete from Pinecone
        all_chunks = db.query(models.Chunk).all()
        vector_ids = [chunk.pinecone_vector_id for chunk in all_chunks if chunk.pinecone_vector_id]
        
        print(f"Found {len(all_chunks)} chunks in database")
        print(f"Found {len(vector_ids)} vectors to delete from Pinecone")
        
        # 2. Delete vectors from Pinecone
        if vector_ids:
            namespace = (settings.PINECONE_NAMESPACE or "").strip()
            try:
                # Delete in batches of 1000 (Pinecone limit)
                batch_size = 1000
                for i in range(0, len(vector_ids), batch_size):
                    batch = vector_ids[i:i + batch_size]
                    pinecone_index.delete(ids=batch, namespace=namespace if namespace else None)
                    print(f"Deleted {len(batch)} vectors from Pinecone (batch {i//batch_size + 1})")
            except Exception as e:
                print(f"Warning: Failed to delete some vectors from Pinecone: {e}")
        
        # 3. Delete all chunks from database
        chunk_count = db.query(models.Chunk).count()
        db.query(models.Chunk).delete()
        db.commit()
        print(f"Deleted {chunk_count} chunks from database")
        
        # 4. Delete all document_texts
        text_count = db.query(models.DocumentText).count()
        db.query(models.DocumentText).delete()
        db.commit()
        print(f"Deleted {text_count} document texts from database")
        
        # 5. Get all documents before deletion (for file deletion)
        all_documents = db.query(models.Document).all()
        doc_count = len(all_documents)
        
        # 6. Delete all documents from database
        db.query(models.Document).delete()
        db.commit()
        print(f"Deleted {doc_count} documents from database")
        
        # 7. Optionally delete physical files
        if delete_files:
            base_dir = settings.UPLOAD_DIR
            if os.path.exists(base_dir):
                # Get all customer directories
                customer_dirs = [d for d in os.listdir(base_dir) if os.path.isdir(os.path.join(base_dir, d))]
                files_deleted = 0
                for customer_dir in customer_dirs:
                    customer_path = os.path.join(base_dir, customer_dir)
                    for root, dirs, files in os.walk(customer_path):
                        for file in files:
                            file_path = os.path.join(root, file)
                            try:
                                os.remove(file_path)
                                files_deleted += 1
                            except Exception as e:
                                print(f"Warning: Failed to delete file {file_path}: {e}")
                    # Remove empty customer directory
                    try:
                        if not os.listdir(customer_path):
                            os.rmdir(customer_path)
                    except Exception:
                        pass
                print(f"Deleted {files_deleted} physical files")
            else:
                print(f"Upload directory {base_dir} does not exist, skipping file deletion")
        
        print("\n✅ Successfully deleted all documents!")
        print(f"Summary:")
        print(f"  - Documents deleted: {doc_count}")
        print(f"  - Chunks deleted: {chunk_count}")
        print(f"  - Document texts deleted: {text_count}")
        print(f"  - Vectors deleted from Pinecone: {len(vector_ids)}")
        if delete_files:
            print(f"  - Physical files deleted: Yes")
        else:
            print(f"  - Physical files deleted: No (skipped)")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error deleting documents: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Delete all documents from all customers")
    parser.add_argument("--keep-files", action="store_true", help="Keep physical files (only delete from database)")
    args = parser.parse_args()
    
    delete_all_documents(delete_files=not args.keep_files)
