"""Routes liées aux livres : recherche Google Books, bibliothèque personnelle."""

from datetime import date, datetime, timezone

import httpx
from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

import models
import schemas
from cloudinary_service import CloudinaryNotConfigured, delete_image, upload_image
from database import get_db
from dependencies import get_current_user
from google_books import RateLimited, search_books

router = APIRouter(prefix="/api/books", tags=["books"])


def _get_owned_user_book(
    db: Session, user_book_id: int, user: models.User
) -> models.UserBook:
    """Retrouve un livre de MA bibliothèque, ou lève 404. Empêche d'accéder
    aux livres des autres (on filtre toujours sur user_id)."""
    user_book = (
        db.query(models.UserBook)
        .filter(
            models.UserBook.id == user_book_id,
            models.UserBook.user_id == user.id,
        )
        .first()
    )
    if user_book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    return user_book


def _find_or_create_book(db: Session, data: schemas.BookSearchResult) -> models.Book:
    """Trouve le livre "universel" en base, ou le crée (dédoublonné via
    google_books_id, sinon isbn)."""
    query = db.query(models.Book)
    book = None
    if data.google_books_id:
        book = query.filter(models.Book.google_books_id == data.google_books_id).first()
    if book is None and data.isbn:
        book = query.filter(models.Book.isbn == data.isbn).first()

    if book is None:
        book = models.Book(**data.model_dump())
        db.add(book)
        db.flush()  # attribue un id sans committer
    return book


@router.get("/search", response_model=list[schemas.BookSearchResult])
async def search(
    q: str = Query(min_length=1, description="Titre, auteur ou ISBN à chercher"),
):
    """Cherche des livres sur Google Books. Route publique — pas besoin de
    compte pour chercher, seulement pour ajouter à sa bibliothèque."""
    try:
        return await search_books(q)
    except RateLimited:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="google_books_rate_limited",
        )
    except httpx.HTTPError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="google_books_unavailable",
        )


