import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0002_remove_prestamo_carpeta_prestamo_carpetas'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='prestamo',
            name='carpetas',
        ),
        migrations.RemoveField(
            model_name='prestamo',
            name='estado',
        ),
        migrations.RemoveField(
            model_name='prestamo',
            name='fecha_devol',
        ),
        migrations.CreateModel(
            name='PrestamoCarpeta',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('fecha_devol', models.DateField(blank=True, null=True)),
                ('estado', models.CharField(default='prestado', max_length=20)),
                ('observaciones', models.CharField(blank=True, max_length=255, null=True)),
                ('carpeta', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='api.carpeta')),
                ('prestamo', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='api.prestamo')),
            ],
        ),
        migrations.AddField(
            model_name='prestamo',
            name='carpetas',
            field=models.ManyToManyField(related_name='prestamos', through='api.PrestamoCarpeta', to='api.carpeta'),
        ),
    ]
