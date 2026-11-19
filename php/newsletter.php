<?php
/**
 * Endpoint del complemento Newsletter para NewsCMS.
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
    $modo = $_GET['modo'] ?? 'estado_publico';

    if ($modo === 'estado_publico') {
        echo json_encode(['ok' => true, 'activo' => estaPluginNewsletterActivo($pdo)]);
    } elseif ($modo === 'admin_datos') {
        responderDatosAdmin($pdo);
    } else {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Modo no válido.']);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $accion = trim($_POST['accion'] ?? '');

    if ($accion === 'suscribir') {
        registrarSuscriptor($pdo);
    } elseif ($accion === 'baja') {
        cancelarSuscripcion($pdo);
    } elseif ($accion === 'guardar_boletin') {
        guardarBoletin($pdo);
    } elseif ($accion === 'enviar_boletin') {
        enviarBoletin($pdo);
    } else {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Acción no válida.']);
    }
    exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'mensaje' => 'Método no permitido.']);

function estaPluginNewsletterActivo(PDO $pdo): bool
{
    $stmt = $pdo->prepare("SELECT activo FROM complementos WHERE identificador = 'newsletter' LIMIT 1");
    $stmt->execute();
    $fila = $stmt->fetch();
    return $fila && (int) $fila['activo'] === 1;
}

/**
 * Registra o reactiva una suscripción pública con consentimiento obligatorio.
 */
function registrarSuscriptor(PDO $pdo): void
{
    if (!estaPluginNewsletterActivo($pdo)) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'El servicio de suscripción no está activo en este momento.']);
        return;
    }

    iniciarSesionSegura();
    $ahora = time();
    $ultimo = $_SESSION['newsletter_ultimo_envio'] ?? 0;
    if (($ahora - $ultimo) < 3) {
        http_response_code(429);
        echo json_encode(['ok' => false, 'mensaje' => 'Espera unos segundos antes de intentar nuevamente.']);
        return;
    }
    $_SESSION['newsletter_ultimo_envio'] = $ahora;

    $consentimiento = $_POST['consentimiento'] ?? '';
    if ((string) $consentimiento !== '1') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Debes aceptar recibir boletines para suscribirte.']);
        return;
    }

    $correo = strtolower(trim($_POST['correo'] ?? ''));
    if ($correo === '' || mb_strlen($correo) > 150 || !filter_var($correo, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Ingresa una dirección de correo electrónico válida.']);
        return;
    }

    $stmtBuscar = $pdo->prepare('SELECT id, estado FROM suscriptores_newsletter WHERE correo = ? LIMIT 1');
    $stmtBuscar->execute([$correo]);
    $existente = $stmtBuscar->fetch();

    if ($existente) {
        if ($existente['estado'] === 'inactivo') {
            $nuevoToken = bin2hex(random_bytes(32));
            $stmtReactivar = $pdo->prepare(
                "UPDATE suscriptores_newsletter
                 SET estado = 'activo', token_baja = ?, fecha_baja = NULL
                 WHERE id = ?"
            );
            $stmtReactivar->execute([$nuevoToken, $existente['id']]);
        }

        // Mensaje neutral sin revelar innecesariamente si la dirección ya existía
        echo json_encode([
            'ok'      => true,
            'mensaje' => 'Tu solicitud de suscripción fue procesada correctamente.',
        ]);
        return;
    }

    $tokenBaja = bin2hex(random_bytes(32));
    $stmtInsertar = $pdo->prepare(
        "INSERT INTO suscriptores_newsletter (correo, estado, token_baja)
         VALUES (?, 'activo', ?)"
    );
    $stmtInsertar->execute([$correo, $tokenBaja]);

    echo json_encode([
        'ok'      => true,
        'mensaje' => 'Tu solicitud de suscripción fue procesada correctamente.',
    ]);
}

/**
 * Cancela la suscripción mediante POST y token aleatorio válido.
 */
