"""Service d'envoi d'emails (Resend) : vérification de compte + mot de
passe oublié. Configuré via RESEND_API_KEY (.env)."""

import resend

from config import FRONTEND_URL, RESEND_API_KEY

# Adresse "bac à sable" Resend : fonctionne sans domaine vérifié, mais ne
# peut envoyer qu'à l'adresse du compte Resend lui-même. À remplacer par
# "SHELVED <noreply@tondomaine.com>" une fois un domaine vérifié.
FROM_ADDRESS = "SHELVED <onboarding@resend.dev>"


class EmailNotConfigured(Exception):
    """Levée si RESEND_API_KEY n'est pas configurée."""


# {langue: {clé: texte}} ; `{username}` et `{link}` remplacés à l'envoi.
_TEMPLATES = {
    "fr": {
        "verify_subject": "Confirme ton adresse email — SHELVED",
        "verify_body": (
            "Bonjour {username},<br><br>"
            "Clique sur ce lien pour confirmer ton adresse email :<br>"
            '<a href="{link}">{link}</a><br><br>'
            "Ce lien est valable 1 heure."
        ),
        "reset_subject": "Réinitialise ton mot de passe — SHELVED",
        "reset_body": (
            "Bonjour {username},<br><br>"
            "Clique sur ce lien pour choisir un nouveau mot de passe :<br>"
            '<a href="{link}">{link}</a><br><br>'
            "Ce lien est valable 1 heure. Si tu n'es pas à l'origine de cette "
            "demande, ignore simplement cet email."
        ),
    },
    "en": {
        "verify_subject": "Confirm your email — SHELVED",
        "verify_body": (
            "Hi {username},<br><br>"
            "Click this link to confirm your email address:<br>"
            '<a href="{link}">{link}</a><br><br>'
            "This link is valid for 1 hour."
        ),
        "reset_subject": "Reset your password — SHELVED",
        "reset_body": (
            "Hi {username},<br><br>"
            "Click this link to choose a new password:<br>"
            '<a href="{link}">{link}</a><br><br>'
            "This link is valid for 1 hour. If you didn't request this, "
            "just ignore this email."
        ),
    },
    "es": {
        "verify_subject": "Confirma tu correo — SHELVED",
        "verify_body": (
            "Hola {username},<br><br>"
            "Haz clic en este enlace para confirmar tu correo electrónico:<br>"
            '<a href="{link}">{link}</a><br><br>'
            "Este enlace es válido durante 1 hora."
        ),
        "reset_subject": "Restablece tu contraseña — SHELVED",
        "reset_body": (
            "Hola {username},<br><br>"
            "Haz clic en este enlace para elegir una nueva contraseña:<br>"
            '<a href="{link}">{link}</a><br><br>'
            "Este enlace es válido durante 1 hora. Si no has sido tú, ignora "
            "este correo."
        ),
    },
    "it": {
        "verify_subject": "Conferma la tua email — SHELVED",
        "verify_body": (
            "Ciao {username},<br><br>"
            "Clicca su questo link per confermare la tua email:<br>"
            '<a href="{link}">{link}</a><br><br>'
            "Questo link è valido per 1 ora."
        ),
        "reset_subject": "Reimposta la tua password — SHELVED",
        "reset_body": (
            "Ciao {username},<br><br>"
            "Clicca su questo link per scegliere una nuova password:<br>"
            '<a href="{link}">{link}</a><br><br>'
            "Questo link è valido per 1 ora. Se non sei stato tu, ignora "
            "questa email."
        ),
    },
    "de": {
        "verify_subject": "Bestätige deine E-Mail — SHELVED",
        "verify_body": (
            "Hallo {username},<br><br>"
            "Klicke auf diesen Link, um deine E-Mail-Adresse zu bestätigen:<br>"
            '<a href="{link}">{link}</a><br><br>'
            "Dieser Link ist 1 Stunde gültig."
        ),
        "reset_subject": "Setze dein Passwort zurück — SHELVED",
        "reset_body": (
            "Hallo {username},<br><br>"
            "Klicke auf diesen Link, um ein neues Passwort zu wählen:<br>"
            '<a href="{link}">{link}</a><br><br>'
            "Dieser Link ist 1 Stunde gültig. Falls du das nicht warst, "
            "ignoriere diese E-Mail einfach."
        ),
    },
    "pt": {
        "verify_subject": "Confirma o teu email — SHELVED",
        "verify_body": (
            "Olá {username},<br><br>"
            "Clica neste link para confirmar o teu email:<br>"
            '<a href="{link}">{link}</a><br><br>'
            "Este link é válido durante 1 hora."
        ),
        "reset_subject": "Repõe a tua palavra-passe — SHELVED",
        "reset_body": (
            "Olá {username},<br><br>"
            "Clica neste link para escolheres uma nova palavra-passe:<br>"
            '<a href="{link}">{link}</a><br><br>'
            "Este link é válido durante 1 hora. Se não foste tu, ignora "
            "este email."
        ),
    },
    "ar": {
        "verify_subject": "أكّد بريدك الإلكتروني — SHELVED",
        "verify_body": (
            "مرحبًا {username}،<br><br>"
            "اضغط على هذا الرابط لتأكيد بريدك الإلكتروني:<br>"
            '<a href="{link}">{link}</a><br><br>'
            "هذا الرابط صالح لمدة ساعة واحدة."
        ),
        "reset_subject": "إعادة تعيين كلمة المرور — SHELVED",
        "reset_body": (
            "مرحبًا {username}،<br><br>"
            "اضغط على هذا الرابط لاختيار كلمة مرور جديدة:<br>"
            '<a href="{link}">{link}</a><br><br>'
            "هذا الرابط صالح لمدة ساعة واحدة. إذا لم تكن أنت من طلب ذلك، "
            "يمكنك تجاهل هذا البريد."
        ),
    },
}


def _template(language: str) -> dict:
    return _TEMPLATES.get(language, _TEMPLATES["fr"])


def _send(to_email: str, subject: str, html: str) -> None:
    if not RESEND_API_KEY:
        raise EmailNotConfigured()
    resend.api_key = RESEND_API_KEY
    resend.Emails.send(
        {
            "from": FROM_ADDRESS,
            "to": [to_email],
            "subject": subject,
            "html": html,
        }
    )


def send_verification_email(
    to_email: str, username: str, token: str, language: str = "fr"
) -> None:
    tpl = _template(language)
    link = f"{FRONTEND_URL}/verify-email?token={token}"
    _send(
        to_email,
        tpl["verify_subject"],
        tpl["verify_body"].format(username=username, link=link),
    )


def send_password_reset_email(
    to_email: str, username: str, token: str, language: str = "fr"
) -> None:
    tpl = _template(language)
    link = f"{FRONTEND_URL}/reset-password?token={token}"
    _send(
        to_email,
        tpl["reset_subject"],
        tpl["reset_body"].format(username=username, link=link),
    )
