"""
Cloudflare R2 Storage Service
S3-compatible storage for documents using Cloudflare R2
"""
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from typing import BinaryIO, Optional
import logging
from ..settings import settings

logger = logging.getLogger(__name__)


class R2Storage:
    """Cloudflare R2 storage client"""
    
    def __init__(self):
        self.access_key_id = getattr(settings, 'R2_ACCESS_KEY_ID', None)
        self.secret_access_key = getattr(settings, 'R2_SECRET_ACCESS_KEY', None)
        self.endpoint_url = getattr(settings, 'R2_ENDPOINT', None)
        self.bucket_name = getattr(settings, 'R2_BUCKET_NAME', None)
        self.public_domain = getattr(settings, 'R2_PUBLIC_DOMAIN', None)
        self.signed_url_expires = getattr(settings, 'R2_SIGNED_URL_EXPIRES_SECONDS', 60)
        
        if not all([self.access_key_id, self.secret_access_key, self.endpoint_url, self.bucket_name]):
            logger.warning("R2 credentials not fully configured. R2 storage will not work.")
            self.client = None
        else:
            # Configure boto3 for R2 (S3-compatible)
            config = Config(
                signature_version='s3v4',
                s3={
                    'addressing_style': 'path'
                }
            )
            
            self.client = boto3.client(
                's3',
                endpoint_url=self.endpoint_url,
                aws_access_key_id=self.access_key_id,
                aws_secret_access_key=self.secret_access_key,
                config=config
            )
    
    def _is_configured(self) -> bool:
        """Check if R2 is properly configured"""
        return self.client is not None
    
    def upload_file(
        self,
        file_bytes: bytes | BinaryIO,
        key: str,
        content_type: Optional[str] = None
    ) -> str:
        """
        Upload file to R2
        
        Args:
            file_bytes: File content as bytes or file-like object
            key: Object key (path) in R2
            content_type: MIME type of the file
            
        Returns:
            The storage key (same as input key)
        """
        if not self._is_configured():
            raise ValueError("R2 storage is not configured")
        
        try:
            extra_args = {}
            if content_type:
                extra_args['ContentType'] = content_type
            
            # If file_bytes is bytes, we need to wrap it
            if isinstance(file_bytes, bytes):
                from io import BytesIO
                file_obj = BytesIO(file_bytes)
            else:
                file_obj = file_bytes
            
            self.client.upload_fileobj(
                file_obj,
                self.bucket_name,
                key,
                ExtraArgs=extra_args
            )
            
            logger.info(f"Uploaded file to R2: {key}")
            return key
        except ClientError as e:
            logger.error(f"Failed to upload file to R2: {e}")
            raise Exception(f"R2 upload failed: {str(e)}")
    
    def generate_presigned_get_url(
        self,
        key: str,
        expires_seconds: Optional[int] = None
    ) -> str:
        """
        Generate a presigned URL for downloading a file
        
        Args:
            key: Object key in R2
            expires_seconds: URL expiration time in seconds (defaults to R2_SIGNED_URL_EXPIRES_SECONDS)
            
        Returns:
            Presigned URL string
        """
        if not self._is_configured():
            raise ValueError("R2 storage is not configured")
        
        try:
            expires = expires_seconds or self.signed_url_expires
            
            url = self.client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': self.bucket_name,
                    'Key': key
                },
                ExpiresIn=expires
            )
            
            return url
        except ClientError as e:
            logger.error(f"Failed to generate presigned URL: {e}")
            raise Exception(f"Failed to generate presigned URL: {str(e)}")
    
    def delete_key(self, key: str) -> bool:
        """
        Delete a single object from R2
        
        Args:
            key: Object key to delete
            
        Returns:
            True if successful, False otherwise
        """
        if not self._is_configured():
            logger.warning("R2 not configured, skipping delete")
            return False
        
        try:
            self.client.delete_object(
                Bucket=self.bucket_name,
                Key=key
            )
            logger.info(f"Deleted object from R2: {key}")
            return True
        except ClientError as e:
            logger.error(f"Failed to delete object from R2: {e}")
            return False
    
    def delete_by_prefix(self, prefix: str) -> int:
        """
        Delete all objects with a given prefix (bulk delete)
        
        Args:
            prefix: Prefix to match (e.g., "customers/123/projects/456/")
            
        Returns:
            Number of objects deleted
        """
        if not self._is_configured():
            logger.warning("R2 not configured, skipping bulk delete")
            return 0
        
        deleted_count = 0
        
        try:
            # List all objects with the prefix
            paginator = self.client.get_paginator('list_objects_v2')
            pages = paginator.paginate(
                Bucket=self.bucket_name,
                Prefix=prefix
            )
            
            # Collect all keys
            keys_to_delete = []
            for page in pages:
                if 'Contents' in page:
                    for obj in page['Contents']:
                        keys_to_delete.append({'Key': obj['Key']})
            
            if not keys_to_delete:
                return 0
            
            # Delete in batches of 1000 (S3/R2 limit)
            batch_size = 1000
            for i in range(0, len(keys_to_delete), batch_size):
                batch = keys_to_delete[i:i + batch_size]
                response = self.client.delete_objects(
                    Bucket=self.bucket_name,
                    Delete={
                        'Objects': batch,
                        'Quiet': True
                    }
                )
                
                # Count successful deletions
                if 'Deleted' in response:
                    deleted_count += len(response['Deleted'])
                
                # Log errors if any
                if 'Errors' in response and response['Errors']:
                    for error in response['Errors']:
                        logger.error(f"Failed to delete {error['Key']}: {error['Message']}")
            
            logger.info(f"Deleted {deleted_count} objects from R2 with prefix: {prefix}")
            return deleted_count
            
        except ClientError as e:
            logger.error(f"Failed to delete objects by prefix from R2: {e}")
            return deleted_count


# Singleton instance
_r2_storage = None

def get_r2_storage() -> R2Storage:
    """Get or create R2 storage instance"""
    global _r2_storage
    if _r2_storage is None:
        _r2_storage = R2Storage()
    return _r2_storage

