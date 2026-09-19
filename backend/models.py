"""Tables SQLAlchemy de la base de données SHELVED."""

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    # Identité de connexion
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)  # mot de passe CRYPTÉ, jamais en clair
    username = Column(String, unique=True, index=True, nullable=False)
    # Pour limiter le changement de pseudo à 1 fois/30 jours ; None = jamais changé.
    username_changed_at = Column(DateTime, nullable=True)

    # Profil
    bio = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    avatar_public_id = Column(String, nullable=True)  # id Cloudinary (pour suppression/remplacement)
    reading_goal = Column(Integer, nullable=True)  # objectif annuel de lecture

    language = Column(String, default="fr", nullable=False)

    # Vérification d'email + mot de passe oublié (tokens à durée de vie courte)
    email_verified = Column(Boolean, default=False, nullable=False)
    verification_token = Column(String, nullable=True)
    reset_token = Column(String, nullable=True)

    # Accès aux outils de modération
    is_admin = Column(Boolean, default=False, nullable=False)

    created_at = Column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )


class Book(Base):
    """Livre "universel" partagé par tous les utilisateurs — sert aussi
    de cache pour éviter de rappeler Google Books à chaque recherche."""

    __tablename__ = "books"

    id = Column(Integer, primary_key=True, index=True)

    # le plus fiable pour dédupliquer, avant de retomber sur l'isbn
    google_books_id = Column(String, unique=True, index=True, nullable=True)
    isbn = Column(String, unique=True, index=True, nullable=True)

    title = Column(String, nullable=False)
    author = Column(String, nullable=True)
    pages = Column(Integer, nullable=True)
    publisher = Column(String, nullable=True)
    published_date = Column(String, nullable=True)  # texte : Google renvoie "1965" ou "1965-06-01"
    cover_url = Column(String, nullable=True)
    description = Column(String, nullable=True)
    genre = Column(String, nullable=True)
    language = Column(String, nullable=True)

    created_at = Column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )


class UserBook(Base):
    """Lien user↔livre : statut, note et progression, propres à cet utilisateur."""

    __tablename__ = "user_books"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    book_id = Column(Integer, ForeignKey("books.id"), nullable=False, index=True)

    status = Column(String, default="to_read", nullable=False)  # to_read / reading / read
    rating = Column(Integer, nullable=True)  # 1 à 5, optionnel
    current_page = Column(Integer, default=0, nullable=False)  # SOURCE DE VÉRITÉ progression
    position = Column(Integer, nullable=True)  # ordre manuel sur l'étagère (NULL = non rangé)

    date_added = Column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    date_finished = Column(DateTime, nullable=True)
    created_at = Column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # raccourci : user_book.book.title
    book = relationship("Book")

    __table_args__ = (
        UniqueConstraint("user_id", "book_id", name="unique_user_book"),
    )


class BookNote(Base):
    """Une note perso prise sur « mon » livre (ex: une citation, une réflexion)."""

    __tablename__ = "book_notes"

    id = Column(Integer, primary_key=True, index=True)
    user_book_id = Column(
        Integer, ForeignKey("user_books.id"), nullable=False, index=True
    )
    content = Column(String, nullable=False)
    page_number = Column(Integer, nullable=True)  # optionnel : à quelle page
    created_at = Column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )


class BookImage(Base):
    """Photo de couverture (custom) d'un livre, uploadée par un utilisateur
    et stockée sur Cloudinary. Reliée au livre universel."""

    __tablename__ = "book_images"

    id = Column(Integer, primary_key=True, index=True)
    book_id = Column(Integer, ForeignKey("books.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # qui a uploadé
    type = Column(String, nullable=False)  # toujours "cover" pour l'instant
    image_url = Column(String, nullable=False)
    thumbnail_url = Column(String, nullable=True)
    public_id = Column(String, nullable=True)  # identifiant Cloudinary (pour suppression)
    is_public = Column(Boolean, default=True, nullable=False)
    created_at = Column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )


class AIUsage(Base):
    """Compteur d'appels IA par utilisateur et par jour (maîtrise des coûts/quota)."""

    __tablename__ = "ai_usage"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    usage_date = Column(Date, nullable=False, index=True)
    request_count = Column(Integer, default=0, nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "usage_date", name="unique_user_day"),
    )


