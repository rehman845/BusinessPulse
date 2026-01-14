from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    DATABASE_URL: str

    OPENAI_API_KEY: str
    OPENAI_MODEL: str = "gpt-4o-mini"

    PINECONE_API_KEY: str
    PINECONE_ENVIRONMENT: str | None = None
    PINECONE_INDEX: str
    PINECONE_NAMESPACE: str = "default"

    UPLOAD_DIR: str = "app/storage/uploads"

    # Notion API settings
    NOTION_TOKEN: str | None = None
    NOTION_TASKS_DB_ID: str | None = None
    NOTION_VERSION: str = "2022-06-28"  # Default Notion API version

    # Cloudflare R2 settings
    R2_ACCESS_KEY_ID: str | None = None
    R2_SECRET_ACCESS_KEY: str | None = None
    R2_ENDPOINT: str | None = None
    R2_BUCKET_NAME: str | None = None
    R2_PUBLIC_DOMAIN: str | None = None
    R2_SIGNED_URL_EXPIRES_SECONDS: int = 60
    STORAGE_PROVIDER: str = "r2"  # "r2" or "local"


settings = Settings()
