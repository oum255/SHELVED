"""Routes de modération : signaler un élément (tout le monde), traiter les
signalements (admins seulement). Seul target_type="image" existe pour l'instant."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

import models
import schemas
from cloudinary_service import delete_image
from database import get_db
from dependencies import get_current_admin, get_current_user

router = APIRouter(tags=["moderation"])


@router.post(
    "/api/reports",
    response_model=schemas.ReportPublic,
    status_code=status.HTTP_201_CREATED,
)
def create_report(
    data: schemas.ReportCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Signale un élément (ex: une photo qui pose problème)."""
    if data.target_type == "image":
        exists = (
            db.query(models.BookImage)
            .filter(models.BookImage.id == data.target_id)
            .first()
        )
        if exists is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")

    report = models.Report(
        reporter_id=current_user.id,
        target_type=data.target_type,
        target_id=data.target_id,
        reason=data.reason,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return _to_public(db, report)


def _to_public(db: Session, report: models.Report) -> schemas.ReportPublic:
    reporter = db.query(models.User).filter(models.User.id == report.reporter_id).first()
    image_url = None
    book_title = None
    if report.target_type == "image":
        image = (
            db.query(models.BookImage)
            .filter(models.BookImage.id == report.target_id)
            .first()
        )
        if image is not None:
            image_url = image.image_url
            book = db.query(models.Book).filter(models.Book.id == image.book_id).first()
            book_title = book.title if book else None

    return schemas.ReportPublic(
        id=report.id,
        target_type=report.target_type,
        target_id=report.target_id,
        reason=report.reason,
        status=report.status,
        created_at=report.created_at,
        reporter_username=reporter.username if reporter else "?",
        image_url=image_url,
        book_title=book_title,
    )


@router.get("/api/admin/reports", response_model=list[schemas.ReportPublic])
def list_reports(
    status_filter: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    _admin: models.User = Depends(get_current_admin),
):
    """Liste les signalements (option : filtrer par statut). Réservé aux admins."""
    query = db.query(models.Report)
    if status_filter:
        query = query.filter(models.Report.status == status_filter)
    reports = query.order_by(models.Report.created_at.desc()).all()
    return [_to_public(db, r) for r in reports]


@router.patch("/api/admin/reports/{report_id}", response_model=schemas.ReportPublic)
def update_report(
    report_id: int,
    data: schemas.ReportUpdate,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(get_current_admin),
):
    """Passer à "removed" supprime aussi l'élément signalé, pas seulement le signalement."""
    report = db.query(models.Report).filter(models.Report.id == report_id).first()
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")

    report.status = data.status

    if data.status == "removed" and report.target_type == "image":
        image = (
            db.query(models.BookImage)
            .filter(models.BookImage.id == report.target_id)
            .first()
        )
        if image is not None:
            try:
                delete_image(image.public_id)
            except Exception:
                pass  # ligne supprimée même si Cloudinary échoue
            db.delete(image)

    db.commit()
    db.refresh(report)
    return _to_public(db, report)
