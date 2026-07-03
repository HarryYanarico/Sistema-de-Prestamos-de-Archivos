import uuid
from django.core.management.base import BaseCommand
from api.models import Devolucion


class Command(BaseCommand):
    help = 'Genera token_firma para devoluciones que no tienen uno'

    def handle(self, *args, **options):
        qs = Devolucion.objects.filter(token_firma__isnull=True)
        count = qs.count()
        if count == 0:
            self.stdout.write(self.style.SUCCESS('No hay devoluciones sin token_firma.'))
            return

        updated = 0
        for dev in qs.iterator():
            dev.token_firma = uuid.uuid4()
            dev.save(update_fields=['token_firma'])
            updated += 1
            if updated % 100 == 0:
                self.stdout.write(f'  {updated}/{count}...')

        self.stdout.write(self.style.SUCCESS(f'✅ {updated} token(s) generado(s) correctamente.'))
