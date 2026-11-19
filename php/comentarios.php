<?php
/**
 * Endpoint de comentarios públicos y moderación administrativa para NewsCMS.
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
        responderComentariosPublicos($pdo);
    } elseif ($modo === 'admin_lista') {
        responderComentariosAdmin($pdo);
    } else {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Modo no válido.']);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $accion = trim($_POST['accion'] ?? '');

    if ($accion === 'crear') {
        crearComentarioPublico($pdo);
    } elseif (in_array($accion, ['aprobar', 'rechazar', 'eliminar'], true)) {
        moderarComentario($pdo, $accion);
    } else {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Acción no válida.']);
    }
    exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'mensaje' => 'Método no permitido.']);

function estaPluginComentariosActivo(PDO $pdo): bool
{
    $stmt = $pdo->prepare("SELECT activo FROM complementos WHERE identificador = 'comentarios_sociales' LIMIT 1");
    $stmt->execute();
    $fila = $stmt->fetch();
    return $fila && (int) $fila['activo'] === 1;
}

function googleEstaConfigurado(): bool
{
    $rutaConfig = __DIR__ . '/../config/google_oauth_local.php';
    if (!file_exists($rutaConfig)) {
        return false;
    }
    $config = require $rutaConfig;
    return trim((string) ($config['client_id'] ?? '')) !== ''
        && trim((string) ($config['client_secret'] ?? '')) !== '';
}

function responderComentariosPublicos(PDO $pdo): void
{
    if (!estaPluginComentariosActivo($pdo)) {
        echo json_encode(['ok' => true, 'activo' => false, 'comentarios' => []]);
        return;
    }

    $noticiaId = (int) ($_GET['noticia_id'] ?? 0);
    if ($noticiaId <= 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Noticia no válida.']);
        return;
    }

    $stmtNoticia = $pdo->prepare("SELECT id FROM noticias WHERE id = ? AND estado = 'publicada' LIMIT 1");
    $stmtNoticia->execute([$noticiaId]);
    if (!$stmtNoticia->fetch()) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'mensaje' => 'Noticia no publicada o inexistente.']);
        return;
    }

    iniciarSesionSegura();
    $socialId = (int) ($_SESSION['social_usuario_id'] ?? 0);
    $socialNombre = $_SESSION['social_nombre'] ?? null;
    $csrf = generarTokenCsrf();

    $stmtAprobados = $pdo->prepare(
        "SELECT c.id, c.contenido, c.fecha_creacion, u.nombre AS autor
         FROM comentarios c
         INNER JOIN usuarios_sociales u ON u.id = c.usuario_social_id
         WHERE c.noticia_id = ? AND c.estado = 'aprobado'
         ORDER BY c.fecha_creacion DESC, c.id DESC"
    );
    $stmtAprobados->execute([$noticiaId]);

    $misComentarios = [];
    if ($socialId > 0) {
        $stmtPropios = $pdo->prepare(
            "SELECT id, contenido, estado, fecha_creacion
             FROM comentarios
             WHERE noticia_id = ? AND usuario_social_id = ? AND estado <> 'aprobado'
             ORDER BY fecha_creacion DESC, id DESC"
        );
        $stmtPropios->execute([$noticiaId, $socialId]);
        $misComentarios = $stmtPropios->fetchAll();
    }

    echo json_encode([
        'ok'                 => true,
        'activo'             => true,
        'google_configurado' => googleEstaConfigurado(),
        'sesion_social'      => [
            'autenticado' => $socialId > 0,
            'nombre'      => $socialNombre,
            'csrf_token'  => $csrf,
        ],
        'comentarios'        => $stmtAprobados->fetchAll(),
        'mis_comentarios'    => $misComentarios,
    ]);
}

function crearComentarioPublico(PDO $pdo): void
{
    if (!estaPluginComentariosActivo($pdo)) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'Los comentarios no están activos.']);
        return;
    }

    iniciarSesionSegura();
    $socialId = (int) ($_SESSION['social_usuario_id'] ?? 0);
    if ($socialId <= 0) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'mensaje' => 'Debes iniciar sesión con Google para comentar.']);
        return;
    }

    if (!validarTokenCsrf($_POST['csrf_token'] ?? '')) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'Token CSRF inválido.']);
        return;
    }

    $ahora = time();
    $ultimo = $_SESSION['comentario_ultimo_envio'] ?? 0;
    if (($ahora - $ultimo) < 10) {
        http_response_code(429);
        echo json_encode(['ok' => false, 'mensaje' => 'Espera unos segundos antes de enviar otro comentario.']);
        return;
    }

    $noticiaId = (int) ($_POST['noticia_id'] ?? 0);
    $contenido = trim((string) ($_POST['contenido'] ?? ''));

    if ($noticiaId <= 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Noticia no válida.']);
        return;
    }

    // Solo permitir comentarios en noticias publicadas
    $stmtNoticia = $pdo->prepare("SELECT id FROM noticias WHERE id = ? AND estado = 'publicada' LIMIT 1");
    $stmtNoticia->execute([$noticiaId]);
    if (!$stmtNoticia->fetch()) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'Solo se puede comentar en noticias publicadas.']);
        return;
    }

    // Rechazar etiquetas HTML/scripts
    $contenidoLimpio = trim(strip_tags($contenido));
    if ($contenidoLimpio === '' || $contenidoLimpio !== $contenido || mb_strlen($contenidoLimpio) > 1000) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'El comentario debe ser texto plano (máximo 1000 caracteres).']);
        return;
    }

    $_SESSION['comentario_ultimo_envio'] = $ahora;

    $stmt = $pdo->prepare(
        "INSERT INTO comentarios (noticia_id, usuario_social_id, contenido, estado)
         VALUES (?, ?, ?, 'pendiente')"
    );
    $stmt->execute([$noticiaId, $socialId, $contenidoLimpio]);

    echo json_encode([
        'ok'      => true,
        'mensaje' => 'Tu comentario se envió y está pendiente de aprobación.',
    ]);
}

function responderComentariosAdmin(PDO $pdo): void
{
    iniciarSesionSegura();

    if (!estaAutenticado()) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'mensaje' => 'No autenticado.']);
        return;
    }

    if (!tieneRol(['administrador'])) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'Solo el administrador puede moderar comentarios.']);
        return;
    }

    $estado = trim($_GET['estado'] ?? '');
    $sql = "SELECT c.id, c.contenido, c.estado, c.fecha_creacion,
                   u.nombre AS autor, n.titulo AS noticia, n.id AS noticia_id
            FROM comentarios c
            INNER JOIN usuarios_sociales u ON u.id = c.usuario_social_id
            INNER JOIN noticias n ON n.id = c.noticia_id
            WHERE 1=1";
    $parametros = [];

    if (in_array($estado, ['pendiente', 'aprobado', 'rechazado'], true)) {
        $sql .= ' AND c.estado = ?';
        $parametros[] = $estado;
    }

    $sql .= ' ORDER BY c.fecha_creacion DESC, c.id DESC';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($parametros);

    echo json_encode([
        'ok'          => true,
        'comentarios' => $stmt->fetchAll(),
    ]);
}

function moderarComentario(PDO $pdo, string $accion): void
{
    iniciarSesionSegura();

    if (!estaAutenticado()) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'mensaje' => 'No autenticado.']);
        return;
    }

    if (!tieneRol(['administrador'])) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'Solo el administrador puede moderar comentarios.']);
        return;
    }

    if (!validarTokenCsrf($_POST['csrf_token'] ?? '')) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'Token CSRF inválido.']);
        return;
    }

    $id = (int) ($_POST['id'] ?? 0);
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Comentario no válido.']);
        return;
    }

    if ($accion === 'eliminar') {
        $stmt = $pdo->prepare('DELETE FROM comentarios WHERE id = ?');
        $stmt->execute([$id]);
        echo json_encode(['ok' => true, 'mensaje' => 'Comentario eliminado correctamente.']);
        return;
    }

    $nuevoEstado = $accion === 'aprobar' ? 'aprobado' : 'rechazado';
    $stmt = $pdo->prepare('UPDATE comentarios SET estado = ?, fecha_revision = NOW() WHERE id = ?');
    $stmt->execute([$nuevoEstado, $id]);

    echo json_encode([
        'ok'      => true,
        'mensaje' => $nuevoEstado === 'aprobado' ? 'Comentario aprobado.' : 'Comentario rechazado.',
    ]);
}
