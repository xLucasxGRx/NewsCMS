<?php
/**
 * Endpoint para consultar y administrar categorías y etiquetas de NewsCMS.
 */

require_once __DIR__ . '/../config/conexion.php';
require_once __DIR__ . '/../config/seguridad.php';

header('Content-Type: application/json; charset=utf-8');

if (!$conexionActiva || !$pdo) {
    http_response_code(503);
    echo json_encode(['ok' => false, 'mensaje' => 'Base de datos no disponible.']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $modo = $_GET['modo'] ?? '';
    if ($modo === 'nube_etiquetas') {
        listarNubeEtiquetasPublica($pdo);
    } else {
        listarCatalogos($pdo);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    procesarOperacionCatalogo($pdo);
    exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'mensaje' => 'Método no permitido.']);

/**
 * Devuelve categorías y etiquetas con el conteo de noticias asociadas.
 */
function listarCatalogos(PDO $pdo): void
{
    $categorias = $pdo->query(
        'SELECT c.id, c.nombre, c.identificador, c.descripcion, COUNT(n.id) AS total_noticias
         FROM categorias c
         LEFT JOIN noticias n ON n.categoria_id = c.id
         GROUP BY c.id
         ORDER BY c.nombre ASC'
    )->fetchAll();

    $etiquetas = $pdo->query(
        'SELECT e.id, e.nombre, e.identificador, COUNT(ne.noticia_id) AS total_noticias
         FROM etiquetas e
         LEFT JOIN noticias_etiquetas ne ON ne.etiqueta_id = e.id
         GROUP BY e.id
         ORDER BY e.nombre ASC'
    )->fetchAll();

    echo json_encode([
        'ok'         => true,
        'categorias' => $categorias,
        'etiquetas'  => $etiquetas,
    ]);
}

/**
 * Devuelve hasta 20 etiquetas usadas en noticias publicadas para la nube pública.
 */
function listarNubeEtiquetasPublica(PDO $pdo): void
{
    $etiquetas = $pdo->query(
        "SELECT e.id, e.nombre, e.identificador, COUNT(n.id) AS total_publicadas
         FROM etiquetas e
         INNER JOIN noticias_etiquetas ne ON ne.etiqueta_id = e.id
         INNER JOIN noticias n ON n.id = ne.noticia_id AND n.estado = 'publicada'
         GROUP BY e.id
         HAVING total_publicadas > 0
         ORDER BY total_publicadas DESC, e.nombre ASC
         LIMIT 20"
    )->fetchAll();

    echo json_encode([
        'ok'        => true,
        'etiquetas' => $etiquetas,
    ]);
}

/**
 * Procesa altas, ediciones y eliminaciones de categorías y etiquetas.
 */
function procesarOperacionCatalogo(PDO $pdo): void
{
    iniciarSesionSegura();

    if (!estaAutenticado()) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'mensaje' => 'No autenticado.']);
        return;
    }

    if (!tieneRol(['administrador', 'editor', 'redactor'])) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'No tienes permisos para administrar categorías o etiquetas.']);
        return;
    }

    if (!validarTokenCsrf($_POST['csrf_token'] ?? '')) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'Token CSRF inválido. Recarga la página.']);
        return;
    }

    $accion = trim($_POST['accion'] ?? '');

    $accionesCategoria = ['crear_categoria', 'editar_categoria', 'eliminar_categoria'];
    $accionesEtiqueta = ['crear_etiqueta', 'editar_etiqueta', 'eliminar_etiqueta'];

    if (in_array($accion, $accionesCategoria, true) && !tienePermiso('gestionar_categorias')) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'Tu rol no tiene permiso para administrar categorías.']);
        return;
    }

    if (in_array($accion, $accionesEtiqueta, true) && !tienePermiso('gestionar_etiquetas')) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'Tu rol no tiene permiso para administrar etiquetas.']);
        return;
    }

    if ($accion === 'crear_categoria') {
        crearCategoria($pdo);
    } elseif ($accion === 'editar_categoria') {
        editarCategoria($pdo);
    } elseif ($accion === 'eliminar_categoria') {
        eliminarCategoria($pdo);
    } elseif ($accion === 'crear_etiqueta') {
        crearEtiqueta($pdo);
    } elseif ($accion === 'editar_etiqueta') {
        editarEtiqueta($pdo);
    } elseif ($accion === 'eliminar_etiqueta') {
        eliminarEtiqueta($pdo);
    } else {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Acción no válida.']);
    }
}

function crearCategoria(PDO $pdo): void
{
    $nombre = trim($_POST['nombre'] ?? '');
    $descripcion = trim($_POST['descripcion'] ?? '');

    if ($nombre === '' || mb_strlen($nombre) > 80) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'El nombre de la categoría es obligatorio (máximo 80 caracteres).']);
        return;
    }

    if (mb_strlen($descripcion) > 255) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'La descripción no debe superar los 255 caracteres.']);
        return;
    }

    if (existeNombreDuplicado($pdo, 'categorias', $nombre, 0)) {
        http_response_code(409);
        echo json_encode(['ok' => false, 'mensaje' => 'Ya existe una categoría con ese nombre.']);
        return;
    }

    $identificador = generarIdentificadorCatalogo($pdo, 'categorias', $nombre);
    $stmt = $pdo->prepare('INSERT INTO categorias (nombre, identificador, descripcion) VALUES (?, ?, ?)');
    $stmt->execute([$nombre, $identificador, $descripcion !== '' ? $descripcion : null]);

    echo json_encode([
        'ok'      => true,
        'id'      => (int) $pdo->lastInsertId(),
        'mensaje' => 'Categoría creada correctamente.',
    ]);
}

