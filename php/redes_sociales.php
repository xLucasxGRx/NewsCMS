<?php
/**
 * Endpoint del complemento Feed de Redes Sociales para NewsCMS.
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
        listarEnlacesPublicos($pdo);
    } elseif ($modo === 'admin_lista') {
        listarEnlacesAdmin($pdo);
    } else {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Modo no válido.']);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    procesarOperacionSocial($pdo);
    exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'mensaje' => 'Método no permitido.']);

/**
 * Devuelve únicamente los enlaces visibles cuando el complemento está activo.
 */
function listarEnlacesPublicos(PDO $pdo): void
{
    $stmtEstado = $pdo->prepare(
        "SELECT activo FROM complementos WHERE identificador = 'feed_redes_sociales' LIMIT 1"
    );
    $stmtEstado->execute();
    $plugin = $stmtEstado->fetch();

    if (!$plugin || (int) $plugin['activo'] !== 1) {
        echo json_encode([
            'ok'      => true,
            'activo'  => false,
            'enlaces' => [],
        ]);
        return;
    }

    $enlaces = $pdo->query(
        'SELECT id, plataforma, titulo, descripcion, url
         FROM enlaces_sociales
         WHERE visible = 1
         ORDER BY id DESC'
    )->fetchAll();

    echo json_encode([
        'ok'      => true,
        'activo'  => true,
        'enlaces' => $enlaces,
    ]);
}

/**
 * Lista todos los enlaces registrados para el administrador.
 */
function listarEnlacesAdmin(PDO $pdo): void
{
    iniciarSesionSegura();

    if (!estaAutenticado()) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'mensaje' => 'No autenticado.']);
        return;
    }

    if (!tieneRol(['administrador'])) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'Solo el administrador puede gestionar enlaces sociales.']);
        return;
    }

    $enlaces = $pdo->query(
        'SELECT id, plataforma, titulo, descripcion, url, visible, fecha_creacion
         FROM enlaces_sociales
         ORDER BY id DESC'
    )->fetchAll();

    echo json_encode([
        'ok'      => true,
        'enlaces' => $enlaces,
    ]);
}

/**
 * Procesa creación, edición, cambio de visibilidad y eliminación (solo administrador).
 */
function procesarOperacionSocial(PDO $pdo): void
{
    iniciarSesionSegura();

    if (!estaAutenticado()) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'mensaje' => 'No autenticado.']);
        return;
    }

    if (!tieneRol(['administrador'])) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'Solo el administrador puede gestionar enlaces sociales.']);
        return;
    }

    if (!validarTokenCsrf($_POST['csrf_token'] ?? '')) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'Token CSRF inválido. Recarga la página.']);
        return;
    }

    $accion = trim($_POST['accion'] ?? '');

    if ($accion === 'crear') {
        crearEnlaceSocial($pdo);
    } elseif ($accion === 'editar') {
        editarEnlaceSocial($pdo);
    } elseif ($accion === 'eliminar') {
        eliminarEnlaceSocial($pdo);
    } elseif ($accion === 'cambiar_visibilidad') {
        cambiarVisibilidadEnlace($pdo);
    } else {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Acción no válida.']);
    }
}

function crearEnlaceSocial(PDO $pdo): void
{
    $validacion = validarDatosEnlace();
    if (!$validacion['ok']) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => $validacion['mensaje']]);
        return;
    }

    $d = $validacion['datos'];
    $stmt = $pdo->prepare(
        'INSERT INTO enlaces_sociales (plataforma, titulo, descripcion, url, visible)
         VALUES (?, ?, ?, ?, ?)'
    );
    $stmt->execute([$d['plataforma'], $d['titulo'], $d['descripcion'], $d['url'], $d['visible']]);

    echo json_encode([
        'ok'      => true,
        'id'      => (int) $pdo->lastInsertId(),
        'mensaje' => 'Enlace social agregado correctamente.',
    ]);
}

