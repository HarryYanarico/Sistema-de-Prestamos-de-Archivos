import uuid
from datetime import datetime, timedelta, time

import graphene
from api.services.otp_service import generate_2fa_qr, obtener_tiempo_ntp
import pyotp   #para la autenticacion 2f
from graphene_django import DjangoObjectType
from django.contrib.auth.models import User, Group, Permission
from django.contrib.contenttypes.models import ContentType
import graphql_jwt
from django.db import transaction
from django.db.models import Count, Q, Prefetch, F
from django.utils import timezone
from .models import (
    Persona, Ambiente, Estante, Piso, Carpeta, Documento,
    Incidente, DetalleIncidente, Bloqueo, Prestamo, PrestamoCarpeta, Prorroga, Devolucion,
    AsignacionAmbiente, Traspaso, TraspasoCarpeta,
    PrestamoDoc, PrestamoDocItem, DevolucionDoc, ProrrogaDoc,
    Notification, DevolucionDocumento, Perfil, TempToken, Retiro,
)


FEATURE_PERMS = {
    'gestionar_carpetas', 'gestionar_documentos',
    'gestionar_prestamos', 'gestionar_devoluciones', 'gestionar_traspasos',
    'gestionar_ubicaciones', 'gestionar_personas', 'gestionar_bloqueos',
    'gestionar_prorrogas', 'gestionar_retiros', 'gestionar_usuarios',
    'ver_dashboard',
}


def has_admin_permission(user):
    return user.is_authenticated and (user.is_superuser or user.has_perm('api.gestionar_usuarios'))


# ============================
# TYPES
# ============================

class PermissionType(graphene.ObjectType):
    id = graphene.ID()
    codename = graphene.String()
    name = graphene.String()
    content_type = graphene.String()

class PermissionDetailType(graphene.ObjectType):
    id = graphene.ID()
    codename = graphene.String()
    name = graphene.String()
    content_type_model = graphene.String()

class GroupType(DjangoObjectType):
    class Meta:
        model = Group
        fields = ("id", "name")
    permissions = graphene.List(PermissionDetailType)

    def resolve_permissions(self, info):
        return self.permissions.all()

class UserType(DjangoObjectType):
    class Meta:
        model = User
        fields = ("id", "username", "first_name", "last_name", "email", "is_active", "is_superuser", "date_joined", "groups", "user_permissions")

    permissions_list = graphene.List(graphene.String)
    direct_permissions_list = graphene.List(graphene.String)
    direct_permission_ids = graphene.List(graphene.ID)
    ambientes_asignados = graphene.List(graphene.ID)
    session_invalidated_at = graphene.DateTime()
    bypass2fa_hasta = graphene.DateTime()

    def resolve_bypass2fa_hasta(self, info):
        try:
            return self.perfil.bypass_2fa_hasta
        except Exception:
            return None

    def resolve_permissions_list(self, info):
        return [p for p in self.get_all_permissions()
                if p.split('.')[-1] in FEATURE_PERMS]

    def resolve_direct_permissions_list(self, info):
        return [f'{p.content_type.app_label}.{p.codename}'
                for p in self.user_permissions.filter(codename__in=FEATURE_PERMS)]

    def resolve_direct_permission_ids(self, info):
        return [str(p.id) for p in self.user_permissions.filter(codename__in=FEATURE_PERMS)]

    def resolve_ambientes_asignados(self, info):
        viewer = info.context.user
        if viewer != self and not has_admin_permission(viewer):
            return []
        if has_admin_permission(self):
            return list(Ambiente.objects.values_list('id', flat=True))
        return list(AsignacionAmbiente.objects.filter(usuario=self).values_list('ambiente_id', flat=True))

    def resolve_session_invalidated_at(self, info):
        try:
            return self.perfil.session_invalidated_at
        except Exception:
            return None


class PermissionInputType(graphene.InputObjectType):
    id = graphene.ID(required=True)


class PersonaType(DjangoObjectType):
    bloqueo_activo = graphene.Field(lambda: BloqueoType)
    prestamos_info = graphene.Field(lambda: PersonaPrestamosInfoType)

    class Meta:
        model = Persona
        fields = "__all__"

    def resolve_bloqueo_activo(root, info):
        try:
            return Bloqueo.objects.filter(persona=root, fecha_desbloq__isnull=True).first()
        except Bloqueo.DoesNotExist:
            return None

    def resolve_prestamos_info(self, info):
        from django.utils import timezone
        now = timezone.now()
        items_carpetas = []
        pcs = PrestamoCarpeta.objects.filter(
            prestamo__persona=self, estado='prestado'
        ).select_related('prestamo', 'carpeta')
        for pc in pcs:
            dias_retraso = 0
            if pc.prestamo.fecha_devolucion < now:
                dias_retraso = (now - pc.prestamo.fecha_devolucion).days
            items_carpetas.append(ItemPendienteType(
                prestamo_carpeta_id=pc.id,
                carpeta_descripcion=pc.carpeta.descripcion,
                fecha_prest=pc.prestamo.fecha_prest.isoformat(),
                fecha_devolucion=pc.prestamo.fecha_devolucion.isoformat(),
                dias_retraso=dias_retraso,
            ))
        items_documentos = []
        doc_items = PrestamoDocItem.objects.filter(
            prestamo__persona=self, estado='prestado'
        ).select_related('prestamo', 'documento')
        for di in doc_items:
            dias_retraso = 0
            if di.prestamo.fecha_devolucion < now:
                dias_retraso = (now - di.prestamo.fecha_devolucion).days
            desc = di.documento.titulo
            if di.documento.codigo_doc:
                desc = f"{di.documento.codigo_doc} - {desc}"
            items_documentos.append(DocItemPendienteType(
                prestamo_doc_item_id=di.id,
                documento_descripcion=desc,
                fecha_prest=di.prestamo.fecha_prest.isoformat(),
                fecha_devolucion=di.prestamo.fecha_devolucion.isoformat(),
                dias_retraso=dias_retraso,
            ))
        bloqueo = Bloqueo.objects.filter(persona=self, fecha_desbloq__isnull=True).first()
        return PersonaPrestamosInfoType(
            total_pendientes_carpetas=len(items_carpetas),
            items_carpetas=items_carpetas,
            total_pendientes_documentos=len(items_documentos),
            items_documentos=items_documentos,
            bloqueo_activo=bloqueo,
        )

class AmbienteType(DjangoObjectType):
    class Meta:
        model = Ambiente
        fields = "__all__"

class EstanteType(DjangoObjectType):
    class Meta:
        model = Estante
        fields = "__all__"

    ambiente = graphene.Field(AmbienteType)


class DocumentoType(DjangoObjectType):
    is_prestado_individual = graphene.Boolean()
    propietario = graphene.Field(PersonaType)

    class Meta:
        model = Documento
        fields = "__all__"

    def resolve_is_prestado_individual(self, info):
        return PrestamoDocItem.objects.filter(
            documento=self, estado='prestado'
        ).exists()


class CarpetaType(DjangoObjectType):
    class Meta:
        model = Carpeta
        fields = "__all__"
    documentos = graphene.List(DocumentoType)
    prestamo_info = graphene.Field(lambda: CarpetaPrestamoInfoType)

    def resolve_documentos(self, info):
        return self.documento_set.all()

    def resolve_prestamo_info(self, info):
        try:
            pc = PrestamoCarpeta.objects.filter(
                carpeta=self, estado='prestado'
            ).select_related('prestamo__persona').first()
            if not pc:
                return CarpetaPrestamoInfoType(prestada=False)
            from django.utils import timezone
            now = timezone.now()
            dias_restantes = (pc.prestamo.fecha_devolucion - now).days
            return CarpetaPrestamoInfoType(
                prestada=True,
                persona_id=pc.prestamo.persona_id,
                persona_nombre=f"{pc.prestamo.persona.nombre} {pc.prestamo.persona.apellido}",
                fecha_prest=pc.prestamo.fecha_prest.isoformat(),
                fecha_devolucion=pc.prestamo.fecha_devolucion.isoformat(),
                dias_restantes=dias_restantes,
            )
        except Exception:
            return CarpetaPrestamoInfoType(prestada=False)


class PisoType(DjangoObjectType):
    class Meta:
        model = Piso
        fields = "__all__"


class BloqueoType(DjangoObjectType):
    class Meta:
        model = Bloqueo
        fields = "__all__"


class TraspasoType(DjangoObjectType):
    items = graphene.List(lambda: TraspasoCarpetaType)

    class Meta:
        model = Traspaso
        fields = "__all__"

    def resolve_items(root, info):
        return root.items.all()


class TraspasoCarpetaType(DjangoObjectType):
    class Meta:
        model = TraspasoCarpeta
        fields = "__all__"


class PrestamoType(DjangoObjectType):
    prestamo_carpetas = graphene.List(lambda: PrestamoCarpetaType)

    class Meta:
        model = Prestamo
        fields = "__all__"

    def resolve_prestamo_carpetas(root, info):
        return root.prestamocarpeta_set.all()


class PrestamoCarpetaType(DjangoObjectType):
    devoluciones = graphene.List(lambda: DevolucionType)

    class Meta:
        model = PrestamoCarpeta
        fields = "__all__"

    def resolve_devoluciones(self, info):
        return self.devolucion_set.all().order_by('-fecha_devol')


class CarpetaPrestamoInfoType(graphene.ObjectType):
    prestada = graphene.Boolean()
    persona_id = graphene.ID()
    persona_nombre = graphene.String()
    fecha_prest = graphene.String()
    fecha_devolucion = graphene.String()
    dias_restantes = graphene.Int()


class PersonaPrestamosInfoType(graphene.ObjectType):
    total_pendientes_carpetas = graphene.Int()
    items_carpetas = graphene.List(lambda: ItemPendienteType)
    total_pendientes_documentos = graphene.Int()
    items_documentos = graphene.List(lambda: DocItemPendienteType)
    bloqueo_activo = graphene.Field(lambda: BloqueoType)


class ItemPendienteType(graphene.ObjectType):
    prestamo_carpeta_id = graphene.ID()
    carpeta_descripcion = graphene.String()
    fecha_prest = graphene.String()
    fecha_devolucion = graphene.String()
    dias_retraso = graphene.Int()


class PersonaPrestamosPendientesType(graphene.ObjectType):
    total_pendientes = graphene.Int()
    items = graphene.List(ItemPendienteType)


class DocItemPendienteType(graphene.ObjectType):
    prestamo_doc_item_id = graphene.ID()
    documento_descripcion = graphene.String()
    fecha_prest = graphene.String()
    fecha_devolucion = graphene.String()
    dias_retraso = graphene.Int()


class PersonaPrestamosDocPendientesType(graphene.ObjectType):
    total_pendientes = graphene.Int()
    items = graphene.List(DocItemPendienteType)


class DevolucionDocumentoType(DjangoObjectType):
    class Meta:
        model = DevolucionDocumento
        fields = "__all__"


class DevolucionType(DjangoObjectType):
    documentos = graphene.List(DevolucionDocumentoType)

    class Meta:
        model = Devolucion
        fields = "__all__"

    def resolve_documentos(root, info):
        return root.documentos.all()


class IncidenteType(DjangoObjectType):
    detalles = graphene.List(lambda: DetalleIncidenteType)

    class Meta:
        model = Incidente
        fields = "__all__"

    def resolve_detalles(root, info):
        return root.detalleincidente_set.all()


class DetalleIncidenteType(DjangoObjectType):
    class Meta:
        model = DetalleIncidente
        fields = "__all__"


class ProrrogaType(DjangoObjectType):
    class Meta:
        model = Prorroga
        fields = "__all__"


class PrestamoDocType(DjangoObjectType):
    items = graphene.List(lambda: PrestamoDocItemType)

    class Meta:
        model = PrestamoDoc
        fields = "__all__"

    def resolve_items(root, info):
        return root.items.all()


class PrestamoDocItemType(DjangoObjectType):
    class Meta:
        model = PrestamoDocItem
        fields = "__all__"


class DevolucionDocType(DjangoObjectType):
    class Meta:
        model = DevolucionDoc
        fields = "__all__"


class ProrrogaDocType(DjangoObjectType):
    class Meta:
        model = ProrrogaDoc
        fields = "__all__"


class RetiroType(DjangoObjectType):
    class Meta:
        model = Retiro
        fields = "__all__"


class PaginatedPrestamoDocType(graphene.ObjectType):
    items = graphene.List(PrestamoDocType)
    total_count = graphene.Int()


class PaginatedDevolucionDocType(graphene.ObjectType):
    items = graphene.List(DevolucionDocType)
    total_count = graphene.Int()


class PaginatedProrrogaDocType(graphene.ObjectType):
    items = graphene.List(ProrrogaDocType)
    total_count = graphene.Int()


class CrearAmbiente(graphene.Mutation):
    class Arguments:
        nombre = graphene.String(required=True)
        ubicacion = graphene.String()
        descripcion = graphene.String()

    ambiente = graphene.Field(AmbienteType)
    success = graphene.Boolean()
    error = graphene.String()

    def mutate(root, info, nombre, ubicacion=None, descripcion=None):
        user = info.context.user
        if not user.is_authenticated:
            return CrearAmbiente(success=False, error="Acceso denegado.")
        if not (user.is_superuser or user.has_perm('api.gestionar_ubicaciones')):
            return CrearAmbiente(success=False, error="No tienes permisos para gestionar ubicaciones.")

        ambiente = Ambiente.objects.create(nombre=nombre, ubicacion=ubicacion, descripcion=descripcion)
        return CrearAmbiente(ambiente=ambiente, success=True)


class CrearCarpeta(graphene.Mutation):
    class Arguments:
        descripcion = graphene.String(required=True)
        id_piso = graphene.ID(required=True)

    carpeta = graphene.Field(CarpetaType)
    success = graphene.Boolean()
    error = graphene.String()

    def mutate(root, info, descripcion, id_piso):
        user = info.context.user
        if not user.is_authenticated:
            return CrearCarpeta(success=False, error="Acceso denegado.")
        if not (user.is_superuser or user.has_perm('api.gestionar_carpetas')):
            return CrearCarpeta(success=False, error="No tienes permisos.")

        try:
            piso = Piso.objects.get(id=id_piso)
        except Piso.DoesNotExist:
            return CrearCarpeta(success=False, error="Piso no encontrado.")

        carpeta = Carpeta.objects.create(descripcion=descripcion, piso=piso)
        return CrearCarpeta(carpeta=carpeta, success=True)


class EditarCarpeta(graphene.Mutation):
    class Arguments:
        id = graphene.ID(required=True)
        descripcion = graphene.String()
        estado = graphene.String()
        id_piso = graphene.ID()

    carpeta = graphene.Field(CarpetaType)
    success = graphene.Boolean()
    error = graphene.String()

    def mutate(root, info, id, descripcion=None, estado=None, id_piso=None):
        user = info.context.user
        if not user.is_authenticated:
            return EditarCarpeta(success=False, error="Acceso denegado.")
        if not (user.is_superuser or user.has_perm('api.gestionar_carpetas')):
            return EditarCarpeta(success=False, error="No tienes permisos.")

        try:
            carpeta = Carpeta.objects.get(id=id)
        except Carpeta.DoesNotExist:
            return EditarCarpeta(success=False, error="Carpeta no encontrada.")

        if descripcion is not None:
            carpeta.descripcion = descripcion
        if estado is not None:
            carpeta.estado = estado
        if id_piso is not None:
            try:
                carpeta.piso = Piso.objects.get(id=id_piso)
            except Piso.DoesNotExist:
                return EditarCarpeta(success=False, error="Piso no encontrado.")
        carpeta.save()
        return EditarCarpeta(carpeta=carpeta, success=True)


