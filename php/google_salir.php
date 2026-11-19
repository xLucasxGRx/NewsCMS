<?php
/**
 * Cierra únicamente la sesión social del visitante sin afectar la sesión administrativa.
 */

require_once __DIR__ . '/../config/seguridad.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'mensaje' => 'Método no permitido.']);
    exit;
}

iniciarSesionSegura();

if (!validarTokenCsrf($_POST['csrf_token'] ?? '')) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'mensaje' => 'Token CSRF inválido.']);
    exit;
}

unset($_SESSION['social_usuario_id'], $_SESSION['social_nombre']);

echo json_encode([
    'ok'      => true,
    'mensaje' => 'Sesión social cerrada correctamente.',
]);
