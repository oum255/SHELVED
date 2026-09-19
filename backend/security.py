"""Hachage des mots de passe et jetons JWT."""

from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from config import ACCESS_TOKEN_EXPIRE_MINUTES, ALGORITHM, SECRET_KEY


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(
        password.encode("utf-8"), password_hash.encode("utf-8")
    )


def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_action_token(user_id: int, purpose: str, minutes: int) -> str:
    """Jeton à usage unique et courte durée de vie, envoyé par email
    (vérification de compte, mot de passe oublié). `purpose` empêche un
    jeton de servir à autre chose que ce pour quoi il a été émis."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    payload = {"sub": str(user_id), "purpose": purpose, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_action_token(token: str, expected_purpose: str) -> int | None:
    """Vérifie signature, expiration et `purpose` ; renvoie l'id utilisateur
    ou None si l'un des trois ne correspond pas."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.InvalidTokenError:
        return None
    if payload.get("purpose") != expected_purpose:
        return None
    user_id = payload.get("sub")
    return int(user_id) if user_id is not None else None
