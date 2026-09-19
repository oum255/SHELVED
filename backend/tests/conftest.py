"""Réglages partagés par tous les tests (pytest les charge automatiquement).
Base à part en mémoire, jamais shelved.db, branchée via
`app.dependency_overrides` (remplace `get_db` le temps des tests)."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base, get_db
from main import app

# SQLite en mémoire ; StaticPool = une seule connexion partagée, sinon
# chaque nouvelle connexion repartirait avec une base vide.
engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override_get_db


@pytest.fixture(autouse=True)
def fresh_database():
    """Tables vides avant chaque test, pour qu'aucun test ne voie les
    données créées par un autre."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    return TestClient(app)


def signup_and_login(client, email="alice@example.com", username="alice", password="password123"):
    """Crée un compte, se connecte, renvoie le jeton prêt pour l'en-tête Authorization."""
    client.post(
        "/api/auth/signup",
        json={"email": email, "username": username, "password": password},
    )
    response = client.post(
        "/api/auth/login", json={"email": email, "password": password}
    )
    return response.json()["access_token"]


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}
