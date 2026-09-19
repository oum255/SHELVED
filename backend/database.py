"""Connexion à la base de données. SQLite en dev (shelved.db), PostgreSQL
prévu en prod — le reste du code ne change pas grâce à SQLAlchemy."""

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = "sqlite:///./shelved.db"

# check_same_thread=False : nécessaire pour SQLite avec FastAPI.
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Session DB par requête (dépendance FastAPI), fermée après coup."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
