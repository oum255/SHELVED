# SHELVED

*English version — [Version française ici](README.fr.md)*

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.13-3776AB?logo=python&logoColor=white)
![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-D71F00?logo=sqlalchemy&logoColor=white)
![JWT](https://img.shields.io/badge/Auth-JWT-black?logo=jsonwebtokens)
![Tests](https://img.shields.io/badge/tests-pytest%20%2B%20vitest-4B32C3)
![License](https://img.shields.io/badge/license-MIT-green)

A full-stack reading tracker: shelve your books on a customizable visual
bookshelf, track your reading progress, connect with other readers, and get
AI-generated recommendations.

Built from day one for **real users**, not as an isolated exercise: secure
authentication, GDPR-compliant data handling, accessibility work, 7
languages (including right-to-left Arabic), and a deliberate cost-control
strategy around the AI features.

---

## Screenshots

**Home page — Niche Corail theme**
![Bookshelf](docs/screenshots/bookshelf.png)

**Book detail — status, rating, progress**
![Book detail page](docs/screenshots/book-detail.png)

**Book detail — description, reading sessions, notes**
![Book detail page, continued](docs/screenshots/book-detail2.png)

**Reading statistics**
![Stats](docs/screenshots/stats.png)

---

## Key features

**Library & discovery**
Book search (Google Books) or camera barcode scanning; a customizable
bookshelf (several visual themes, drag-and-drop reordering); detailed
reading tracking (status, rating, progress, sessions, personal notes).

**Social**
Public profiles, follows, an auto-generated activity feed (likes,
comments), and book clubs with discussion threads and voting for the next
pick.

**AI recommendations**
Personalized recommendations with a compatibility score, cached to avoid
re-calling the API on every visit, with a daily per-user limit to keep
costs under control.

**Account & compliance**
Email verification, forgot-password flow, password-protected credential
changes, GDPR-compliant account deletion (every associated record is
erased, including externally-hosted files), and a moderation system for
community-submitted photos.

---

## What this project demonstrates

- **Security** — bcrypt-hashed passwords, signed JWT sessions, short-lived
  single-use tokens for sensitive email actions (verification, password
  reset), and deliberately identical failure responses on login so the API
  never reveals which accounts exist.
- **Accessibility** — an automated WCAG contrast audit across the entire
  color system, full keyboard navigation (a consistent visible focus ring,
  Escape closes modal dialogs, focus is managed on open), ARIA attributes
  on interactive elements, and respect for `prefers-reduced-motion`.
- **Real internationalization** — 7 languages including right-to-left
  Arabic, with no hardcoded text anywhere in the components.
- **Disciplined AI integration** — caching to avoid redundant calls, a
  daily quota per user, and the AI provider isolated behind a single
  service so it can be swapped out without touching the rest of the code.
- **Automated testing** — pytest on the API (isolated test database, never
  real data) and Vitest/React Testing Library on the frontend, including
  regression tests that target bugs actually encountered and fixed during
  development.
- **Clean architecture** — separated layers (routes / validation schemas /
  data models on the API side), external services (image storage, email,
  AI) isolated behind simple interfaces, and complex layout logic extracted
  and tested independently of the UI.
- **Real product iteration** — several rounds of visual and functional
  redesign driven by concrete feedback, with choices sometimes reverted
  once tested in practice rather than kept on principle.

---

## Tech stack

**Frontend** — React 19, Vite, React Router, i18next (translations),
Recharts (charts), ZXing (barcode scanning), CSS custom properties for
theming, Vitest + React Testing Library.

**Backend** — FastAPI, SQLAlchemy, SQLite (PostgreSQL planned for
production), PyJWT + bcrypt, Pydantic, pytest.

**External services** — Google Books (search & covers), Cloudinary (image
storage), Google Gemini (AI recommendations), Resend (transactional
emails) — all on free tiers, with keys isolated in environment variables.

---

## Architecture

```
Frontend (React + Vite)              what the user sees
        │  HTTP / JSON
Backend (FastAPI + SQLAlchemy)       business logic, validation, security
        │
Storage                              SQLite → PostgreSQL in production
        │                            Cloudinary (images)
External services                    Google Books · Google Gemini · Resend
```

---

## Getting started

Two servers, each in its own terminal.

```bash
# Backend
cd backend
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
cp .env.example .env   # then fill in the keys (see comments inside the file)
./venv/bin/uvicorn main:app --reload
# → http://localhost:8000 (interactive docs at /docs)
```

```bash
# Frontend
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

---

## Tests

```bash
cd backend && pytest        # API tests (isolated, in-memory database)
cd frontend && npm test     # UI tests (Vitest + Testing Library)
```

---

## Author

Designed, built, and iterated on end-to-end by **Oumayma Haddour**.

Distributed under the [MIT license](LICENSE).
