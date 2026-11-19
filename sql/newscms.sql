-- ============================================================================
-- NewsCMS - Estructura inicial de base de datos (MySQL / MariaDB)
-- Base de datos: newscms_db
-- ============================================================================

CREATE DATABASE IF NOT EXISTS newscms_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE newscms_db;

-- 1. Tabla de usuarios del sistema (administrador, editor, redactor)
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    usuario VARCHAR(60) NOT NULL,
    correo VARCHAR(150) NOT NULL,
    contrasena VARCHAR(255) NOT NULL,
    rol ENUM('administrador', 'editor', 'redactor') NOT NULL DEFAULT 'redactor',
    estado ENUM('activo', 'inactivo') NOT NULL DEFAULT 'activo',
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_usuarios_usuario (usuario),
    UNIQUE KEY uk_usuarios_correo (correo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabla de categorías de noticias
CREATE TABLE IF NOT EXISTS categorias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(80) NOT NULL,
    identificador VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255) NULL,
    UNIQUE KEY uk_categorias_identificador (identificador)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabla de etiquetas de noticias
CREATE TABLE IF NOT EXISTS etiquetas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(80) NOT NULL,
    identificador VARCHAR(100) NOT NULL,
    UNIQUE KEY uk_etiquetas_identificador (identificador)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Tabla principal de noticias
