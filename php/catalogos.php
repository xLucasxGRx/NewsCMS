<?php
/**
 * Endpoint para consultar y administrar categorías y etiquetas de NewsCMS.
 */

require_once __DIR__ . '/../config/conexion.php';
require_once __DIR__ . '/../config/seguridad.php';
require_once __DIR__ . '/normalizacion_etiquetas.php';

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
    } elseif ($modo === 'admin_etiquetas') {
        listarEtiquetasAdmin($pdo);
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
        'SELECT e.id, e.nombre, e.clave_normalizada, e.identificador, COUNT(ne.noticia_id) AS total_noticias
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
 * Lista etiquetas para el panel administrativo con búsqueda por nombre, orden alfabético y paginación real.
 */
function listarEtiquetasAdmin(PDO $pdo): void
{
    iniciarSesionSegura();

    if (!estaAutenticado()) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'mensaje' => 'No autenticado.']);
        return;
    }

    if (!tieneRol(['administrador', 'editor', 'redactor']) || !tienePermiso('gestionar_etiquetas')) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'No tienes permisos para administrar etiquetas.']);
        return;
    }

    $busqueda = mb_substr(trim((string) ($_GET['q'] ?? '')), 0, 80);
    $pagina = max(1, (int) ($_GET['pagina'] ?? 1));
    $porPaginaSolicitado = (int) ($_GET['por_pagina'] ?? 16);
    $porPagina = max(1, min(48, $porPaginaSolicitado > 0 ? $porPaginaSolicitado : 16));

    $totalRegistrado = (int) $pdo->query('SELECT COUNT(*) FROM etiquetas')->fetchColumn();

    $whereSql = '1=1';
    $parametros = [];
    if ($busqueda !== '') {
        $whereSql = 'e.nombre LIKE ?';
        $parametros[] = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $busqueda) . '%';
    }

    $stmtTotal = $pdo->prepare("SELECT COUNT(*) FROM etiquetas e WHERE {$whereSql}");
    $stmtTotal->execute($parametros);
    $totalFiltrado = (int) $stmtTotal->fetchColumn();

    $totalPaginas = $totalFiltrado > 0 ? (int) ceil($totalFiltrado / $porPagina) : 0;
    if ($totalPaginas > 0 && $pagina > $totalPaginas) {
        $pagina = $totalPaginas;
    } elseif ($totalFiltrado === 0) {
        $pagina = 1;
    }
    $offset = ($pagina - 1) * $porPagina;

    $stmtLista = $pdo->prepare(
        "SELECT e.id, e.nombre, e.identificador, COUNT(ne.noticia_id) AS total_noticias
         FROM etiquetas e
         LEFT JOIN noticias_etiquetas ne ON ne.etiqueta_id = e.id
         WHERE {$whereSql}
         GROUP BY e.id, e.nombre, e.identificador
         ORDER BY e.nombre ASC, e.id ASC
         LIMIT ? OFFSET ?"
    );

    $indice = 1;
    foreach ($parametros as $valor) {
        $stmtLista->bindValue($indice, $valor);
        $indice++;
    }
    $stmtLista->bindValue($indice, $porPagina, PDO::PARAM_INT);
    $stmtLista->bindValue($indice + 1, $offset, PDO::PARAM_INT);
    $stmtLista->execute();

    echo json_encode([
        'ok'               => true,
        'etiquetas'        => $stmtLista->fetchAll(),
        'total'            => $totalFiltrado,
        'total_registrado' => $totalRegistrado,
        'pagina'           => $pagina,
        'por_pagina'       => $porPagina,
        'total_paginas'    => $totalPaginas,
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
    $nombre = normalizarNombreVisibleEtiqueta((string) ($_POST['nombre'] ?? ''));

    if ($nombre === '' || mb_strlen($nombre, 'UTF-8') > 80) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'El nombre de la etiqueta es obligatorio (máximo 80 caracteres).']);
        return;
    }

    $clave = normalizarClaveEtiqueta($nombre);
    if ($clave === '') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'El nombre de la etiqueta no es válido.']);
        return;
    }

    $existente = buscarEtiquetaPorClave($pdo, $clave, 0);
    if ($existente) {
        responderEtiquetaDuplicada($existente);
        return;
    }

    $identificador = generarIdentificadorCatalogo($pdo, 'etiquetas', $nombre);

    try {
        $stmt = $pdo->prepare('INSERT INTO etiquetas (nombre, clave_normalizada, identificador) VALUES (?, ?, ?)');
        $stmt->execute([$nombre, $clave, $identificador]);
        $nuevoId = (int) $pdo->lastInsertId();
    } catch (PDOException $e) {
        if ((string) $e->getCode() === '23000') {
            $colision = buscarEtiquetaPorClave($pdo, $clave, 0);
            if ($colision) {
                responderEtiquetaDuplicada($colision);
                return;
            }
            http_response_code(409);
            echo json_encode([
                'ok'      => false,
                'codigo'  => 'duplicada',
                'mensaje' => 'Esta etiqueta ya existe.',
            ]);
            return;
        }
        error_log('NewsCMS - Error al crear etiqueta: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['ok' => false, 'mensaje' => 'No se pudo registrar la etiqueta.']);
        return;
    }

    echo json_encode([
        'ok'       => true,
        'id'       => $nuevoId,
        'etiqueta' => [
            'id'                => $nuevoId,
            'nombre'            => $nombre,
            'clave_normalizada' => $clave,
            'identificador'     => $identificador,
        ],
        'mensaje'  => 'Etiqueta creada correctamente.',
    ]);
}