class Recommendation(Base):
    """Cache des recommandations générées par l'IA (pour ne pas réinterroger
    à chaque visite). On régénère quand l'utilisateur le demande."""

    __tablename__ = "recommendations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    book_title = Column(String, nullable=False)
    book_author = Column(String, nullable=True)
    reason = Column(String, nullable=True)
    match_score = Column(Integer, nullable=True)
    created_at = Column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )


class ChatMessage(Base):
    """Un message du chat avec l'IA (historique par utilisateur)."""

    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    role = Column(String, nullable=False)  # user / assistant
    content = Column(String, nullable=False)
    created_at = Column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )


class Follow(Base):
    """Qui suit qui — une ligne par abonnement (A suit B ≠ B suit A, pas symétrique)."""

    __tablename__ = "follows"

    id = Column(Integer, primary_key=True, index=True)
    follower_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)  # celui qui suit
    following_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)  # celui qui est suivi
    created_at = Column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("follower_id", "following_id", name="unique_follow"),
    )


class ActivityPost(Base):
    """Événement du fil d'activité (« Jean a terminé Dune »), généré
    automatiquement — jamais créé directement via une route dédiée."""

    __tablename__ = "activity_posts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(String, nullable=False)  # added_book / rated_book / finished_book
    book_id = Column(Integer, ForeignKey("books.id"), nullable=True)
    content = Column(String, nullable=True)  # ex: la note donnée, en texte ("4")
    created_at = Column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )


class PostLike(Base):
    __tablename__ = "post_likes"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("activity_posts.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("post_id", "user_id", name="unique_like"),
    )


class PostComment(Base):
    __tablename__ = "post_comments"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("activity_posts.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    content = Column(String, nullable=False)
    created_at = Column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )


class Report(Base):
    """Signalement générique : `target_type` + `target_id` pointent vers
    l'élément visé (seulement "image" pour l'instant)."""

    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    target_type = Column(String, nullable=False)  # "image" pour l'instant
    target_id = Column(Integer, nullable=False)
    reason = Column(String, nullable=False)
    status = Column(String, default="pending", nullable=False)  # pending / reviewed / removed
    created_at = Column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )


class BookClub(Base):
    __tablename__ = "book_clubs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    current_book_id = Column(Integer, ForeignKey("books.id"), nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )


class ClubMember(Base):
    """Qui fait partie de quel club — le créateur y est automatiquement,
    avec le rôle "owner"."""

    __tablename__ = "club_members"

    id = Column(Integer, primary_key=True, index=True)
    club_id = Column(Integer, ForeignKey("book_clubs.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    role = Column(String, default="member", nullable=False)  # owner / member
    joined_at = Column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("club_id", "user_id", name="unique_club_member"),
    )


class ClubMessage(Base):
    """Un message dans la discussion d'un club (réservée aux membres)."""

    __tablename__ = "club_messages"

    id = Column(Integer, primary_key=True, index=True)
    club_id = Column(Integer, ForeignKey("book_clubs.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    content = Column(String, nullable=False)
    created_at = Column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )


class ClubVote(Base):
    """Vote pour le prochain livre — un seul vote actif par membre et par
    club ; revoter remplace le précédent."""

    __tablename__ = "club_votes"

    id = Column(Integer, primary_key=True, index=True)
    club_id = Column(Integer, ForeignKey("book_clubs.id"), nullable=False, index=True)
    book_id = Column(Integer, ForeignKey("books.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("club_id", "user_id", name="unique_club_vote"),
    )


class ReadingSession(Base):
    """Une session de lecture (pages lues à une date) — sert de base au calcul des stats."""

    __tablename__ = "reading_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_book_id = Column(
        Integer, ForeignKey("user_books.id"), nullable=False, index=True
    )
    pages_read = Column(Integer, nullable=False)
    duration_minutes = Column(Integer, nullable=True)
    mood = Column(String, nullable=True)  # happy / excited / relaxed / sad / bored
    session_date = Column(Date, nullable=False, index=True)
    notes = Column(String, nullable=True)
    created_at = Column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
