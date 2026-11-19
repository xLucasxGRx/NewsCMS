<?php
/**
 * Cierra la sesión actual mediante POST protegido por CSRF y responde en JSON.
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

cerrarSesion();

echo json_encode([
    'ok'        => true,
    'redirigir' => '../acceso.html',
]);
