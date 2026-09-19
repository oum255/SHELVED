"""Service IA (Google Gemini) : recommandations de livres.
Configuré à partir de GEMINI_API_KEY (.env)."""

import json

from google import genai

from config import GEMINI_API_KEY

MODEL = "gemini-2.5-flash"


class AINotConfigured(Exception):
    """Levée si GEMINI_API_KEY n'est pas configurée."""


class AIUnavailable(Exception):
    """Levée si l'IA est injoignable ou a dépassé son quota (429)."""


_client = None


def _get_client():
    global _client
    if not GEMINI_API_KEY:
        raise AINotConfigured()
    if _client is None:
        _client = genai.Client(api_key=GEMINI_API_KEY)
    return _client


# Noms des langues (pour demander à l'IA de répondre dans la bonne langue).
_LANG_NAMES = {
    "fr": "français",
    "en": "English",
    "es": "español",
    "it": "italiano",
    "de": "Deutsch",
    "pt": "português",
    "ar": "العربية",
}


def _ask_for_books(prompt: str) -> list[dict]:
    """Envoie un prompt à Gemini (réponse en JSON) et renvoie une liste de livres
    nettoyés : [{"title", "author", "reason", "match_score"}, ...] (max 5)."""
    client = _get_client()
    try:
        response = client.models.generate_content(
            model=MODEL,
            contents=prompt,
            config={"response_mime_type": "application/json"},
        )
    except Exception as e:
        raise AIUnavailable(str(e))

    try:
        data = json.loads(response.text)
    except (json.JSONDecodeError, TypeError):
        raise AIUnavailable("réponse IA illisible")

    results = []
    for item in data if isinstance(data, list) else []:
        if not isinstance(item, dict) or not item.get("title"):
            continue
        score = item.get("match_score")
        try:
            score = max(0, min(100, int(score)))
        except (TypeError, ValueError):
            score = None
        results.append(
            {
                "title": str(item["title"])[:300],
                "author": str(item["author"])[:300] if item.get("author") else None,
                "reason": str(item["reason"])[:1000] if item.get("reason") else None,
                "match_score": score,
            }
        )
    return results[:5]


def generate_recommendations(liked_books: list[dict], language: str = "fr") -> list[dict]:
    """Demande à Gemini 5 recommandations basées sur les livres aimés.
    `liked_books` = [{"title": ..., "author": ...}, ...]."""
    lang_name = _LANG_NAMES.get(language, "français")

    if liked_books:
        liste = "\n".join(
            f"- {b['title']}" + (f" ({b['author']})" if b.get("author") else "")
            for b in liked_books
        )
        contexte = f"Cette personne a aimé ces livres :\n{liste}"
    else:
        contexte = (
            "Cette personne n'a pas encore de livres notés. Propose des "
            "classiques et best-sellers variés et populaires."
        )

    prompt = (
        f"{contexte}\n\n"
        "Recommande exactement 5 livres qu'elle pourrait adorer (différents de "
        "ceux déjà cités). Pour chacun, donne une raison courte et personnalisée "
        f"(1 phrase), rédigée en {lang_name}.\n"
        "Réponds UNIQUEMENT en JSON, un tableau de 5 objets avec les clés : "
        '"title" (string), "author" (string), "reason" (string en '
        f'{lang_name}), "match_score" (entier 0-100).'
    )
    return _ask_for_books(prompt)


def suggest_books(query: str, language: str = "fr") -> list[dict]:
    """Ex: « romans fantasy avec une héroïne forte »."""
    lang_name = _LANG_NAMES.get(language, "français")
    prompt = (
        f'Un lecteur cherche des idées de lecture correspondant à cette demande : "{query}".\n\n'
        "Recommande exactement 5 livres réels et pertinents. Pour chacun, donne une "
        f"raison courte (1 phrase) expliquant pourquoi il correspond, rédigée en {lang_name}.\n"
        "Réponds UNIQUEMENT en JSON, un tableau de 5 objets avec les clés : "
        '"title" (string), "author" (string), "reason" (string en '
        f'{lang_name}), "match_score" (entier 0-100, pertinence vis-à-vis de la demande).'
    )
    return _ask_for_books(prompt)
