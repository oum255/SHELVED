"""Routes d'authentification : inscription, connexion, gestion du compte."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

import models
import schemas
from cloudinary_service import CloudinaryNotConfigured, delete_image, upload_image
from database import get_db
from dependencies import get_current_user
from email_service import (
    EmailNotConfigured,
    send_password_reset_email,
    send_verification_email,
)
from security import (
    create_access_token,
    create_action_token,
    decode_action_token,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

VERIFY_TOKEN_MINUTES = 60
RESET_TOKEN_MINUTES = 60


def _send_verification_email(db: Session, user: models.User) -> None:
    """Best-effort : si Resend échoue (pas configuré, ou refuse l'envoi hors
    domaine vérifié en dev), on ne bloque jamais l'action — l'email part juste pas."""
    token = create_action_token(user.id, "verify_email", VERIFY_TOKEN_MINUTES)
    user.verification_token = token
    db.commit()
    try:
        send_verification_email(user.email, user.username, token, user.language)
    except EmailNotConfigured:
        pass
    except Exception:
        pass


@router.post(
    "/signup",
    response_model=schemas.UserPublic,
    status_code=status.HTTP_201_CREATED,
)
def signup(data: schemas.UserCreate, db: Session = Depends(get_db)):
    """Crée un nouveau compte."""
    if db.query(models.User).filter(models.User.email == data.email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="email_already_used",
        )

    if db.query(models.User).filter(models.User.username == data.username).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="username_already_taken",
        )

    new_user = models.User(
        email=data.email,
        username=data.username,
        password_hash=hash_password(data.password),
        language=data.language,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    _send_verification_email(db, new_user)  # best-effort

    return new_user


@router.post("/resend-verification", response_model=schemas.MessageResponse)
def resend_verification(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Renvoie l'email de vérification (ex: le premier est resté sans réponse)."""
    if current_user.email_verified:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="already_verified")
    _send_verification_email(db, current_user)
    return schemas.MessageResponse(message="sent")


@router.get("/verify-email", response_model=schemas.MessageResponse)
def verify_email(token: str, db: Session = Depends(get_db)):
    """Confirme l'adresse email à partir du jeton reçu par email."""
    user_id = decode_action_token(token, "verify_email")
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_or_expired_token")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    # doit être le DERNIER jeton envoyé, sinon un vieux lien reste utilisable
    if user is None or user.verification_token != token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_or_expired_token")

    user.email_verified = True
    user.verification_token = None
    db.commit()
    return schemas.MessageResponse(message="verified")


@router.post("/forgot-password", response_model=schemas.MessageResponse)
def forgot_password(data: schemas.ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Demande un email de réinitialisation. Renvoie toujours le même message,
    que l'email existe ou non — sinon on révélerait les comptes inscrits."""
    user = db.query(models.User).filter(models.User.email == data.email).first()
    if user is not None:
        token = create_action_token(user.id, "reset_password", RESET_TOKEN_MINUTES)
        user.reset_token = token
        db.commit()
        try:
            send_password_reset_email(user.email, user.username, token, user.language)
        except EmailNotConfigured:
            pass
        except Exception:
            pass
    return schemas.MessageResponse(message="sent_if_account_exists")


@router.post("/reset-password", response_model=schemas.MessageResponse)
def reset_password(data: schemas.ResetPasswordRequest, db: Session = Depends(get_db)):
    """Choisit un nouveau mot de passe à partir du jeton reçu par email."""
    user_id = decode_action_token(data.token, "reset_password")
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_or_expired_token")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None or user.reset_token != data.token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_or_expired_token")

    user.password_hash = hash_password(data.new_password)
    user.reset_token = None
    db.commit()
    return schemas.MessageResponse(message="password_reset")


@router.post("/login", response_model=schemas.Token)
def login(data: schemas.LoginRequest, db: Session = Depends(get_db)):
    """Connecte un utilisateur et renvoie un jeton JWT."""
    user = db.query(models.User).filter(models.User.email == data.email).first()

    # même erreur, email existant ou non — on ne révèle jamais un compte inscrit
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid_credentials",
        )

    token = create_access_token(user.id)
    return schemas.Token(access_token=token)


@router.get("/me", response_model=schemas.UserPublic)
def read_me(current_user: models.User = Depends(get_current_user)):
    """Profil de l'utilisateur connecté."""
    return current_user


