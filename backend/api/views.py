import json
import socket
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods, require_GET
from .models import Devolucion, DevolucionDoc, Prestamo, PrestamoDoc


def get_local_ip():
    try:
        hostname = socket.gethostname()
        ip = socket.gethostbyname(hostname)
        if not ip.startswith('127.') and not ip.startswith('169.254.'):
            return ip
    except Exception:
        pass

    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        result = s.getsockname()[0]
        if not result.startswith('169.254.'):
            return result
    except Exception:
        pass
    finally:
        s.close()
    return '127.0.0.1'


@csrf_exempt
@require_GET
def server_ip(request):
    return JsonResponse({'ip': get_local_ip()})


@csrf_exempt
@require_GET
def serve_firma_image(request, token):
    obj = (Devolucion.objects.filter(token_firma=token).first() or
           DevolucionDoc.objects.filter(token_firma=token).first() or
           Prestamo.objects.filter(token_firma=token).first() or
           PrestamoDoc.objects.filter(token_firma=token).first())
    if not obj or not obj.foto_firma:
        return HttpResponse(status=404)
    return HttpResponse(obj.foto_firma.read(), content_type='image/png')


@csrf_exempt
@require_http_methods(['GET', 'POST'])
def upload_firma(request, token):
    devolucion = Devolucion.objects.filter(token_firma=token).first()
    devolucion_doc = None
    prestamo = None
    prestamo_doc = None

    if not devolucion:
        devolucion_doc = DevolucionDoc.objects.filter(token_firma=token).first()
        if not devolucion_doc:
            prestamo = Prestamo.objects.filter(token_firma=token).first()
            if not prestamo:
                prestamo_doc = PrestamoDoc.objects.filter(token_firma=token).first()
                if not prestamo_doc:
                    return JsonResponse({'success': False, 'error': 'Token inválido'}, status=404)

    obj = devolucion or devolucion_doc or prestamo or prestamo_doc

    if request.method == 'GET':
        if obj.foto_firma:
            return JsonResponse({
                'success': True,
                'url': f'/api/firma/imagen/{token}/'
            })
        return JsonResponse({'success': False, 'error': 'Sin foto aún'}, status=404)

    if 'foto' not in request.FILES:
        return JsonResponse({'success': False, 'error': 'No se envió ninguna imagen'}, status=400)

    foto = request.FILES['foto']
    if not foto.content_type.startswith('image/'):
        return JsonResponse({'success': False, 'error': 'El archivo debe ser una imagen'}, status=400)

    obj.foto_firma = foto
    obj.save(update_fields=['foto_firma'])

    return JsonResponse({
        'success': True,
        'url': f'/api/firma/imagen/{token}/'
    })