class CrearDocumento(graphene.Mutation):
    class Arguments:
        codigo_doc = graphene.String()
        titulo = graphene.String(required=True)
        tipo_doc = graphene.String(required=True)
        id_carpeta = graphene.ID(required=True)
        id_propietario = graphene.ID()

    documento = graphene.Field(DocumentoType)
    success = graphene.Boolean()
    error = graphene.String()

    def mutate(root, info, codigo_doc=None, titulo=None, tipo_doc=None, id_carpeta=None, id_propietario=None):
        user = info.context.user
        if not user.is_authenticated:
            return CrearDocumento(success=False, error="Acceso denegado.")
        if not (user.is_superuser or user.has_perm('api.gestionar_documentos')):
            return CrearDocumento(success=False, error="No tienes permisos.")

        if not titulo or not tipo_doc or not id_carpeta:
            return CrearDocumento(success=False, error="Título, tipo y carpeta son obligatorios.")

        try:
            carpeta = Carpeta.objects.get(id=id_carpeta)
        except Carpeta.DoesNotExist:
            return CrearDocumento(success=False, error="Carpeta no encontrada.")

        propietario = None
        if id_propietario:
            try:
                propietario = Persona.objects.get(id=id_propietario)
            except Persona.DoesNotExist:
                return CrearDocumento(success=False, error="Persona no encontrada.")

        documento = Documento.objects.create(
            codigo_doc=codigo_doc, titulo=titulo, tipo_doc=tipo_doc,
            carpeta=carpeta, propietario=propietario
        )
        return CrearDocumento(documento=documento, success=True)


class EditarDocumento(graphene.Mutation):
    class Arguments:
        id = graphene.ID(required=True)
        codigo_doc = graphene.String()
        titulo = graphene.String()
        tipo_doc = graphene.String()
        id_propietario = graphene.ID()

    documento = graphene.Field(DocumentoType)
    success = graphene.Boolean()
    error = graphene.String()

    def mutate(root, info, id, codigo_doc=None, titulo=None, tipo_doc=None, id_propietario=None):
        user = info.context.user
        if not user.is_authenticated:
            return EditarDocumento(success=False, error="Acceso denegado.")
        if not (user.is_superuser or user.has_perm('api.gestionar_documentos')):
            return EditarDocumento(success=False, error="No tienes permisos.")

        try:
            documento = Documento.objects.get(id=id)
        except Documento.DoesNotExist:
            return EditarDocumento(success=False, error="Documento no encontrado.")

        if codigo_doc is not None:
            documento.codigo_doc = codigo_doc
        if titulo is not None:
            documento.titulo = titulo
        if tipo_doc is not None:
            documento.tipo_doc = tipo_doc
        if id_propietario is not None:
            try:
                documento.propietario = Persona.objects.get(id=id_propietario)
            except Persona.DoesNotExist:
                return EditarDocumento(success=False, error="Persona no encontrada.")
        documento.save()
        return EditarDocumento(documento=documento, success=True)


class CrearPersona(graphene.Mutation):
    class Arguments:
        ci = graphene.String(required=True)
        nombre = graphene.String(required=True)
        apellido = graphene.String(required=True)
        telefono = graphene.String()
        email = graphene.String()
        direccion = graphene.String()
        cargo = graphene.String()
        tipo_entidad = graphene.String()

    persona = graphene.Field(PersonaType)
    success = graphene.Boolean()
    error = graphene.String()

    def mutate(root, info, ci, nombre, apellido, telefono=None, email=None, direccion=None, cargo=None, tipo_entidad=None):
        user = info.context.user
        if not user.is_authenticated:
            return CrearPersona(success=False, error="Acceso denegado.")
        if not has_admin_permission(user):
            return CrearPersona(success=False, error="No tienes permisos.")

        if Persona.objects.filter(ci=ci).exists():
            return CrearPersona(success=False, error="Ya existe una persona con ese CI.")

        persona = Persona.objects.create(
            ci=ci, nombre=nombre, apellido=apellido,
            telefono=telefono, email=email, direccion=direccion,
            cargo=cargo,
            tipo_entidad=tipo_entidad
        )
        return CrearPersona(persona=persona, success=True)


class ActualizarPersona(graphene.Mutation):
    class Arguments:
        id = graphene.ID(required=True)
        ci = graphene.String()
        nombre = graphene.String()
        apellido = graphene.String()
        telefono = graphene.String()
        email = graphene.String()
        direccion = graphene.String()
        cargo = graphene.String()
        tipo_entidad = graphene.String()

    persona = graphene.Field(PersonaType)
    success = graphene.Boolean()
    error = graphene.String()

    def mutate(root, info, id, ci=None, nombre=None, apellido=None, telefono=None, email=None, direccion=None, cargo=None, tipo_entidad=None):
        user = info.context.user
        if not user.is_authenticated:
            return ActualizarPersona(success=False, error="Acceso denegado.")
        if not has_admin_permission(user):
            return ActualizarPersona(success=False, error="No tienes permisos.")

        try:
            persona = Persona.objects.get(id=id)
        except Persona.DoesNotExist:
            return ActualizarPersona(success=False, error="Persona no encontrada.")

        if ci is not None:
            persona.ci = ci
        if nombre is not None:
            persona.nombre = nombre
        if apellido is not None:
            persona.apellido = apellido
        if telefono is not None:
            persona.telefono = telefono
        if email is not None:
            persona.email = email
        if direccion is not None:
            persona.direccion = direccion
        if cargo is not None:
            persona.cargo = cargo
        if tipo_entidad is not None:
            persona.tipo_entidad = tipo_entidad
        persona.save()
        return ActualizarPersona(persona=persona, success=True)


class EditarAmbiente(graphene.Mutation):
    class Arguments:
        id = graphene.ID(required=True)
        nombre = graphene.String()
        ubicacion = graphene.String()
        descripcion = graphene.String()

    ambiente = graphene.Field(AmbienteType)
    success = graphene.Boolean()
    error = graphene.String()

    def mutate(root, info, id, nombre=None, ubicacion=None, descripcion=None):
        user = info.context.user
        if not user.is_authenticated:
            return EditarAmbiente(success=False, error="Acceso denegado.")
        if not (user.is_superuser or user.has_perm('api.gestionar_ubicaciones')):
            return EditarAmbiente(success=False, error="No tienes permisos para gestionar ubicaciones.")

        try:
            ambiente = Ambiente.objects.get(id=id)
        except Ambiente.DoesNotExist:
            return EditarAmbiente(success=False, error="Ambiente no encontrado.")

        if nombre is not None:
            ambiente.nombre = nombre
        if ubicacion is not None:
            ambiente.ubicacion = ubicacion
        if descripcion is not None:
            ambiente.descripcion = descripcion
        ambiente.save()
        return EditarAmbiente(ambiente=ambiente, success=True)


class CrearEstante(graphene.Mutation):
    class Arguments:
        codigo = graphene.String(required=True)
        numero = graphene.Int()
        descripcion = graphene.String()
        estado = graphene.String()
        limite_pisos = graphene.Int()
        id_ambiente = graphene.ID(required=True)

    estante = graphene.Field(EstanteType)
    success = graphene.Boolean()
    error = graphene.String()

    def mutate(root, info, codigo, id_ambiente, numero=None, descripcion=None, estado=None, limite_pisos=None):
        user = info.context.user
        if not user.is_authenticated:
            return CrearEstante(success=False, error="Acceso denegado.")
        if not (user.is_superuser or user.has_perm('api.gestionar_ubicaciones')):
            return CrearEstante(success=False, error="No tienes permisos para gestionar ubicaciones.")

        try:
            ambiente = Ambiente.objects.get(id=id_ambiente)
        except Ambiente.DoesNotExist:
            return CrearEstante(success=False, error="Ambiente no encontrado.")

        estante = Estante.objects.create(codigo=codigo, numero=numero, descripcion=descripcion, estado=estado, limite_pisos=limite_pisos if limite_pisos is not None else 1, ambiente=ambiente)
        return CrearEstante(estante=estante, success=True)

class EditarEstante(graphene.Mutation):
    class Arguments:
        id = graphene.ID(required=True)
        codigo = graphene.String()
        numero = graphene.Int()
        descripcion = graphene.String()
        estado = graphene.String()
        limite_pisos = graphene.Int()
        id_ambiente = graphene.ID()

    estante = graphene.Field(EstanteType)
    success = graphene.Boolean()
    error = graphene.String()

    def mutate(root, info, id, codigo=None, numero=None, descripcion=None, estado=None, limite_pisos=None, id_ambiente=None):
        user = info.context.user
        if not user.is_authenticated:
            return EditarEstante(success=False, error="Acceso denegado.")
        if not (user.is_superuser or user.has_perm('api.gestionar_ubicaciones')):
            return EditarEstante(success=False, error="No tienes permisos para gestionar ubicaciones.")

        try:
            estante = Estante.objects.get(id=id)
        except Estante.DoesNotExist:
            return EditarEstante(success=False, error="Estante no encontrado.")

        if codigo is not None:
            estante.codigo = codigo
        if numero is not None:
            estante.numero = numero
        if descripcion is not None:
            estante.descripcion = descripcion
        if estado is not None:
            estante.estado = estado
        if limite_pisos is not None:
            estante.limite_pisos = limite_pisos
        if id_ambiente is not None:
            try:
                estante.ambiente = Ambiente.objects.get(id=id_ambiente)
            except Ambiente.DoesNotExist:
                return EditarEstante(success=False, error="Ambiente no encontrado.")
        estante.save()
        return EditarEstante(estante=estante, success=True)


class CrearPiso(graphene.Mutation):
    class Arguments:
        nro_fila = graphene.Int(required=True)
        descripcion = graphene.String()
        id_estante = graphene.ID(required=True)

    piso = graphene.Field(PisoType)
    success = graphene.Boolean()
    error = graphene.String()

    def mutate(root, info, nro_fila, id_estante, descripcion=None):
        user = info.context.user
        if not user.is_authenticated:
            return CrearPiso(success=False, error="Acceso denegado.")
        if not (user.is_superuser or user.has_perm('api.gestionar_ubicaciones')):
            return CrearPiso(success=False, error="No tienes permisos para gestionar ubicaciones.")

        try:
            estante = Estante.objects.get(id=id_estante)
        except Estante.DoesNotExist:
            return CrearPiso(success=False, error="Estante no encontrado.")

        if estante.limite_pisos and Piso.objects.filter(estante=estante).count() >= estante.limite_pisos:
            return CrearPiso(success=False, error=f"Límite de {estante.limite_pisos} pisos alcanzado para el estante {estante.codigo}.")

        piso = Piso.objects.create(nro_fila=nro_fila, descripcion=descripcion, estante=estante)
        return CrearPiso(piso=piso, success=True)


class EditarPiso(graphene.Mutation):
    class Arguments:
        id = graphene.ID(required=True)
        nro_fila = graphene.Int()
        descripcion = graphene.String()
        id_estante = graphene.ID()

    piso = graphene.Field(PisoType)
    success = graphene.Boolean()
    error = graphene.String()

    def mutate(root, info, id, nro_fila=None, descripcion=None, id_estante=None):
        user = info.context.user
        if not user.is_authenticated:
            return EditarPiso(success=False, error="Acceso denegado.")
        if not (user.is_superuser or user.has_perm('api.gestionar_ubicaciones')):
            return EditarPiso(success=False, error="No tienes permisos para gestionar ubicaciones.")

        try:
            piso = Piso.objects.get(id=id)
        except Piso.DoesNotExist:
            return EditarPiso(success=False, error="Piso no encontrado.")

        if nro_fila is not None:
            piso.nro_fila = nro_fila
        if descripcion is not None:
            piso.descripcion = descripcion
        if id_estante is not None:
            try:
                piso.estante = Estante.objects.get(id=id_estante)
            except Estante.DoesNotExist:
                return EditarPiso(success=False, error="Estante no encontrado.")
        piso.save()
        return EditarPiso(piso=piso, success=True)

class Login2FA(graphene.Mutation):

    class Arguments:
        username = graphene.String(required=True)
        password = graphene.String(required=True)

    success = graphene.Boolean()
    requires_2fa = graphene.Boolean()
    setup_required = graphene.Boolean()
    qr_code = graphene.String()
    user_id = graphene.Int()
    temp_token = graphene.String()
    token = graphene.String()
    error = graphene.String()

    def mutate(root, info, username, password):

        from django.contrib.auth import authenticate

        user = authenticate(username=username, password=password)

        if user is None:
            return Login2FA(
                success=False,
                error="Credenciales incorrectas"
            )

        perfil, created = Perfil.objects.get_or_create(user=user)

        # ⏭️ BYPASS: el admin eximió a este usuario de 2FA hasta cierta hora
        if perfil.bypass_2fa_hasta and perfil.bypass_2fa_hasta > timezone.now():
            token = graphql_jwt.shortcuts.get_token(user)
            return Login2FA(
                success=True,
                requires_2fa=False,
                token=token,
            )

        # 🟡 CASO 1: NO TIENE 2FA CONFIGURADO
        if not perfil.is_2fa_enabled or not perfil.secreto_2fa:

            secret, qr = generate_2fa_qr(user.username)

            perfil.secreto_2fa = secret
            perfil.is_2fa_enabled = True
            perfil.save()

            temp = TempToken.create_token(user)

            return Login2FA(
                success=True,
                requires_2fa=True,
                setup_required=True,
                qr_code=qr,
                user_id=user.id,
                temp_token=temp.token
            )

        # 🟢 CASO 2: YA TIENE 2FA
        temp = TempToken.create_token(user)

        return Login2FA(
            success=True,
            requires_2fa=True,
            setup_required=False,
            user_id=user.id,
            temp_token=temp.token
        )
class Verify2FA(graphene.Mutation):

    class Arguments:
        user_id = graphene.Int(required=True)
        code = graphene.String(required=True)
        temp_token = graphene.String(required=True)

    success = graphene.Boolean()
    token = graphene.String()
    error = graphene.String()

    def mutate(root, info, user_id, code, temp_token):

        from .models import Perfil

        try:
            user = User.objects.get(id=user_id)
            perfil = Perfil.objects.get(user_id=user_id)

        except:
            return Verify2FA(
                success=False,
                error="Usuario no encontrado"
            )

        try:
            temp = TempToken.objects.get(token=temp_token, user=user)
        except TempToken.DoesNotExist:
            return Verify2FA(
                success=False,
                error="Token de verificación inválido o expirado. Vuelve a iniciar sesión."
            )

        if temp.is_expired():
            temp.delete()
            return Verify2FA(
                success=False,
                error="Token de verificación expirado. Vuelve a iniciar sesión."
            )

        ntp_time = obtener_tiempo_ntp()
        totp = pyotp.TOTP(perfil.secreto_2fa)

        if not totp.verify(code, valid_window=1, for_time=ntp_time):

            return Verify2FA(
                success=False,
                error="Código inválido"
            )

        temp.delete()
        TempToken.objects.filter(user=user, expires_at__lt=timezone.now()).delete()
        token = graphql_jwt.shortcuts.get_token(user)

        return Verify2FA(
            success=True,
            token=token
        )

class ResetUser2FA(graphene.Mutation):
    class Arguments:
        user_id = graphene.ID(required=True)

    success = graphene.Boolean()
    error = graphene.String()

    def mutate(root, info, user_id):
        if not has_admin_permission(info.context.user):
            return ResetUser2FA(success=False, error="Acceso denegado. Se requiere rol de Administrador.")
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return ResetUser2FA(success=False, error="Usuario no encontrado.")
        perfil, _ = Perfil.objects.get_or_create(user=user)
        perfil.is_2fa_enabled = False
        perfil.secreto_2fa = None
        perfil.save()
        return ResetUser2FA(success=True)
    
class AsignarAmbientes(graphene.Mutation):
    class Arguments:
        usuario_id = graphene.ID(required=True)
        ids_ambientes = graphene.List(graphene.ID, required=True)

    success = graphene.Boolean()
    error = graphene.String()

    def mutate(root, info, usuario_id, ids_ambientes):
        if not has_admin_permission(info.context.user):
            return AsignarAmbientes(success=False, error="Acceso denegado. Se requiere rol de Administrador.")

        try:
            target = User.objects.get(id=usuario_id)
        except User.DoesNotExist:
            return AsignarAmbientes(success=False, error="Usuario no encontrado.")

        actuales = set(AsignacionAmbiente.objects.filter(
            usuario=target
        ).values_list('ambiente_id', flat=True))
        nuevos = set(int(x) for x in ids_ambientes)
        changed = actuales != nuevos

        AsignacionAmbiente.objects.filter(usuario=target).delete()
        for amb_id in ids_ambientes:
            AsignacionAmbiente.objects.create(usuario=target, ambiente_id=amb_id)

        if changed and str(info.context.user.id) != str(usuario_id):
            try:
                perfil, _ = Perfil.objects.get_or_create(user=target)
                perfil.session_invalidated_at = timezone.now()
                perfil.save()
                from graphql_jwt.refresh_token.models import RefreshToken
                RefreshToken.objects.filter(user=target).delete()
            except Exception:
                pass

        return AsignarAmbientes(success=True)


