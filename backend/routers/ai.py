"""Routes IA : recommandations de livres via Google Gemini, avec une
limite d'appels par utilisateur et par jour (table ai_usage)."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import models
import schemas
from config import AI_DAILY_LIMIT
from database import get_db
from dependencies import get_current_user
from gemini_service import (
    AINotConfigured,
    AIUnavailable,
    generate_recommendations,
    suggest_books,
)

router = APIRouter(prefix="/api/ai", tags=["ai"])


def _check_and_increment_usage(db: Session, user: models.User):
    """Lève 429 si la limite quotidienne est atteinte."""
    today = date.today()
    usage = (
        db.query(models.AIUsage)
        .filter(models.AIUsage.user_id == user.id, models.AIUsage.usage_date == today)
        .first()
    )
    if usage is None:
        usage = models.AIUsage(user_id=user.id, usage_date=today, request_count=0)
        db.add(usage)
        db.flush()

    if usage.request_count >= AI_DAILY_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="ai_limit_reached",
        )
    usage.request_count += 1


def _liked_books(db: Session, user: models.User) -> list[dict]:
    """Les livres que l'utilisateur a aimés (note >= 4 ou statut 'lu')."""
    user_books = (
        db.query(models.UserBook)
        .filter(models.UserBook.user_id == user.id)
        .all()
    )
    liked = [
        ub for ub in user_books
        if (ub.rating is not None and ub.rating >= 4) or ub.status == "read"
    ]
    source = liked or user_books  # à défaut, tous ses livres
    return [
        {"title": ub.book.title, "author": ub.book.author}
        for ub in source[:15]
    ]


def _ai_error(exc: Exception) -> HTTPException:
    if isinstance(exc, AINotConfigured):
        return HTTPException(status_code=503, detail="ai_not_configured")
    return HTTPException(status_code=503, detail="ai_unavailable")


def _generate_and_store(db: Session, user: models.User):
    """Génère de nouvelles recommandations et remplace l'ancien cache."""
    _check_and_increment_usage(db, user)
    try:
        recs = generate_recommendations(_liked_books(db, user), user.language)
    except (AINotConfigured, AIUnavailable) as e:
        raise _ai_error(e)

    db.query(models.Recommendation).filter(
        models.Recommendation.user_id == user.id
    ).delete()
    rows = [
        models.Recommendation(
            user_id=user.id,
            book_title=r["title"],
            book_author=r.get("author"),
            reason=r.get("reason"),
            match_score=r.get("match_score"),
        )
        for r in recs
    ]
    db.add_all(rows)
    db.commit()
    return rows


@router.get("/recommendations", response_model=list[schemas.RecommendationPublic])
def get_recommendations(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Renvoie les recommandations en cache, ou les génère si aucune."""
    cached = (
        db.query(models.Recommendation)
        .filter(models.Recommendation.user_id == current_user.id)
        .order_by(models.Recommendation.match_score.desc().nullslast())
        .all()
    )
    if cached:
        return cached
    return _generate_and_store(db, current_user)


@router.post("/recommendations/refresh", response_model=list[schemas.RecommendationPublic])
def refresh_recommendations(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Force la régénération des recommandations (consomme un appel IA)."""
    return _generate_and_store(db, current_user)


@router.post("/suggest", response_model=list[schemas.RecommendationPublic])
def suggest(
    data: schemas.SuggestRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Suggère des livres à partir d'une demande libre (barre de recherche IA).
    Ces suggestions sont ponctuelles : on ne les met PAS en cache."""
    _check_and_increment_usage(db, current_user)
    try:
        books = suggest_books(data.query, current_user.language)
    except (AINotConfigured, AIUnavailable) as e:
        raise _ai_error(e)
    db.commit()  # valide l'incrément du compteur d'usage

    return [
        {
            "book_title": b["title"],
            "book_author": b.get("author"),
            "reason": b.get("reason"),
            "match_score": b.get("match_score"),
        }
        for b in books
    ]
