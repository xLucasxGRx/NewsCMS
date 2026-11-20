<?php
/**
 * Normalización Unicode canónica compartida para etiquetas de NewsCMS.
 * Impide duplicados por mayúsculas, minúsculas, tildes, diéresis, espacios o formas NFD/NFC.
 */

/**
 * Limpia espacios al inicio/final y colapsa espacios consecutivos conservando el texto legible.
 */
function normalizarNombreVisibleEtiqueta(string $nombre): string
{
    $colapsado = preg_replace('/\s+/u', ' ', trim($nombre));
    return $colapsado !== null ? $colapsado : trim($nombre);
}

/**
 * Genera la clave canónica única para comparar y persistir unicidad en MySQL.
 * Flujo: colapsar espacios -> descomposición Unicode NFKD -> retirar marcas diacríticas -> minúsculas UTF-8.
 */
function normalizarClaveEtiqueta(string $nombre): string
{
    $limpio = normalizarNombreVisibleEtiqueta($nombre);
    if ($limpio === '') {
        return '';
    }

    if (class_exists('Normalizer')) {
        $descompuesto = Normalizer::normalize($limpio, Normalizer::FORM_KD);
        if ($descompuesto !== false) {
            $limpio = $descompuesto;
        }
    }

    $sinMarcas = preg_replace('/\p{M}+/u', '', $limpio);
    if ($sinMarcas !== null) {
        $limpio = $sinMarcas;
    }

    $minusculas = function_exists('mb_strtolower')
        ? mb_strtolower($limpio, 'UTF-8')
        : strtolower($limpio);

    $final = preg_replace('/\s+/u', ' ', trim($minusculas));
    return $final !== null ? $final : trim($minusculas);
}