class RegistrarTraspaso(graphene.Mutation):
    class Arguments:
        ids_carpetas = graphene.List(graphene.ID, required=True)
        id_ambiente_origen = graphene.ID(required=True)
        id_ambiente_destino = graphene.ID(required=True)
        observaciones = graphene.String()

    traspaso = graphene.Field(TraspasoType)
    success = graphene.Boolean()
    error = graphene.String()

    def mutate(root, info, ids_carpetas, id_ambiente_origen, id_ambiente_destino, observaciones=""):
        user = info.context.user
        if not user.is_authenticated:
            return RegistrarTraspaso(success=False, error="Acceso denegado.")

        if not has_admin_permission(user):
            asignado = AsignacionAmbiente.objects.filter(usuario=user, ambiente_id=id_ambiente_origen).exists()
            if not asignado:
                return RegistrarTraspaso(success=False, error="No tienes asignado el ambiente origen.")

        try:
            origen = Ambiente.objects.get(id=id_ambiente_origen)
            destino = Ambiente.objects.get(id=id_ambiente_destino)
        except Ambiente.DoesNotExist:
            return RegistrarTraspaso(success=False, error="Ambiente no encontrado.")

        carpetas = Carpeta.objects.filter(id__in=ids_carpetas)
        if carpetas.count() != len(ids_carpetas):
            return RegistrarTraspaso(success=False, error="Una o más carpetas no fueron encontradas.")

        for carpeta in carpetas:
            if carpeta.estado != 'disponible':
                return RegistrarTraspaso(success=False, error=f"La carpeta '{carpeta.descripcion}' no está disponible.")

        traspaso = Traspaso.objects.create(
            usuario=user, ambiente_origen=origen, ambiente_destino=destino, observaciones=observaciones
        )
        for carpeta in carpetas:
            TraspasoCarpeta.objects.create(traspaso=traspaso, carpeta=carpeta)

        return RegistrarTraspaso(traspaso=traspaso, success=True)


class UbicarCarpetas(graphene.Mutation):
    class Arguments:
        ids_traspaso_carpeta = graphene.List(graphene.ID, required=True)
        id_piso = graphene.ID(required=True)

    success = graphene.Boolean()
    error = graphene.String()

    def mutate(root, info, ids_traspaso_carpeta, id_piso):
        user = info.context.user
        if not user.is_authenticated:
            return UbicarCarpetas(success=False, error="Acceso denegado.")
        if not (user.is_superuser or user.has_perm('api.gestionar_carpetas')):
            return UbicarCarpetas(success=False, error="No tienes permisos para ubicar carpetas.")

        try:
            piso = Piso.objects.get(id=id_piso)
        except Piso.DoesNotExist:
            return UbicarCarpetas(success=False, error="Piso no encontrado.")

        items = TraspasoCarpeta.objects.filter(id__in=ids_traspaso_carpeta)
        if items.count() != len(ids_traspaso_carpeta):
            return UbicarCarpetas(success=False, error="Uno o más ítems no fueron encontrados.")

        for item in items:
            if item.ubicado:
                return UbicarCarpetas(success=False, error="Una o más carpetas ya están ubicadas.")
            item.piso_asignado = piso
            item.ubicado = True
            item.save()

        traspasos_afectados = set(items.values_list('traspaso_id', flat=True))
        for t_id in traspasos_afectados:
            t = Traspaso.objects.get(id=t_id)
            if not t.items.filter(ubicado=False).exists():
                t.ubicado = True
                t.save()

        return UbicarCarpetas(success=True)


class CrearBloqueo(graphene.Mutation):
    class Arguments:
        persona_id = graphene.ID(required=True)
        motivo = graphene.String()

    bloqueo = graphene.Field(BloqueoType)
    success = graphene.Boolean()
    error = graphene.String()

    def mutate(root, info, persona_id, motivo=None):
        user = info.context.user
        if not has_admin_permission(user):
            return CrearBloqueo(success=False, error="Acceso denegado. Se requiere rol de Administrador.")

        try:
            persona = Persona.objects.get(id=persona_id)
        except Persona.DoesNotExist:
            return CrearBloqueo(success=False, error="Persona no encontrada.")

        if Bloqueo.objects.filter(persona=persona, fecha_desbloq__isnull=True).exists():
            return CrearBloqueo(success=False, error="Esta persona ya tiene un bloqueo activo.")

        bloqueo = Bloqueo.objects.create(
            motivo_bloq=motivo or '',
            usuario=user,
            persona=persona,
        )
        return CrearBloqueo(bloqueo=bloqueo, success=True)


class DesbloquearPersona(graphene.Mutation):
    class Arguments:
        bloqueo_id = graphene.ID(required=True)
        motivo_desbloq = graphene.String()

    bloqueo = graphene.Field(BloqueoType)
    success = graphene.Boolean()
    error = graphene.String()

    def mutate(root, info, bloqueo_id, motivo_desbloq=None):
        user = info.context.user
        if not has_admin_permission(user):
            return DesbloquearPersona(success=False, error="Acceso denegado. Se requiere rol de Administrador.")

        try:
            bloqueo = Bloqueo.objects.get(id=bloqueo_id)
        except Bloqueo.DoesNotExist:
            return DesbloquearPersona(success=False, error="Bloqueo no encontrado.")

        if bloqueo.fecha_desbloq:
            return DesbloquearPersona(success=False, error="Esta persona ya fue desbloqueada.")

        bloqueo.fecha_desbloq = timezone.now()
        bloqueo.usuario_desbloqueo = user
        if motivo_desbloq:
            bloqueo.motivo_desbloq = motivo_desbloq
        bloqueo.save()

        return DesbloquearPersona(bloqueo=bloqueo, success=True)


class GenerateResetCode(graphene.Mutation):
    class Arguments:
        user_id = graphene.ID(required=True)

    success = graphene.Boolean()
    code = graphene.String()
    error = graphene.String()

    def mutate(root, info, user_id):
        if not has_admin_permission(info.context.user):
            return GenerateResetCode(success=False, error="Acceso denegado.")
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return GenerateResetCode(success=False, error="Usuario no encontrado.")

        temp = TempToken.create_reset_token(user)
        return GenerateResetCode(success=True, code=temp.token)


class VerifyResetCode(graphene.Mutation):
    class Arguments:
        username = graphene.String(required=True)
        code = graphene.String(required=True)

    success = graphene.Boolean()
    error = graphene.String()

    def mutate(root, info, username, code):
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return VerifyResetCode(success=False, error="Usuario no encontrado.")

        try:
            temp = TempToken.objects.get(token=code, user=user, purpose='reset')
        except TempToken.DoesNotExist:
            return VerifyResetCode(success=False, error="Código inválido o expirado.")

        if temp.is_expired():
            temp.delete()
            return VerifyResetCode(success=False, error="El código ha expirado. Solicita uno nuevo.")

        return VerifyResetCode(success=True)


class SetNewPassword(graphene.Mutation):
    class Arguments:
        username = graphene.String(required=True)
        code = graphene.String(required=True)
        new_password = graphene.String(required=True)

    success = graphene.Boolean()
    error = graphene.String()

    def mutate(root, info, username, code, new_password):
        if len(new_password) < 8:
            return SetNewPassword(success=False, error="La contraseña debe tener al menos 8 caracteres.")

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return SetNewPassword(success=False, error="Usuario no encontrado.")

        try:
            temp = TempToken.objects.get(token=code, user=user, purpose='reset')
        except TempToken.DoesNotExist:
            return SetNewPassword(success=False, error="Código inválido o expirado.")

        if temp.is_expired():
            temp.delete()
            return SetNewPassword(success=False, error="El código ha expirado. Solicita uno nuevo.")

        user.set_password(new_password)
        user.save()
        temp.delete()
        TempToken.objects.filter(user=user, purpose='reset').delete()

        return SetNewPassword(success=True)


class ForzarCierreSesion(graphene.Mutation):
    class Arguments:
        user_id = graphene.ID(required=True)

    success = graphene.Boolean()
    error = graphene.String()

    def mutate(root, info, user_id):
        if not has_admin_permission(info.context.user):
            return ForzarCierreSesion(success=False, error="Acceso denegado.")
        
        current_user = info.context.user
        if str(current_user.id) == str(user_id):
            return ForzarCierreSesion(success=False, error="No puedes forzar el cierre de tu propia sesión.")

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return ForzarCierreSesion(success=False, error="Usuario no encontrado.")

        if user.is_superuser:
            return ForzarCierreSesion(success=False, error="No se puede forzar el cierre de un superusuario.")

        try:
            perfil, created = Perfil.objects.get_or_create(user=user)
            perfil.session_invalidated_at = timezone.now()
            perfil.save()
        except Exception as e:
            return ForzarCierreSesion(success=False, error=f"Error al actualizar perfil: {str(e)}")

        try:
            from graphql_jwt.refresh_token.models import RefreshToken
            RefreshToken.objects.filter(user=user).delete()
        except Exception:
            pass

        return ForzarCierreSesion(success=True, error=None)


class ToggleBypass2FA(graphene.Mutation):
    class Arguments:
        user_id = graphene.ID(required=True)

    success = graphene.Boolean()
    enabled = graphene.Boolean()
    error = graphene.String()

    def mutate(root, info, user_id):
        if not has_admin_permission(info.context.user):
            return ToggleBypass2FA(success=False, error="Acceso denegado.")

        current_user = info.context.user
        if str(current_user.id) == str(user_id):
            return ToggleBypass2FA(success=False, error="No puedes modificar tu propia verificación 2FA.")

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return ToggleBypass2FA(success=False, error="Usuario no encontrado.")

        perfil, created = Perfil.objects.get_or_create(user=user)

        if perfil.bypass_2fa_hasta and perfil.bypass_2fa_hasta > timezone.now():
            perfil.bypass_2fa_hasta = None
            perfil.save()
            return ToggleBypass2FA(success=True, enabled=False)
        else:
            midnight = timezone.now().replace(hour=23, minute=59, second=59, microsecond=999999)
            perfil.bypass_2fa_hasta = midnight
            perfil.save()
            return ToggleBypass2FA(success=True, enabled=True)


class PaginatedPersonaType(graphene.ObjectType):
    items = graphene.List(PersonaType)
    total_count = graphene.Int()


class PaginatedCarpetaType(graphene.ObjectType):
    items = graphene.List(CarpetaType)
    total_count = graphene.Int()


class PaginatedPrestamoType(graphene.ObjectType):
    items = graphene.List(PrestamoType)
    total_count = graphene.Int()


class PaginatedDevolucionType(graphene.ObjectType):
    items = graphene.List(DevolucionType)
    total_count = graphene.Int()


class PaginatedIncidenteType(graphene.ObjectType):
    items = graphene.List(IncidenteType)
    total_count = graphene.Int()


class PaginatedProrrogaType(graphene.ObjectType):
    items = graphene.List(ProrrogaType)
    total_count = graphene.Int()


class PaginatedUserType(graphene.ObjectType):
    items = graphene.List(UserType)
    total_count = graphene.Int()


class PaginatedTraspasoType(graphene.ObjectType):
    items = graphene.List(TraspasoType)
    total_count = graphene.Int()


class TraspasoPendienteType(graphene.ObjectType):
    traspaso_carpeta_id = graphene.ID()
    carpeta = graphene.Field(CarpetaType)
    traspaso = graphene.Field(TraspasoType)


class PaginatedTraspasoPendienteType(graphene.ObjectType):
    items = graphene.List(TraspasoPendienteType)
    total_count = graphene.Int()


class PaginatedPrestamoCarpetaType(graphene.ObjectType):
    items = graphene.List(PrestamoCarpetaType)
    total_count = graphene.Int()


class PaginatedBloqueoType(graphene.ObjectType):
    items = graphene.List(BloqueoType)
    total_count = graphene.Int()


class PaginatedRetiroType(graphene.ObjectType):
    items = graphene.List(RetiroType)
    total_count = graphene.Int()


class RegistrarUsuarioPersona(graphene.Mutation):
    class Arguments:
        user_id = graphene.ID(required=True)
        persona_id = graphene.ID(required=True)

    success = graphene.Boolean()
    error = graphene.String()

    def mutate(root, info, user_id, persona_id):
        if not has_admin_permission(info.context.user):
            return RegistrarUsuarioPersona(success=False, error="Acceso denegado.")
        try:
            user = User.objects.get(id=user_id)
            persona = Persona.objects.get(id=persona_id)
        except User.DoesNotExist:
            return RegistrarUsuarioPersona(success=False, error="Usuario no encontrado.")
        except Persona.DoesNotExist:
            return RegistrarUsuarioPersona(success=False, error="Persona no encontrada.")
        Perfil.objects.get_or_create(user=user)
        return RegistrarUsuarioPersona(success=True)


class ActualizarPerfil(graphene.Mutation):
    class Arguments:
        first_name = graphene.String()
        last_name = graphene.String()
        current_password = graphene.String()
        new_password = graphene.String()

    user = graphene.Field(UserType)
    success = graphene.Boolean()
    error = graphene.String()

    def mutate(root, info, first_name=None, last_name=None, current_password=None, new_password=None):
        user = info.context.user
        if not user.is_authenticated:
            return ActualizarPerfil(success=False, error="Acceso denegado.")
        if first_name is not None:
            user.first_name = first_name
        if last_name is not None:
            user.last_name = last_name
        if new_password:
            if not current_password:
                return ActualizarPerfil(success=False, error="Debes proporcionar la contraseña actual.")
            if not user.check_password(current_password):
                return ActualizarPerfil(success=False, error="Contraseña actual incorrecta.")
            user.set_password(new_password)
        user.save()
        return ActualizarPerfil(user=user, success=True)


class CreateUser(graphene.Mutation):
    class Arguments:
        username = graphene.String(required=True)
        password = graphene.String(required=True)
        first_name = graphene.String()
        last_name = graphene.String()
        email = graphene.String()
        group_id = graphene.ID()
        permission_ids = graphene.List(graphene.ID)

    user = graphene.Field(UserType)
    success = graphene.Boolean()
    error = graphene.String()

    def mutate(root, info, username, password, first_name=None, last_name=None, email=None, group_id=None, permission_ids=None):
        if not has_admin_permission(info.context.user):
            return CreateUser(success=False, error="Acceso denegado.")
        if User.objects.filter(username=username).exists():
            return CreateUser(success=False, error="El nombre de usuario ya existe.")
        user = User.objects.create_user(username=username, password=password, first_name=first_name or '', last_name=last_name or '', email=email or '')
        if group_id:
            try:
                user.groups.add(Group.objects.get(id=group_id))
            except Group.DoesNotExist:
                pass
        if permission_ids:
            user.user_permissions.add(*Permission.objects.filter(id__in=permission_ids))
        return CreateUser(user=user, success=True)


class UpdateUser(graphene.Mutation):
    class Arguments:
        user_id = graphene.ID(required=True)
        first_name = graphene.String()
        last_name = graphene.String()
        email = graphene.String()
        is_active = graphene.Boolean()
        group_id = graphene.ID()
        permission_ids = graphene.List(graphene.ID)

    user = graphene.Field(UserType)
    success = graphene.Boolean()
    error = graphene.String()

    def mutate(root, info, user_id, first_name=None, last_name=None, email=None, is_active=None, group_id=None, permission_ids=None):
        if not has_admin_permission(info.context.user):
            return UpdateUser(success=False, error="Acceso denegado.")
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return UpdateUser(success=False, error="Usuario no encontrado.")
        changed = False
        if first_name is not None:
            user.first_name = first_name
        if last_name is not None:
            user.last_name = last_name
        if email is not None:
            user.email = email
        if is_active is not None:
            user.is_active = is_active
        if group_id is not None:
            user.groups.clear()
            if group_id:
                try:
                    user.groups.add(Group.objects.get(id=group_id))
                except Group.DoesNotExist:
                    pass
            changed = True
        if permission_ids is not None:
            user.user_permissions.clear()
            user.user_permissions.add(*Permission.objects.filter(id__in=permission_ids))
            changed = True
        user.save()
        if changed and str(info.context.user.id) != str(user_id):
            try:
                perfil, _ = Perfil.objects.get_or_create(user=user)
                perfil.session_invalidated_at = timezone.now()
                perfil.save()
                from graphql_jwt.refresh_token.models import RefreshToken
                RefreshToken.objects.filter(user=user).delete()
            except Exception:
                pass
        return UpdateUser(user=user, success=True)


