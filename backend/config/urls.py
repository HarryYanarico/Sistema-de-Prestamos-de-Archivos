from django.contrib import admin
from django.urls import path
from django.conf import settings
from django.conf.urls.static import static
from django.views.decorators.csrf import csrf_exempt
from graphene_django.views import GraphQLView
from api.views import upload_firma, server_ip, serve_firma_image

urlpatterns = [
    path('admin/', admin.site.urls),
    path('graphql/', csrf_exempt(GraphQLView.as_view(graphiql=True))),
    path('api/upload-firma/<uuid:token>/', upload_firma, name='upload_firma'),
    path('api/firma/imagen/<uuid:token>/', serve_firma_image, name='serve_firma_image'),
    path('api/server-ip/', server_ip, name='server_ip'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
