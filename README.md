# Sistema Archivo

![Django](https://img.shields.io/badge/Django-5.2-092E20?style=flat&logo=django&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=flat&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat&logo=postgresql&logoColor=white)
![GraphQL](https://img.shields.io/badge/GraphQL-E10098?style=flat&logo=graphql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat&logo=docker&logoColor=white)

Sistema web fullstack para la gestión documental física de instituciones. Administra el registro de carpetas, documentos, préstamos, devoluciones, traspasos entre ubicaciones, incidentes, bloqueos a personas que solicitan prestamo y reportes con autenticación de inicio de seccion basado en JWT + 2FA.

---

## Funcionalidades

- **Gestión de ubicaciones físicas** — CRUD de ambientes, estantes, pisos y carpetas en jerarquía jerárquica
- **Gestión de documentos** — Crear, editar y organizar documentos dentro de carpetas
- **Préstamos de carpetas** — Registrar préstamos con firma digital (QR + foto), fechas y observaciones
- **Préstamos de documentos** — Préstamo individual de documentos con seguimiento propio
- **Devoluciones** — Verificar estado de documentos al momento de la devolución
- **Prórrogas** — Extensiones de plazo para préstamos vencidos o próximos a vencer
- **Traspasos** — Transferir carpetas entre ambientes con registro y ubicación
- **Incidentes** — Reportar y detallar incidentes sobre carpetas
- **Bloqueos** — Bloquear y desbloquear personas que no cumplen con devoluciones
- **Retiros** — Registrar retiros definitivos de carpetas con motivo y autorización
- **Sistema de usuarios** — Gestión de usuarios con 12 permisos granulares y roles/grupos
- **Autenticación 2FA** — Verificación en dos pasos (TOTP) con bypass temporal para administradores
- **Dashboard y reportes** — Visualización de métricas y exportación a PDF/Excel
- **Notificaciones** — Alertas en tiempo real sobre préstamos, vencimientos y más

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend | Python 3.11, Django 5.2 |
| API | GraphQL (Graphene-Django) |
| Base de datos | PostgreSQL 16 |
| Frontend | React 19, TypeScript 6.0 |
| Bundler | Vite 8 |
| Estilos | TailwindCSS 3.4 |
| Cliente GraphQL | Apollo Client 4 |
| Router | React Router 7 |
| Auth | JWT (graphql-jwt) + Refresh Tokens |
| 2FA | TOTP (pyotp) |
| Almacenamiento | MinIO (S3-compatible) / Sistema local |
| Proxy | Nginx |
| Contenedorización | Docker Compose |

## Arquitectura

```
Sistema Archivo/
├── backend/
│   ├── api/
│   │   ├── models.py          # Modelos de datos (20+ entidades)
│   │   ├── schema.py          # Schema GraphQL (queries y mutations)
│   │   ├── views.py           # Vistas REST (firmas, IP del servidor)
│   │   ├── signals.py         # Señales de Django
│   │   ├── auth_backends.py   # Backend de autenticación por email
│   │   └── services/
│   │       ├── otp_service.py   # Servicio de 2FA/OTP
│   │       └── email_service.py # Servicio de correo electrónico
│   ├── config/
│   │   ├── settings.py        # Configuración de Django
│   │   └── urls.py            # URLs del proyecto
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/             # 21 páginas (Dashboard, CRUDs, Login, etc.)
│   │   ├── components/        # Componentes reutilizables
│   │   ├── context/           # Context de React (auth, notificaciones)
│   │   ├── lib/               # Configuración de Apollo Client
│   │   └── utils/             # Utilidades y helpers
│   ├── nginx.conf
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
├── .env.template
└── dev.bat
```

## Prerrequisitos

- **Python 3.11+**
- **Node.js 20+** y npm
- **PostgreSQL 16** (o usar Docker)
- **Docker y Docker Compose** (opcional, para despliegue completo)

## Instalación y Configuración

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/sistema-archivo.git
cd sistema-archivo
```

### 2. Configurar variables de entorno

```bash
cp .env.template .env
```

Edita el archivo `.env` con tus credenciales. Ver la sección [Variables de Entorno](#variables-de-entorno) para más detalles.

### 3. Backend (Django)

```bash
cd backend

# Crear entorno virtual
python -m venv venv

# Activar entorno virtual
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt

# Ejecutar migraciones
python manage.py migrate

# Crear superusuario
python manage.py createsuperuser

# Iniciar servidor de desarrollo
python manage.py runserver
```

El backend estará disponible en `http://localhost:8000/graphql/`

### 4. Frontend (React)

```bash
cd frontend

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

El frontend estará disponible en `http://localhost:5173`

### 5. Desarrollo rápido (Windows)

Ejecuta `dev.bat` desde la raíz del proyecto para iniciar backend y frontend simultáneamente:

```bash
dev.bat
```

### 6. Docker (alternativa)

```bash
# Construir y levantar todos los servicios
docker-compose up -d

# Ver logs
docker-compose logs -f
```

Esto levantará:
- **Frontend** en `http://localhost:80`
- **Backend** en `http://localhost:8000`
- **PostgreSQL** en `localhost:5432`
- **MinIO** (consola) en `http://localhost:9001`

## Variables de Entorno

| Variable | Descripción | Valor por defecto |
|----------|------------|-------------------|
| `DEBUG` | Modo debug de Django | `False` |
| `SECRET_KEY` | Clave secreta de Django (cambiar en producción) | — |
| `ALLOWED_HOSTS` | Hosts permitidos | `*` |
| `CORS_ALLOW_ALL_ORIGINS` | Permitir todos los orígenes CORS | `True` |
| `DB_NAME` | Nombre de la base de datos | `bd_archivo` |
| `DB_USER` | Usuario de PostgreSQL | `postgres` |
| `DB_PASSWORD` | Contraseña de PostgreSQL | — |
| `DB_HOST` | Host de PostgreSQL | `db` |
| `DB_PORT` | Puerto de PostgreSQL | `5432` |
| `EMAIL_HOST` | Servidor SMTP | — |
| `EMAIL_PORT` | Puerto SMTP | `587` |
| `EMAIL_HOST_USER` | Usuario SMTP | — |
| `EMAIL_HOST_PASSWORD` | Contraseña SMTP | — |
| `DEFAULT_FROM_EMAIL` | Email remitente por defecto | — |
| `MINIO_ENDPOINT_URL` | URL de MinIO (solo producción) | — |
| `MINIO_ROOT_USER` | Usuario de MinIO | `minioadmin` |
| `MINIO_ROOT_PASSWORD` | Contraseña de MinIO | `minioadmin` |
| `MINIO_BUCKET_NAME` | Bucket de MinIO | `archivo-firmas` |
| `VITE_GRAPHQL_URI` | URL del endpoint GraphQL para el frontend | `/graphql/` |

## Estructura de Permisos

El sistema cuenta con 12 permisos granulares que se asignan a usuarios individuales o a través de grupos:

| Permiso | Descripción |
|---------|-------------|
| `gestionar_carpetas` | Crear, editar y eliminar carpetas |
| `gestionar_documentos` | Crear, editar y eliminar documentos |
| `gestionar_prestamos` | Registrar y administrar préstamos |
| `gestionar_devoluciones` | Registrar devoluciones |
| `gestionar_traspasos` | Realizar traspasos entre ambientes |
| `gestionar_ubicaciones` | CRUD de ambientes, estantes y pisos |
| `gestionar_personas` | Administrar personas e instituciones |
| `gestionar_bloqueos` | Bloquear y desbloquear personas |
| `gestionar_prorrogas` | Otorgar extensiones de préstamo |
| `gestionar_retiros` | Registrar retiros de carpetas |
| `gestionar_usuarios` | Administrar usuarios del sistema |
| `ver_dashboard` | Acceso al dashboard y reportes |

## API

### GraphQL (principal)

- **Endpoint:** `/graphql/`
- **Auth:** JWT Bearer token en header `Authorization`
- **Playground:** Disponible en `/graphql/` cuando `DEBUG=True`

### REST (complementaria)

- `GET /api/firma/imagen/<token>/` — Obtener imagen de firma por token
- `POST /api/firma/subir/<token>/` — Subir foto de firma
- `GET /api/server-ip/` — Obtener IP del servidor

## Modelo de Datos

```
Ambiente → Estante → Piso → Carpeta → Documento
                                        ↓
                                    PrestamoCarpeta → Devolucion
                                    PrestamoDocItem → DevolucionDoc

Persona ←→ Prestamo / PrestamoDoc
Persona ←→ Bloqueo
Persona ←→ Retiro

Traspaso → TraspasoCarpeta
Incidente → DetalleIncidente
Usuario → Perfil (2FA, permisos)
```
## Capturas de Pantalla del sistema
Inicio de session:
<img width="1360" height="654" alt="image" src="https://github.com/user-attachments/assets/7a8b0d17-9dc0-45eb-a7c1-c8b8fd32cb86" />

Inicio:
<img width="1350" height="644" alt="image" src="https://github.com/user-attachments/assets/930e0d99-5c8e-4e43-88f1-b0b97e68b4da" />

Dashboard
<img width="1341" height="643" alt="image" src="https://github.com/user-attachments/assets/31e77148-b8ec-4c83-bb54-d439d0f61275" />




## Licencia

Este proyecto es privado. Todos los derechos reservados.