CREATE TABLE IF NOT EXISTS noticias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(200) NOT NULL,
    identificador VARCHAR(220) NOT NULL,
    resumen TEXT NULL,
    contenido LONGTEXT NOT NULL,
    categoria_id INT NOT NULL,
    autor_id INT NOT NULL,
    imagen VARCHAR(255) NULL,
    estado ENUM(
        'borrador',
        'pendiente_revision',
        'cambios_solicitados',
        'publicada',
        'archivada'
    ) NOT NULL DEFAULT 'borrador',
    es_destacada TINYINT(1) NOT NULL DEFAULT 0,
    es_ultima_hora TINYINT(1) NOT NULL DEFAULT 0,
    fecha_publicacion DATETIME NULL,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_noticias_identificador (identificador),
    KEY idx_noticias_estado (estado),
    KEY idx_noticias_categoria (categoria_id),
    KEY idx_noticias_autor (autor_id),
    KEY idx_noticias_fecha_pub (fecha_publicacion),
    CONSTRAINT fk_noticias_categoria
        FOREIGN KEY (categoria_id) REFERENCES categorias (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_noticias_autor
        FOREIGN KEY (autor_id) REFERENCES usuarios (id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Tabla intermedia entre noticias y etiquetas
CREATE TABLE IF NOT EXISTS noticias_etiquetas (
    noticia_id INT NOT NULL,
    etiqueta_id INT NOT NULL,
    PRIMARY KEY (noticia_id, etiqueta_id),
    CONSTRAINT fk_ne_noticia
        FOREIGN KEY (noticia_id) REFERENCES noticias (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_ne_etiqueta
        FOREIGN KEY (etiqueta_id) REFERENCES etiquetas (id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Tabla de revisiones editoriales
CREATE TABLE IF NOT EXISTS revisiones_editoriales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    noticia_id INT NOT NULL,
    editor_id INT NOT NULL,
    accion VARCHAR(50) NOT NULL,
    observaciones TEXT NULL,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_revisiones_noticia (noticia_id),
    KEY idx_revisiones_editor (editor_id),
    CONSTRAINT fk_rev_noticia
        FOREIGN KEY (noticia_id) REFERENCES noticias (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_rev_editor
        FOREIGN KEY (editor_id) REFERENCES usuarios (id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Categorías predeterminadas (evita duplicados si ya existen)
INSERT IGNORE INTO categorias (nombre, identificador, descripcion) VALUES
('Actualidad', 'actualidad', 'Noticias de interés general y acontecimientos recientes.'),
('Tecnología', 'tecnologia', 'Avances tecnológicos, software, innovación y ciencia.'),
('Deportes', 'deportes', 'Información sobre competencias, resultados y disciplinas deportivas.'),
('Economía', 'economia', 'Finanzas, mercados, emprendimiento y desarrollo económico.'),
('Entretenimiento', 'entretenimiento', 'Cultura, cine, música y espectáculos.');

-- 7. Tabla de complementos (plugins) instalados en el sistema
CREATE TABLE IF NOT EXISTS complementos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    identificador VARCHAR(80) NOT NULL,
    descripcion VARCHAR(255) NULL,
    version VARCHAR(30) NOT NULL,
    zona VARCHAR(60) NOT NULL DEFAULT 'portada_inferior',
    archivo_js VARCHAR(120) NOT NULL DEFAULT 'principal.js',
    archivo_css VARCHAR(120) NULL,
    activo TINYINT(1) NOT NULL DEFAULT 0,
    fecha_instalacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_complementos_identificador (identificador)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Tabla de enlaces para el complemento Feed de Redes Sociales
CREATE TABLE IF NOT EXISTS enlaces_sociales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    plataforma ENUM('Facebook', 'Instagram', 'TikTok', 'X') NOT NULL,
    titulo VARCHAR(120) NOT NULL,
    descripcion VARCHAR(255) NULL,
    url VARCHAR(500) NOT NULL,
    visible TINYINT(1) NOT NULL DEFAULT 1,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_enlaces_visible (visible)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Tabla de anuncios para el complemento Gestor de Publicidad
CREATE TABLE IF NOT EXISTS anuncios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(120) NOT NULL,
    descripcion VARCHAR(255) NULL,
    imagen VARCHAR(255) NOT NULL,
    enlace VARCHAR(500) NOT NULL,
    visible TINYINT(1) NOT NULL DEFAULT 1,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_anuncios_visible (visible)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Tabla de suscriptores del complemento Newsletter
CREATE TABLE IF NOT EXISTS suscriptores_newsletter (
    id INT AUTO_INCREMENT PRIMARY KEY,
    correo VARCHAR(150) NOT NULL,
    estado ENUM('activo', 'inactivo') NOT NULL DEFAULT 'activo',
    token_baja VARCHAR(64) NOT NULL,
    fecha_registro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_baja DATETIME NULL,
    UNIQUE KEY uk_newsletter_correo (correo),
    UNIQUE KEY uk_newsletter_token (token_baja),
    KEY idx_newsletter_estado (estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Tabla de boletines del complemento Newsletter
CREATE TABLE IF NOT EXISTS boletines_newsletter (
    id INT AUTO_INCREMENT PRIMARY KEY,
    asunto VARCHAR(180) NOT NULL,
    contenido TEXT NOT NULL,
    estado ENUM('borrador', 'enviado') NOT NULL DEFAULT 'borrador',
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_envio DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Tabla de visitantes autenticados mediante proveedor social (Google)
CREATE TABLE IF NOT EXISTS usuarios_sociales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    proveedor VARCHAR(30) NOT NULL DEFAULT 'google',
    proveedor_id VARCHAR(120) NOT NULL,
    nombre VARCHAR(120) NOT NULL,
    correo VARCHAR(150) NULL,
    fecha_registro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_social_proveedor_id (proveedor, proveedor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Tabla de comentarios de noticias
CREATE TABLE IF NOT EXISTS comentarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    noticia_id INT NOT NULL,
    usuario_social_id INT NOT NULL,
    contenido TEXT NOT NULL,
    estado ENUM('pendiente', 'aprobado', 'rechazado') NOT NULL DEFAULT 'pendiente',
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_revision DATETIME NULL,
    KEY idx_comentarios_noticia_estado (noticia_id, estado),
    KEY idx_comentarios_usuario (usuario_social_id),
    CONSTRAINT fk_comentarios_noticia
        FOREIGN KEY (noticia_id) REFERENCES noticias (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_comentarios_usuario
        FOREIGN KEY (usuario_social_id) REFERENCES usuarios_sociales (id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. Tabla de temas visuales instalados en el sistema
CREATE TABLE IF NOT EXISTS temas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    identificador VARCHAR(80) NOT NULL,
    descripcion VARCHAR(255) NULL,
    version VARCHAR(30) NOT NULL,
    archivo_css VARCHAR(120) NOT NULL DEFAULT 'tema.css',
    activo TINYINT(1) NOT NULL DEFAULT 0,
    fecha_instalacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_temas_identificador (identificador)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. Tabla de configuración general del portal
CREATE TABLE IF NOT EXISTS configuracion (
    clave VARCHAR(80) PRIMARY KEY,
    valor TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO configuracion (clave, valor) VALUES
('nombre_portal', 'NewsCMS'),
('subtitulo_portal', 'Portal informativo universitario'),
('descripcion_portal', 'Sistema de gestión de contenidos de noticias desarrollado con HTML5, CSS3, JavaScript, PHP nativo y MySQL.'),
('texto_pie_pagina', 'Sistema de gestión de contenidos de noticias desarrollado sin frameworks con HTML5, CSS3, JavaScript, PHP y MySQL.'),
('correo_contacto', '');

-- 16. Tabla de permisos editoriales por rol
CREATE TABLE IF NOT EXISTS permisos_roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rol ENUM('administrador', 'editor', 'redactor') NOT NULL,
    permiso VARCHAR(60) NOT NULL,
    permitido TINYINT(1) NOT NULL DEFAULT 0,
    UNIQUE KEY uk_rol_permiso (rol, permiso)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO permisos_roles (rol, permiso, permitido) VALUES
-- Administrador (todos activos)
('administrador', 'ver_dashboard', 1),
('administrador', 'crear_noticias', 1),
('administrador', 'consultar_noticias_propias', 1),
('administrador', 'consultar_noticias_ajenas', 1),
('administrador', 'editar_noticias_propias', 1),
('administrador', 'editar_noticias_ajenas', 1),
('administrador', 'enviar_revision', 1),
('administrador', 'publicar_noticias', 1),
('administrador', 'consultar_revision', 1),
('administrador', 'aprobar_noticias', 1),
('administrador', 'solicitar_correcciones', 1),
('administrador', 'gestionar_categorias', 1),
('administrador', 'gestionar_etiquetas', 1),
-- Editor (todos los permisos editoriales iniciales activos)
('editor', 'ver_dashboard', 1),
('editor', 'crear_noticias', 1),
('editor', 'consultar_noticias_propias', 1),
('editor', 'consultar_noticias_ajenas', 1),
('editor', 'editar_noticias_propias', 1),
('editor', 'editar_noticias_ajenas', 1),
('editor', 'enviar_revision', 1),
('editor', 'publicar_noticias', 1),
('editor', 'consultar_revision', 1),
('editor', 'aprobar_noticias', 1),
('editor', 'solicitar_correcciones', 1),
('editor', 'gestionar_categorias', 1),
('editor', 'gestionar_etiquetas', 1),
-- Redactor (permisos iniciales de redacción propia)
('redactor', 'ver_dashboard', 1),
('redactor', 'crear_noticias', 1),
('redactor', 'consultar_noticias_propias', 1),
('redactor', 'consultar_noticias_ajenas', 0),
('redactor', 'editar_noticias_propias', 1),
('redactor', 'editar_noticias_ajenas', 0),
('redactor', 'enviar_revision', 1),
('redactor', 'publicar_noticias', 0),
('redactor', 'consultar_revision', 0),
('redactor', 'aprobar_noticias', 0),
('redactor', 'solicitar_correcciones', 0),
('redactor', 'gestionar_categorias', 0),
('redactor', 'gestionar_etiquetas', 0);