class DeleteUser(graphene.Mutation):
    class Arguments:
        user_id = graphene.ID(required=True)

    success = graphene.Boolean()
    error = graphene.String()

    def mutate(root, info, user_id):
        if not has_admin_permission(info.context.user):
            return DeleteUser(success=False, error="Acceso denegado.")
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return DeleteUser(success=False, error="Usuario no encontrado.")
        if user.is_superuser:
            return DeleteUser(success=False, error="No se puede eliminar un superusuario.")
        user.delete()
        return DeleteUser(success=True)


class CreateGroup(graphene.Mutation):
    class Arguments:
        name = graphene.String(required=True)
        permission_ids = graphene.List(graphene.ID)

    group = graphene.Field(GroupType)
    success = graphene.Boolean()
    error = graphene.String()

    def mutate(root, info, name, permission_ids=None):
        if not has_admin_permission(info.context.user):
            return CreateGroup(success=False, error="Acceso denegado.")
        if Group.objects.filter(name=name).exists():
            return CreateGroup(success=False, error="El grupo ya existe.")
        group = Group.objects.create(name=name)
        if permission_ids:
            group.permissions.add(*Permission.objects.filter(id__in=permission_ids))
        return CreateGroup(group=group, success=True)


class RegistrarPrestamo(graphene.Mutation):
    class Arguments:
        ids_carpetas = graphene.List(graphene.ID, required=True)
        id_persona = graphene.ID(required=True)
        fecha_devolucion = graphene.Date(required=True)
        id_autorizado_por = graphene.ID(required=True)
        observaciones = graphene.String()

    prestamo = graphene.Field(PrestamoType)
    success = graphene.Boolean()
    error = graphene.String()
    docs_prestados_individualmente = graphene.List(graphene.String)
    warning = graphene.String()
    token_firma = graphene.String()
    foto_firma = graphene.String()

    def mutate(root, info, ids_carpetas, id_persona, fecha_devolucion, id_autorizado_por, observaciones=""):
        user = info.context.user
        if not user.is_authenticated:
            return RegistrarPrestamo(success=False, error="Acceso denegado.")
        if not (user.is_superuser or user.has_perm('api.gestionar_prestamos')):
            return RegistrarPrestamo(success=False, error="No tienes permisos.")
        try:
            persona = Persona.objects.get(id=id_persona)
            autorizado = Persona.objects.get(id=id_autorizado_por)
        except Persona.DoesNotExist:
            return RegistrarPrestamo(success=False, error="Persona no encontrada.")
        if Bloqueo.objects.filter(persona=persona, fecha_desbloq__isnull=True).exists():
            return RegistrarPrestamo(success=False, error="Esta persona tiene un bloqueo activo y no puede recibir préstamos.")
        carpetas = Carpeta.objects.filter(id__in=ids_carpetas)
        if carpetas.count() != len(ids_carpetas):
            return RegistrarPrestamo(success=False, error="Una o más carpetas no fueron encontradas.")
        for carpeta in carpetas:
            if carpeta.estado != 'disponible':
                return RegistrarPrestamo(success=False, error=f"La carpeta '{carpeta.descripcion}' no está disponible.")
        docs_prestados = Documento.objects.filter(
            carpeta__in=carpetas, estado='prestado_individual'
        )
        docs_prestados_nombres = []
        if docs_prestados.exists():
            docs_prestados_nombres = list(docs_prestados.values_list('titulo', flat=True))
        fecha_devol = datetime.combine(fecha_devolucion, time(15, 30))
        prestamo = Prestamo.objects.create(
            persona=persona, usuario=user, autorizado_por=autorizado,
            fecha_devolucion=fecha_devol, observaciones=observaciones
        )
        for carpeta in carpetas:
            PrestamoCarpeta.objects.create(prestamo=prestamo, carpeta=carpeta)
            carpeta.estado = 'prestado'
            carpeta.save()
            Documento.objects.filter(carpeta=carpeta, estado='disponible').update(
                estado='prestado_carpeta'
            )
        warning = ""
        if docs_prestados_nombres:
            warning = f"Los siguientes documentos ya estaban prestados individualmente: {', '.join(docs_prestados_nombres)}"
        if not prestamo.token_firma:
            prestamo.token_firma = uuid.uuid4()
            prestamo.save(update_fields=['token_firma'])
        return RegistrarPrestamo(
            prestamo=prestamo, success=True,
            docs_prestados_individualmente=docs_prestados_nombres,
            warning=warning,
            token_firma=str(prestamo.token_firma),
            foto_firma=prestamo.foto_firma.url if prestamo.foto_firma else None
        )


class RegistrarDevolucion(graphene.Mutation):
    class Arguments:
        id_prestamo_carpeta = graphene.ID(required=True)
        observaciones = graphene.String()
        estado_devolucion = graphene.String()
        bloquear_persona = graphene.Boolean()

    devolucion = graphene.Field(DevolucionType)
    success = graphene.Boolean()
    error = graphene.String()
    token_firma = graphene.String()

    def mutate(root, info, id_prestamo_carpeta, observaciones="", estado_devolucion="buen_estado", bloquear_persona=False):
        user = info.context.user
        if not user.is_authenticated:
            return RegistrarDevolucion(success=False, error="Acceso denegado.")
        if not (user.is_superuser or user.has_perm('api.gestionar_devoluciones')):
            return RegistrarDevolucion(success=False, error="No tienes permisos.")
        try:
            pc = PrestamoCarpeta.objects.get(id=id_prestamo_carpeta)
        except PrestamoCarpeta.DoesNotExist:
            return RegistrarDevolucion(success=False, error="Préstamo de carpeta no encontrado.")
        if pc.estado == 'devuelto':
            return RegistrarDevolucion(success=False, error="Esta carpeta ya fue devuelta.")
        devolucion = Devolucion.objects.create(
            prestamo_carpeta=pc, usuario=user,
            observaciones=observaciones, estado_devolucion=estado_devolucion
        )
        if not devolucion.token_firma:
            devolucion.token_firma = uuid.uuid4()
            devolucion.save(update_fields=['token_firma'])
        pc.estado = 'devuelto'
        pc.fecha_devol = devolucion.fecha_devol
        pc.save()
        carpeta = pc.carpeta
        if estado_devolucion == 'dañado':
            carpeta.estado = 'dañado'
        else:
            carpeta.estado = 'disponible'
        carpeta.save()
        if bloquear_persona:
            persona = pc.prestamo.persona
            if not Bloqueo.objects.filter(persona=persona, fecha_desbloq__isnull=True).exists():
                Bloqueo.objects.create(motivo_bloq=f"Devolución en estado: {estado_devolucion}", usuario=user, persona=persona)
        return RegistrarDevolucion(devolucion=devolucion, success=True, token_firma=str(devolucion.token_firma))


class RegistrarDevolucionConDocumentos(graphene.Mutation):
    class Arguments:
        id_prestamo_carpeta = graphene.ID(required=True)
        ids_documentos_presentes = graphene.List(graphene.ID, required=True)
        dias_prorroga = graphene.Int()
        motivo_prorroga = graphene.String()

    devolucion = graphene.Field(DevolucionType)
    success = graphene.Boolean()
    error = graphene.String()
    prorroga_creada = graphene.Boolean()
    docs_faltantes = graphene.List(graphene.String)
    mensaje = graphene.String()
    token_firma = graphene.String()

    def mutate(root, info, id_prestamo_carpeta, ids_documentos_presentes, dias_prorroga=None, motivo_prorroga=None):
        user = info.context.user
        if not user.is_authenticated:
            return RegistrarDevolucionConDocumentos(success=False, error="Acceso denegado.")
        if not (user.is_superuser or user.has_perm('api.gestionar_devoluciones')):
            return RegistrarDevolucionConDocumentos(success=False, error="No tienes permisos.")
        try:
            pc = PrestamoCarpeta.objects.get(id=id_prestamo_carpeta)
        except PrestamoCarpeta.DoesNotExist:
            return RegistrarDevolucionConDocumentos(success=False, error="Préstamo de carpeta no encontrado.")
        if pc.estado == 'devuelto':
            return RegistrarDevolucionConDocumentos(success=False, error="Esta carpeta ya fue devuelta.")

        carpeta = pc.carpeta
        todos_documentos = list(Documento.objects.filter(carpeta=carpeta))
        ids_presentes = set(str(doc_id) for doc_id in (ids_documentos_presentes or []))

        prestado_individual_ids = set(
            str(d.id) for d in Documento.objects.filter(
                carpeta=carpeta, estado='prestado_individual'
            )
        )

        docs_faltantes = [
            doc for doc in todos_documentos
            if str(doc.id) not in ids_presentes
            and str(doc.id) not in prestado_individual_ids
        ]

        devolucion = Devolucion.objects.create(
            prestamo_carpeta=pc, usuario=user,
            observaciones=f"Revisión de documentos: {len(todos_documentos)} documentos, {len(docs_faltantes)} faltantes",
            estado_devolucion='buen_estado'
        )

        docs_faltantes_nombres = []
        for doc in todos_documentos:
            presente = str(doc.id) in ids_presentes
            if str(doc.id) in prestado_individual_ids:
                presente = False
            DevolucionDocumento.objects.create(
                devolucion=devolucion, documento=doc, presente=presente
            )
            if not presente and str(doc.id) not in prestado_individual_ids:
                docs_faltantes_nombres.append(doc.tipo_doc)

        prorroga_creada = False
        if docs_faltantes:
            from django.utils import timezone
            persona = pc.prestamo.persona
            dias = dias_prorroga if dias_prorroga else 7
            motivo = motivo_prorroga if motivo_prorroga else f"Documentos faltantes en devolución: {', '.join(docs_faltantes_nombres)}"
            prorroga = Prorroga.objects.create(
                prestamo=pc.prestamo,
                persona_solicita=persona,
                usuario=user,
                dias_otorgados=dias,
                motivo=motivo
            )
            pc.prestamo.fecha_devolucion = pc.prestamo.fecha_devolucion + timedelta(days=dias)
            pc.prestamo.save()
            prorroga_creada = True

        if not docs_faltantes:
            pc.estado = 'devuelto'
            pc.fecha_devol = devolucion.fecha_devol
            pc.save()
            carpeta.estado = 'disponible'
            carpeta.save()
            Documento.objects.filter(carpeta=carpeta, estado='prestado_carpeta').exclude(
                id__in=list(prestado_individual_ids) if prestado_individual_ids else []
            ).update(estado='disponible')

        if not devolucion.token_firma:
            devolucion.token_firma = uuid.uuid4()
            devolucion.save(update_fields=['token_firma'])

        mensaje = f"✅ Devolución registrada. {len(todos_documentos) - len(docs_faltantes)}/{len(todos_documentos)} documentos presentes."
        if docs_faltantes:
            mensaje = f"⚠️ Devolución registrada con {len(docs_faltantes)} documento(s) faltante(s). Se generó prórroga de {dias_prorroga or 7} días."
            try:
                from api.services.email_service import notificar_documentos_faltantes
                notificar_documentos_faltantes(
                    carpeta_desc=carpeta.descripcion or f"Carpeta #{carpeta.id}",
                    persona_nombre=f"{pc.prestamo.persona.nombre} {pc.prestamo.persona.apellido}",
                    docs_faltantes=docs_faltantes_nombres,
                    usuario_registra=f"{user.first_name} {user.last_name} (@{user.username})",
                )
            except Exception:
                pass

        return RegistrarDevolucionConDocumentos(
            devolucion=devolucion, success=True, prorroga_creada=prorroga_creada,
            docs_faltantes=docs_faltantes_nombres, mensaje=mensaje,
            token_firma=str(devolucion.token_firma)
        )


class CrearIncidente(graphene.Mutation):
    class Arguments:
        tipo_inci = graphene.String(required=True)
        carpeta_ids = graphene.List(graphene.ID, required=True)
        descripcion = graphene.String()

    incidente = graphene.Field(IncidenteType)
    success = graphene.Boolean()
    error = graphene.String()

    def mutate(root, info, tipo_inci, carpeta_ids, descripcion=None):
        user = info.context.user
        if not user.is_authenticated:
            return CrearIncidente(success=False, error="Acceso denegado.")
        incidente = Incidente.objects.create(tipo_inci=tipo_inci, usuario=user)
        for cid in carpeta_ids:
            try:
                carpeta = Carpeta.objects.get(id=cid)
            except Carpeta.DoesNotExist:
                continue
            if carpeta.estado == 'retirado':
                continue
            DetalleIncidente.objects.create(descripcion=descripcion or '', incidente=incidente, carpeta=carpeta)
        return CrearIncidente(incidente=incidente, success=True)


class ResolverIncidente(graphene.Mutation):
    class Arguments:
        incidente_id = graphene.ID(required=True)
        accion = graphene.String()

    success = graphene.Boolean()
    error = graphene.String()

    def mutate(root, info, incidente_id, accion=None):
        user = info.context.user
        if not user.is_authenticated:
            return ResolverIncidente(success=False, error="Acceso denegado.")
        try:
            incidente = Incidente.objects.get(id=incidente_id)
        except Incidente.DoesNotExist:
            return ResolverIncidente(success=False, error="Incidente no encontrado.")
        incidente.estado = False
        incidente.save()
        
        if accion in ['recuperada', 'danada']:
            from .models import Carpeta
            estado_nuevo = 'disponible' if accion == 'recuperada' else 'dañado'
            for detalle in incidente.detalleincidente_set.all():
                carpeta = detalle.carpeta
                if carpeta.estado not in ['retirado']:
                    carpeta.estado = estado_nuevo
                    carpeta.save()
        
        return ResolverIncidente(success=True)


class ResolverCarpetas(graphene.Mutation):
    class Arguments:
        carpeta_ids = graphene.List(graphene.ID, required=True)
    
    success = graphene.Boolean()
    error = graphene.String()
    
    def mutate(root, info, carpeta_ids):
        from django.apps import apps
        user = info.context.user
        if not user.is_authenticated:
            return ResolverCarpetas(success=False, error="Acceso denegado.")
        Carpeta = apps.get_model('api', 'Carpeta')
        DetalleIncidente = apps.get_model('api', 'DetalleIncidente')
        Incidente = apps.get_model('api', 'Incidente')
        updated = 0
        incidentes_afectados = set()
        for cid in carpeta_ids:
            try:
                carpeta = Carpeta.objects.get(id=cid)
                if carpeta.estado not in ['retirado']:
                    carpeta.estado = 'disponible'
                    carpeta.save()
                    updated += 1
                for det in DetalleIncidente.objects.filter(carpeta=carpeta):
                    incidentes_afectados.add(det.incidente_id)
            except Carpeta.DoesNotExist:
                pass
        for inc_id in incidentes_afectados:
            try:
                inc = Incidente.objects.get(id=inc_id)
                detalles = inc.detalleincidente_set.all()
                todos_disponibles = all(d.carpeta.estado == 'disponible' for d in detalles)
                if detalles.exists() and todos_disponibles:
                    inc.estado = False
                    inc.save()
            except Incidente.DoesNotExist:
                pass
        return ResolverCarpetas(success=True)


