"""Clubs de lecture : créer/rejoindre, choisir le livre en cours, discuter,
voter. Discussion et vote réservés aux membres ; le reste est public."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from dependencies import get_current_user, get_current_user_optional

router = APIRouter(prefix="/api/clubs", tags=["clubs"])


def _find_or_create_book(db: Session, data: schemas.BookSearchResult) -> models.Book:
    """Même logique que dans routers/books.py."""
    query = db.query(models.Book)
    book = None
    if data.google_books_id:
        book = query.filter(models.Book.google_books_id == data.google_books_id).first()
    if book is None and data.isbn:
        book = query.filter(models.Book.isbn == data.isbn).first()
    if book is None:
        book = models.Book(**data.model_dump())
        db.add(book)
        db.flush()
    return book


def _get_club_or_404(db: Session, club_id: int) -> models.BookClub:
    club = db.query(models.BookClub).filter(models.BookClub.id == club_id).first()
    if club is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    return club


def _get_membership(db: Session, club_id: int, user_id: int) -> models.ClubMember | None:
    return (
        db.query(models.ClubMember)
        .filter(models.ClubMember.club_id == club_id, models.ClubMember.user_id == user_id)
        .first()
    )


def _require_member(db: Session, club_id: int, user: models.User) -> models.ClubMember:
    """Lève 403 si l'utilisateur n'est pas membre du club."""
    membership = _get_membership(db, club_id, user.id)
    if membership is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="members_only")
    return membership


def _member_count(db: Session, club_id: int) -> int:
    return db.query(models.ClubMember).filter(models.ClubMember.club_id == club_id).count()


def _club_book(db: Session, book_id: int | None) -> schemas.ClubBookPublic | None:
    if book_id is None:
        return None
    book = db.query(models.Book).filter(models.Book.id == book_id).first()
    return schemas.ClubBookPublic.model_validate(book) if book else None


def _club_to_summary(
    db: Session, club: models.BookClub, viewer: models.User | None
) -> schemas.BookClubSummary:
    is_member = viewer is not None and _get_membership(db, club.id, viewer.id) is not None
    return schemas.BookClubSummary(
        id=club.id,
        name=club.name,
        description=club.description,
        member_count=_member_count(db, club.id),
        current_book=_club_book(db, club.current_book_id),
        is_member=is_member,
    )


def _club_to_public(
    db: Session, club: models.BookClub, viewer: models.User | None
) -> schemas.BookClubPublic:
    owner = db.query(models.User).filter(models.User.id == club.owner_id).first()
    is_member = viewer is not None and _get_membership(db, club.id, viewer.id) is not None
    return schemas.BookClubPublic(
        id=club.id,
        name=club.name,
        description=club.description,
        owner_username=owner.username if owner else "?",
        member_count=_member_count(db, club.id),
        current_book=_club_book(db, club.current_book_id),
        is_member=is_member,
        is_owner=viewer is not None and viewer.id == club.owner_id,
        created_at=club.created_at,
    )


@router.get("", response_model=list[schemas.BookClubSummary])
def list_clubs(
    db: Session = Depends(get_db),
    viewer: models.User | None = Depends(get_current_user_optional),
):
    """Tous les clubs, les plus récents d'abord (accessible sans compte)."""
    clubs = db.query(models.BookClub).order_by(models.BookClub.created_at.desc()).all()
    return [_club_to_summary(db, c, viewer) for c in clubs]


@router.post("", response_model=schemas.BookClubPublic, status_code=status.HTTP_201_CREATED)
def create_club(
    data: schemas.BookClubCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Crée un club — le créateur en devient automatiquement propriétaire."""
    club = models.BookClub(
        name=data.name, description=data.description, owner_id=current_user.id
    )
    db.add(club)
    db.flush()
    db.add(models.ClubMember(club_id=club.id, user_id=current_user.id, role="owner"))
    db.commit()
    db.refresh(club)
    return _club_to_public(db, club, current_user)


@router.get("/{club_id}", response_model=schemas.BookClubPublic)
def get_club(
    club_id: int,
    db: Session = Depends(get_db),
    viewer: models.User | None = Depends(get_current_user_optional),
):
    club = _get_club_or_404(db, club_id)
    return _club_to_public(db, club, viewer)


@router.patch("/{club_id}", response_model=schemas.BookClubPublic)
def update_club(
    club_id: int,
    data: schemas.BookClubUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Nom, description et/ou livre en cours (propriétaire seulement)."""
    club = _get_club_or_404(db, club_id)
    if club.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="owner_only")
    if data.name is not None:
        club.name = data.name
    if data.description is not None:
        club.description = data.description
    if data.current_book is not None:
        book = _find_or_create_book(db, data.current_book)
        club.current_book_id = book.id
    elif data.current_book_id is not None:
        book = db.query(models.Book).filter(models.Book.id == data.current_book_id).first()
        if book is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="book_not_found")
        club.current_book_id = book.id
    db.commit()
    db.refresh(club)
    return _club_to_public(db, club, current_user)


