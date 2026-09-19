"""Schémas Pydantic : forme des données qui entrent/sortent de l'API
(différent de models.py, qui décrit les tables en base)."""

from datetime import date, datetime

from pydantic import BaseModel, EmailStr, Field


class BookSearchResult(BaseModel):
    """Livre trouvé via Google Books, pas encore enregistré chez nous."""

    google_books_id: str | None = None
    isbn: str | None = None
    title: str
    author: str | None = None
    pages: int | None = None
    publisher: str | None = None
    published_date: str | None = None
    cover_url: str | None = None
    description: str | None = None
    genre: str | None = None
    language: str | None = None


class BookPublic(BaseModel):
    id: int
    google_books_id: str | None = None
    isbn: str | None = None
    title: str
    author: str | None = None
    pages: int | None = None
    publisher: str | None = None
    published_date: str | None = None
    cover_url: str | None = None
    description: str | None = None
    genre: str | None = None
    language: str | None = None

    model_config = {"from_attributes": True}


class AddToLibraryRequest(BaseModel):
    book: BookSearchResult
    status: str = Field(default="to_read", pattern="^(to_read|reading|read)$")


class UserBookPublic(BaseModel):
    """Mon livre : infos perso + livre imbriqué."""

    id: int
    status: str
    rating: int | None = None
    current_page: int
    date_added: datetime
    date_finished: datetime | None = None
    book: BookPublic

    model_config = {"from_attributes": True}


class RecommendationPublic(BaseModel):
    book_title: str
    book_author: str | None = None
    reason: str | None = None
    match_score: int | None = None

    model_config = {"from_attributes": True}


class SuggestRequest(BaseModel):
    query: str = Field(min_length=1, max_length=300)


class DailyPages(BaseModel):
    date: date
    pages: int


class StatsPublic(BaseModel):
    total_pages_read: int
    total_sessions: int
    books_finished: int
    books_in_progress: int
    current_streak: int  # jours de lecture d'affilée
    pages_per_day: list[DailyPages]  # les 30 derniers jours
    mood_distribution: dict[str, int]  # ex: {"happy": 5, "relaxed": 3}
    reading_calendar: list[DailyPages]  # TOUS les jours lus (pour le calendrier)


class MoodSession(BaseModel):
    """Session associée à une humeur (liste cliquable de la page Stats)."""

    user_book_id: int
    title: str
    author: str | None = None
    cover_url: str | None = None
    session_date: date
    pages_read: int


class BookImagePublic(BaseModel):
    id: int
    type: str
    image_url: str
    thumbnail_url: str | None = None
    is_own: bool = False  # vrai si c'est MA photo (pour autoriser la suppression)

    model_config = {"from_attributes": True}


class ReadingSessionCreate(BaseModel):
    pages_read: int = Field(ge=1)
    duration_minutes: int | None = Field(default=None, ge=0)
    mood: str | None = Field(
        default=None, pattern="^(happy|excited|relaxed|sad|bored)$"
    )
    session_date: date | None = None  # par défaut : aujourd'hui (rempli côté serveur)
    notes: str | None = None


class ReadingSessionPublic(BaseModel):
    id: int
    pages_read: int
    duration_minutes: int | None = None
    mood: str | None = None
    session_date: date
    notes: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ReorderRequest(BaseModel):
    """Nouvel ordre des livres (liste d'ids user_book)."""

    ordered_ids: list[int]


class UserBookUpdate(BaseModel):
    """Champs tous optionnels : on n'envoie que ce qui change."""

    status: str | None = Field(default=None, pattern="^(to_read|reading|read)$")
    rating: int | None = Field(default=None, ge=1, le=5)
    current_page: int | None = Field(default=None, ge=0)


class BookNoteCreate(BaseModel):
    content: str = Field(min_length=1)
    page_number: int | None = Field(default=None, ge=0)


class BookNotePublic(BaseModel):
    id: int
    content: str
    page_number: int | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserProfilePublic(BaseModel):
    """Profil public — jamais l'email. Inclut si le visiteur connecté suit
    déjà ce compte, ou si c'est son propre profil."""

    username: str
    bio: str | None = None
    avatar_url: str | None = None
    reading_goal: int | None = None
    followers_count: int
    following_count: int
    books_read_count: int
    is_following: bool = False
    is_me: bool = False

    model_config = {"from_attributes": True}


class UserProfileUpdate(BaseModel):
    bio: str | None = Field(default=None, max_length=280)
    reading_goal: int | None = Field(default=None, ge=1, le=1000)


class FollowUserPublic(BaseModel):
    username: str
    avatar_url: str | None = None

    model_config = {"from_attributes": True}


