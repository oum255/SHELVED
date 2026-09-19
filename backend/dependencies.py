"""Dépendances FastAPI réutilisables pour protéger les routes."""

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

import models
from config import ALGORITHM, SECRET_KEY
from database import get_db

bearer_scheme = HTTPBearer()
# auto_error=False : pour les routes publiques qui se comportent juste un
# peu différemment si un jeton valide est fourni (ex: un profil public
# affiche "tu suis déjà cette personne" seulement si quelqu'un est connecté).
optional_bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    erreur_401 = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="invalid_token",
    )

    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise erreur_401
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="token_expired",
        )
    except jwt.InvalidTokenError:
        raise erreur_401

    user = db.query(models.User).filter(models.User.id == int(user_id)).first()
    if user is None:
        raise erreur_401

    return user


def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_bearer_scheme),
    db: Session = Depends(get_db),
) -> models.User | None:
    """Comme get_current_user, mais renvoie None plutôt que 401 s'il n'y a
    pas de jeton ou s'il est invalide/expiré."""
    if credentials is None:
        return None
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            return None
    except jwt.InvalidTokenError:
        return None
    return db.query(models.User).filter(models.User.id == int(user_id)).first()


def get_current_admin(
    current_user: models.User = Depends(get_current_user),
) -> models.User:
    """Comme get_current_user, avec en plus is_admin=True requis (403 sinon)."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="admin_only",
        )
    return current_user
