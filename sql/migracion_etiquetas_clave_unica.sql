-- Migración reproducible e idempotente: unicidad canónica de etiquetas
-- Garantiza mediante índice UNIQUE en clave_normalizada que no puedan existir duplicados
-- por mayúsculas, minúsculas, tildes, diéresis, espacios o formas Unicode equivalentes.

ALTER TABLE etiquetas
    ADD COLUMN IF NOT EXISTS clave_normalizada VARCHAR(120) NULL AFTER nombre;

-- Backfill SQL compatible para ejecuciones directas cuando clave_normalizada aún esté vacía
UPDATE etiquetas
SET clave_normalizada = LOWER(TRIM(REGEXP_REPLACE(nombre, '[[:space:]]+', ' ')))
WHERE clave_normalizada IS NULL OR clave_normalizada = '';

ALTER TABLE etiquetas
    MODIFY COLUMN clave_normalizada VARCHAR(120) NOT NULL;

ALTER TABLE etiquetas
    ADD UNIQUE KEY IF NOT EXISTS uk_etiquetas_clave_normalizada (clave_normalizada);
