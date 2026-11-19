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