function editarEtiqueta(PDO $pdo): void
{
    $id = (int) ($_POST['id'] ?? 0);
    $nombre = normalizarNombreVisibleEtiqueta((string) ($_POST['nombre'] ?? ''));

    if ($id <= 0 || $nombre === '' || mb_strlen($nombre, 'UTF-8') > 80) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Datos de etiqueta no válidos.']);
        return;
    }

    $clave = normalizarClaveEtiqueta($nombre);
    if ($clave === '') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'El nombre de la etiqueta no es válido.']);
        return;
    }

    $existente = buscarEtiquetaPorClave($pdo, $clave, $id);
    if ($existente) {
        responderEtiquetaDuplicada($existente, true);
        return;
    }

    try {
        $stmt = $pdo->prepare('UPDATE etiquetas SET nombre = ?, clave_normalizada = ? WHERE id = ?');
        $stmt->execute([$nombre, $clave, $id]);
    } catch (PDOException $e) {
        if ((string) $e->getCode() === '23000') {
            $colision = buscarEtiquetaPorClave($pdo, $clave, $id);
            if ($colision) {
                responderEtiquetaDuplicada($colision, true);
                return;
            }
            http_response_code(409);
            echo json_encode([
                'ok'      => false,
                'codigo'  => 'duplicada',
                'mensaje' => 'Ya existe otra etiqueta con ese nombre.',
            ]);
            return;
        }
        error_log('NewsCMS - Error al editar etiqueta: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['ok' => false, 'mensaje' => 'No se pudo actualizar la etiqueta.']);
        return;
    }

    echo json_encode([
        'ok'       => true,
        'etiqueta' => [
            'id'                => $id,
            'nombre'            => $nombre,
            'clave_normalizada' => $clave,
        ],
        'mensaje'  => 'Etiqueta actualizada correctamente.',
    ]);
}

/**
 * Busca una etiqueta equivalente mediante clave canónica excluyendo un ID opcional.
 */
function buscarEtiquetaPorClave(PDO $pdo, string $clave, int $excluirId): ?array
{
    $stmt = $pdo->prepare(
        'SELECT id, nombre, clave_normalizada, identificador
         FROM etiquetas
         WHERE clave_normalizada = ?
           AND id <> ?
         LIMIT 1'
    );
    $stmt->execute([$clave, $excluirId]);
    $fila = $stmt->fetch();
    if (!$fila) {
        return null;
    }
    return [
        'id'                => (int) $fila['id'],
        'nombre'            => (string) $fila['nombre'],
        'clave_normalizada' => (string) $fila['clave_normalizada'],
        'identificador'     => (string) $fila['identificador'],
    ];
}

function responderEtiquetaDuplicada(array $existente, bool $enEdicion = false): void
{
    http_response_code(409);
    $mensaje = $enEdicion
        ? 'Ya existe otra etiqueta equivalente: "' . $existente['nombre'] . '".'
        : 'Esta etiqueta ya existe: "' . $existente['nombre'] . '".';

    echo json_encode([
        'ok'                 => false,
        'codigo'             => 'duplicada',
        'mensaje'            => $mensaje,
        'etiqueta_existente' => $existente,
    ]);
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
    $base = normalizarClaveEtiqueta($nombre);
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
