from django.core.management.base import BaseCommand
from django.contrib.sessions.models import Session
from django.db import transaction

from api.models import (
    Ambiente, AsignacionAmbiente, Bloqueo, Carpeta, DetalleIncidente,
    Devolucion, DevolucionDoc, DevolucionDocumento, Documento, Estante,
    Incidente, Notification, Persona, Piso, Prestamo, PrestamoCarpeta,
    PrestamoDoc, PrestamoDocItem, Prorroga, ProrrogaDoc, Retiro,
    TempToken, Traspaso, TraspasoCarpeta,
)

TABLES_IN_ORDER = [
    (DetalleIncidente, 'DetalleIncidente'),
    (DevolucionDocumento, 'DevolucionDocumento'),
    (DevolucionDoc, 'DevolucionDoc'),
    (ProrrogaDoc, 'ProrrogaDoc'),
    (PrestamoDocItem, 'PrestamoDocItem'),
    (PrestamoDoc, 'PrestamoDoc'),
    (Devolucion, 'Devolucion'),
    (Prorroga, 'Prorroga'),
    (PrestamoCarpeta, 'PrestamoCarpeta'),
    (Prestamo, 'Prestamo'),
    (TraspasoCarpeta, 'TraspasoCarpeta'),
    (Traspaso, 'Traspaso'),
    (AsignacionAmbiente, 'AsignacionAmbiente'),
    (Retiro, 'Retiro'),
    (Bloqueo, 'Bloqueo'),
    (Incidente, 'Incidente'),
    (Documento, 'Documento'),
    (Carpeta, 'Carpeta'),
    (Piso, 'Piso'),
    (Estante, 'Estante'),
    (Ambiente, 'Ambiente'),
    (Persona, 'Persona'),
    (TempToken, 'TempToken'),
    (Notification, 'Notification'),
    (Session, 'django_session'),
]


class Command(BaseCommand):
    help = 'Limpia toda la base de datos excepto cuentas de usuario (User, Perfil, Group, Permission)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Ejecutar sin pedir confirmación',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('=== LIMPIEZA DE DATOS ==='))
        self.stdout.write('Se eliminarán todos los registros de las siguientes tablas:\n')

        total = 0
        counts = []
        for model, label in TABLES_IN_ORDER:
            cnt = model.objects.count()
            counts.append((model, label, cnt))
            total += cnt
            self.stdout.write(f'  {label}: {cnt} registros')

        self.stdout.write(f'\nTotal a eliminar: {total} registros')

        if total == 0:
            self.stdout.write(self.style.SUCCESS('No hay datos que limpiar.'))
            return

        if not options['force']:
            self.stdout.write()
            answer = input('¿Continuar? (s/N): ').strip().lower()
            if answer != 's':
                self.stdout.write(self.style.WARNING('Operación cancelada.'))
                return

        with transaction.atomic():
            deleted_total = 0
            for model, label, cnt in counts:
                if cnt == 0:
                    continue
                model.objects.all().delete()
                deleted_total += cnt
                self.stdout.write(f'  OK {label}: {cnt} registros eliminados')

        self.stdout.write(self.style.SUCCESS(f'\nLimpieza completada. {deleted_total} registros eliminados.'))
