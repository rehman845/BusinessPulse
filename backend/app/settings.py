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


settings = Settings()