class RegistrarProrroga(graphene.Mutation):
    class Arguments:
        prestamo_id = graphene.ID(required=True)
        persona_solicita_id = graphene.ID(required=True)
        dias_otorgados = graphene.Int(required=True)
        motivo = graphene.String()

    prorroga = graphene.Field(ProrrogaType)
    success = graphene.Boolean()
    error = graphene.String()

    def mutate(root, info, prestamo_id, persona_solicita_id, dias_otorgados, motivo=None):
        user = info.context.user
        if not user.is_authenticated:
            return RegistrarProrroga(success=False, error="Acceso denegado.")
        if not (user.is_superuser or user.has_perm('api.gestionar_prorrogas')):
            return RegistrarProrroga(success=False, error="No tienes permisos.")
        try:
            prestamo = Prestamo.objects.get(id=prestamo_id)
            persona_solicita = Persona.objects.get(id=persona_solicita_id)
        except Prestamo.DoesNotExist:
            return RegistrarProrroga(success=False, error="Préstamo no encontrado.")
        except Persona.DoesNotExist:
            return RegistrarProrroga(success=False, error="Persona no encontrada.")
        prorroga = Prorroga.objects.create(
            prestamo=prestamo, persona_solicita=persona_solicita,
            usuario=user, dias_otorgados=dias_otorgados, motivo=motivo
        )
        prestamo.fecha_devolucion = prestamo.fecha_devolucion + timedelta(days=dias_otorgados)
        prestamo.save()
        return RegistrarProrroga(prorroga=prorroga, success=True)


class RegistrarPrestamoDoc(graphene.Mutation):
    class Arguments:
        ids_documentos = graphene.List(graphene.ID, required=True)
        id_persona = graphene.ID(required=True)
        fecha_devolucion = graphene.Date(required=True)
        id_autorizado_por = graphene.ID(required=True)
        observaciones = graphene.String()

    prestamo = graphene.Field(PrestamoDocType)
    success = graphene.Boolean()
    error = graphene.String()
    token_firma = graphene.String()

    def mutate(root, info, ids_documentos, id_persona, fecha_devolucion, id_autorizado_por, observaciones=""):
        user = info.context.user
        if not user.is_authenticated:
            return RegistrarPrestamoDoc(success=False, error="Acceso denegado.")
        if not (user.is_superuser or user.has_perm('api.gestionar_prestamos')):
            return RegistrarPrestamoDoc(success=False, error="No tienes permisos.")
        try:
            persona = Persona.objects.get(id=id_persona)
            autorizado = Persona.objects.get(id=id_autorizado_por)
        except Persona.DoesNotExist:
            return RegistrarPrestamoDoc(success=False, error="Persona no encontrada.")
        if Bloqueo.objects.filter(persona=persona, fecha_desbloq__isnull=True).exists():
            return RegistrarPrestamoDoc(success=False, error="Esta persona tiene un bloqueo activo y no puede recibir préstamos.")
        docs = Documento.objects.filter(id__in=ids_documentos)
        if docs.count() != len(ids_documentos):
            return RegistrarPrestamoDoc(success=False, error="Uno o más documentos no fueron encontrados.")
        fecha_devol = datetime.combine(fecha_devolucion, time(15, 30))
        prestamo = PrestamoDoc.objects.create(
            persona=persona, usuario=user, autorizado_por=autorizado,
            fecha_devolucion=fecha_devol, observaciones=observaciones
        )
        for doc in docs:
            PrestamoDocItem.objects.create(prestamo=prestamo, documento=doc)
            doc.estado = 'prestado_individual'
            doc.save()
        if not prestamo.token_firma:
            prestamo.token_firma = uuid.uuid4()
            prestamo.save(update_fields=['token_firma'])
        return RegistrarPrestamoDoc(
            prestamo=prestamo, success=True,
            token_firma=str(prestamo.token_firma)
        )


class RegistrarDevolucionDoc(graphene.Mutation):
    class Arguments:
        id_prestamo_doc_item = graphene.ID(required=True)
        observaciones = graphene.String()
        estado_devolucion = graphene.String()
        bloquear_persona = graphene.Boolean()

    devolucion = graphene.Field(DevolucionDocType)
    success = graphene.Boolean()
    error = graphene.String()

    def mutate(root, info, id_prestamo_doc_item, observaciones="", estado_devolucion="buen_estado", bloquear_persona=False):
        user = info.context.user
        if not user.is_authenticated:
            return RegistrarDevolucionDoc(success=False, error="Acceso denegado.")
        if not (user.is_superuser or user.has_perm('api.gestionar_devoluciones')):
            return RegistrarDevolucionDoc(success=False, error="No tienes permisos.")
        try:
            item = PrestamoDocItem.objects.get(id=id_prestamo_doc_item)
        except PrestamoDocItem.DoesNotExist:
            return RegistrarDevolucionDoc(success=False, error="Item de préstamo no encontrado.")
        if item.estado == 'devuelto':
            return RegistrarDevolucionDoc(success=False, error="Este documento ya fue devuelto.")
        import uuid
        devolucion = DevolucionDoc.objects.create(
            prestamo_doc_item=item, usuario=user,
            observaciones=observaciones, estado_devolucion=estado_devolucion,
            token_firma=uuid.uuid4()
        )
        item.estado = 'devuelto'
        item.fecha_devol = devolucion.fecha_devol
        item.save()
        doc = item.documento
        if PrestamoCarpeta.objects.filter(carpeta=doc.carpeta, estado='prestado').exists():
            doc.estado = 'prestado_carpeta'
        else:
            doc.estado = 'disponible'
        doc.save()
        if bloquear_persona:
            persona = item.prestamo.persona
            if not Bloqueo.objects.filter(persona=persona, fecha_desbloq__isnull=True).exists():
                Bloqueo.objects.create(motivo_bloq=f"Devolución en estado: {estado_devolucion}", usuario=user, persona=persona)
        return RegistrarDevolucionDoc(devolucion=devolucion, success=True)


class RegistrarProrrogaDoc(graphene.Mutation):
    class Arguments:
        prestamo_id = graphene.ID(required=True)
        persona_solicita_id = graphene.ID(required=True)
        dias_otorgados = graphene.Int(required=True)
        motivo = graphene.String()

    prorroga = graphene.Field(ProrrogaDocType)
    success = graphene.Boolean()
    error = graphene.String()

    def mutate(root, info, prestamo_id, persona_solicita_id, dias_otorgados, motivo=None):
        user = info.context.user
        if not user.is_authenticated:
            return RegistrarProrrogaDoc(success=False, error="Acceso denegado.")
        if not (user.is_superuser or user.has_perm('api.gestionar_prorrogas')):
            return RegistrarProrrogaDoc(success=False, error="No tienes permisos.")
        try:
            prestamo = PrestamoDoc.objects.get(id=prestamo_id)
            persona_solicita = Persona.objects.get(id=persona_solicita_id)
        except PrestamoDoc.DoesNotExist:
            return RegistrarProrrogaDoc(success=False, error="Préstamo no encontrado.")
        except Persona.DoesNotExist:
            return RegistrarProrrogaDoc(success=False, error="Persona no encontrada.")
        prorroga = ProrrogaDoc.objects.create(
            prestamo=prestamo, persona_solicita=persona_solicita,
            usuario=user, dias_otorgados=dias_otorgados, motivo=motivo
        )
        prestamo.fecha_devolucion = prestamo.fecha_devolucion + timedelta(days=dias_otorgados)
        prestamo.save()
        return RegistrarProrrogaDoc(prorroga=prorroga, success=True)


class MarcarNotificacionesLeidas(graphene.Mutation):
    class Arguments:
        ids = graphene.List(graphene.ID, required=True)

    success = graphene.Boolean()
    error = graphene.String()

    def mutate(root, info, ids):
        user = info.context.user
        if not user.is_authenticated:
            return MarcarNotificacionesLeidas(success=False, error="Acceso denegado.")
        Notification.objects.filter(id__in=ids, usuario=user).update(leido=True)
        return MarcarNotificacionesLeidas(success=True)


class CarpetasPorAmbienteType(graphene.ObjectType):
    ambiente_id = graphene.ID()
    ambiente_nombre = graphene.String()
    count = graphene.Int()


class DashboardStatsType(graphene.ObjectType):
    total_carpetas = graphene.Int()
    prestamos_activos = graphene.Int()
    prestamos_vencidos_count = graphene.Int()
    carpetas_disponibles = graphene.Int()
    personas_count = graphene.Int()
    traspasos_pendientes = graphene.Int()
    incidentes_activos = graphene.Int()
    carpetas_por_ambiente = graphene.List(CarpetasPorAmbienteType)
    prestamos_recientes = graphene.List(PrestamoType)
    prestamos_por_vencer = graphene.List(PrestamoType)
    devoluciones_recientes = graphene.List(DevolucionType)


class GlobalSearchResultType(graphene.ObjectType):
    carpetas = graphene.List(CarpetaType)
    personas = graphene.List(PersonaType)
    documentos = graphene.List(DocumentoType)


class NotificationType(DjangoObjectType):
    class Meta:
        model = Notification
        fields = '__all__'


class RegistrarRetiro(graphene.Mutation):
    class Arguments:
        id_carpeta = graphene.ID(required=True)
        id_persona = graphene.ID(required=True)
        id_autorizado_por = graphene.ID(required=True)
        motivo = graphene.String(required=True)
        motivo_otro = graphene.String()
        observaciones = graphene.String()

    retiro = graphene.Field(RetiroType)
    success = graphene.Boolean()
    error = graphene.String()

    def mutate(root, info, id_carpeta, id_persona, id_autorizado_por, motivo, motivo_otro=None, observaciones=None):
        user = info.context.user
        if not user.is_authenticated:
            return RegistrarRetiro(success=False, error="Acceso denegado.")
        if not (user.is_superuser or user.has_perm('api.gestionar_retiros')):
            return RegistrarRetiro(success=False, error="No tienes permisos.")
        try:
            carpeta = Carpeta.objects.get(id=id_carpeta)
        except Carpeta.DoesNotExist:
            return RegistrarRetiro(success=False, error="Carpeta no encontrada.")
        try:
            persona = Persona.objects.get(id=id_persona)
        except Persona.DoesNotExist:
            return RegistrarRetiro(success=False, error="Persona no encontrada.")
        try:
            autorizado_por = Persona.objects.get(id=id_autorizado_por)
        except Persona.DoesNotExist:
            return RegistrarRetiro(success=False, error="Autorizado por no encontrado.")
        if carpeta.estado == 'retirado':
            return RegistrarRetiro(success=False, error="Esta carpeta ya está retirada.")
        if carpeta.estado == 'prestado':
            pc = PrestamoCarpeta.objects.filter(
                carpeta=carpeta, estado='prestado'
            ).select_related('prestamo__persona').first()
            nombre = f"{pc.prestamo.persona.nombre} {pc.prestamo.persona.apellido}" if pc else "desconocida"
            return RegistrarRetiro(success=False, error=f"No se puede retirar: carpeta prestada a {nombre}.")
        retiro = Retiro.objects.create(
            carpeta=carpeta, persona=persona, autorizado_por=autorizado_por,
            usuario=user, fecha_retiro=timezone.now(), motivo=motivo,
            motivo_otro=motivo_otro, observaciones=observaciones,
        )
        carpeta.estado = 'retirado'
        carpeta.save(update_fields=['estado'])
        return RegistrarRetiro(retiro=retiro, success=True)