@router.patch("/me", response_model=schemas.UserPublic)
def update_me(
    data: schemas.UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Modifie mon propre profil (bio, objectif de lecture annuel)."""
    fields = data.model_dump(exclude_unset=True)
    for key, value in fields.items():
        setattr(current_user, key, value)
    db.commit()
    db.refresh(current_user)
    return current_user


USERNAME_COOLDOWN_DAYS = 30


@router.post("/change-username", response_model=schemas.UserPublic)
def change_username(
    data: schemas.ChangeUsernameRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Change mon pseudo. Protégé par le mot de passe actuel, limité à
    une fois tous les 30 jours."""
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_password")

    if current_user.username_changed_at is not None:
        # SQLite renvoie une date naïve même stockée en UTC — on la
        # re-marque avant de comparer, sinon Python lève une erreur.
        last_change = current_user.username_changed_at
        if last_change.tzinfo is None:
            last_change = last_change.replace(tzinfo=timezone.utc)
        next_allowed = last_change + timedelta(days=USERNAME_COOLDOWN_DAYS)
        if datetime.now(timezone.utc) < next_allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="username_change_too_soon",
            )

    if data.new_username != current_user.username:
        taken = (
            db.query(models.User)
            .filter(models.User.username == data.new_username, models.User.id != current_user.id)
            .first()
        )
        if taken:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="username_already_taken")
        current_user.username = data.new_username
        current_user.username_changed_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(current_user)

    return current_user


@router.post("/change-email", response_model=schemas.UserPublic)
def change_email(
    data: schemas.ChangeEmailRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Change mon adresse email (protégé par le mot de passe actuel) — la
    nouvelle adresse redevient non-vérifiée et reçoit un email de confirmation."""
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_password")

    if data.new_email != current_user.email:
        taken = (
            db.query(models.User)
            .filter(models.User.email == data.new_email, models.User.id != current_user.id)
            .first()
        )
        if taken:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="email_already_used")
        current_user.email = data.new_email
        current_user.email_verified = False
        db.commit()
        db.refresh(current_user)
        _send_verification_email(db, current_user)

    return current_user


@router.post("/change-password", response_model=schemas.MessageResponse)
def change_password(
    data: schemas.ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Change mon mot de passe en étant connecté — protégé par le mot de
    passe actuel (contrairement à /reset-password, basé sur un jeton email)."""
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_password")

    current_user.password_hash = hash_password(data.new_password)
    db.commit()
    return schemas.MessageResponse(message="password_changed")


@router.post("/me/avatar", response_model=schemas.UserPublic)
def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Envoie (ou remplace) ma photo de profil. L'ancienne, s'il y en a une,
    est supprimée de Cloudinary pour ne pas laisser de fichier orphelin."""
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=422, detail="not_an_image")

    try:
        uploaded = upload_image(file.file)
    except CloudinaryNotConfigured:
        raise HTTPException(status_code=503, detail="images_not_configured")
    except Exception:
        raise HTTPException(status_code=502, detail="upload_failed")

    old_public_id = current_user.avatar_public_id
    current_user.avatar_url = uploaded["image_url"]
    current_user.avatar_public_id = uploaded["public_id"]
    db.commit()
    db.refresh(current_user)

    if old_public_id:
        try:
            delete_image(old_public_id)
        except Exception:
            pass  # best-effort : la nouvelle photo est déjà en place

    return current_user


@router.delete("/me/avatar", response_model=schemas.UserPublic)
def remove_avatar(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Retire ma photo de profil (retour aux initiales)."""
    if current_user.avatar_public_id:
        try:
            delete_image(current_user.avatar_public_id)
        except Exception:
            pass
    current_user.avatar_url = None
    current_user.avatar_public_id = None
    db.commit()
    db.refresh(current_user)
    return current_user


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_me(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """RGPD, droit à l'effacement : supprime définitivement le compte et
    toutes les données personnelles (la table `books`, partagée entre
    utilisateurs, n'est pas touchée)."""
    uid = current_user.id

    # photo de profil (best-effort)
    if current_user.avatar_public_id:
        try:
            delete_image(current_user.avatar_public_id)
        except Exception:
            pass

    # photos de livres : fichiers Cloudinary d'abord (best-effort), puis les lignes
    images = db.query(models.BookImage).filter(models.BookImage.user_id == uid).all()
    for img in images:
        try:
            delete_image(img.public_id)
        except Exception:
            pass  # ligne supprimée même si Cloudinary échoue
    db.query(models.BookImage).filter(models.BookImage.user_id == uid).delete(
        synchronize_session=False
    )

    # notes et sessions rattachées à mes livres perso
    ub_ids = [
        row[0]
        for row in db.query(models.UserBook.id)
        .filter(models.UserBook.user_id == uid)
        .all()
    ]
    if ub_ids:
        db.query(models.BookNote).filter(
            models.BookNote.user_book_id.in_(ub_ids)
        ).delete(synchronize_session=False)
        db.query(models.ReadingSession).filter(
            models.ReadingSession.user_book_id.in_(ub_ids)
        ).delete(synchronize_session=False)
    db.query(models.UserBook).filter(models.UserBook.user_id == uid).delete(
        synchronize_session=False
    )

    # données IA (compteur, cache de recommandations, historique du chat)
    db.query(models.AIUsage).filter(models.AIUsage.user_id == uid).delete(
        synchronize_session=False
    )
    db.query(models.Recommendation).filter(
        models.Recommendation.user_id == uid
    ).delete(synchronize_session=False)
    db.query(models.ChatMessage).filter(models.ChatMessage.user_id == uid).delete(
        synchronize_session=False
    )

    db.query(models.User).filter(models.User.id == uid).delete(
        synchronize_session=False
    )
    db.commit()
