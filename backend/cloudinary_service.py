"""Service Cloudinary : envoie et supprime les images des livres.
Configuré à la première utilisation, à partir de CLOUDINARY_URL (.env)."""

import cloudinary
import cloudinary.uploader

from config import CLOUDINARY_URL


class CloudinaryNotConfigured(Exception):
    """Levée si CLOUDINARY_URL n'est pas configurée dans le .env."""


_configured = False


def _ensure_config():
    global _configured
    if not CLOUDINARY_URL:
        raise CloudinaryNotConfigured()
    if not _configured:
        cloudinary.config(cloudinary_url=CLOUDINARY_URL, secure=True)
        _configured = True


def upload_image(file) -> dict:
    _ensure_config()
    result = cloudinary.uploader.upload(file, folder="shelved")
    public_id = result["public_id"]
    # miniature générée à la volée par Cloudinary, recadrée 200x300
    thumbnail = cloudinary.CloudinaryImage(public_id).build_url(
        width=200, height=300, crop="fill", secure=True
    )
    return {
        "image_url": result["secure_url"],
        "thumbnail_url": thumbnail,
        "public_id": public_id,
    }


def delete_image(public_id: str):
    if not public_id:
        return
    _ensure_config()
    cloudinary.uploader.destroy(public_id)