class UserBookSummary(BaseModel):
    title: str
    author: str | None = None
    cover_url: str | None = None
    rating: int | None = None


class ActivityPostPublic(BaseModel):
    """Événement du fil, dénormalisé pour l'affichage sans requête supplémentaire."""

    id: int
    type: str
    created_at: datetime
    username: str
    avatar_url: str | None = None
    book_id: int | None = None
    book_title: str | None = None
    book_author: str | None = None
    book_cover_url: str | None = None
    content: str | None = None
    likes_count: int
    is_liked: bool = False
    comments_count: int


class PostCommentCreate(BaseModel):
    content: str = Field(min_length=1, max_length=500)


class PostCommentPublic(BaseModel):
    id: int
    username: str
    avatar_url: str | None = None
    content: str
    created_at: datetime


class ReportCreate(BaseModel):
    target_type: str = Field(pattern="^(image)$")  # seul "image" existe pour l'instant
    target_id: int
    reason: str = Field(min_length=1, max_length=500)


class ReportPublic(BaseModel):
    """Signalement avec aperçu (qui a signalé, élément concerné) pour juger
    sans naviguer ailleurs."""

    id: int
    target_type: str
    target_id: int
    reason: str
    status: str
    created_at: datetime
    reporter_username: str
    # Aperçu de l'élément signalé (rempli seulement si target_type == "image").
    image_url: str | None = None
    book_title: str | None = None

    model_config = {"from_attributes": True}


class ReportUpdate(BaseModel):
    status: str = Field(pattern="^(pending|reviewed|removed)$")


class BookClubCreate(BaseModel):
    name: str = Field(min_length=3, max_length=100)
    description: str | None = Field(default=None, max_length=500)


class BookClubUpdate(BaseModel):
    """Modifie un club (propriétaire seulement). `current_book` pour un choix
    libre (résultat Google Books, retrouvé/créé en base) ; `current_book_id`
    pour reprendre un livre déjà connu (ex: le gagnant du vote) sans doublon."""

    name: str | None = Field(default=None, min_length=3, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    current_book: BookSearchResult | None = None
    current_book_id: int | None = None


class ClubBookPublic(BaseModel):
    id: int
    title: str
    author: str | None = None
    cover_url: str | None = None

    model_config = {"from_attributes": True}


class BookClubSummary(BaseModel):
    id: int
    name: str
    description: str | None = None
    member_count: int
    current_book: ClubBookPublic | None = None
    is_member: bool = False


class BookClubPublic(BaseModel):
    id: int
    name: str
    description: str | None = None
    owner_username: str
    member_count: int
    current_book: ClubBookPublic | None = None
    is_member: bool = False
    is_owner: bool = False
    created_at: datetime


class ClubMemberPublic(BaseModel):
    username: str
    avatar_url: str | None = None
    role: str

    model_config = {"from_attributes": True}


class ClubMessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=1000)


class ClubMessagePublic(BaseModel):
    id: int
    username: str
    avatar_url: str | None = None
    content: str
    created_at: datetime


class ClubVoteCreate(BaseModel):
    """Vote pour un livre (résultat de recherche Google Books — pas besoin
    qu'il existe déjà en base)."""

    book: BookSearchResult


class ClubVoteResult(BaseModel):
    book_id: int
    title: str
    author: str | None = None
    cover_url: str | None = None
    votes_count: int
    voted_by_me: bool = False


class ChangeUsernameRequest(BaseModel):
    """Changement de pseudo, protégé par le mot de passe actuel."""

    new_username: str = Field(min_length=3, max_length=30)
    current_password: str


class ChangeEmailRequest(BaseModel):
    """Changement d'email, protégé par le mot de passe actuel — la nouvelle
    adresse redevient non-vérifiée."""

    new_email: EmailStr
    current_password: str


class ChangePasswordRequest(BaseModel):
    """Protégé par le mot de passe actuel (contrairement à /reset-password,
    basé sur un jeton email pour qui ne peut pas se connecter)."""

    current_password: str
    new_password: str = Field(min_length=8)


class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=30)
    password: str = Field(min_length=8)
    language: str = Field(default="fr", pattern="^(fr|en|es|it|de|pt|ar)$")


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8)


class MessageResponse(BaseModel):
    message: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserPublic(BaseModel):
    """Ce que l'API renvoie pour un utilisateur — jamais le mot de passe."""

    id: int
    email: EmailStr
    username: str
    username_changed_at: datetime | None = None
    language: str
    bio: str | None = None
    avatar_url: str | None = None
    reading_goal: int | None = None
    is_admin: bool = False
    email_verified: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}
