from django.db import migrations, models


def limpiar_estado(apps, schema_editor):
    Carpeta = apps.get_model('api', 'Carpeta')
    Carpeta.objects.filter(estado='True').update(estado='disponible')
    Carpeta.objects.filter(estado='False').update(estado='prestado')
    Carpeta.objects.filter(estado='1').update(estado='disponible')
    Carpeta.objects.filter(estado='0').update(estado='prestado')
    Carpeta.objects.filter(estado='true').update(estado='disponible')
    Carpeta.objects.filter(estado='false').update(estado='prestado')


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0009_devolucion'),
    ]

    operations = [
        migrations.AlterField(
            model_name='carpeta',
            name='estado',
            field=models.CharField(default='disponible', max_length=20),
        ),
        migrations.RunPython(limpiar_estado),
    ]
