-- ============================================================
-- SISTEMA DE ARCHIVO - ESQUEMA DE BASE DE DATOS
-- ============================================================
-- RELACIONES:
--
-- Ambiente (1) ---< (N) Estante
--   Estante (1) ---< (N) Piso
--     Piso (1) ---< (N) Carpeta
--       Carpeta (1) ---< (N) Documento
--
-- Persona (1) ---< (N) Prestamo  (persona_id: quien recibe)
-- Persona (1) ---< (N) Prestamo  (autorizado_por_id: quien autoriza)
-- User (1) ---< (N) Prestamo     (usuario_id: quien registra)
--
-- Prestamo (1) ---< (N) PrestamoCarpeta >--- (1) Carpeta
--   PrestamoCarpeta (1) ---< (N) Devolucion
--     User (1) ---< (N) Devolucion            (usuario_id: quien registra)
--
-- Prestamo (1) ---< (N) Prorroga
--
-- User (1) ---< (N) Incidente
--   Incidente (1) ---< (N) DetalleIncidente >--- (1) Carpeta
--
-- User (1) ---< (N) Bloqueo
--   Persona (1) ---< (N) Bloqueo
--
-- User (1) --- (1) Perfil  (2FA)
-- ============================================================

CREATE TABLE auth_user (
    id INT PRIMARY KEY,
    username VARCHAR(150) NOT NULL,
    email VARCHAR(254) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE api_persona (
    id INT PRIMARY KEY,
    ci VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    telefono VARCHAR(20),
    email VARCHAR(100),
    direccion VARCHAR(255),
    fecha_naci DATE,
    cargo VARCHAR(100),
    CONSTRAINT fk_persona_self FOREIGN KEY (id) REFERENCES api_persona(id)
);

CREATE TABLE api_ambiente (
    id INT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    ubicacion VARCHAR(100),
    descripcion VARCHAR(255)
);

CREATE TABLE api_estante (
    id INT PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL,
    numero INT,
    descripcion VARCHAR(255),
    estado VARCHAR(20),
    limite_pisos INT,
    ambiente_id INT NOT NULL,
    CONSTRAINT fk_estante_ambiente FOREIGN KEY (ambiente_id) REFERENCES api_ambiente(id) ON DELETE CASCADE
);

CREATE TABLE api_piso (
    id INT PRIMARY KEY,
    nro_fila INT NOT NULL,
    descripcion VARCHAR(255),
    estante_id INT NOT NULL,
    CONSTRAINT fk_piso_estante FOREIGN KEY (estante_id) REFERENCES api_estante(id) ON DELETE CASCADE
);

CREATE TABLE api_carpeta (
    id INT PRIMARY KEY,
    descripcion VARCHAR(255),
    fecha_crea TIMESTAMP NOT NULL DEFAULT NOW(),
    estado VARCHAR(20) NOT NULL DEFAULT 'disponible',
    piso_id INT NOT NULL,
    CONSTRAINT fk_carpeta_piso FOREIGN KEY (piso_id) REFERENCES api_piso(id) ON DELETE CASCADE
);

CREATE TABLE api_documento (
    id INT PRIMARY KEY,
    codigo_doc VARCHAR(50) NOT NULL,
    titulo VARCHAR(150) NOT NULL,
    tipo_doc VARCHAR(50) NOT NULL,
    fecha_ingre TIMESTAMP NOT NULL DEFAULT NOW(),
    carpeta_id INT NOT NULL,
    CONSTRAINT fk_documento_carpeta FOREIGN KEY (carpeta_id) REFERENCES api_carpeta(id) ON DELETE CASCADE
);

CREATE TABLE api_incidente (
    id INT PRIMARY KEY,
    tipo_inci VARCHAR(50) NOT NULL,
    fecha_reporte TIMESTAMP NOT NULL DEFAULT NOW(),
    estado BOOLEAN NOT NULL DEFAULT TRUE,
    usuario_id INT NOT NULL,
    CONSTRAINT fk_incidente_usuario FOREIGN KEY (usuario_id) REFERENCES auth_user(id) ON DELETE CASCADE
);

CREATE TABLE api_detalleincidente (
    id INT PRIMARY KEY,
    descripcion VARCHAR(255),
    incidente_id INT NOT NULL,
    carpeta_id INT NOT NULL,
    CONSTRAINT fk_detalle_incidente FOREIGN KEY (incidente_id) REFERENCES api_incidente(id) ON DELETE CASCADE,
    CONSTRAINT fk_detalle_carpeta FOREIGN KEY (carpeta_id) REFERENCES api_carpeta(id) ON DELETE CASCADE
);

CREATE TABLE api_bloqueo (
    id INT PRIMARY KEY,
    fecha_bloq TIMESTAMP NOT NULL DEFAULT NOW(),
    motivo_bloq VARCHAR(255) NOT NULL,
    fecha_desbloq TIMESTAMP,
    usuario_id INT NOT NULL,
    persona_id INT,
    CONSTRAINT fk_bloqueo_usuario FOREIGN KEY (usuario_id) REFERENCES auth_user(id) ON DELETE CASCADE,
    CONSTRAINT fk_bloqueo_persona FOREIGN KEY (persona_id) REFERENCES api_persona(id) ON DELETE CASCADE
);

CREATE TABLE api_prestamo (
    id INT PRIMARY KEY,
    fecha_prest TIMESTAMP NOT NULL DEFAULT NOW(),
    fecha_devolucion TIMESTAMP NOT NULL,
    observaciones VARCHAR(255),
    persona_id INT NOT NULL,
    usuario_id INT,
    autorizado_por_id INT,
    CONSTRAINT fk_prestamo_persona FOREIGN KEY (persona_id) REFERENCES api_persona(id) ON DELETE CASCADE,
    CONSTRAINT fk_prestamo_usuario FOREIGN KEY (usuario_id) REFERENCES auth_user(id) ON DELETE SET NULL,
    CONSTRAINT fk_prestamo_autorizador FOREIGN KEY (autorizado_por_id) REFERENCES api_persona(id) ON DELETE SET NULL
);

CREATE TABLE api_prestamocarpeta (
    id INT PRIMARY KEY,
    fecha_devol TIMESTAMP,
    estado VARCHAR(20) NOT NULL DEFAULT 'prestado',
    observaciones VARCHAR(255),
    prestamo_id INT NOT NULL,
    carpeta_id INT NOT NULL,
    CONSTRAINT fk_prestamo_carpeta_prestamo FOREIGN KEY (prestamo_id) REFERENCES api_prestamo(id) ON DELETE CASCADE,
    CONSTRAINT fk_prestamo_carpeta_carpeta FOREIGN KEY (carpeta_id) REFERENCES api_carpeta(id) ON DELETE CASCADE
);

CREATE TABLE api_devolucion (
    id INT PRIMARY KEY,
    fecha_devol TIMESTAMP NOT NULL DEFAULT NOW(),
    observaciones VARCHAR(255),
    prestamo_carpeta_id INT NOT NULL,
    usuario_id INT,
    CONSTRAINT fk_devolucion_prestamo_carpeta FOREIGN KEY (prestamo_carpeta_id) REFERENCES api_prestamocarpeta(id) ON DELETE CASCADE,
    CONSTRAINT fk_devolucion_usuario FOREIGN KEY (usuario_id) REFERENCES auth_user(id) ON DELETE SET NULL
);

CREATE TABLE api_prorroga (
    id INT PRIMARY KEY,
    fecha_solici TIMESTAMP NOT NULL DEFAULT NOW(),
    dias_solicit INT NOT NULL,
    estado VARCHAR(20) NOT NULL,
    fecha_aprobado DATE,
    motivo VARCHAR(255),
    prestamo_id INT NOT NULL,
    CONSTRAINT fk_prorroga_prestamo FOREIGN KEY (prestamo_id) REFERENCES api_prestamo(id) ON DELETE CASCADE
);

CREATE TABLE api_perfil (
    id INT PRIMARY KEY,
    secreto_2fa VARCHAR(32),
    is_2fa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    user_id INT NOT NULL UNIQUE,
    CONSTRAINT fk_perfil_usuario FOREIGN KEY (user_id) REFERENCES auth_user(id) ON DELETE CASCADE
);