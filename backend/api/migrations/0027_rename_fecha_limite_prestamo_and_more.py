from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0026_bloqueo_motivo_desbloq'),
    ]

    operations = [
        migrations.RenameField(
            model_name='prestamo',
            old_name='fecha_limite',
            new_name='fecha_devolucion',
        ),
        migrations.RenameField(
            model_name='prestamodoc',
            old_name='fecha_limite',
            new_name='fecha_devolucion',
        ),
    ]
