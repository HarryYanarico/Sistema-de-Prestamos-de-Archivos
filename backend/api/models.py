import secrets
import uuid
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

class Persona(models.Model):
    TIPO_ENTIDAD_CHOICES = [
        ('persona', 'Persona Natural'),
        ('institucion', 'Institución'),
        ('empresa', 'Empresa'),
    ]

    ci = models.CharField(max_length=20, unique=True)
    nombre = models.CharField(max_length=100)
    apellido = models.CharField(max_length=100)
    telefono = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(max_length=100, blank=True, null=True)
    direccion = models.CharField(max_length=255, blank=True, null=True)
    cargo = models.CharField(max_length=100, blank=True, null=True)
    tipo_entidad = models.CharField(
        max_length=20,
        choices=TIPO_ENTIDAD_CHOICES,
        blank=True,
        null=True,
        default='persona'
    )

    def __str__(self):
        return f"{self.nombre} {self.apellido}"

class Ambiente(models.Model):
    nombre = models.CharField(max_length=100)
    ubicacion = models.CharField(max_length=100, blank=True, null=True)
    descripcion = models.CharField(max_length=255, blank=True, null=True)

    def __str__(self):
        return self.nombre

class Estante(models.Model):
    codigo = models.CharField(max_length=50)
    numero = models.IntegerField(blank=True, null=True)
    descripcion = models.CharField(max_length=255, blank=True, null=True)
    estado = models.CharField(max_length=20, blank=True, null=True)
    limite_pisos = models.IntegerField(blank=True, null=True, default=1)
    ambiente = models.ForeignKey(Ambiente, on_delete=models.CASCADE)

    def __str__(self):
        return f"Estante {self.codigo}"

class Piso(models.Model):
    nro_fila = models.IntegerField()
    descripcion = models.CharField(max_length=255, blank=True, null=True)
    estante = models.ForeignKey(Estante, on_delete=models.CASCADE)

    def __str__(self):
        return f"Piso {self.nro_fila} - {self.estante.codigo}"

class Carpeta(models.Model):
    descripcion = models.CharField(max_length=255, blank=True, null=True)
    fecha_crea = models.DateTimeField(auto_now_add=True)
    estado = models.CharField(max_length=20, default='disponible')
    piso = models.ForeignKey(Piso, on_delete=models.CASCADE)

    def __str__(self):
        return f"Carpeta {self.id} - {self.descripcion}"

class Documento(models.Model):
    ESTADO_CHOICES = [
        ('disponible', 'Disponible'),
        ('prestado_carpeta', 'Prestado (carpeta)'),
        ('prestado_individual', 'Prestado (individual)'),
    ]

    codigo_doc = models.CharField(max_length=50, blank=True)
    titulo = models.CharField(max_length=150)
    tipo_doc = models.CharField(max_length=50)
    fecha_ingre = models.DateTimeField(auto_now_add=True)
    propietario = models.ForeignKey(
        'Persona',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='documentos_propietario'
    )
    carpeta = models.ForeignKey(Carpeta, on_delete=models.CASCADE)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='disponible')

    def __str__(self):
        return self.titulo

class Incidente(models.Model):
    tipo_inci = models.CharField(max_length=50)
    fecha_reporte = models.DateTimeField(auto_now_add=True)
    estado = models.BooleanField(default=True)
    usuario = models.ForeignKey(User, on_delete=models.CASCADE)

    def __str__(self):
        return f"Incidente {self.id} - {self.tipo_inci}"

class DetalleIncidente(models.Model):
    descripcion = models.CharField(max_length=255, blank=True, null=True)
    incidente = models.ForeignKey(Incidente, on_delete=models.CASCADE)
    carpeta = models.ForeignKey(Carpeta, on_delete=models.CASCADE)

    def __str__(self):
        return f"Detalle Incidente {self.incidente.id}"