function cancelarSuscripcion(PDO $pdo): void
{
    $token = trim($_POST['token'] ?? '');
    if (!preg_match('/^[a-f0-9]{64}$/', $token)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'El enlace de cancelación no es válido.']);
        return;
    }

    $stmt = $pdo->prepare('SELECT id, estado FROM suscriptores_newsletter WHERE token_baja = ? LIMIT 1');
    $stmt->execute([$token]);
    $suscriptor = $stmt->fetch();

    if (!$suscriptor) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'mensaje' => 'No se encontró una suscripción asociada a este enlace.']);
        return;
    }

    if ($suscriptor['estado'] === 'inactivo') {
        echo json_encode(['ok' => true, 'mensaje' => 'Tu suscripción ya se encontraba cancelada.']);
        return;
    }

    $upd = $pdo->prepare(
        "UPDATE suscriptores_newsletter
         SET estado = 'inactivo', fecha_baja = NOW()
         WHERE id = ?"
    );
    $upd->execute([$suscriptor['id']]);

    echo json_encode([
        'ok'      => true,
        'mensaje' => 'Tu suscripción ha sido cancelada correctamente.',
    ]);
}

/**
 * Devuelve suscriptores, boletines y disponibilidad real de correo (solo administrador).
 */
function responderDatosAdmin(PDO $pdo): void
{
    iniciarSesionSegura();

    if (!estaAutenticado()) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'mensaje' => 'No autenticado.']);
        return;
    }

    if (!tieneRol(['administrador'])) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'Solo el administrador puede gestionar el newsletter.']);
        return;
    }

    $totalSuscriptores = (int) $pdo->query('SELECT COUNT(*) FROM suscriptores_newsletter')->fetchColumn();
    $suscriptoresActivos = (int) $pdo->query(
        "SELECT COUNT(*) FROM suscriptores_newsletter WHERE estado = 'activo'"
    )->fetchColumn();

    $suscriptores = $pdo->query(
        'SELECT id, correo, estado, fecha_registro, fecha_baja
         FROM suscriptores_newsletter
         ORDER BY fecha_registro DESC, id DESC'
    )->fetchAll();

    $boletines = $pdo->query(
        'SELECT id, asunto, contenido, estado, fecha_creacion, fecha_envio
         FROM boletines_newsletter
         ORDER BY fecha_creacion DESC, id DESC'
    )->fetchAll();

    echo json_encode([
        'ok'                   => true,
        'total_suscriptores'   => $totalSuscriptores,
        'suscriptores_activos' => $suscriptoresActivos,
        'suscriptores'         => $suscriptores,
        'boletines'            => $boletines,
        'correo_disponible'    => verificarServicioCorreoDisponible(),
    ]);
}

function guardarBoletin(PDO $pdo): void
{
    if (!verificarAdminYCsrf()) {
        return;
    }

    $id = (int) ($_POST['id'] ?? 0);
    $asunto = trim($_POST['asunto'] ?? '');
    $contenido = trim($_POST['contenido'] ?? '');

    if ($asunto === '' || mb_strlen($asunto) > 180) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'El asunto es obligatorio (máximo 180 caracteres).']);
        return;
    }

    if ($contenido === '') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'El contenido del boletín es obligatorio.']);
        return;
    }

    if ($id === 0) {
        $stmt = $pdo->prepare(
            "INSERT INTO boletines_newsletter (asunto, contenido, estado) VALUES (?, ?, 'borrador')"
        );
        $stmt->execute([$asunto, $contenido]);
        $id = (int) $pdo->lastInsertId();
    } else {
        $stmtCheck = $pdo->prepare('SELECT estado FROM boletines_newsletter WHERE id = ? LIMIT 1');
        $stmtCheck->execute([$id]);
        $actual = $stmtCheck->fetch();
        if (!$actual) {
            http_response_code(404);
            echo json_encode(['ok' => false, 'mensaje' => 'Boletín no encontrado.']);
            return;
        }
        if ($actual['estado'] !== 'borrador') {
            http_response_code(409);
            echo json_encode(['ok' => false, 'mensaje' => 'Solo se pueden editar boletines en borrador.']);
            return;
        }

        $stmt = $pdo->prepare('UPDATE boletines_newsletter SET asunto = ?, contenido = ? WHERE id = ?');
        $stmt->execute([$asunto, $contenido, $id]);
    }

    echo json_encode([
        'ok'      => true,
        'id'      => $id,
        'mensaje' => 'Borrador de boletín guardado correctamente.',
    ]);
}

