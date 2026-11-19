-- Migración segura y reproducible: propuestas de actualización para noticias publicadas
CREATE TABLE IF NOT EXISTS actualizaciones_noticias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    noticia_id INT NOT NULL,
    autor_id INT NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    resumen TEXT NULL,
    contenido LONGTEXT NOT NULL,
    categoria_id INT NOT NULL,
    imagen VARCHAR(255) NULL,
    etiquetas_json TEXT NULL,
    es_destacada TINYINT(1) NOT NULL DEFAULT 0,
    es_ultima_hora TINYINT(1) NOT NULL DEFAULT 0,
    estado ENUM('borrador', 'pendiente_revision', 'cambios_solicitados', 'aprobada', 'descartada') NOT NULL DEFAULT 'borrador',
    observaciones TEXT NULL,
    editor_id INT NULL,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    fecha_revision DATETIME NULL,
    KEY idx_act_noticia_estado (noticia_id, estado),
    KEY idx_act_estado (estado),
    CONSTRAINT fk_act_noticia
        FOREIGN KEY (noticia_id) REFERENCES noticias (id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_act_autor
        FOREIGN KEY (autor_id) REFERENCES usuarios (id)
        ON UPDATE CASCADE,
    CONSTRAINT fk_act_categoria
        FOREIGN KEY (categoria_id) REFERENCES categorias (id)
        ON UPDATE CASCADE,
    CONSTRAINT fk_act_editor
        FOREIGN KEY (editor_id) REFERENCES usuarios (id)
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
