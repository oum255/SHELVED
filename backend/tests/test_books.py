"""Tests de la bibliothèque : ajouter/retirer un livre, sessions de lecture,
et la bascule automatique de statut (to_read/reading/read) — zone à
régression, couverte en détail plus bas."""

from .conftest import auth_headers, signup_and_login

BOOK = {
    "google_books_id": "cruel-prince-1",
    "title": "Le Prince Cruel",
    "author": "Holly Black",
    "pages": 100,
}


def _add_book(client, token, book=None, status="to_read"):
    response = client.post(
        "/api/books/library",
        json={"book": book or BOOK, "status": status},
        headers=auth_headers(token),
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_add_to_library_creates_entry(client):
    token = signup_and_login(client)
    user_book = _add_book(client, token)
    assert user_book["status"] == "to_read"
    assert user_book["current_page"] == 0
    assert user_book["book"]["title"] == BOOK["title"]


def test_add_to_library_rejects_duplicate(client):
    token = signup_and_login(client)
    _add_book(client, token)
    response = client.post(
        "/api/books/library",
        json={"book": BOOK, "status": "to_read"},
        headers=auth_headers(token),
    )
    assert response.status_code == 409
    assert response.json()["detail"] == "book_already_in_library"


def test_list_library_returns_my_books_only(client):
    token_a = signup_and_login(client, email="a@example.com", username="usera")
    token_b = signup_and_login(client, email="b@example.com", username="userb")
    _add_book(client, token_a)

    response_a = client.get("/api/books/library", headers=auth_headers(token_a))
    assert len(response_a.json()) == 1

    response_b = client.get("/api/books/library", headers=auth_headers(token_b))
    assert response_b.json() == []


def test_remove_from_library(client):
    token = signup_and_login(client)
    user_book = _add_book(client, token)

    response = client.delete(
        f"/api/books/library/{user_book['id']}", headers=auth_headers(token)
    )
    assert response.status_code == 204

    response = client.get("/api/books/library", headers=auth_headers(token))
    assert response.json() == []


def test_cannot_access_another_users_book(client):
    token_a = signup_and_login(client, email="a@example.com", username="usera")
    token_b = signup_and_login(client, email="b@example.com", username="userb")
    user_book = _add_book(client, token_a)

    response = client.get(
        f"/api/books/library/{user_book['id']}", headers=auth_headers(token_b)
    )
    assert response.status_code == 404


def test_log_session_marks_book_as_read_when_pages_reach_total(client):
    token = signup_and_login(client)
    user_book = _add_book(client, token)

    response = client.post(
        f"/api/books/library/{user_book['id']}/sessions",
        json={"pages_read": 100},
        headers=auth_headers(token),
    )
    assert response.status_code == 201

    updated = client.get(
        f"/api/books/library/{user_book['id']}", headers=auth_headers(token)
    ).json()
    assert updated["status"] == "read"
    assert updated["current_page"] == 100
    assert updated["date_finished"] is not None


def test_log_session_reverts_read_to_reading_on_incomplete_progress(client):
    """Marquer un livre "lu" à la main avant d'avoir atteint le nombre de
    pages, puis logger une session incomplète, doit faire redescendre le
    statut à "reading" (et effacer la date de fin)."""
    token = signup_and_login(client)
    user_book = _add_book(client, token)

    # marque le livre "lu" à la main, avant la fin (page 0)
    marked_read = client.patch(
        f"/api/books/library/{user_book['id']}",
        json={"status": "read"},
        headers=auth_headers(token),
    ).json()
    assert marked_read["status"] == "read"
    assert marked_read["date_finished"] is not None

    # continue à logger des sessions, sans atteindre le total
    response = client.post(
        f"/api/books/library/{user_book['id']}/sessions",
        json={"pages_read": 30},
        headers=auth_headers(token),
    )
    assert response.status_code == 201

    updated = client.get(
        f"/api/books/library/{user_book['id']}", headers=auth_headers(token)
    ).json()
    assert updated["status"] == "reading"
    assert updated["current_page"] == 30
    assert updated["date_finished"] is None


def test_log_session_stays_read_if_already_finished(client):
    """Une fois le total atteint, continuer à loguer ne doit pas faire perdre le statut "lu"."""
    token = signup_and_login(client)
    user_book = _add_book(client, token)

    client.post(
        f"/api/books/library/{user_book['id']}/sessions",
        json={"pages_read": 100},
        headers=auth_headers(token),
    )
    response = client.post(
        f"/api/books/library/{user_book['id']}/sessions",
        json={"pages_read": 5},
        headers=auth_headers(token),
    )
    assert response.status_code == 201

    updated = client.get(
        f"/api/books/library/{user_book['id']}", headers=auth_headers(token)
    ).json()
    assert updated["status"] == "read"
    assert updated["current_page"] == 100  # ne dépasse jamais le total du livre