class Bloqueo(models.Model):
    fecha_bloq = models.DateTimeField(auto_now_add=True)
    motivo_bloq = models.CharField(max_length=255)
    fecha_desbloq = models.DateTimeField(blank=True, null=True)
    motivo_desbloq = models.CharField(max_length=255, blank=True, null=True)
    usuario = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bloqueos_realizados')
    usuario_desbloqueo = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='bloqueos_desbloqueados')
    persona = models.ForeignKey(Persona, on_delete=models.CASCADE, null=True, blank=True)

    def __str__(self):
        return f"Bloqueo {self.id} - {self.usuario.username} bloqueó a {self.persona}"

class PrestamoCarpeta(models.Model):
    prestamo = models.ForeignKey('Prestamo', on_delete=models.CASCADE)
    carpeta = models.ForeignKey(Carpeta, on_delete=models.CASCADE)
    fecha_devol = models.DateTimeField(blank=True, null=True)
    estado = models.CharField(max_length=20, default='prestado')
    observaciones = models.CharField(max_length=255, blank=True, null=True)

    def __str__(self):
        return f"Prestamo {self.prestamo_id} - Carpeta {self.carpeta_id}"

class Prestamo(models.Model):
    fecha_prest = models.DateTimeField(auto_now_add=True)
    fecha_devolucion = models.DateTimeField()
    observaciones = models.CharField(max_length=255, blank=True, null=True)
    persona = models.ForeignKey(Persona, on_delete=models.CASCADE, related_name='prestamos_recibidos')
    usuario = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='prestamos_registrados')
    autorizado_por = models.ForeignKey(Persona, on_delete=models.SET_NULL, null=True, blank=True, related_name='prestamos_autorizados')
    carpetas = models.ManyToManyField(Carpeta, through='PrestamoCarpeta', related_name='prestamos')
    token_firma = models.UUIDField(null=True, blank=True, unique=True)
    foto_firma = models.ImageField(upload_to='firmas/', blank=True, null=True)

    def __str__(self):
        return f"Prestamo {self.id} - {self.persona}"

class Devolucion(models.Model):
    prestamo_carpeta = models.ForeignKey(PrestamoCarpeta, on_delete=models.CASCADE)
    usuario = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    fecha_devol = models.DateTimeField(auto_now_add=True)
    observaciones = models.CharField(max_length=255, blank=True, null=True)
    estado_devolucion = models.CharField(max_length=20, default='buen_estado')
    foto_firma = models.ImageField(upload_to='firmas/', blank=True, null=True)
    token_firma = models.UUIDField(default=uuid.uuid4, unique=True, null=True)

    def __str__(self):
        return f"Devolucion {self.id} - PrestamoCarpeta {self.prestamo_carpeta_id}"

class DevolucionDocumento(models.Model):
    devolucion = models.ForeignKey(Devolucion, on_delete=models.CASCADE, related_name='documentos')
    documento = models.ForeignKey(Documento, on_delete=models.CASCADE)
    presente = models.BooleanField(default=True)

    def __str__(self):
        return f"DevolucionDoc {self.id} - {self.documento.titulo} {'✓' if self.presente else '✗'}"


class Prorroga(models.Model):
    prestamo = models.ForeignKey(Prestamo, on_delete=models.CASCADE)
    persona_solicita = models.ForeignKey(Persona, on_delete=models.SET_NULL, null=True, blank=True)
    usuario = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    fecha_registro = models.DateTimeField(auto_now_add=True)
    dias_otorgados = models.IntegerField()
    motivo = models.CharField(max_length=255, blank=True, null=True)

    def __str__(self):
        return f"Prorroga {self.id} - Prestamo {self.prestamo.id}"


class PrestamoDoc(models.Model):
    fecha_prest = models.DateTimeField(auto_now_add=True)
    fecha_devolucion = models.DateTimeField()
    observaciones = models.TextField(blank=True, null=True)
    persona = models.ForeignKey(Persona, on_delete=models.CASCADE, related_name='prestamos_doc_recibidos')
    usuario = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='prestamos_doc_registrados')
    autorizado_por = models.ForeignKey(Persona, on_delete=models.SET_NULL, null=True, blank=True, related_name='prestamos_doc_autorizados')
    token_firma = models.UUIDField(null=True, blank=True, unique=True)
    foto_firma = models.ImageField(upload_to='firmas/', blank=True, null=True)

    def __str__(self):
        return f"PrestamoDoc {self.id} - {self.persona}"


