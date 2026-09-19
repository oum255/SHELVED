"""Interroge l'API Google Books et normalise ses résultats (champs
parfois absents) en objets simples prêts pour la table `books`."""

import httpx

from config import GOOGLE_BOOKS_API_KEY

GOOGLE_BOOKS_URL = "https://www.googleapis.com/books/v1/volumes"


class RateLimited(Exception):
    """Levée quand Google répond 429 (quota dépassé)."""


def _hi_res_cover(url: str | None) -> str | None:
    """Transforme l'URL de couverture Google Books pour obtenir une image nette.
    Par défaut Google renvoie ~128px (flou une fois agrandi) ; on demande ~400px."""
    if not url:
        return None
    url = url.replace("http://", "https://")
    url = url.replace("&edge=curl", "").replace("zoom=1", "zoom=0")
    if "fife=" not in url:
        sep = "&" if "?" in url else "?"
        url = url + sep + "fife=w400"
    return url


def _extract_isbn(volume_info: dict) -> str | None:
    """Cherche l'ISBN-13 (sinon ISBN-10) dans les identifiants du livre."""
    identifiers = volume_info.get("industryIdentifiers", [])
    isbn13 = next((i["identifier"] for i in identifiers if i.get("type") == "ISBN_13"), None)
    isbn10 = next((i["identifier"] for i in identifiers if i.get("type") == "ISBN_10"), None)
    return isbn13 or isbn10


def _normalize(item: dict) -> dict:
    info = item.get("volumeInfo", {})
    authors = info.get("authors", [])
    image_links = info.get("imageLinks", {})

    return {
        "google_books_id": item.get("id"),
        "isbn": _extract_isbn(info),
        "title": info.get("title", "Sans titre"),
        "author": ", ".join(authors) if authors else None,
        "pages": info.get("pageCount"),
        "publisher": info.get("publisher"),
        "published_date": info.get("publishedDate"),
        "cover_url": _hi_res_cover(image_links.get("thumbnail")),
        "description": info.get("description"),
        "genre": (info.get("categories") or [None])[0],
        "language": info.get("language"),
    }


async def search_books(query: str, max_results: int = 20) -> list[dict]:
    params = {"q": query, "maxResults": max_results}
    if GOOGLE_BOOKS_API_KEY:
        params["key"] = GOOGLE_BOOKS_API_KEY

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(GOOGLE_BOOKS_URL, params=params)

    if response.status_code == 429:
        raise RateLimited()
    response.raise_for_status()
    data = response.json()

    items = data.get("items", [])
    return [_normalize(item) for item in items if item.get("id")]
