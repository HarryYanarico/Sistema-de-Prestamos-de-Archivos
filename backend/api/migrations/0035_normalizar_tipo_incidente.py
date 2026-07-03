from django.db import migrations


def actualizar_tipos(apps, schema_editor):
    Incidente = apps.get_model('api', 'Incidente')
    Incidente.objects.filter(tipo_inci='Danado').update(tipo_inci='Dañado')
    Incidente.objects.filter(tipo_inci='Daño').update(tipo_inci='Dañado')


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0034_prestamo_foto_firma_prestamo_token_firma'),
    ]

    operations = [
        migrations.RunPython(actualizar_tipos),
    ]