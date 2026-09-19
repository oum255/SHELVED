"""Tests de l'inscription et de la connexion (routers/auth.py)."""

from .conftest import auth_headers, signup_and_login


def test_signup_creates_account(client):
    response = client.post(
        "/api/auth/signup",
        json={"email": "alice@example.com", "username": "alice", "password": "password123"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "alice@example.com"
    assert data["username"] == "alice"
    # le mot de passe (clair ou haché) ne doit jamais revenir dans la réponse
    assert "password" not in data
    assert "password_hash" not in data


def test_signup_rejects_duplicate_email(client):
    client.post(
        "/api/auth/signup",
        json={"email": "alice@example.com", "username": "alice", "password": "password123"},
    )
    response = client.post(
        "/api/auth/signup",
        json={"email": "alice@example.com", "username": "someoneelse", "password": "password123"},
    )
    assert response.status_code == 409
    assert response.json()["detail"] == "email_already_used"


def test_signup_rejects_duplicate_username(client):
    client.post(
        "/api/auth/signup",
        json={"email": "alice@example.com", "username": "alice", "password": "password123"},
    )
    response = client.post(
        "/api/auth/signup",
        json={"email": "other@example.com", "username": "alice", "password": "password123"},
    )
    assert response.status_code == 409
    assert response.json()["detail"] == "username_already_taken"


def test_signup_rejects_short_password(client):
    response = client.post(
        "/api/auth/signup",
        json={"email": "alice@example.com", "username": "alice", "password": "short"},
    )
    assert response.status_code == 422


def test_login_with_correct_password_returns_token(client):
    client.post(
        "/api/auth/signup",
        json={"email": "alice@example.com", "username": "alice", "password": "password123"},
    )
    response = client.post(
        "/api/auth/login",
        json={"email": "alice@example.com", "password": "password123"},
    )
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_login_with_wrong_password_is_rejected(client):
    client.post(
        "/api/auth/signup",
        json={"email": "alice@example.com", "username": "alice", "password": "password123"},
    )
    response = client.post(
        "/api/auth/login",
        json={"email": "alice@example.com", "password": "wrong-password"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "invalid_credentials"


def test_login_with_unknown_email_gives_same_error(client):
    # même message que "mauvais mot de passe" — on ne révèle jamais qu'un email n'est pas inscrit
    response = client.post(
        "/api/auth/login",
        json={"email": "ghost@example.com", "password": "password123"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "invalid_credentials"


def test_me_requires_a_token(client):
    response = client.get("/api/auth/me")
    assert response.status_code in (401, 403)  # HTTPBearer renvoie 403 sans en-tête


def test_me_returns_current_user_profile(client):
    token = signup_and_login(client)
    response = client.get("/api/auth/me", headers=auth_headers(token))
    assert response.status_code == 200
    assert response.json()["username"] == "alice"


def test_me_rejects_garbage_token(client):
    response = client.get("/api/auth/me", headers=auth_headers("not-a-real-token"))
    assert response.status_code == 401


def test_change_password_requires_current_password(client):
    token = signup_and_login(client)
    response = client.post(
        "/api/auth/change-password",
        json={"current_password": "wrong-current", "new_password": "newpassword123"},
        headers=auth_headers(token),
    )
    assert response.status_code == 401

    # avec le bon mot de passe actuel, ça marche et on peut se reconnecter avec le nouveau
    response = client.post(
        "/api/auth/change-password",
        json={"current_password": "password123", "new_password": "newpassword123"},
        headers=auth_headers(token),
    )
    assert response.status_code == 200

    relogin = client.post(
        "/api/auth/login",
        json={"email": "alice@example.com", "password": "newpassword123"},
    )
    assert relogin.status_code == 200