function editarCategoria(PDO $pdo): void
{
    $id = (int) ($_POST['id'] ?? 0);
    $nombre = trim($_POST['nombre'] ?? '');
    $descripcion = trim($_POST['descripcion'] ?? '');

    if ($id <= 0 || $nombre === '' || mb_strlen($nombre) > 80) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Datos de categoría no válidos.']);
        return;
    }

    if (mb_strlen($descripcion) > 255) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'La descripción no debe superar los 255 caracteres.']);
        return;
    }

    if (existeNombreDuplicado($pdo, 'categorias', $nombre, $id)) {
        http_response_code(409);
        echo json_encode(['ok' => false, 'mensaje' => 'Ya existe otra categoría con ese nombre.']);
        return;
    }

    $stmt = $pdo->prepare('UPDATE categorias SET nombre = ?, descripcion = ? WHERE id = ?');
    $stmt->execute([$nombre, $descripcion !== '' ? $descripcion : null, $id]);

    echo json_encode(['ok' => true, 'mensaje' => 'Categoría actualizada correctamente.']);
}

function eliminarCategoria(PDO $pdo): void
{
    $id = (int) ($_POST['id'] ?? 0);
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Categoría no válida.']);
        return;
    }

    $stmtUso = $pdo->prepare('SELECT COUNT(*) FROM noticias WHERE categoria_id = ?');
    $stmtUso->execute([$id]);
    if ((int) $stmtUso->fetchColumn() > 0) {
        http_response_code(409);
        echo json_encode(['ok' => false, 'mensaje' => 'No se puede eliminar la categoría porque tiene noticias asociadas.']);
        return;
    }

    $stmt = $pdo->prepare('DELETE FROM categorias WHERE id = ?');
    $stmt->execute([$id]);

    echo json_encode(['ok' => true, 'mensaje' => 'Categoría eliminada correctamente.']);
}

function crearEtiqueta(PDO $pdo): void
{
    $nombre = trim($_POST['nombre'] ?? '');

    if ($nombre === '' || mb_strlen($nombre) > 80) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'El nombre de la etiqueta es obligatorio (máximo 80 caracteres).']);
        return;
    }

    if (existeNombreDuplicado($pdo, 'etiquetas', $nombre, 0)) {
        http_response_code(409);
        echo json_encode(['ok' => false, 'mensaje' => 'Ya existe una etiqueta con ese nombre.']);
        return;
    }

    $identificador = generarIdentificadorCatalogo($pdo, 'etiquetas', $nombre);
    $stmt = $pdo->prepare('INSERT INTO etiquetas (nombre, identificador) VALUES (?, ?)');
    $stmt->execute([$nombre, $identificador]);

    echo json_encode([
        'ok'      => true,
        'id'      => (int) $pdo->lastInsertId(),
        'mensaje' => 'Etiqueta creada correctamente.',
    ]);
}

function editarEtiqueta(PDO $pdo): void
{
    $id = (int) ($_POST['id'] ?? 0);
    $nombre = trim($_POST['nombre'] ?? '');

    if ($id <= 0 || $nombre === '' || mb_strlen($nombre) > 80) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Datos de etiqueta no válidos.']);
        return;
    }

    if (existeNombreDuplicado($pdo, 'etiquetas', $nombre, $id)) {
        http_response_code(409);
        echo json_encode(['ok' => false, 'mensaje' => 'Ya existe otra etiqueta con ese nombre.']);
        return;
    }

    $stmt = $pdo->prepare('UPDATE etiquetas SET nombre = ? WHERE id = ?');
    $stmt->execute([$nombre, $id]);

    echo json_encode(['ok' => true, 'mensaje' => 'Etiqueta actualizada correctamente.']);
}

function eliminarEtiqueta(PDO $pdo): void
{
    $id = (int) ($_POST['id'] ?? 0);
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Etiqueta no válida.']);
        return;
    }

    $stmtUso = $pdo->prepare('SELECT COUNT(*) FROM noticias_etiquetas WHERE etiqueta_id = ?');
    $stmtUso->execute([$id]);
    if ((int) $stmtUso->fetchColumn() > 0) {
        http_response_code(409);
        echo json_encode(['ok' => false, 'mensaje' => 'No se puede eliminar la etiqueta porque está asociada a una o más noticias.']);
        return;
    }

    $stmt = $pdo->prepare('DELETE FROM etiquetas WHERE id = ?');
    $stmt->execute([$id]);

    echo json_encode(['ok' => true, 'mensaje' => 'Etiqueta eliminada correctamente.']);
}

function existeNombreDuplicado(PDO $pdo, string $tabla, string $nombre, int $excluirId): bool
{
    $stmt = $pdo->prepare("SELECT id FROM {$tabla} WHERE LOWER(nombre) = LOWER(?) AND id <> ? LIMIT 1");
    $stmt->execute([$nombre, $excluirId]);
    return (bool) $stmt->fetch();
}

function generarIdentificadorCatalogo(PDO $pdo, string $tabla, string $nombre): string
{
    $base = strtolower(trim($nombre));
    $base = strtr($base, ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n']);
    $base = trim((string) preg_replace('/[^a-z0-9]+/', '-', $base), '-');
    if ($base === '') {
        $base = 'elemento';
    }
    $base = substr($base, 0, 85);

    $identificador = $base;
    $contador = 2;
    $stmt = $pdo->prepare("SELECT id FROM {$tabla} WHERE identificador = ? LIMIT 1");

    while (true) {
        $stmt->execute([$identificador]);
        if (!$stmt->fetch()) {
            return $identificador;
        }
        $identificador = $base . '-' . $contador;
        $contador++;
    }
}
