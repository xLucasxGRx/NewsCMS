<?php
/**
 * Endpoint del complemento Gestor de Publicidad para NewsCMS.
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
    $modo = $_GET['modo'] ?? 'publico';

    if ($modo === 'publico') {
        listarAnunciosPublicos($pdo);
    } elseif ($modo === 'admin_lista') {
        listarAnunciosAdmin($pdo);
    } else {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Modo no válido.']);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    procesarOperacionAnuncio($pdo);
    exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'mensaje' => 'Método no permitido.']);

/**
 * Devuelve hasta 3 anuncios visibles si el complemento gestor_publicidad está activo.
 */
function listarAnunciosPublicos(PDO $pdo): void
{
    $stmtEstado = $pdo->prepare(
        "SELECT activo FROM complementos WHERE identificador = 'gestor_publicidad' LIMIT 1"
    );
    $stmtEstado->execute();
    $plugin = $stmtEstado->fetch();

    if (!$plugin || (int) $plugin['activo'] !== 1) {
        echo json_encode([
            'ok'       => true,
            'activo'   => false,
            'anuncios' => [],
        ]);
        return;
    }

    $anuncios = $pdo->query(
        'SELECT id, titulo, descripcion, imagen, enlace
         FROM anuncios
         WHERE visible = 1
         ORDER BY fecha_creacion DESC, id DESC
         LIMIT 3'
    )->fetchAll();

    echo json_encode([
        'ok'       => true,
        'activo'   => true,
        'anuncios' => $anuncios,
    ]);
}

/**
 * Lista todos los anuncios registrados para el administrador.
 */
function listarAnunciosAdmin(PDO $pdo): void
{
    iniciarSesionSegura();

    if (!estaAutenticado()) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'mensaje' => 'No autenticado.']);
        return;
    }

    if (!tieneRol(['administrador'])) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'Solo el administrador puede gestionar la publicidad.']);
        return;
    }

    $anuncios = $pdo->query(
        'SELECT id, titulo, descripcion, imagen, enlace, visible, fecha_creacion
         FROM anuncios
         ORDER BY fecha_creacion DESC, id DESC'
    )->fetchAll();

    echo json_encode([
        'ok'       => true,
        'anuncios' => $anuncios,
    ]);
}

/**
 * Procesa creación, edición, cambio de visibilidad y eliminación (solo administrador).
 */
function procesarOperacionAnuncio(PDO $pdo): void
{
    iniciarSesionSegura();

    if (!estaAutenticado()) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'mensaje' => 'No autenticado.']);
        return;
    }

    if (!tieneRol(['administrador'])) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'Solo el administrador puede gestionar la publicidad.']);
        return;
    }

    if (!validarTokenCsrf($_POST['csrf_token'] ?? '')) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'Token CSRF inválido. Recarga la página.']);
        return;
    }

    $accion = trim($_POST['accion'] ?? '');

    if ($accion === 'crear') {
        crearAnuncio($pdo);
    } elseif ($accion === 'editar') {
        editarAnuncio($pdo);
    } elseif ($accion === 'cambiar_visibilidad') {
        cambiarVisibilidadAnuncio($pdo);
    } elseif ($accion === 'eliminar') {
        eliminarAnuncio($pdo);
    } else {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Acción no válida.']);
    }
}

function crearAnuncio(PDO $pdo): void
{
    $validacion = validarDatosAnuncio();
    if (!$validacion['ok']) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => $validacion['mensaje']]);
        return;
    }

    $rutaImagen = null;
    if (isset($_FILES['imagen']) && $_FILES['imagen']['error'] !== UPLOAD_ERR_NO_FILE) {
        $resultadoImagen = procesarImagenPublicidad($_FILES['imagen']);
        if (!$resultadoImagen['ok']) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'mensaje' => $resultadoImagen['mensaje']]);
            return;
        }
        $rutaImagen = $resultadoImagen['ruta'];
    }

    $d = $validacion['datos'];
    $stmt = $pdo->prepare(
        'INSERT INTO anuncios (titulo, descripcion, imagen, enlace, visible)
         VALUES (?, ?, ?, ?, ?)'
    );
    $stmt->execute([$d['titulo'], $d['descripcion'], $rutaImagen, $d['enlace'], $d['visible']]);

    echo json_encode([
        'ok'      => true,
        'id'      => (int) $pdo->lastInsertId(),
        'mensaje' => 'Anuncio registrado correctamente.',
    ]);
}

function editarAnuncio(PDO $pdo): void
{
    $id = (int) ($_POST['id'] ?? 0);
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Anuncio no válido.']);
        return;
    }

    $stmtExistente = $pdo->prepare('SELECT id, imagen FROM anuncios WHERE id = ? LIMIT 1');
    $stmtExistente->execute([$id]);
    $existente = $stmtExistente->fetch();

    if (!$existente) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'mensaje' => 'Anuncio no encontrado.']);
        return;
    }

    $validacion = validarDatosAnuncio();
    if (!$validacion['ok']) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => $validacion['mensaje']]);
        return;
    }

    $rutaImagen = $existente['imagen'];
    if (isset($_FILES['imagen']) && $_FILES['imagen']['error'] !== UPLOAD_ERR_NO_FILE) {
        $resultadoImagen = procesarImagenPublicidad($_FILES['imagen']);
        if (!$resultadoImagen['ok']) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'mensaje' => $resultadoImagen['mensaje']]);
            return;
        }
        $rutaImagen = $resultadoImagen['ruta'];
    }

    $d = $validacion['datos'];
    $stmt = $pdo->prepare(
        'UPDATE anuncios
         SET titulo = ?, descripcion = ?, imagen = ?, enlace = ?, visible = ?
         WHERE id = ?'
    );
    $stmt->execute([$d['titulo'], $d['descripcion'], $rutaImagen, $d['enlace'], $d['visible'], $id]);

    echo json_encode([
        'ok'      => true,
        'mensaje' => 'Anuncio actualizado correctamente.',
    ]);
}

