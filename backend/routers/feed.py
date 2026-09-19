"""Fil d'activité : événements des comptes suivis (ajout, note, livre
terminé), avec j'aime et commentaires. Les événements (ActivityPost) sont
créés ailleurs (routers/books.py) — ce fichier ne fait que les lire."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from dependencies import get_current_user

router = APIRouter(prefix="/api/feed", tags=["feed"])


def _post_to_public(db: Session, post: models.ActivityPost, viewer_id: int) -> schemas.ActivityPostPublic:
    author = db.query(models.User).filter(models.User.id == post.user_id).first()
    book = (
        db.query(models.Book).filter(models.Book.id == post.book_id).first()
        if post.book_id
        else None
    )
    likes_count = (
        db.query(models.PostLike).filter(models.PostLike.post_id == post.id).count()
    )
    is_liked = (
        db.query(models.PostLike)
        .filter(models.PostLike.post_id == post.id, models.PostLike.user_id == viewer_id)
        .first()
        is not None
    )
    comments_count = (
        db.query(models.PostComment).filter(models.PostComment.post_id == post.id).count()
    )
    return schemas.ActivityPostPublic(
        id=post.id,
        type=post.type,
        created_at=post.created_at,
        username=author.username if author else "?",
        avatar_url=author.avatar_url if author else None,
        book_id=book.id if book else None,
        book_title=book.title if book else None,
        book_author=book.author if book else None,
        book_cover_url=book.cover_url if book else None,
        content=post.content,
        likes_count=likes_count,
        is_liked=is_liked,
        comments_count=comments_count,
    )


def _comment_to_public(db: Session, comment: models.PostComment) -> schemas.PostCommentPublic:
    author = db.query(models.User).filter(models.User.id == comment.user_id).first()
    return schemas.PostCommentPublic(
        id=comment.id,
        username=author.username if author else "?",
        avatar_url=author.avatar_url if author else None,
        content=comment.content,
        created_at=comment.created_at,
    )


def _get_post_or_404(db: Session, post_id: int) -> models.ActivityPost:
    post = db.query(models.ActivityPost).filter(models.ActivityPost.id == post_id).first()
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    return post


@router.get("", response_model=list[schemas.ActivityPostPublic])
def get_feed(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Événements des comptes suivis + les miens, les plus récents d'abord (limité à 50)."""
    following_ids = [
        f.following_id
        for f in db.query(models.Follow).filter(models.Follow.follower_id == current_user.id)
    ]
    visible_ids = following_ids + [current_user.id]
    posts = (
        db.query(models.ActivityPost)
        .filter(models.ActivityPost.user_id.in_(visible_ids))
        .order_by(models.ActivityPost.created_at.desc())
        .limit(50)
        .all()
    )
    return [_post_to_public(db, p, current_user.id) for p in posts]


@router.post("/{post_id}/like", status_code=status.HTTP_204_NO_CONTENT)
def like_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _get_post_or_404(db, post_id)
    existing = (
        db.query(models.PostLike)
        .filter(models.PostLike.post_id == post_id, models.PostLike.user_id == current_user.id)
        .first()
    )
    if existing is None:
        db.add(models.PostLike(post_id=post_id, user_id=current_user.id))
        db.commit()


@router.delete("/{post_id}/like", status_code=status.HTTP_204_NO_CONTENT)
def unlike_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    db.query(models.PostLike).filter(
        models.PostLike.post_id == post_id, models.PostLike.user_id == current_user.id
    ).delete()
    db.commit()


@router.get("/{post_id}/comments", response_model=list[schemas.PostCommentPublic])
def list_comments(post_id: int, db: Session = Depends(get_db)):
    _get_post_or_404(db, post_id)
    comments = (
        db.query(models.PostComment)
        .filter(models.PostComment.post_id == post_id)
        .order_by(models.PostComment.created_at.asc())
        .all()
    )
    return [_comment_to_public(db, c) for c in comments]


@router.post(
    "/{post_id}/comments",
    response_model=schemas.PostCommentPublic,
    status_code=status.HTTP_201_CREATED,
)
def add_comment(
    post_id: int,
    data: schemas.PostCommentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _get_post_or_404(db, post_id)
    comment = models.PostComment(
        post_id=post_id, user_id=current_user.id, content=data.content
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return _comment_to_public(db, comment)
