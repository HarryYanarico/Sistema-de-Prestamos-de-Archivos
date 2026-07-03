from django.conf import settings
from django.core.mail import send_mail
from django.contrib.auth.models import User


def notificar_documentos_faltantes(carpeta_desc, persona_nombre, docs_faltantes, usuario_registra):
    if not settings.EMAIL_HOST:
        return
    superusers = User.objects.filter(is_superuser=True, is_active=True)
    destinatarios = [u.email for u in superusers if u.email]
    if not destinatarios:
        return
    asunto = f"Devolución con documentos faltantes - {carpeta_desc}"
    cuerpo = (
        f"Se ha registrado una devolución de la carpeta: {carpeta_desc}\n"
        f"Persona: {persona_nombre}\n"
        f"Registró: {usuario_registra}\n\n"
        f"Documentos faltantes:\n"
    )
    for doc in docs_faltantes:
        cuerpo += f"  - {doc}\n"
    cuerpo += (
        f"\nSe generó una prórroga automática de 7 días "
        f"para que la persona devuelva los documentos faltantes."
    )
    send_mail(asunto, cuerpo, settings.DEFAULT_FROM_EMAIL, destinatarios)