class Query(graphene.ObjectType):
    me = graphene.Field(UserType)
    all_users = graphene.List(UserType)
    all_groups = graphene.List(GroupType)
    all_permissions = graphene.List(PermissionDetailType)
    all_personas = graphene.List(PersonaType)
    all_ambientes = graphene.List(AmbienteType)
    all_estantes = graphene.List(EstanteType)
    all_pisos = graphene.List(PisoType)
    all_carpetas = graphene.List(CarpetaType, ids=graphene.List(graphene.ID))
    all_documentos = graphene.List(DocumentoType, search=graphene.String())
    all_prestamos = graphene.List(PrestamoType, usuario_id=graphene.ID())
    all_incidentes = graphene.List(IncidenteType, usuario_id=graphene.ID())
    all_devoluciones = graphene.List(DevolucionType, usuario_id=graphene.ID())
    all_traspasos = graphene.List(TraspasoType, usuario_id=graphene.ID())
    all_bloqueos = graphene.List(BloqueoType, usuario_id=graphene.ID())
    all_bloqueos_paginated = graphene.Field(
        graphene.NonNull(PaginatedBloqueoType),
        page=graphene.Int(), page_size=graphene.Int(), search=graphene.String(),
        usuario_id=graphene.ID(),
        fecha_desde=graphene.Date(), fecha_hasta=graphene.Date()
    )

    all_retiros = graphene.List(RetiroType, usuario_id=graphene.ID())
    all_retiros_paginated = graphene.Field(
        graphene.NonNull(PaginatedRetiroType),
        page=graphene.Int(), page_size=graphene.Int(), search=graphene.String(), usuario_id=graphene.ID(),
        fecha_desde=graphene.Date(), fecha_hasta=graphene.Date()
    )

    notifications = graphene.List(NotificationType)
    mis_ambientes = graphene.List(AmbienteType)
    dashboard_stats = graphene.Field(DashboardStatsType)
    global_search = graphene.Field(GlobalSearchResultType, query=graphene.String(required=True))

    all_personas_paginated = graphene.Field(
        graphene.NonNull(PaginatedPersonaType),
        page=graphene.Int(), page_size=graphene.Int(), search=graphene.String()
    )
    all_carpetas_paginated = graphene.Field(
        graphene.NonNull(PaginatedCarpetaType),
        page=graphene.Int(), page_size=graphene.Int(),
        ambiente_id=graphene.ID(), search=graphene.String(),
        fecha_desde=graphene.Date(), fecha_hasta=graphene.Date(),
        estado=graphene.String()
    )
    all_prestamos_paginated = graphene.Field(
        graphene.NonNull(PaginatedPrestamoType),
        page=graphene.Int(), page_size=graphene.Int(), search=graphene.String(), usuario_id=graphene.ID(),
        persona_id=graphene.ID(),
        fecha_desde=graphene.Date(), fecha_hasta=graphene.Date()
    )
    all_prestamos_vencidos_paginated = graphene.Field(
        graphene.NonNull(PaginatedPrestamoType),
        page=graphene.Int(), page_size=graphene.Int(), usuario_id=graphene.ID()
    )
    all_prestamos_activos_paginated = graphene.Field(
        graphene.NonNull(PaginatedPrestamoType),
        page=graphene.Int(), page_size=graphene.Int(), usuario_id=graphene.ID(),
        search=graphene.String()
    )
    persona_prestamos_pendientes = graphene.Field(
        PersonaPrestamosPendientesType,
        persona_id=graphene.ID(required=True)
    )
    persona_prestamos_doc_pendientes = graphene.Field(
        PersonaPrestamosDocPendientesType,
        persona_id=graphene.ID(required=True)
    )
    all_devoluciones_paginated = graphene.Field(
        graphene.NonNull(PaginatedDevolucionType),
        page=graphene.Int(), page_size=graphene.Int(), search=graphene.String(), usuario_id=graphene.ID(),
        fecha_desde=graphene.Date(), fecha_hasta=graphene.Date()
    )
    all_incidentes_paginated = graphene.Field(
        graphene.NonNull(PaginatedIncidenteType),
        page=graphene.Int(), page_size=graphene.Int(), search=graphene.String(), usuario_id=graphene.ID(),
        fecha_desde=graphene.Date(), fecha_hasta=graphene.Date()
    )
    all_prorrogas_paginated = graphene.Field(
        graphene.NonNull(PaginatedProrrogaType),
        page=graphene.Int(), page_size=graphene.Int(), search=graphene.String(), usuario_id=graphene.ID(),
        fecha_desde=graphene.Date(), fecha_hasta=graphene.Date()
    )
    all_users_paginated = graphene.Field(
        graphene.NonNull(PaginatedUserType),
        page=graphene.Int(), page_size=graphene.Int(), search=graphene.String()
    )
    all_traspasos_paginated = graphene.Field(
        graphene.NonNull(PaginatedTraspasoType),
        page=graphene.Int(), page_size=graphene.Int(), search=graphene.String(), usuario_id=graphene.ID(),
        fecha_desde=graphene.Date(), fecha_hasta=graphene.Date()
    )
    all_traspasos_pendientes_paginated = graphene.Field(
        graphene.NonNull(PaginatedTraspasoPendienteType),
        page=graphene.Int(), page_size=graphene.Int(),
        ambiente_id=graphene.ID(), search=graphene.String()
    )
    prestamo_carpeta = graphene.Field(PrestamoCarpetaType, id=graphene.ID(required=True))
    prestamo_carpetas_paginated = graphene.Field(
        graphene.NonNull(PaginatedPrestamoCarpetaType),
        prestamo_id=graphene.ID(required=True), page=graphene.Int(), page_size=graphene.Int()
    )
    all_prestamos_doc_paginated = graphene.Field(
        graphene.NonNull(PaginatedPrestamoDocType),
        page=graphene.Int(), page_size=graphene.Int(), search=graphene.String(), usuario_id=graphene.ID(),
        fecha_desde=graphene.Date(), fecha_hasta=graphene.Date()
    )
    all_prestamos_doc_vencidos_paginated = graphene.Field(
        graphene.NonNull(PaginatedPrestamoDocType),
        page=graphene.Int(), page_size=graphene.Int()
    )
    all_prestamos_doc_activos_paginated = graphene.Field(
        graphene.NonNull(PaginatedPrestamoDocType),
        page=graphene.Int(), page_size=graphene.Int()
    )
    all_devoluciones_doc_paginated = graphene.Field(
        graphene.NonNull(PaginatedDevolucionDocType),
        page=graphene.Int(), page_size=graphene.Int(), search=graphene.String(), usuario_id=graphene.ID(),
        fecha_desde=graphene.Date(), fecha_hasta=graphene.Date()
    )
    all_prorrogas_doc_paginated = graphene.Field(
        graphene.NonNull(PaginatedProrrogaDocType),
        page=graphene.Int(), page_size=graphene.Int(), search=graphene.String(), usuario_id=graphene.ID(),
        fecha_desde=graphene.Date(), fecha_hasta=graphene.Date()
    )

    def resolve_me(root, info):
        user = info.context.user
        if not user.is_authenticated:
            return None
        return user

    def resolve_all_users(root, info):
        if not has_admin_permission(info.context.user):
            return []
        return User.objects.all()

    def resolve_all_groups(root, info):
        if not has_admin_permission(info.context.user):
            return []
        return Group.objects.all()

    def resolve_all_permissions(root, info):
        if not info.context.user.is_authenticated:
            return []
        return Permission.objects.all()

    def resolve_all_personas(root, info):
        if not info.context.user.is_authenticated:
            return []
        return Persona.objects.all()

    def resolve_all_ambientes(root, info):
        if not info.context.user.is_authenticated:
            return []
        user = info.context.user
        if not has_admin_permission(user):
            ambiente_ids = list(AsignacionAmbiente.objects.filter(usuario=user).values_list('ambiente_id', flat=True))
            return Ambiente.objects.filter(id__in=ambiente_ids)
        return Ambiente.objects.all()

    def resolve_all_estantes(root, info):
        if not info.context.user.is_authenticated:
            return []
        user = info.context.user
        if not has_admin_permission(user):
            ambiente_ids = list(AsignacionAmbiente.objects.filter(usuario=user).values_list('ambiente_id', flat=True))
            return Estante.objects.filter(ambiente_id__in=ambiente_ids)
        return Estante.objects.all()

    def resolve_all_pisos(root, info):
        if not info.context.user.is_authenticated:
            return []
        user = info.context.user
        if not has_admin_permission(user):
            ambiente_ids = list(AsignacionAmbiente.objects.filter(usuario=user).values_list('ambiente_id', flat=True))
            return Piso.objects.filter(estante__ambiente_id__in=ambiente_ids)
        return Piso.objects.all()

    def resolve_all_carpetas(root, info, ids=None):
        if not info.context.user.is_authenticated:
            return []
        user = info.context.user
        qs = Carpeta.objects.select_related('piso__estante__ambiente').all()
        if not has_admin_permission(user):
            ambiente_ids = list(AsignacionAmbiente.objects.filter(
                usuario=user
            ).values_list('ambiente_id', flat=True))
            qs = qs.filter(piso__estante__ambiente_id__in=ambiente_ids)
        if ids:
            qs = qs.filter(id__in=ids)
        return qs

    def resolve_all_documentos(root, info, search=None):
        if not info.context.user.is_authenticated:
            return []
        user = info.context.user
        qs = Documento.objects.select_related('carpeta__piso__estante__ambiente').all()
        if not has_admin_permission(user):
            ambiente_ids = list(AsignacionAmbiente.objects.filter(
                usuario=user
            ).values_list('ambiente_id', flat=True))
            qs = qs.filter(carpeta__piso__estante__ambiente_id__in=ambiente_ids)
        if search:
            qs = qs.filter(Q(titulo__icontains=search) | Q(codigo_doc__icontains=search))
        return qs[:50]

    def resolve_all_prestamos(root, info, usuario_id=None):
        if not info.context.user.is_authenticated:
            return []
        user = info.context.user
        qs = Prestamo.objects.all()
        if not has_admin_permission(user):
            ambiente_ids = list(AsignacionAmbiente.objects.filter(
                usuario=user
            ).values_list('ambiente_id', flat=True))
            if ambiente_ids:
                qs = qs.filter(prestamocarpeta__carpeta__piso__estante__ambiente_id__in=ambiente_ids).distinct()
        if usuario_id:
            qs = qs.filter(usuario_id=usuario_id)
        return qs

    def resolve_all_incidentes(root, info, usuario_id=None):
        if not info.context.user.is_authenticated:
            return []
        user = info.context.user
        qs = Incidente.objects.all()
        if not has_admin_permission(user):
            ambiente_ids = list(AsignacionAmbiente.objects.filter(
                usuario=user
            ).values_list('ambiente_id', flat=True))
            if ambiente_ids:
                qs = qs.filter(detalleincidente__carpeta__piso__estante__ambiente_id__in=ambiente_ids).distinct()
        if usuario_id:
            qs = qs.filter(usuario_id=usuario_id)
        return qs

    def resolve_all_devoluciones(root, info, usuario_id=None):
        if not info.context.user.is_authenticated:
            return []
        user = info.context.user
        qs = Devolucion.objects.all()
        if not has_admin_permission(user):
            ambiente_ids = list(AsignacionAmbiente.objects.filter(
                usuario=user
            ).values_list('ambiente_id', flat=True))
            if ambiente_ids:
                qs = qs.filter(prestamo_carpeta__carpeta__piso__estante__ambiente_id__in=ambiente_ids).distinct()
        if usuario_id:
            qs = qs.filter(usuario_id=usuario_id)
        return qs

    def resolve_all_traspasos(root, info, usuario_id=None):
        if not info.context.user.is_authenticated:
            return []
        qs = Traspaso.objects.select_related('usuario', 'ambiente_origen', 'ambiente_destino').prefetch_related(
            Prefetch('items', queryset=TraspasoCarpeta.objects.select_related('carpeta', 'piso_asignado__estante'))
        )
        if usuario_id:
            qs = qs.filter(usuario_id=usuario_id)
        return qs

    def resolve_all_bloqueos(root, info, usuario_id=None):
        if not info.context.user.is_authenticated:
            return []
        qs = Bloqueo.objects.select_related('persona', 'usuario', 'usuario_desbloqueo').all()
        if usuario_id:
            qs = qs.filter(usuario_id=usuario_id)
        return qs

    def resolve_all_bloqueos_paginated(root, info, page=1, page_size=10, search=None, usuario_id=None, fecha_desde=None, fecha_hasta=None):
        if not info.context.user.is_authenticated:
            return PaginatedBloqueoType(items=[], total_count=0)
        qs = Bloqueo.objects.select_related('persona', 'usuario', 'usuario_desbloqueo').all()
        if search:
            qs = qs.filter(
                Q(persona__nombre__icontains=search) |
                Q(persona__apellido__icontains=search) |
                Q(persona__ci__icontains=search) |
                Q(persona__telefono__icontains=search) |
                Q(persona__email__icontains=search) |
                Q(persona__direccion__icontains=search) |
                Q(persona__cargo__icontains=search) |
                Q(persona__tipo_entidad__icontains=search) |
                Q(motivo_bloq__icontains=search) |
                Q(motivo_desbloq__icontains=search) |
                Q(usuario__username__icontains=search) |
                Q(usuario__first_name__icontains=search) |
                Q(usuario__last_name__icontains=search) |
                Q(usuario__email__icontains=search) |
                Q(usuario_desbloqueo__username__icontains=search) |
                Q(usuario_desbloqueo__first_name__icontains=search) |
                Q(usuario_desbloqueo__last_name__icontains=search) |
                Q(usuario_desbloqueo__email__icontains=search)
            )
        if usuario_id:
            qs = qs.filter(usuario_id=usuario_id)
        if fecha_desde:
            qs = qs.filter(fecha_bloq__date__gte=fecha_desde)
        if fecha_hasta:
            qs = qs.filter(fecha_bloq__date__lte=fecha_hasta)
        qs = qs.order_by('-fecha_bloq')
        total = qs.count()
        items = qs[(page - 1) * page_size:page * page_size]
        return PaginatedBloqueoType(items=items, total_count=total)

    def resolve_all_retiros(root, info, usuario_id=None):
        if not info.context.user.is_authenticated:
            return []
        user = info.context.user
        qs = Retiro.objects.select_related('carpeta', 'persona', 'autorizado_por', 'usuario').all()
        if not has_admin_permission(user):
            ambiente_ids = list(AsignacionAmbiente.objects.filter(
                usuario=user
            ).values_list('ambiente_id', flat=True))
            if ambiente_ids:
                qs = qs.filter(carpeta__piso__estante__ambiente_id__in=ambiente_ids)
        if usuario_id:
            qs = qs.filter(usuario_id=usuario_id)
        return qs

    def resolve_all_retiros_paginated(root, info, page=1, page_size=10, search=None, usuario_id=None, fecha_desde=None, fecha_hasta=None):
        if not info.context.user.is_authenticated:
            return PaginatedRetiroType(items=[], total_count=0)
        user = info.context.user
        qs = Retiro.objects.select_related('carpeta', 'persona', 'autorizado_por', 'usuario').all()
        if not has_admin_permission(user):
            ambiente_ids = list(AsignacionAmbiente.objects.filter(
                usuario=user
            ).values_list('ambiente_id', flat=True))
            if ambiente_ids:
                qs = qs.filter(carpeta__piso__estante__ambiente_id__in=ambiente_ids)
        if search:
            qs = qs.filter(
                Q(carpeta__descripcion__icontains=search) |
                Q(carpeta__estado__icontains=search) |
                Q(persona__nombre__icontains=search) |
                Q(persona__apellido__icontains=search) |
                Q(persona__ci__icontains=search) |
                Q(persona__telefono__icontains=search) |
                Q(persona__email__icontains=search) |
                Q(persona__direccion__icontains=search) |
                Q(persona__cargo__icontains=search) |
                Q(persona__tipo_entidad__icontains=search) |
                Q(autorizado_por__nombre__icontains=search) |
                Q(autorizado_por__apellido__icontains=search) |
                Q(autorizado_por__ci__icontains=search) |
                Q(autorizado_por__telefono__icontains=search) |
                Q(autorizado_por__email__icontains=search) |
                Q(autorizado_por__cargo__icontains=search) |
                Q(autorizado_por__tipo_entidad__icontains=search) |
                Q(motivo__icontains=search) |
                Q(motivo_otro__icontains=search) |
                Q(observaciones__icontains=search) |
                Q(usuario__username__icontains=search) |
                Q(usuario__first_name__icontains=search) |
                Q(usuario__last_name__icontains=search) |
                Q(usuario__email__icontains=search)
            )
        if usuario_id:
            qs = qs.filter(usuario_id=usuario_id)
        if fecha_desde:
            qs = qs.filter(fecha_retiro__date__gte=fecha_desde)
        if fecha_hasta:
            qs = qs.filter(fecha_retiro__date__lte=fecha_hasta)
        qs = qs.order_by('-fecha_retiro')
        total = qs.count()
        items = qs[(page - 1) * page_size:page * page_size]
        return PaginatedRetiroType(items=items, total_count=total)

    def resolve_notifications(root, info):
        user = info.context.user
        if not user.is_authenticated:
            return []

        notis = list(Notification.objects.filter(usuario=user)[:20])

        ambiente_ids = None
        if not has_admin_permission(user):
            ambiente_ids = list(AsignacionAmbiente.objects.filter(usuario=user).values_list('ambiente_id', flat=True))

        hoy = timezone.now()
        vencidos = Prestamo.objects.filter(
            fecha_devolucion__lt=hoy
        ).exclude(
            prestamocarpeta__estado='devuelto'
        ).distinct().order_by('-fecha_devolucion')
        if ambiente_ids:
            vencidos = vencidos.filter(prestamocarpeta__carpeta__piso__estante__ambiente_id__in=ambiente_ids)
        vencidos = vencidos[:3]

        for p in vencidos:
            notis.append(Notification(
                id=-p.id,
                tipo='VENCIMIENTO',
                mensaje=f"Préstamo #{p.id} vencido - {p.persona.nombre} {p.persona.apellido}",
                link=f"/prestamos?id={p.id}",
                fecha=p.fecha_devolucion,
            ))

        proximos = Prestamo.objects.filter(
            fecha_devolucion__gte=hoy,
            fecha_devolucion__lte=hoy + timedelta(days=2)
        ).exclude(
            prestamocarpeta__estado='devuelto'
        ).distinct().order_by('fecha_devolucion')
        if ambiente_ids:
            proximos = proximos.filter(prestamocarpeta__carpeta__piso__estante__ambiente_id__in=ambiente_ids)
        proximos = proximos[:3]

        for p in proximos:
            notis.append(Notification(
                id=-(1000 + p.id),
                tipo='PROXIMO_VENCER',
                mensaje=f"Préstamo #{p.id} vence {p.fecha_devolucion.strftime('%d/%m/%Y')} - {p.persona.nombre} {p.persona.apellido}",
                link=f"/prestamos?id={p.id}",
                fecha=p.fecha_devolucion,
            ))

        notis.sort(key=lambda n: n.fecha if n.fecha else hoy, reverse=True)
        return notis[:20]

    def resolve_mis_ambientes(root, info):
        user = info.context.user
        if not user.is_authenticated:
            return []
        if has_admin_permission(user):
            return Ambiente.objects.all()
        return [a.ambiente for a in AsignacionAmbiente.objects.filter(usuario=user)]

    def resolve_dashboard_stats(root, info):
        user = info.context.user
        if not user.is_authenticated:
            return None

        if has_admin_permission(user):
            ambiente_ids = list(Ambiente.objects.values_list('id', flat=True))
        else:
            ambiente_ids = list(AsignacionAmbiente.objects.filter(
                usuario=user
            ).values_list('ambiente_id', flat=True))

        carpetas_qs = Carpeta.objects.filter(
            piso__estante__ambiente_id__in=ambiente_ids
        )

        prestamo_ids = PrestamoCarpeta.objects.filter(
            carpeta__in=carpetas_qs
        ).values_list('prestamo_id', flat=True).distinct()

        prestamos_qs = Prestamo.objects.filter(id__in=prestamo_ids)

        hoy = timezone.now()

        total_carpetas = carpetas_qs.count()
        prestamos_activos = prestamos_qs.exclude(
            prestamocarpeta__estado='devuelto'
        ).distinct().count()
        prestamos_vencidos = prestamos_qs.filter(
            fecha_devolucion__lt=hoy
        ).exclude(
            prestamocarpeta__estado='devuelto'
        ).distinct().count()
        carpetas_disponibles = carpetas_qs.filter(estado='disponible').count()
        personas_count = Persona.objects.count()

        traspasos_pendientes = TraspasoCarpeta.objects.filter(
            ubicado=False,
            traspaso__in=Traspaso.objects.filter(
                Q(ambiente_origen_id__in=ambiente_ids) |
                Q(ambiente_destino_id__in=ambiente_ids)
            )
        ).count()

        incidentes_activos = Incidente.objects.filter(
            estado=True,
            detalleincidente__carpeta__in=carpetas_qs
        ).distinct().count()

        carpetas_por_ambiente = Ambiente.objects.filter(
            id__in=ambiente_ids
        ).annotate(
            count=Count('estante__piso__carpeta')
        )

        carpetas_por_ambiente_list = [
            CarpetasPorAmbienteType(
                ambiente_id=str(a.id),
                ambiente_nombre=a.nombre,
                count=a.count
            ) for a in carpetas_por_ambiente
        ]

        prestamos_recientes = prestamos_qs.order_by('-fecha_prest')[:10]
        prestamos_por_vencer = prestamos_qs.filter(
            fecha_devolucion__gte=timezone.now()
        ).exclude(
            prestamocarpeta__estado='devuelto'
        ).distinct().order_by('fecha_devolucion')[:10]

        devoluciones_recientes = Devolucion.objects.filter(
            prestamo_carpeta__carpeta__in=carpetas_qs
        ).order_by('-fecha_devol')[:10]

        return DashboardStatsType(
            total_carpetas=total_carpetas,
            prestamos_activos=prestamos_activos,
            prestamos_vencidos_count=prestamos_vencidos,
            carpetas_disponibles=carpetas_disponibles,
            personas_count=personas_count,
            traspasos_pendientes=traspasos_pendientes,
            incidentes_activos=incidentes_activos,
            carpetas_por_ambiente=carpetas_por_ambiente_list,
            prestamos_recientes=prestamos_recientes,
            prestamos_por_vencer=prestamos_por_vencer,
            devoluciones_recientes=devoluciones_recientes,
        )

    def resolve_global_search(root, info, query):
        user = info.context.user
        if not user.is_authenticated:
            return GlobalSearchResultType(carpetas=[], personas=[], documentos=[])

        carpetas = Carpeta.objects.filter(descripcion__icontains=query).prefetch_related(
            'prestamocarpeta_set__prestamo__persona'
        )[:10]
        personas = Persona.objects.filter(
            Q(ci__icontains=query) |
            Q(nombre__icontains=query) |
            Q(apellido__icontains=query)
        ).prefetch_related(
            'prestamos_recibidos__prestamocarpeta_set__carpeta',
            'prestamos_doc_recibidos__items__documento',
            'bloqueo_set',
        )[:10]
        documentos = Documento.objects.filter(
            Q(titulo__icontains=query) |
            Q(codigo_doc__icontains=query)
        )[:10]

        return GlobalSearchResultType(
            carpetas=carpetas,
            personas=personas,
            documentos=documentos,
        )

    def resolve_all_personas_paginated(root, info, page=1, page_size=10, search=None):
        if not info.context.user.is_authenticated:
            return PaginatedPersonaType(items=[], total_count=0)
        qs = Persona.objects.all()
        if search:
            qs = qs.filter(
                Q(ci__icontains=search) |
                Q(nombre__icontains=search) |
                Q(apellido__icontains=search) |
                Q(telefono__icontains=search) |
                Q(email__icontains=search) |
                Q(direccion__icontains=search) |
                Q(cargo__icontains=search) |
                Q(tipo_entidad__icontains=search)
            )
        total = qs.count()
        items = qs[(page - 1) * page_size:page * page_size]
        return PaginatedPersonaType(items=items, total_count=total)

    def resolve_all_carpetas_paginated(root, info, page=1, page_size=10, ambiente_id=None, search=None, fecha_desde=None, fecha_hasta=None, estado=None):
        if not info.context.user.is_authenticated:
            return PaginatedCarpetaType(items=[], total_count=0)
        user = info.context.user
        qs = Carpeta.objects.select_related('piso__estante__ambiente').prefetch_related('documento_set').all()
        if not has_admin_permission(user):
            ambiente_ids = list(AsignacionAmbiente.objects.filter(
                usuario=user
            ).values_list('ambiente_id', flat=True))
            qs = qs.filter(piso__estante__ambiente_id__in=ambiente_ids)
        if ambiente_id:
            qs = qs.filter(piso__estante__ambiente_id=ambiente_id)
        if search:
            qs = qs.filter(
                Q(descripcion__icontains=search) |
                Q(estado__icontains=search) |
                Q(piso__descripcion__icontains=search) |
                Q(piso__estante__codigo__icontains=search) |
                Q(piso__estante__descripcion__icontains=search) |
                Q(piso__estante__estado__icontains=search) |
                Q(piso__estante__ambiente__nombre__icontains=search) |
                Q(piso__estante__ambiente__ubicacion__icontains=search) |
                Q(piso__estante__ambiente__descripcion__icontains=search) |
                Q(documento__titulo__icontains=search) |
                Q(documento__codigo_doc__icontains=search) |
                Q(documento__tipo_doc__icontains=search) |
                Q(documento__estado__icontains=search) |
                Q(documento__propietario__ci__icontains=search) |
                Q(documento__propietario__nombre__icontains=search) |
                Q(documento__propietario__apellido__icontains=search) |
                Q(documento__propietario__telefono__icontains=search) |
                Q(documento__propietario__email__icontains=search) |
                Q(documento__propietario__direccion__icontains=search) |
                Q(documento__propietario__cargo__icontains=search) |
                Q(documento__propietario__tipo_entidad__icontains=search)
            ).distinct()
        if fecha_desde:
            qs = qs.filter(fecha_crea__date__gte=fecha_desde)
        if fecha_hasta:
            qs = qs.filter(fecha_crea__date__lte=fecha_hasta)
        if estado:
            qs = qs.filter(estado=estado)
        total = qs.count()
        items = qs[(page - 1) * page_size:page * page_size]
        return PaginatedCarpetaType(items=items, total_count=total)

    def resolve_all_prestamos_paginated(root, info, page=1, page_size=10, search=None, usuario_id=None, persona_id=None, fecha_desde=None, fecha_hasta=None):
        if not info.context.user.is_authenticated:
            return PaginatedPrestamoType(items=[], total_count=0)
        qs = Prestamo.objects.all()
        user = info.context.user
        if not has_admin_permission(user):
            ambiente_ids = list(AsignacionAmbiente.objects.filter(
                usuario=user
            ).values_list('ambiente_id', flat=True))
            if ambiente_ids:
                qs = qs.filter(
                    prestamocarpeta__carpeta__piso__estante__ambiente_id__in=ambiente_ids
                ).distinct()
        if search:
            qs = qs.filter(
                Q(persona__nombre__icontains=search) |
                Q(persona__apellido__icontains=search) |
                Q(persona__ci__icontains=search) |
                Q(persona__telefono__icontains=search) |
                Q(persona__email__icontains=search) |
                Q(persona__direccion__icontains=search) |
                Q(persona__cargo__icontains=search) |
                Q(persona__tipo_entidad__icontains=search) |
                Q(observaciones__icontains=search) |
                Q(usuario__username__icontains=search) |
                Q(usuario__first_name__icontains=search) |
                Q(usuario__last_name__icontains=search) |
                Q(usuario__email__icontains=search) |
                Q(autorizado_por__nombre__icontains=search) |
                Q(autorizado_por__apellido__icontains=search) |
                Q(autorizado_por__ci__icontains=search) |
                Q(autorizado_por__telefono__icontains=search) |
                Q(autorizado_por__email__icontains=search) |
                Q(autorizado_por__cargo__icontains=search) |
                Q(autorizado_por__tipo_entidad__icontains=search)
            )
        if usuario_id:
            qs = qs.filter(usuario_id=usuario_id)
        if fecha_desde:
            qs = qs.filter(fecha_prest__date__gte=fecha_desde)
        if fecha_hasta:
            qs = qs.filter(fecha_prest__date__lte=fecha_hasta)
        if persona_id:
            qs = qs.filter(persona_id=persona_id)
            from django.db.models import Exists, OuterRef, Case, When, Value, IntegerField
            from django.utils import timezone
            active_sub = PrestamoCarpeta.objects.filter(
                prestamo=OuterRef('pk'), estado='prestado'
            )
            qs = qs.annotate(
                has_active=Exists(active_sub),
                sort_order=Case(
                    When(has_active=True, fecha_devolucion__lt=timezone.now(), then=Value(0)),
                    When(has_active=True, then=Value(1)),
                    default=Value(2),
                    output_field=IntegerField(),
                )
            ).order_by('sort_order', '-fecha_prest').distinct()
        else:
            qs = qs.order_by('-fecha_prest')
        total = qs.count()
        items = qs[(page - 1) * page_size:page * page_size]
        return PaginatedPrestamoType(items=items, total_count=total)

    def resolve_all_prestamos_vencidos_paginated(root, info, page=1, page_size=10, usuario_id=None):
        if not info.context.user.is_authenticated:
            return PaginatedPrestamoType(items=[], total_count=0)
        from django.utils import timezone
        qs = Prestamo.objects.filter(
            fecha_devolucion__lt=timezone.now(),
            prestamocarpeta__estado='prestado',
        ).distinct()
        if usuario_id:
            qs = qs.filter(usuario_id=usuario_id)
        qs = qs.order_by('-fecha_prest')
        total = qs.count()
        items = qs[(page - 1) * page_size:page * page_size]
        return PaginatedPrestamoType(items=items, total_count=total)

    def resolve_all_prestamos_activos_paginated(root, info, page=1, page_size=10, usuario_id=None, search=None):
        if not info.context.user.is_authenticated:
            return PaginatedPrestamoType(items=[], total_count=0)
        user = info.context.user
        qs = Prestamo.objects.filter(
            fecha_devolucion__gte=timezone.now(),
            prestamocarpeta__estado='prestado',
        ).distinct()
        if not has_admin_permission(user):
            ambiente_ids = list(AsignacionAmbiente.objects.filter(
                usuario=user
            ).values_list('ambiente_id', flat=True))
            if ambiente_ids:
                qs = qs.filter(
                    prestamocarpeta__carpeta__piso__estante__ambiente_id__in=ambiente_ids
                )
        if usuario_id:
            qs = qs.filter(usuario_id=usuario_id)
        if search:
            qs = qs.filter(
                Q(persona__nombre__icontains=search) |
                Q(persona__apellido__icontains=search)
            )
        qs = qs.order_by('-fecha_prest')
        total = qs.count()
        items = qs[(page - 1) * page_size:page * page_size]
        return PaginatedPrestamoType(items=items, total_count=total)

    def resolve_persona_prestamos_pendientes(root, info, persona_id):
        if not info.context.user.is_authenticated:
            return PersonaPrestamosPendientesType(total_pendientes=0, items=[])
        from django.utils import timezone
        now = timezone.now()
        pcs = PrestamoCarpeta.objects.filter(
            prestamo__persona_id=persona_id,
            estado='prestado'
        ).select_related('prestamo', 'carpeta')
        items = []
        for pc in pcs:
            dias_retraso = 0
            if pc.prestamo.fecha_devolucion < now:
                dias_retraso = (now - pc.prestamo.fecha_devolucion).days
            items.append(ItemPendienteType(
                prestamo_carpeta_id=pc.id,
                carpeta_descripcion=pc.carpeta.descripcion,
                fecha_prest=pc.prestamo.fecha_prest.isoformat(),
                fecha_devolucion=pc.prestamo.fecha_devolucion.isoformat(),
                dias_retraso=dias_retraso,
            ))
        return PersonaPrestamosPendientesType(total_pendientes=len(items), items=items)

    def resolve_persona_prestamos_doc_pendientes(root, info, persona_id):
        if not info.context.user.is_authenticated:
            return PersonaPrestamosDocPendientesType(total_pendientes=0, items=[])
        from django.utils import timezone
        now = timezone.now()
        doc_items = PrestamoDocItem.objects.filter(
            prestamo__persona_id=persona_id,
            estado='prestado'
        ).select_related('prestamo', 'documento')
        items = []
        for di in doc_items:
            dias_retraso = 0
            if di.prestamo.fecha_devolucion < now:
                dias_retraso = (now - di.prestamo.fecha_devolucion).days
            desc = di.documento.titulo
            if di.documento.codigo_doc:
                desc = f"{di.documento.codigo_doc} - {desc}"
            items.append(DocItemPendienteType(
                prestamo_doc_item_id=di.id,
                documento_descripcion=desc,
                fecha_prest=di.prestamo.fecha_prest.isoformat(),
                fecha_devolucion=di.prestamo.fecha_devolucion.isoformat(),
                dias_retraso=dias_retraso,
            ))
        return PersonaPrestamosDocPendientesType(total_pendientes=len(items), items=items)

    def resolve_all_devoluciones_paginated(root, info, page=1, page_size=10, search=None, usuario_id=None, fecha_desde=None, fecha_hasta=None):
        if not info.context.user.is_authenticated:
            return PaginatedDevolucionType(items=[], total_count=0)
        qs = Devolucion.objects.all()
        user = info.context.user
        if not has_admin_permission(user):
            ambiente_ids = list(AsignacionAmbiente.objects.filter(usuario=user).values_list('ambiente_id', flat=True))
            if ambiente_ids:
                qs = qs.filter(prestamo_carpeta__carpeta__piso__estante__ambiente_id__in=ambiente_ids).distinct()
        if search:
            qs = qs.filter(
                Q(prestamo_carpeta__carpeta__descripcion__icontains=search) |
                Q(prestamo_carpeta__carpeta__estado__icontains=search) |
                Q(prestamo_carpeta__estado__icontains=search) |
                Q(prestamo_carpeta__observaciones__icontains=search) |
                Q(usuario__username__icontains=search) |
                Q(usuario__first_name__icontains=search) |
                Q(usuario__last_name__icontains=search) |
                Q(usuario__email__icontains=search) |
                Q(observaciones__icontains=search) |
                Q(estado_devolucion__icontains=search)
            )
        if usuario_id:
            qs = qs.filter(usuario_id=usuario_id)
        if fecha_desde:
            qs = qs.filter(fecha_devol__date__gte=fecha_desde)
        if fecha_hasta:
            qs = qs.filter(fecha_devol__date__lte=fecha_hasta)
        qs = qs.order_by('-fecha_devol')

        total = qs.count()
        items = qs[(page - 1) * page_size:page * page_size]
        return PaginatedDevolucionType(items=items, total_count=total)

    def resolve_all_incidentes_paginated(root, info, page=1, page_size=10, search=None, usuario_id=None, fecha_desde=None, fecha_hasta=None):
        if not info.context.user.is_authenticated:
            return PaginatedIncidenteType(items=[], total_count=0)
        qs = Incidente.objects.all()
        if search:
            qs = qs.filter(
                Q(tipo_inci__icontains=search) |
                Q(detalles__descripcion__icontains=search) |
                Q(detalles__carpeta__descripcion__icontains=search) |
                Q(detalles__carpeta__estado__icontains=search) |
                Q(usuario__username__icontains=search) |
                Q(usuario__first_name__icontains=search) |
                Q(usuario__last_name__icontains=search) |
                Q(usuario__email__icontains=search)
        ).distinct()
        user = info.context.user
        if not has_admin_permission(user):
            ambiente_ids = list(AsignacionAmbiente.objects.filter(
                usuario=user
            ).values_list('ambiente_id', flat=True))
            if ambiente_ids:
                qs = qs.filter(
                    detalles__carpeta__piso__estante__ambiente_id__in=ambiente_ids
                ).distinct()
        if usuario_id:
            qs = qs.filter(usuario_id=usuario_id)
        if fecha_desde:
            qs = qs.filter(fecha_reporte__date__gte=fecha_desde)
        if fecha_hasta:
            qs = qs.filter(fecha_reporte__date__lte=fecha_hasta)
        qs = qs.order_by('-fecha_reporte')
        total = qs.count()
        items = qs[(page - 1) * page_size:page * page_size]
        return PaginatedIncidenteType(items=items, total_count=total)

    def resolve_all_prorrogas_paginated(root, info, page=1, page_size=10, search=None, usuario_id=None, fecha_desde=None, fecha_hasta=None):
        if not info.context.user.is_authenticated:
            return PaginatedProrrogaType(items=[], total_count=0)
        qs = Prorroga.objects.all()
        user = info.context.user
        if not has_admin_permission(user):
            ambiente_ids = list(AsignacionAmbiente.objects.filter(usuario=user).values_list('ambiente_id', flat=True))
            if ambiente_ids:
                qs = qs.filter(prestamo__prestamocarpeta__carpeta__piso__estante__ambiente_id__in=ambiente_ids).distinct()
        if search:
            qs = qs.filter(
                Q(prestamo__persona__nombre__icontains=search) |
                Q(prestamo__persona__apellido__icontains=search) |
                Q(prestamo__persona__ci__icontains=search) |
                Q(prestamo__persona__telefono__icontains=search) |
                Q(prestamo__persona__email__icontains=search) |
                Q(prestamo__persona__direccion__icontains=search) |
                Q(prestamo__persona__cargo__icontains=search) |
                Q(prestamo__persona__tipo_entidad__icontains=search) |
                Q(prestamo__observaciones__icontains=search) |
                Q(prestamo__usuario__username__icontains=search) |
                Q(prestamo__usuario__first_name__icontains=search) |
                Q(prestamo__usuario__last_name__icontains=search) |
                Q(prestamo__usuario__email__icontains=search) |
                Q(persona_solicita__nombre__icontains=search) |
                Q(persona_solicita__apellido__icontains=search) |
                Q(persona_solicita__ci__icontains=search) |
                Q(persona_solicita__telefono__icontains=search) |
                Q(persona_solicita__email__icontains=search) |
                Q(persona_solicita__direccion__icontains=search) |
                Q(persona_solicita__cargo__icontains=search) |
                Q(persona_solicita__tipo_entidad__icontains=search) |
                Q(motivo__icontains=search) |
                Q(usuario__username__icontains=search) |
                Q(usuario__first_name__icontains=search) |
                Q(usuario__last_name__icontains=search) |
                Q(usuario__email__icontains=search)
            )
        if usuario_id:
            qs = qs.filter(usuario_id=usuario_id)
        if fecha_desde:
            qs = qs.filter(fecha_registro__date__gte=fecha_desde)
        if fecha_hasta:
            qs = qs.filter(fecha_registro__date__lte=fecha_hasta)
        qs = qs.order_by('-fecha_registro')
        total = qs.count()
        items = qs[(page - 1) * page_size:page * page_size]
        return PaginatedProrrogaType(items=items, total_count=total)

    def resolve_all_users_paginated(root, info, page=1, page_size=10, search=None):
        if not has_admin_permission(info.context.user):
            return PaginatedUserType(items=[], total_count=0)
        qs = User.objects.all()
        if search:
            qs = qs.filter(
                Q(username__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(email__icontains=search)
            )
        total = qs.count()
        items = qs[(page - 1) * page_size:page * page_size]
        return PaginatedUserType(items=items, total_count=total)

    def resolve_all_traspasos_paginated(root, info, page=1, page_size=10, search=None, usuario_id=None, fecha_desde=None, fecha_hasta=None):
        if not info.context.user.is_authenticated:
            return PaginatedTraspasoType(items=[], total_count=0)
        qs = Traspaso.objects.all()
        if search:
            qs = qs.filter(
                Q(ambiente_origen__nombre__icontains=search) |
                Q(ambiente_origen__ubicacion__icontains=search) |
                Q(ambiente_origen__descripcion__icontains=search) |
                Q(ambiente_destino__nombre__icontains=search) |
                Q(ambiente_destino__ubicacion__icontains=search) |
                Q(ambiente_destino__descripcion__icontains=search) |
                Q(observaciones__icontains=search) |
                Q(usuario__username__icontains=search) |
                Q(usuario__first_name__icontains=search) |
                Q(usuario__last_name__icontains=search) |
                Q(usuario__email__icontains=search)
            )
        if usuario_id:
            qs = qs.filter(usuario_id=usuario_id)
        if fecha_desde:
            qs = qs.filter(fecha__date__gte=fecha_desde)
        if fecha_hasta:
            qs = qs.filter(fecha__date__lte=fecha_hasta)
        qs = qs.order_by('-fecha')
        total = qs.count()
        items = qs[(page - 1) * page_size:page * page_size]
        return PaginatedTraspasoType(items=items, total_count=total)

    def resolve_all_traspasos_pendientes_paginated(root, info, page=1, page_size=10, ambiente_id=None, search=None):
        if not info.context.user.is_authenticated:
            return PaginatedTraspasoPendienteType(items=[], total_count=0)
        user = info.context.user
        qs = TraspasoCarpeta.objects.filter(ubicado=False).select_related(
            'carpeta__piso__estante__ambiente',
            'traspaso__ambiente_origen',
            'traspaso__ambiente_destino',
            'traspaso__usuario',
        )
        if not has_admin_permission(user):
            ambiente_ids = list(AsignacionAmbiente.objects.filter(
                usuario=user
            ).values_list('ambiente_id', flat=True))
            qs = qs.filter(
                Q(traspaso__ambiente_origen_id__in=ambiente_ids) |
                Q(traspaso__ambiente_destino_id__in=ambiente_ids)
            )
        if ambiente_id:
            qs = qs.filter(
                Q(traspaso__ambiente_origen_id=ambiente_id) |
                Q(traspaso__ambiente_destino_id=ambiente_id)
            )
        if search:
            qs = qs.filter(
                Q(carpeta__descripcion__icontains=search) |
                Q(traspaso__ambiente_origen__nombre__icontains=search) |
                Q(traspaso__ambiente_destino__nombre__icontains=search)
            ).distinct()
        total = qs.count()
        items = qs[(page - 1) * page_size:page * page_size]
        pendientes = [
            TraspasoPendienteType(traspaso_carpeta_id=item.id, carpeta=item.carpeta, traspaso=item.traspaso)
            for item in items
        ]
        return PaginatedTraspasoPendienteType(items=pendientes, total_count=total)

    def resolve_prestamo_carpeta(root, info, id):
        if not info.context.user.is_authenticated:
            return None
        try:
            return PrestamoCarpeta.objects.get(id=id)
        except PrestamoCarpeta.DoesNotExist:
            return None

    def resolve_prestamo_carpetas_paginated(root, info, prestamo_id, page=1, page_size=10):
        if not info.context.user.is_authenticated:
            return PaginatedPrestamoCarpetaType(items=[], total_count=0)
        qs = PrestamoCarpeta.objects.filter(prestamo_id=prestamo_id).order_by('id')
        total = qs.count()
        items = qs[(page - 1) * page_size:page * page_size]
        return PaginatedPrestamoCarpetaType(items=items, total_count=total)

    def resolve_all_prestamos_doc_paginated(root, info, page=1, page_size=10, search=None, usuario_id=None, fecha_desde=None, fecha_hasta=None):
        if not info.context.user.is_authenticated:
            return PaginatedPrestamoDocType(items=[], total_count=0)
        qs = PrestamoDoc.objects.all().order_by('-fecha_prest')
        user = info.context.user
        if not has_admin_permission(user):
            ambiente_ids = list(AsignacionAmbiente.objects.filter(usuario=user).values_list('ambiente_id', flat=True))
            if ambiente_ids:
                qs = qs.filter(items__documento__carpeta__piso__estante__ambiente_id__in=ambiente_ids).distinct()
        if search:
            qs = qs.filter(
                Q(persona__nombre__icontains=search) |
                Q(persona__apellido__icontains=search) |
                Q(persona__ci__icontains=search) |
                Q(persona__telefono__icontains=search) |
                Q(persona__email__icontains=search) |
                Q(observaciones__icontains=search) |
                Q(usuario__username__icontains=search) |
                Q(usuario__first_name__icontains=search) |
                Q(usuario__last_name__icontains=search) |
                Q(usuario__email__icontains=search) |
                Q(autorizado_por__nombre__icontains=search) |
                Q(autorizado_por__apellido__icontains=search) |
                Q(autorizado_por__ci__icontains=search)
            )
        if usuario_id:
            qs = qs.filter(usuario_id=usuario_id)
        if fecha_desde:
            qs = qs.filter(fecha_prest__date__gte=fecha_desde)
        if fecha_hasta:
            qs = qs.filter(fecha_prest__date__lte=fecha_hasta)
        total = qs.count()
        items = qs[(page - 1) * page_size:page * page_size]
        return PaginatedPrestamoDocType(items=items, total_count=total)

    def resolve_all_prestamos_doc_vencidos_paginated(root, info, page=1, page_size=10):
        if not info.context.user.is_authenticated:
            return PaginatedPrestamoDocType(items=[], total_count=0)
        from django.utils import timezone
        qs = PrestamoDoc.objects.filter(
            fecha_devolucion__lt=timezone.now()
        ).annotate(
            total_items=Count('items'),
            devueltos=Count('items', filter=Q(items__estado='devuelto'))
        ).filter(devueltos=F('total_items')).distinct().order_by('-fecha_prest')
        user = info.context.user
        if not has_admin_permission(user):
            ambiente_ids = list(AsignacionAmbiente.objects.filter(usuario=user).values_list('ambiente_id', flat=True))
            if ambiente_ids:
                qs = qs.filter(items__documento__carpeta__piso__estante__ambiente_id__in=ambiente_ids).distinct()
        total = qs.count()
        items = qs[(page - 1) * page_size:page * page_size]
        return PaginatedPrestamoDocType(items=items, total_count=total)

    def resolve_all_prestamos_doc_activos_paginated(root, info, page=1, page_size=10):
        if not info.context.user.is_authenticated:
            return PaginatedPrestamoDocType(items=[], total_count=0)
        qs = PrestamoDoc.objects.annotate(
            total_items=Count('items'),
            devueltos=Count('items', filter=Q(items__estado='devuelto'))
        ).filter(devueltos=F('total_items')).distinct().order_by('-fecha_prest')
        user = info.context.user
        if not has_admin_permission(user):
            ambiente_ids = list(AsignacionAmbiente.objects.filter(usuario=user).values_list('ambiente_id', flat=True))
            if ambiente_ids:
                qs = qs.filter(items__documento__carpeta__piso__estante__ambiente_id__in=ambiente_ids).distinct()
        total = qs.count()
        items = qs[(page - 1) * page_size:page * page_size]
        return PaginatedPrestamoDocType(items=items, total_count=total)

    def resolve_all_devoluciones_doc_paginated(root, info, page=1, page_size=10, search=None, usuario_id=None, fecha_desde=None, fecha_hasta=None):
        if not info.context.user.is_authenticated:
            return PaginatedDevolucionDocType(items=[], total_count=0)
        qs = DevolucionDoc.objects.select_related(
            'prestamo_doc_item__prestamo_doc__persona', 'usuario'
        ).all().order_by('-fecha_devol')
        user = info.context.user
        if not has_admin_permission(user):
            ambiente_ids = list(AsignacionAmbiente.objects.filter(usuario=user).values_list('ambiente_id', flat=True))
            if ambiente_ids:
                qs = qs.filter(prestamo_doc_item__documento__carpeta__piso__estante__ambiente_id__in=ambiente_ids).distinct()
        if search:
            qs = qs.filter(
                Q(prestamo_doc_item__documento__titulo__icontains=search) |
                Q(prestamo_doc_item__documento__codigo_doc__icontains=search) |
                Q(prestamo_doc_item__prestamo_doc__persona__nombre__icontains=search) |
                Q(prestamo_doc_item__prestamo_doc__persona__apellido__icontains=search) |
                Q(prestamo_doc_item__prestamo_doc__persona__ci__icontains=search) |
                Q(prestamo_doc_item__prestamo_doc__persona__telefono__icontains=search) |
                Q(prestamo_doc_item__prestamo_doc__persona__email__icontains=search) |
                Q(usuario__username__icontains=search) |
                Q(usuario__first_name__icontains=search) |
                Q(usuario__last_name__icontains=search) |
                Q(usuario__email__icontains=search) |
                Q(observaciones__icontains=search) |
                Q(estado_devolucion__icontains=search)
            )
        if usuario_id:
            qs = qs.filter(usuario_id=usuario_id)
        if fecha_desde:
            qs = qs.filter(fecha_devol__date__gte=fecha_desde)
        if fecha_hasta:
            qs = qs.filter(fecha_devol__date__lte=fecha_hasta)
        total = qs.count()
        items = qs[(page - 1) * page_size:page * page_size]
        return PaginatedDevolucionDocType(items=items, total_count=total)

    def resolve_all_prorrogas_doc_paginated(root, info, page=1, page_size=10, search=None, usuario_id=None, fecha_desde=None, fecha_hasta=None):
        if not info.context.user.is_authenticated:
            return PaginatedProrrogaDocType(items=[], total_count=0)
        qs = ProrrogaDoc.objects.select_related(
            'prestamo_doc__persona', 'usuario'
        ).all().order_by('-fecha_registro')
        user = info.context.user
        if not has_admin_permission(user):
            ambiente_ids = list(AsignacionAmbiente.objects.filter(usuario=user).values_list('ambiente_id', flat=True))
            if ambiente_ids:
                qs = qs.filter(prestamo_doc__items__documento__carpeta__piso__estante__ambiente_id__in=ambiente_ids).distinct()
        if search:
            qs = qs.filter(
                Q(prestamo_doc__persona__nombre__icontains=search) |
                Q(prestamo_doc__persona__apellido__icontains=search) |
                Q(prestamo_doc__persona__ci__icontains=search) |
                Q(prestamo_doc__persona__telefono__icontains=search) |
                Q(prestamo_doc__persona__email__icontains=search) |
                Q(persona_solicita__nombre__icontains=search) |
                Q(persona_solicita__apellido__icontains=search) |
                Q(persona_solicita__ci__icontains=search) |
                Q(motivo__icontains=search) |
                Q(usuario__username__icontains=search) |
                Q(usuario__first_name__icontains=search) |
                Q(usuario__last_name__icontains=search) |
                Q(usuario__email__icontains=search)
            )
        if usuario_id:
            qs = qs.filter(usuario_id=usuario_id)
        if fecha_desde:
            qs = qs.filter(fecha_registro__date__gte=fecha_desde)
        if fecha_hasta:
            qs = qs.filter(fecha_registro__date__lte=fecha_hasta)
        qs = qs.order_by('-fecha_registro')
        total = qs.count()
        items = qs[(page - 1) * page_size:page * page_size]
        return PaginatedProrrogaDocType(items=items, total_count=total)


class Mutation(graphene.ObjectType):
    login_2fa = Login2FA.Field()
    verify_2fa = Verify2FA.Field()
    verify_token = graphql_jwt.Verify.Field()
    refresh_token = graphql_jwt.Refresh.Field()

    create_user = CreateUser.Field()
    update_user = UpdateUser.Field()
    delete_user = DeleteUser.Field()
    create_group = CreateGroup.Field()

    registrar_usuario_persona = RegistrarUsuarioPersona.Field()
    crear_ambiente = CrearAmbiente.Field()
    editar_ambiente = EditarAmbiente.Field()
    crear_estante = CrearEstante.Field()
    editar_estante = EditarEstante.Field()
    crear_piso = CrearPiso.Field()
    editar_piso = EditarPiso.Field()
    crear_carpeta = CrearCarpeta.Field()
    editar_carpeta = EditarCarpeta.Field()
    crear_documento = CrearDocumento.Field()
    editar_documento = EditarDocumento.Field()
    registrar_prestamo = RegistrarPrestamo.Field()
    registrar_devolucion = RegistrarDevolucion.Field()
    registrar_devolucion_con_documentos = RegistrarDevolucionConDocumentos.Field()
    crear_incidente = CrearIncidente.Field()
    resolver_incidente = ResolverIncidente.Field()
    resolver_carpetas = ResolverCarpetas.Field()
    registrar_prorroga = RegistrarProrroga.Field()
    registrar_prestamo_doc = RegistrarPrestamoDoc.Field()
    registrar_devolucion_doc = RegistrarDevolucionDoc.Field()
    registrar_prorroga_doc = RegistrarProrrogaDoc.Field()
    crear_persona = CrearPersona.Field()
    actualizar_persona = ActualizarPersona.Field()
    actualizar_perfil = ActualizarPerfil.Field()

    reset_user_2fa = ResetUser2FA.Field()
    asignar_ambientes = AsignarAmbientes.Field()
    registrar_traspaso = RegistrarTraspaso.Field()
    ubicar_carpetas = UbicarCarpetas.Field()
    crear_bloqueo = CrearBloqueo.Field()
    desbloquear_persona = DesbloquearPersona.Field()
    registrar_retiro = RegistrarRetiro.Field()
    generate_reset_code = GenerateResetCode.Field()
    verify_reset_code = VerifyResetCode.Field()
    set_new_password = SetNewPassword.Field()
    forzar_cierre_sesion = ForzarCierreSesion.Field()
    toggle_bypass_2fa = ToggleBypass2FA.Field()
    marcar_notificaciones_leidas = MarcarNotificacionesLeidas.Field()

schema = graphene.Schema(query=Query, mutation=Mutation)
