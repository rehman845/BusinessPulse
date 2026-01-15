from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy.pool import QueuePool
from .settings import settings


class Base(DeclarativeBase):
    pass


# Optimized connection pool settings for better performance
engine = create_engine(
    settings.DATABASE_URL,
    poolclass=QueuePool,
    pool_pre_ping=True,      # Check connection health before use
    pool_size=10,            # Number of connections to keep open
    max_overflow=20,         # Extra connections when pool is exhausted
    pool_timeout=30,         # Seconds to wait for a connection from pool
    pool_recycle=1800,       # Recycle connections after 30 minutes (avoid stale)
    echo=False,              # Set True for SQL debugging
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