class PrestamoDocItem(models.Model):
    prestamo = models.ForeignKey(PrestamoDoc, on_delete=models.CASCADE, related_name='items')
    documento = models.ForeignKey(Documento, on_delete=models.CASCADE, related_name='prestamos_doc_items')
    fecha_devol = models.DateTimeField(blank=True, null=True)
    estado = models.CharField(max_length=20, default='prestado')
    observaciones = models.CharField(max_length=255, blank=True, null=True)

    def __str__(self):
        return f"PrestamoDocItem {self.id} - Doc {self.documento_id}"


class DevolucionDoc(models.Model):
    prestamo_doc_item = models.ForeignKey(PrestamoDocItem, on_delete=models.CASCADE, related_name='devoluciones')
    usuario = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    fecha_devol = models.DateTimeField(auto_now_add=True)
    observaciones = models.CharField(max_length=255, blank=True, null=True)
    estado_devolucion = models.CharField(max_length=20, default='buen_estado')
    foto_firma = models.ImageField(upload_to='firmas/', blank=True, null=True)
    token_firma = models.UUIDField(null=True, blank=True, unique=True)

    def __str__(self):
        return f"DevolucionDoc {self.id} - Item {self.prestamo_doc_item_id}"


class ProrrogaDoc(models.Model):
    prestamo = models.ForeignKey(PrestamoDoc, on_delete=models.CASCADE, related_name='prorrogas')
    persona_solicita = models.ForeignKey(Persona, on_delete=models.SET_NULL, null=True, blank=True)
    usuario = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    fecha_registro = models.DateTimeField(auto_now_add=True)
    dias_otorgados = models.IntegerField()
    motivo = models.CharField(max_length=255, blank=True, null=True)

    def __str__(self):
        return f"ProrrogaDoc {self.id} - PrestamoDoc {self.prestamo.id}"


class Retiro(models.Model):
    MOTIVOS = [
        ('traslado', 'Traslado'),
        ('retiro_indefinido', 'Retiro Indefinido'),
        ('otro', 'Otro'),
    ]

    carpeta = models.ForeignKey(Carpeta, on_delete=models.CASCADE)
    persona = models.ForeignKey(Persona, on_delete=models.CASCADE, related_name='retiros')
    autorizado_por = models.ForeignKey(Persona, on_delete=models.CASCADE, related_name='retiros_autorizados')
    usuario = models.ForeignKey(User, on_delete=models.CASCADE)
    fecha_retiro = models.DateTimeField()
    motivo = models.CharField(max_length=50, choices=MOTIVOS)
    motivo_otro = models.CharField(max_length=255, blank=True, null=True)
    observaciones = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Retiro {self.id} — {self.carpeta.descripcion}"


