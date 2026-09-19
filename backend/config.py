"""Configuration : lit les secrets depuis backend/.env."""

import os

from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError(
        "SECRET_KEY manquante. Copie backend/.env.example en backend/.env "
        "et renseigne une clé."
    )

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

# Optionnelle : sans clé, la recherche Google Books marche pour un petit
# volume, avec un risque d'erreur 429 au-delà. Avec une clé gratuite : quota
# fiable de 1000 requêtes/jour.
GOOGLE_BOOKS_API_KEY = os.getenv("GOOGLE_BOOKS_API_KEY") or None

# Format : cloudinary://<api_key>:<api_secret>@<cloud_name>
CLOUDINARY_URL = os.getenv("CLOUDINARY_URL") or None

# Clé à créer sur https://aistudio.google.com/apikey
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or None
AI_DAILY_LIMIT = int(os.getenv("AI_DAILY_LIMIT", "20"))

# Clé gratuite à créer sur https://resend.com (Dashboard > API Keys).
RESEND_API_KEY = os.getenv("RESEND_API_KEY") or None

# Utilisée pour construire les liens dans les emails (ex: /verify-email?token=...).
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
