"""Statistiques de lecture, recalculées à la volée depuis `reading_sessions`."""

from collections import defaultdict
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from dependencies import get_current_user

router = APIRouter(prefix="/api/stats", tags=["stats"])


def _compute_streak(session_dates: set[date]) -> int:
    """Nombre de jours de lecture consécutifs jusqu'à aujourd'hui (ou hier).
    Ex : si j'ai lu hier et avant-hier mais pas aujourd'hui, streak = 2."""
    if not session_dates:
        return 0
    today = date.today()
    # Le streak peut partir d'aujourd'hui, ou d'hier (la journée n'est pas finie).
    if today in session_dates:
        cursor = today
    elif (today - timedelta(days=1)) in session_dates:
        cursor = today - timedelta(days=1)
    else:
        return 0
    streak = 0
    while cursor in session_dates:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


@router.get("", response_model=schemas.StatsPublic)
def get_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # passe par user_books pour filtrer sur moi
    sessions = (
        db.query(models.ReadingSession)
        .join(
            models.UserBook,
            models.ReadingSession.user_book_id == models.UserBook.id,
        )
        .filter(models.UserBook.user_id == current_user.id)
        .all()
    )

    total_pages = sum(s.pages_read for s in sessions)

    # pages par jour sur les 30 derniers jours, jours à 0 inclus
    pages_by_date: dict[date, int] = defaultdict(int)
    mood_counts: dict[str, int] = defaultdict(int)
    session_dates: set[date] = set()
    for s in sessions:
        pages_by_date[s.session_date] += s.pages_read
        session_dates.add(s.session_date)
        if s.mood:
            mood_counts[s.mood] += 1

    today = date.today()
    pages_per_day = [
        schemas.DailyPages(
            date=today - timedelta(days=offset),
            pages=pages_by_date.get(today - timedelta(days=offset), 0),
        )
        for offset in range(29, -1, -1)  # du plus ancien au plus récent
    ]

    # tous les jours où l'utilisateur a lu (pour la vue calendrier)
    reading_calendar = [
        schemas.DailyPages(date=d, pages=p)
        for d, p in sorted(pages_by_date.items())
    ]

    user_books = (
        db.query(models.UserBook)
        .filter(models.UserBook.user_id == current_user.id)
        .all()
    )
    books_finished = sum(1 for ub in user_books if ub.status == "read")
    books_in_progress = sum(1 for ub in user_books if ub.status == "reading")

    return schemas.StatsPublic(
        total_pages_read=total_pages,
        total_sessions=len(sessions),
        books_finished=books_finished,
        books_in_progress=books_in_progress,
        current_streak=_compute_streak(session_dates),
        pages_per_day=pages_per_day,
        mood_distribution=dict(mood_counts),
        reading_calendar=reading_calendar,
    )


@router.get("/day-sessions", response_model=list[schemas.MoodSession])
def get_day_sessions(
    day: date,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Sessions d'un jour donné, les plus récentes d'abord (jours cliquables du calendrier)."""
    rows = (
        db.query(models.ReadingSession, models.UserBook, models.Book)
        .join(models.UserBook, models.ReadingSession.user_book_id == models.UserBook.id)
        .join(models.Book, models.UserBook.book_id == models.Book.id)
        .filter(
            models.UserBook.user_id == current_user.id,
            models.ReadingSession.session_date == day,
        )
        .order_by(models.ReadingSession.id.desc())
        .all()
    )
    return [
        schemas.MoodSession(
            user_book_id=ub.id,
            title=book.title,
            author=book.author,
            cover_url=book.cover_url,
            session_date=s.session_date,
            pages_read=s.pages_read,
        )
        for s, ub, book in rows
    ]


@router.get("/mood-sessions", response_model=list[schemas.MoodSession])
def get_mood_sessions(
    mood: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Sessions d'une humeur donnée, les plus récentes d'abord (humeurs cliquables de la page Stats)."""
    rows = (
        db.query(models.ReadingSession, models.UserBook, models.Book)
        .join(models.UserBook, models.ReadingSession.user_book_id == models.UserBook.id)
        .join(models.Book, models.UserBook.book_id == models.Book.id)
        .filter(
            models.UserBook.user_id == current_user.id,
            models.ReadingSession.mood == mood,
        )
        .order_by(
            models.ReadingSession.session_date.desc(),
            models.ReadingSession.id.desc(),
        )
        .all()
    )
    return [
        schemas.MoodSession(
            user_book_id=ub.id,
            title=book.title,
            author=book.author,
            cover_url=book.cover_url,
            session_date=s.session_date,
            pages_read=s.pages_read,
        )
        for s, ub, book in rows
    ]