function cambiarVisibilidadAnuncio(PDO $pdo): void
{
    $id = (int) ($_POST['id'] ?? 0);
    $visible = !empty($_POST['visible']) ? 1 : 0;

    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Anuncio no válido.']);
        return;
    }

    $stmt = $pdo->prepare('UPDATE anuncios SET visible = ? WHERE id = ?');
    $stmt->execute([$visible, $id]);

    echo json_encode([
        'ok'      => true,
        'mensaje' => $visible === 1 ? 'Anuncio activado en el portal.' : 'Anuncio ocultado del portal.',
    ]);
}

function eliminarAnuncio(PDO $pdo): void
{
    $id = (int) ($_POST['id'] ?? 0);
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Anuncio no válido.']);
        return;
    }

    $stmt = $pdo->prepare('DELETE FROM anuncios WHERE id = ?');
    $stmt->execute([$id]);

    echo json_encode([
        'ok'      => true,
        'mensaje' => 'Anuncio eliminado correctamente.',
    ]);
}

function validarDatosAnuncio(): array
{
    $titulo = trim($_POST['titulo'] ?? '');
    $descripcion = trim($_POST['descripcion'] ?? '');
    $enlace = trim($_POST['enlace'] ?? '');
    $visible = isset($_POST['visible']) && (string) $_POST['visible'] === '0' ? 0 : 1;

    if ($titulo === '' || mb_strlen($titulo) > 120) {
        return ['ok' => false, 'mensaje' => 'El título del anuncio es obligatorio (máximo 120 caracteres).'];
    }

    if (mb_strlen($descripcion) > 255) {
        return ['ok' => false, 'mensaje' => 'La descripción no debe superar los 255 caracteres.'];
    }

    if ($enlace === '' || mb_strlen($enlace) > 500 || !validarEnlaceHttps($enlace)) {
        return ['ok' => false, 'mensaje' => 'Ingresa una URL de destino HTTP o HTTPS válida.'];
    }

    return [
        'ok'    => true,
        'datos' => [
            'titulo'      => $titulo,
            'descripcion' => $descripcion !== '' ? $descripcion : null,
            'enlace'      => $enlace,
            'visible'     => $visible,
        ],
    ];
}

function validarEnlaceHttps(string $url): bool
{
    if (!filter_var($url, FILTER_VALIDATE_URL)) {
        return false;
    }

    $partes = parse_url($url);
    if (!is_array($partes)) {
        return false;
    }

    $esquema = strtolower($partes['scheme'] ?? '');
    $host = trim((string) ($partes['host'] ?? ''));

    return ($esquema === 'https' || $esquema === 'http') && $host !== '';
}

function procesarImagenPublicidad(array $archivo): array
{
    if ($archivo['error'] !== UPLOAD_ERR_OK) {
        return ['ok' => false, 'mensaje' => 'Error al subir la imagen publicitaria.'];
    }

    $tamanoMaximo = 2 * 1024 * 1024; // 2 MB
    if ($archivo['size'] <= 0 || $archivo['size'] > $tamanoMaximo) {
        return ['ok' => false, 'mensaje' => 'La imagen no debe superar los 2 MB.'];
    }

    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime = finfo_file($finfo, $archivo['tmp_name']);
    finfo_close($finfo);

    $extensionesPermitidas = [
        'image/jpeg' => 'jpg',
        'image/png'  => 'png',
        'image/webp' => 'webp',
    ];

    if (!isset($extensionesPermitidas[$mime])) {
        return ['ok' => false, 'mensaje' => 'Solo se admiten imágenes JPG, PNG o WEBP.'];
    }

    if (@getimagesize($archivo['tmp_name']) === false) {
        return ['ok' => false, 'mensaje' => 'El archivo no contiene una imagen válida.'];
    }

    $directorioDestino = __DIR__ . '/../uploads/publicidad';
    if (!is_dir($directorioDestino)) {
        mkdir($directorioDestino, 0755, true);
    }

    $nombreSeguro = bin2hex(random_bytes(16)) . '.' . $extensionesPermitidas[$mime];
    $rutaDestino = $directorioDestino . '/' . $nombreSeguro;

    if (!move_uploaded_file($archivo['tmp_name'], $rutaDestino)) {
        return ['ok' => false, 'mensaje' => 'No se pudo guardar la imagen publicitaria.'];
    }

    return [
        'ok'   => true,
        'ruta' => 'uploads/publicidad/' . $nombreSeguro,
    ];
}