class Perfil(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    secreto_2fa = models.CharField(max_length=32, blank=True, null=True)
    is_2fa_enabled = models.BooleanField(default=False)
    session_invalidated_at = models.DateTimeField(blank=True, null=True)
    bypass_2fa_hasta = models.DateTimeField(blank=True, null=True)

    class Meta:
        permissions = [
            ('gestionar_carpetas', 'Gestionar Carpetas'),
            ('gestionar_documentos', 'Gestionar Documentos'),
            ('gestionar_prestamos', 'Gestionar Préstamos'),
            ('gestionar_devoluciones', 'Gestionar Devoluciones'),
            ('gestionar_traspasos', 'Gestionar Traspasos'),
            ('gestionar_ubicaciones', 'Gestionar Ubicaciones'),
            ('gestionar_personas', 'Gestionar Personas'),
            ('gestionar_bloqueos', 'Gestionar Bloqueos'),
            ('gestionar_prorrogas', 'Gestionar Prórrogas'),
            ('gestionar_retiros', 'Gestionar Retiros'),
            ('gestionar_usuarios', 'Gestionar Usuarios'),
            ('ver_dashboard', 'Ver Dashboard y Reportes'),
        ]

    def __str__(self):
        return self.user.username


class TempToken(models.Model):
    PURPOSES = [
        ('2fa', '2FA Verification'),
        ('reset', 'Password Reset'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    token = models.CharField(max_length=64, unique=True)
    purpose = models.CharField(max_length=10, choices=PURPOSES, default='2fa')
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    def is_expired(self):
        return timezone.now() >= self.expires_at

    @classmethod
    def create_token(cls, user, expiry_minutes=1):
        cls.objects.filter(user=user, purpose='2fa', expires_at__gt=timezone.now()).delete()
        token_str = secrets.token_urlsafe(48)
        expires_at = timezone.now() + timezone.timedelta(minutes=expiry_minutes)
        return cls.objects.create(user=user, token=token_str, purpose='2fa', expires_at=expires_at)

    @classmethod
    def create_reset_token(cls, user, expiry_minutes=15):
        cls.objects.filter(user=user, purpose='reset').delete()
        token_str = secrets.token_urlsafe(48)
        expires_at = timezone.now() + timezone.timedelta(minutes=expiry_minutes)
        return cls.objects.create(user=user, token=token_str, purpose='reset', expires_at=expires_at)

    def __str__(self):
        return f"TempToken({self.purpose}) {self.user.username} — {self.created_at}"


class AsignacionAmbiente(models.Model):
    usuario = models.ForeignKey(User, on_delete=models.CASCADE, related_name='ambientes_asignados')
    ambiente = models.ForeignKey(Ambiente, on_delete=models.CASCADE, related_name='usuarios_asignados')

    class Meta:
        unique_together = ('usuario', 'ambiente')

    def __str__(self):
        return f"{self.usuario.username} → {self.ambiente.nombre}"


class Traspaso(models.Model):
    usuario = models.ForeignKey(User, on_delete=models.PROTECT)
    ambiente_origen = models.ForeignKey(Ambiente, on_delete=models.PROTECT, related_name='traspasos_origen')
    ambiente_destino = models.ForeignKey(Ambiente, on_delete=models.PROTECT, related_name='traspasos_destino')
    fecha = models.DateTimeField(auto_now_add=True)
    observaciones = models.TextField(blank=True, null=True)
    ubicado = models.BooleanField(default=False)

    def __str__(self):
        return f"Traspaso {self.id} — {self.ambiente_origen.nombre} → {self.ambiente_destino.nombre}"


class TraspasoCarpeta(models.Model):
    traspaso = models.ForeignKey(Traspaso, on_delete=models.CASCADE, related_name='items')
    carpeta = models.ForeignKey(Carpeta, on_delete=models.PROTECT)
    piso_asignado = models.ForeignKey(Piso, on_delete=models.SET_NULL, null=True, blank=True)
    ubicado = models.BooleanField(default=False)

    def __str__(self):
        return f"Traspaso {self.traspaso_id} — Carpeta {self.carpeta_id}"


class Notification(models.Model):
    TIPO_CHOICES = [
        ('PRESTAMO', 'Préstamo'),
        ('DEVOLUCION_ESTADO', 'Devolución'),
        ('VENCIMIENTO', 'Vencimiento'),
        ('PROXIMO_VENCER', 'Próximo a vencer'),
        ('BLOQUEO', 'Bloqueo'),
        ('TRASPASO', 'Traspaso'),
        ('INCIDENTE', 'Incidente'),
    ]

    usuario = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notificaciones')
    tipo = models.CharField(max_length=50, choices=TIPO_CHOICES)
    mensaje = models.CharField(max_length=255)
    link = models.CharField(max_length=255, blank=True, null=True)
    leido = models.BooleanField(default=False)
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-fecha']

    def __str__(self):
        return f"[{self.tipo}] {self.mensaje}"