@router.post(
    "/library",
    response_model=schemas.UserBookPublic,
    status_code=status.HTTP_201_CREATED,
)
def add_to_library(
    data: schemas.AddToLibraryRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Ajoute un livre (choisi dans la recherche) à MA bibliothèque."""
    book = _find_or_create_book(db, data.book)

    existing = (
        db.query(models.UserBook)
        .filter(
            models.UserBook.user_id == current_user.id,
            models.UserBook.book_id == book.id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="book_already_in_library",
        )

    user_book = models.UserBook(
        user_id=current_user.id,
        book_id=book.id,
        status=data.status,
    )
    db.add(user_book)
    db.add(models.ActivityPost(user_id=current_user.id, type="added_book", book_id=book.id))  # fil d'activité
    db.commit()
    db.refresh(user_book)
    return user_book


@router.get("/library", response_model=list[schemas.UserBookPublic])
def list_my_library(
    status_filter: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Liste les livres de MA bibliothèque (option : filtrer par statut)."""
    query = db.query(models.UserBook).filter(
        models.UserBook.user_id == current_user.id
    )
    if status_filter:
        query = query.filter(models.UserBook.status == status_filter)
    # Ordre : d'abord l'ordre manuel (position), puis les plus récents.
    user_books = query.order_by(
        models.UserBook.position.is_(None),  # ceux avec une position d'abord
        models.UserBook.position.asc(),
        models.UserBook.date_added.desc(),
    ).all()
    return user_books


@router.patch("/reorder", status_code=status.HTTP_204_NO_CONTENT)
def reorder_library(
    data: schemas.ReorderRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Enregistre le nouvel ordre des livres sur l'étagère."""
    owned = {
        ub.id: ub
        for ub in db.query(models.UserBook)
        .filter(models.UserBook.user_id == current_user.id)
        .all()
    }
    for index, ub_id in enumerate(data.ordered_ids):
        ub = owned.get(ub_id)
        if ub is not None:
            ub.position = index
    db.commit()


@router.delete("/library/{user_book_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_from_library(
    user_book_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Retire un livre de MA bibliothèque avec tout ce qui lui est rattaché
    (notes, sessions, photos) — rien n'est en cascade automatique, donc on
    le fait à la main (voir aussi delete_me dans auth.py)."""
    user_book = (
        db.query(models.UserBook)
        .filter(
            models.UserBook.id == user_book_id,
            models.UserBook.user_id == current_user.id,
        )
        .first()
    )
    if user_book is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="not_found",
        )

    images = db.query(models.BookImage).filter(
        models.BookImage.user_id == current_user.id,
        models.BookImage.book_id == user_book.book_id,
    ).all()
    for img in images:
        try:
            delete_image(img.public_id)
        except Exception:
            pass  # ligne supprimée même si Cloudinary échoue
    for img in images:
        db.delete(img)

    db.query(models.BookNote).filter(
        models.BookNote.user_book_id == user_book_id
    ).delete(synchronize_session=False)
    db.query(models.ReadingSession).filter(
        models.ReadingSession.user_book_id == user_book_id
    ).delete(synchronize_session=False)

    db.delete(user_book)
    db.commit()


@router.get("/library/{user_book_id}", response_model=schemas.UserBookPublic)
def get_library_book(
    user_book_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Récupère un livre précis de MA bibliothèque (pour la page Détail)."""
    return _get_owned_user_book(db, user_book_id, current_user)


@router.patch("/library/{user_book_id}", response_model=schemas.UserBookPublic)
def update_library_book(
    user_book_id: int,
    data: schemas.UserBookUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Modifie « mon » livre : statut, note, page actuelle."""
    user_book = _get_owned_user_book(db, user_book_id, current_user)

    # seuls les champs envoyés sont appliqués
    fields = data.model_dump(exclude_unset=True)
    for key, value in fields.items():
        setattr(user_book, key, value)

    # passer à "read" note la date de fin ; en sortir l'efface
    if "status" in fields:
        if fields["status"] == "read" and user_book.date_finished is None:
            user_book.date_finished = datetime.now(timezone.utc)
            db.add(models.ActivityPost(
                user_id=current_user.id, type="finished_book", book_id=user_book.book_id,
            ))
        elif fields["status"] != "read":
            user_book.date_finished = None

    # événement à chaque fois qu'une note est (re)donnée
    if fields.get("rating"):
        db.add(models.ActivityPost(
            user_id=current_user.id, type="rated_book", book_id=user_book.book_id,
            content=str(fields["rating"]),
        ))

    db.commit()
    db.refresh(user_book)
    return user_book


@router.get(
    "/library/{user_book_id}/notes",
    response_model=list[schemas.BookNotePublic],
)
def list_notes(
    user_book_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Liste les notes perso d'un de mes livres."""
    _get_owned_user_book(db, user_book_id, current_user)
    return (
        db.query(models.BookNote)
        .filter(models.BookNote.user_book_id == user_book_id)
        .order_by(models.BookNote.created_at.desc())
        .all()
    )


@router.post(
    "/library/{user_book_id}/notes",
    response_model=schemas.BookNotePublic,
    status_code=status.HTTP_201_CREATED,
)
def add_note(
    user_book_id: int,
    data: schemas.BookNoteCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Ajoute une note perso à un de mes livres."""
    _get_owned_user_book(db, user_book_id, current_user)
    note = models.BookNote(
        user_book_id=user_book_id,
        content=data.content,
        page_number=data.page_number,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.delete(
    "/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Supprime une note perso (seulement si elle m'appartient)."""
    # jointure pour vérifier que la note m'appartient
    note = (
        db.query(models.BookNote)
        .join(models.UserBook, models.BookNote.user_book_id == models.UserBook.id)
        .filter(
            models.BookNote.id == note_id,
            models.UserBook.user_id == current_user.id,
        )
        .first()
    )
    if note is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    db.delete(note)
    db.commit()


@router.post(
    "/library/{user_book_id}/sessions",
    response_model=schemas.ReadingSessionPublic,
    status_code=status.HTTP_201_CREATED,
)
def log_session(
    user_book_id: int,
    data: schemas.ReadingSessionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Logge une session de lecture et met à jour la progression du livre."""
    user_book = _get_owned_user_book(db, user_book_id, current_user)

    session = models.ReadingSession(
        user_book_id=user_book_id,
        pages_read=data.pages_read,
        duration_minutes=data.duration_minutes,
        mood=data.mood,
        session_date=data.session_date or date.today(),
        notes=data.notes,
    )
    db.add(session)

    # current_page est la source de vérité (voir models.py)
    new_page = user_book.current_page + data.pages_read
    total = user_book.book.pages
    if total:
        new_page = min(new_page, total)
    user_book.current_page = new_page

    # Logger une session = on lit encore ce livre, même déjà marqué "lu" à
    # la main sans avoir atteint le total. On ne repasse à "lu" que si la
    # progression atteint (à nouveau) le total.
    was_read = user_book.status == "read"
    is_now_complete = bool(total) and new_page >= total

    if is_now_complete:
        user_book.status = "read"
        if not was_read:
            user_book.date_finished = datetime.now(timezone.utc)
    else:
        user_book.status = "reading"
        if was_read:
            user_book.date_finished = None

    db.commit()
    db.refresh(session)
    return session


@router.get(
    "/library/{user_book_id}/sessions",
    response_model=list[schemas.ReadingSessionPublic],
)
def list_sessions(
    user_book_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Liste les sessions de lecture d'un de mes livres (plus récentes d'abord)."""
    _get_owned_user_book(db, user_book_id, current_user)
    return (
        db.query(models.ReadingSession)
        .filter(models.ReadingSession.user_book_id == user_book_id)
        .order_by(
            models.ReadingSession.session_date.desc(),
            models.ReadingSession.id.desc(),
        )
        .all()
    )


def _image_to_public(img: models.BookImage, user_id: int) -> schemas.BookImagePublic:
    return schemas.BookImagePublic(
        id=img.id,
        type=img.type,
        image_url=img.image_url,
        thumbnail_url=img.thumbnail_url,
        is_own=(img.user_id == user_id),
    )


@router.get(
    "/library/{user_book_id}/images",
    response_model=list[schemas.BookImagePublic],
)
def list_images(
    user_book_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Liste les photos d'un livre : les publiques + les miennes."""
    user_book = _get_owned_user_book(db, user_book_id, current_user)
    images = (
        db.query(models.BookImage)
        .filter(
            models.BookImage.book_id == user_book.book_id,
            (models.BookImage.is_public == True)  # noqa: E712
            | (models.BookImage.user_id == current_user.id),
        )
        .order_by(models.BookImage.created_at.desc())
        .all()
    )
    return [_image_to_public(img, current_user.id) for img in images]


@router.post(
    "/library/{user_book_id}/images",
    response_model=schemas.BookImagePublic,
    status_code=status.HTTP_201_CREATED,
)
def upload_book_image(
    user_book_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Envoie une photo de couverture pour un de mes livres."""
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=422, detail="not_an_image")

    user_book = _get_owned_user_book(db, user_book_id, current_user)

    try:
        uploaded = upload_image(file.file)
    except CloudinaryNotConfigured:
        raise HTTPException(status_code=503, detail="images_not_configured")
    except Exception:
        raise HTTPException(status_code=502, detail="upload_failed")

    image = models.BookImage(
        book_id=user_book.book_id,
        user_id=current_user.id,
        type="cover",
        image_url=uploaded["image_url"],
        thumbnail_url=uploaded["thumbnail_url"],
        public_id=uploaded["public_id"],
    )
    db.add(image)
    db.commit()
    db.refresh(image)
    return _image_to_public(image, current_user.id)


@router.delete("/images/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_book_image(
    image_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Supprime une de MES photos (de la base et de Cloudinary)."""
    image = (
        db.query(models.BookImage)
        .filter(
            models.BookImage.id == image_id,
            models.BookImage.user_id == current_user.id,
        )
        .first()
    )
    if image is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    try:
        delete_image(image.public_id)
    except Exception:
        pass  # on supprime quand même côté base
    db.delete(image)
    db.commit()