@router.delete("/{club_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_club(
    club_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Supprime un club et tout ce qui lui est lié (propriétaire seulement)."""
    club = _get_club_or_404(db, club_id)
    if club.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="owner_only")
    db.query(models.ClubVote).filter(models.ClubVote.club_id == club_id).delete()
    db.query(models.ClubMessage).filter(models.ClubMessage.club_id == club_id).delete()
    db.query(models.ClubMember).filter(models.ClubMember.club_id == club_id).delete()
    db.delete(club)
    db.commit()


@router.post("/{club_id}/join", status_code=status.HTTP_204_NO_CONTENT)
def join_club(
    club_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _get_club_or_404(db, club_id)
    if _get_membership(db, club_id, current_user.id) is None:
        db.add(models.ClubMember(club_id=club_id, user_id=current_user.id, role="member"))
        db.commit()


@router.delete("/{club_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
def leave_club(
    club_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Quitte un club — le propriétaire doit le supprimer plutôt que le
    quitter, sinon personne n'en resterait responsable."""
    club = _get_club_or_404(db, club_id)
    if club.owner_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="owner_cannot_leave")
    db.query(models.ClubMember).filter(
        models.ClubMember.club_id == club_id, models.ClubMember.user_id == current_user.id
    ).delete()
    db.commit()


@router.get("/{club_id}/members", response_model=list[schemas.ClubMemberPublic])
def list_members(club_id: int, db: Session = Depends(get_db)):
    _get_club_or_404(db, club_id)
    members = (
        db.query(models.ClubMember)
        .filter(models.ClubMember.club_id == club_id)
        .order_by(models.ClubMember.joined_at.asc())
        .all()
    )
    users_by_id = {
        u.id: u
        for u in db.query(models.User).filter(
            models.User.id.in_([m.user_id for m in members])
        )
    } if members else {}
    return [
        schemas.ClubMemberPublic(
            username=users_by_id[m.user_id].username,
            avatar_url=users_by_id[m.user_id].avatar_url,
            role=m.role,
        )
        for m in members
        if m.user_id in users_by_id
    ]


@router.get("/{club_id}/messages", response_model=list[schemas.ClubMessagePublic])
def list_messages(
    club_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _get_club_or_404(db, club_id)
    _require_member(db, club_id, current_user)
    messages = (
        db.query(models.ClubMessage)
        .filter(models.ClubMessage.club_id == club_id)
        .order_by(models.ClubMessage.created_at.asc())
        .all()
    )
    authors = {
        u.id: u
        for u in db.query(models.User).filter(
            models.User.id.in_([m.user_id for m in messages])
        )
    } if messages else {}
    return [
        schemas.ClubMessagePublic(
            id=m.id,
            username=authors[m.user_id].username if m.user_id in authors else "?",
            avatar_url=authors[m.user_id].avatar_url if m.user_id in authors else None,
            content=m.content,
            created_at=m.created_at,
        )
        for m in messages
    ]


@router.post(
    "/{club_id}/messages",
    response_model=schemas.ClubMessagePublic,
    status_code=status.HTTP_201_CREATED,
)
def add_message(
    club_id: int,
    data: schemas.ClubMessageCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _get_club_or_404(db, club_id)
    _require_member(db, club_id, current_user)
    message = models.ClubMessage(
        club_id=club_id, user_id=current_user.id, content=data.content
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return schemas.ClubMessagePublic(
        id=message.id,
        username=current_user.username,
        avatar_url=current_user.avatar_url,
        content=message.content,
        created_at=message.created_at,
    )


@router.get("/{club_id}/votes", response_model=list[schemas.ClubVoteResult])
def list_votes(
    club_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Résultats du vote pour le prochain livre : un livre par ligne, avec
    son nombre de voix."""
    _get_club_or_404(db, club_id)
    _require_member(db, club_id, current_user)
    votes = db.query(models.ClubVote).filter(models.ClubVote.club_id == club_id).all()
    if not votes:
        return []

    counts: dict[int, int] = {}
    my_book_id: int | None = None
    for v in votes:
        counts[v.book_id] = counts.get(v.book_id, 0) + 1
        if v.user_id == current_user.id:
            my_book_id = v.book_id

    books_by_id = {
        b.id: b for b in db.query(models.Book).filter(models.Book.id.in_(counts.keys()))
    }
    results = [
        schemas.ClubVoteResult(
            book_id=book_id,
            title=books_by_id[book_id].title,
            author=books_by_id[book_id].author,
            cover_url=books_by_id[book_id].cover_url,
            votes_count=count,
            voted_by_me=book_id == my_book_id,
        )
        for book_id, count in counts.items()
        if book_id in books_by_id
    ]
    results.sort(key=lambda r: r.votes_count, reverse=True)
    return results


@router.post("/{club_id}/votes", status_code=status.HTTP_204_NO_CONTENT)
def cast_vote(
    club_id: int,
    data: schemas.ClubVoteCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Vote pour un livre — revoter remplace le vote précédent."""
    _get_club_or_404(db, club_id)
    _require_member(db, club_id, current_user)
    book = _find_or_create_book(db, data.book)

    existing = (
        db.query(models.ClubVote)
        .filter(models.ClubVote.club_id == club_id, models.ClubVote.user_id == current_user.id)
        .first()
    )
    if existing is not None:
        existing.book_id = book.id
    else:
        db.add(models.ClubVote(club_id=club_id, book_id=book.id, user_id=current_user.id))
    db.commit()


@router.delete("/{club_id}/votes", status_code=status.HTTP_204_NO_CONTENT)
def remove_vote(
    club_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _get_club_or_404(db, club_id)
    db.query(models.ClubVote).filter(
        models.ClubVote.club_id == club_id, models.ClubVote.user_id == current_user.id
    ).delete()
    db.commit()
