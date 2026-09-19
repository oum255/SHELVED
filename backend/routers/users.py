"""Profils publics et abonnements. Contrairement à /api/auth/me, ces routes
montrent le profil PUBLIC d'un utilisateur — jamais son email — accessible
sans compte."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from dependencies import get_current_user, get_current_user_optional

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=list[schemas.FollowUserPublic])
def search_users(
    q: str = Query(min_length=1, description="Début ou morceau du pseudo cherché"),
    db: Session = Depends(get_db),
):
    """Recherche des lecteurs par pseudo (public — pas besoin de compte
    pour chercher, seulement pour suivre)."""
    return (
        db.query(models.User)
        .filter(models.User.username.ilike(f"%{q}%"))
        .order_by(models.User.username)
        .limit(20)
        .all()
    )


def _get_user_or_404(db: Session, username: str) -> models.User:
    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    return user


def _is_following(db: Session, follower_id: int, following_id: int) -> bool:
    return (
        db.query(models.Follow)
        .filter(
            models.Follow.follower_id == follower_id,
            models.Follow.following_id == following_id,
        )
        .first()
        is not None
    )


@router.get("/{username}", response_model=schemas.UserProfilePublic)
def get_profile(
    username: str,
    db: Session = Depends(get_db),
    viewer: models.User | None = Depends(get_current_user_optional),
):
    """Profil public d'un utilisateur (accessible sans compte)."""
    user = _get_user_or_404(db, username)

    followers_count = (
        db.query(models.Follow).filter(models.Follow.following_id == user.id).count()
    )
    following_count = (
        db.query(models.Follow).filter(models.Follow.follower_id == user.id).count()
    )
    books_read_count = (
        db.query(models.UserBook)
        .filter(models.UserBook.user_id == user.id, models.UserBook.status == "read")
        .count()
    )

    is_me = viewer is not None and viewer.id == user.id
    is_following = (
        _is_following(db, viewer.id, user.id) if viewer is not None and not is_me else False
    )

    return schemas.UserProfilePublic(
        username=user.username,
        bio=user.bio,
        avatar_url=user.avatar_url,
        reading_goal=user.reading_goal,
        followers_count=followers_count,
        following_count=following_count,
        books_read_count=books_read_count,
        is_following=is_following,
        is_me=is_me,
    )


@router.post("/{username}/follow", status_code=status.HTTP_204_NO_CONTENT)
def follow_user(
    username: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """S'abonner à un utilisateur."""
    target = _get_user_or_404(db, username)
    if target.id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="cannot_follow_self")
    if not _is_following(db, current_user.id, target.id):
        db.add(models.Follow(follower_id=current_user.id, following_id=target.id))
        db.commit()


@router.delete("/{username}/follow", status_code=status.HTTP_204_NO_CONTENT)
def unfollow_user(
    username: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Se désabonner d'un utilisateur."""
    target = _get_user_or_404(db, username)
    db.query(models.Follow).filter(
        models.Follow.follower_id == current_user.id,
        models.Follow.following_id == target.id,
    ).delete()
    db.commit()


@router.get("/{username}/followers", response_model=list[schemas.FollowUserPublic])
def list_followers(username: str, db: Session = Depends(get_db)):
    """Liste des abonnés d'un utilisateur."""
    user = _get_user_or_404(db, username)
    follower_ids = [
        f.follower_id
        for f in db.query(models.Follow).filter(models.Follow.following_id == user.id)
    ]
    if not follower_ids:
        return []
    return db.query(models.User).filter(models.User.id.in_(follower_ids)).all()


@router.get("/{username}/following", response_model=list[schemas.FollowUserPublic])
def list_following(username: str, db: Session = Depends(get_db)):
    """Liste des utilisateurs suivis par cet utilisateur."""
    user = _get_user_or_404(db, username)
    following_ids = [
        f.following_id
        for f in db.query(models.Follow).filter(models.Follow.follower_id == user.id)
    ]
    if not following_ids:
        return []
    return db.query(models.User).filter(models.User.id.in_(following_ids)).all()


@router.delete(
    "/{username}/followers/{follower_username}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_follower(
    username: str,
    follower_username: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Retire quelqu'un de MES abonnés — seulement sur sa propre liste."""
    if current_user.username != username:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="not_allowed")
    follower = _get_user_or_404(db, follower_username)
    db.query(models.Follow).filter(
        models.Follow.follower_id == follower.id,
        models.Follow.following_id == current_user.id,
    ).delete()
    db.commit()


@router.get("/{username}/books", response_model=list[schemas.UserBookSummary])
def list_user_books(
    username: str,
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int | None = Query(default=None, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Livres publics d'un utilisateur, ex: sa liste "Lus", ou un aperçu
    (mini-étagère du profil) avec `limit`."""
    user = _get_user_or_404(db, username)
    query = db.query(models.UserBook).filter(models.UserBook.user_id == user.id)
    if status_filter:
        query = query.filter(models.UserBook.status == status_filter)
    query = query.order_by(models.UserBook.date_added.desc())
    if limit:
        query = query.limit(limit)
    user_books = query.all()

    results = []
    for ub in user_books:
        book = db.query(models.Book).filter(models.Book.id == ub.book_id).first()
        if book is None:
            continue
        results.append(
            schemas.UserBookSummary(
                title=book.title,
                author=book.author,
                cover_url=book.cover_url,
                rating=ub.rating,
            )
        )
    return results
