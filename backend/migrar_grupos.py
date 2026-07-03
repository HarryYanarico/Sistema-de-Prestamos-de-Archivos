"""
Migración de grupos y permisos.
Ejecutar: python manage.py shell < migrar_grupos.py

Cambios:
  - "Administrativo" → "Archivista" (con permisos ampliados)
  - "Operador": permisos reducidos (sin ver_dashboard, sin docs/traspasos/ubicaciones)
  - Nuevo grupo "Consultor": solo ver_dashboard
  - Elimina grupo "admin" (vacío, legacy)
"""
from django.contrib.auth.models import Group, Permission


def run():
    print("Migrando grupos...")

    # 1. Renombrar "Administrativo" → "Archivista"
    try:
        old = Group.objects.get(name="Administrativo")
        old.name = "Archivista"
        old.save()
        print("  [OK] Grupo 'Administrativo' renombrado a 'Archivista'")
    except Group.DoesNotExist:
        print("  [~] Grupo 'Administrativo' no existe, se creará 'Archivista'")

    # 2. Actualizar permisos de Archivista
    arch_group, _ = Group.objects.get_or_create(name="Archivista")
    arch_perms = Permission.objects.filter(
        content_type__app_label='api',
        codename__in=[
            'gestionar_carpetas', 'gestionar_documentos',
            'gestionar_prestamos', 'gestionar_devoluciones', 'gestionar_traspasos',
            'gestionar_ubicaciones', 'gestionar_personas', 'gestionar_bloqueos',
            'gestionar_prorrogas',
            'ver_dashboard',
        ]
    )
    arch_group.permissions.set(arch_perms)
    print(f"  [OK] Archivista actualizado: {arch_perms.count()} permisos")

    # 3. Actualizar permisos de Operador
    op_group, _ = Group.objects.get_or_create(name="Operador")
    op_perms = Permission.objects.filter(
        content_type__app_label='api',
        codename__in=[
            'gestionar_carpetas',
            'gestionar_prestamos',
            'gestionar_devoluciones',
            'gestionar_personas',
        ]
    )
    op_group.permissions.set(op_perms)
    print(f"  [OK] Operador actualizado: {op_perms.count()} permisos (sin dashboard)")

    # 4. Crear grupo Consultor
    consultor_group, _ = Group.objects.get_or_create(name="Consultor")
    consultor_perms = Permission.objects.filter(
        content_type__app_label='api',
        codename__in=['ver_dashboard']
    )
    consultor_group.permissions.set(consultor_perms)
    print(f"  [OK] Consultor creado: {consultor_perms.count()} permisos (solo dashboard)")

    # 5. Eliminar grupo "admin" legacy (vacío)
    try:
        admin_legacy = Group.objects.get(name="admin")
        if admin_legacy.user_set.count() == 0:
            admin_legacy.delete()
            print("  [OK] Grupo legacy 'admin' eliminado (estaba vacío)")
        else:
            print(f"  [~] Grupo 'admin' tiene {admin_legacy.user_set.count()} usuarios, no se elimina")
    except Group.DoesNotExist:
        print("  [~] Grupo legacy 'admin' no existe")

    # 6. Mostrar resumen
    print("\n--- RESULTADO ---")
    grupos = Group.objects.all().order_by('name')
    for g in grupos:
        perms = g.permissions.filter(content_type__app_label='api').count()
        usuarios = g.user_set.count()
        print(f"  {g.name}: {perms} permisos api, {usuarios} usuario(s)")

    print("\n✅ Migración completada!")


if __name__ == "__main__":
    run()