function editarEnlaceSocial(PDO $pdo): void
{
    $id = (int) ($_POST['id'] ?? 0);
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Enlace no válido.']);
        return;
    }

    $validacion = validarDatosEnlace();
    if (!$validacion['ok']) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => $validacion['mensaje']]);
        return;
    }

    $d = $validacion['datos'];
    $stmt = $pdo->prepare(
        'UPDATE enlaces_sociales
         SET plataforma = ?, titulo = ?, descripcion = ?, url = ?, visible = ?
         WHERE id = ?'
    );
    $stmt->execute([$d['plataforma'], $d['titulo'], $d['descripcion'], $d['url'], $d['visible'], $id]);

    echo json_encode([
        'ok'      => true,
        'mensaje' => 'Enlace social actualizado correctamente.',
    ]);
}

function eliminarEnlaceSocial(PDO $pdo): void
{
    $id = (int) ($_POST['id'] ?? 0);
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Enlace no válido.']);
        return;
    }

    $stmt = $pdo->prepare('DELETE FROM enlaces_sociales WHERE id = ?');
    $stmt->execute([$id]);

    echo json_encode([
        'ok'      => true,
        'mensaje' => 'Enlace social eliminado correctamente.',
    ]);
}

function cambiarVisibilidadEnlace(PDO $pdo): void
{
    $id = (int) ($_POST['id'] ?? 0);
    $visible = !empty($_POST['visible']) ? 1 : 0;

    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Enlace no válido.']);
        return;
    }

    $stmt = $pdo->prepare('UPDATE enlaces_sociales SET visible = ? WHERE id = ?');
    $stmt->execute([$visible, $id]);

    echo json_encode([
        'ok'      => true,
        'mensaje' => $visible === 1 ? 'Enlace visible en el portal.' : 'Enlace ocultado del portal.',
    ]);
}

function validarDatosEnlace(): array
{
    $plataformasPermitidas = ['Facebook', 'Instagram', 'TikTok', 'X'];
    $plataforma = trim($_POST['plataforma'] ?? '');
    $titulo = trim($_POST['titulo'] ?? '');
    $descripcion = trim($_POST['descripcion'] ?? '');
    $url = trim($_POST['url'] ?? '');
    $visible = isset($_POST['visible']) && (string) $_POST['visible'] === '0' ? 0 : 1;

    if (!in_array($plataforma, $plataformasPermitidas, true)) {
        return ['ok' => false, 'mensaje' => 'Selecciona una plataforma válida (Facebook, Instagram, TikTok o X).'];
    }

    if ($titulo === '' || mb_strlen($titulo) > 120) {
        return ['ok' => false, 'mensaje' => 'El título es obligatorio (máximo 120 caracteres).'];
    }

    if (mb_strlen($descripcion) > 255) {
        return ['ok' => false, 'mensaje' => 'La descripción no debe superar los 255 caracteres.'];
    }

    if ($url === '' || mb_strlen($url) > 500 || !validarUrlSocial($url)) {
        return ['ok' => false, 'mensaje' => 'Ingresa una URL HTTPS válida de Facebook, Instagram, TikTok o X.'];
    }

    return [
        'ok'    => true,
        'datos' => [
            'plataforma'  => $plataforma,
            'titulo'      => $titulo,
            'descripcion' => $descripcion !== '' ? $descripcion : null,
            'url'         => $url,
            'visible'     => $visible,
        ],
    ];
}

/**
 * Valida que la URL use HTTPS y pertenezca a un dominio oficial permitido.
 */
function validarUrlSocial(string $url): bool
{
    $partes = parse_url($url);
    if (!is_array($partes)) {
        return false;
    }

    $esquema = strtolower($partes['scheme'] ?? '');
    $host = strtolower(rtrim((string) ($partes['host'] ?? ''), '.'));

    if ($esquema !== 'https' || $host === '') {
        return false;
    }

    $dominiosOficiales = ['facebook.com', 'instagram.com', 'tiktok.com', 'x.com', 'twitter.com'];
    foreach ($dominiosOficiales as $dominio) {
        if ($host === $dominio || str_ends_with($host, '.' . $dominio)) {
            return true;
        }
    }

    return false;
}
