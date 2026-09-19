from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import models  # noqa: F401 (charge les modèles pour que SQLAlchemy connaisse les tables)
from database import Base, engine
from routers import ai, auth, books, clubs, feed, moderation, stats, users

Base.metadata.create_all(bind=engine)

app = FastAPI(title="SHELVED API")

# Autorise le frontend en dev à appeler l'API (à restreindre au vrai domaine en prod).
origines_autorisees = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origines_autorisees,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(books.router)
app.include_router(stats.router)
app.include_router(ai.router)
app.include_router(moderation.router)
app.include_router(users.router)
app.include_router(feed.router)
app.include_router(clubs.router)


@app.get("/")
def accueil():
    return {"message": "Bienvenue sur l'API de SHELVED 📚"}


@app.get("/api/health")
def health():
    return {"status": "ok"}