function enviarBoletin(PDO $pdo): void
{
    if (!verificarAdminYCsrf()) {
        return;
    }

    if (!verificarServicioCorreoDisponible()) {
        http_response_code(503);
        echo json_encode([
            'ok'      => false,
            'mensaje' => 'No disponible: falta configurar un servicio de correo.',
        ]);
        return;
    }

    $id = (int) ($_POST['id'] ?? 0);
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Boletín no válido.']);
        return;
    }

    $stmt = $pdo->prepare('SELECT id, asunto, contenido, estado FROM boletines_newsletter WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $boletin = $stmt->fetch();

    if (!$boletin || $boletin['estado'] !== 'borrador') {
        http_response_code(409);
        echo json_encode(['ok' => false, 'mensaje' => 'El boletín no existe o ya fue procesado.']);
        return;
    }

    $suscriptores = $pdo->query(
        "SELECT correo, token_baja FROM suscriptores_newsletter WHERE estado = 'activo' LIMIT 50"
    )->fetchAll();

    if (empty($suscriptores)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'No hay suscriptores activos para enviar el boletín.']);
        return;
    }

    $remitente = ini_get('sendmail_from');
    $asuntoSeguro = str_replace(["\r", "\n"], '', $boletin['asunto']);
    $cabeceras = "From: {$remitente}\r\nContent-Type: text/plain; charset=UTF-8\r\n";
    $enviados = 0;

    foreach ($suscriptores as $s) {
        $enlaceBaja = 'http://localhost:8081/NewsCMS/baja_newsletter.html?token=' . urlencode($s['token_baja']);
        $cuerpo = $boletin['contenido'] . "\n\n---\nPara cancelar tu suscripción visita: " . $enlaceBaja;
        if (@mail($s['correo'], $asuntoSeguro, $cuerpo, $cabeceras)) {
            $enviados++;
        }
    }

    if ($enviados > 0) {
        $upd = $pdo->prepare("UPDATE boletines_newsletter SET estado = 'enviado', fecha_envio = NOW() WHERE id = ?");
        $upd->execute([$id]);
    }

    echo json_encode([
        'ok'      => $enviados > 0,
        'mensaje' => $enviados > 0
            ? "Boletín procesado para {$enviados} suscriptores activos."
            : 'No se pudo entregar ningún correo desde el servidor local.',
    ]);
}

function verificarAdminYCsrf(): bool
{
    iniciarSesionSegura();

    if (!estaAutenticado()) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'mensaje' => 'No autenticado.']);
        return false;
    }

    if (!tieneRol(['administrador'])) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'Solo el administrador puede gestionar el newsletter.']);
        return false;
    }

    if (!validarTokenCsrf($_POST['csrf_token'] ?? '')) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'Token CSRF inválido. Recarga la página.']);
        return false;
    }

    return true;
}

/**
 * Comprueba de forma real si PHP dispone de un servicio de correo operativo.
 */
function verificarServicioCorreoDisponible(): bool
{
    if (!function_exists('mail')) {
        return false;
    }

    $sendmailPath = trim((string) ini_get('sendmail_path'));
    if ($sendmailPath !== '') {
        return true;
    }

    $remitente = trim((string) ini_get('sendmail_from'));
    $smtpHost = trim((string) ini_get('SMTP'));
    $smtpPort = (int) ini_get('smtp_port');

    if ($remitente === '' || $smtpHost === '' || $smtpPort <= 0) {
        return false;
    }

    $conexion = @fsockopen($smtpHost, $smtpPort, $errno, $errstr, 1);
    if ($conexion) {
        fclose($conexion);
        return true;
    }

    return false;
}
