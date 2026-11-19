<?php
/**
 * Devuelve estadísticas reales desde MySQL para el dashboard administrativo.
 */

require_once __DIR__ . '/../config/conexion.php';
require_once __DIR__ . '/../config/seguridad.php';

header('Content-Type: application/json; charset=utf-8');

iniciarSesionSegura();

if (!estaAutenticado()) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'mensaje' => 'No autenticado.']);
    exit;
}

if (!tieneRol(['administrador', 'editor', 'redactor'])) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'mensaje' => 'No autorizado.']);
    exit;
}

if (!$conexionActiva || !$pdo) {
    http_response_code(503);
    echo json_encode(['ok' => false, 'mensaje' => 'Base de datos no disponible.']);
    exit;
}

$totalNoticias = (int) $pdo->query('SELECT COUNT(*) FROM noticias')->fetchColumn();
$noticiasPublicadas = (int) $pdo->query("SELECT COUNT(*) FROM noticias WHERE estado = 'publicada'")->fetchColumn();
$noticiasPendientes = (int) $pdo->query("SELECT COUNT(*) FROM noticias WHERE estado = 'pendiente_revision'")->fetchColumn();
$totalUsuarios = (int) $pdo->query('SELECT COUNT(*) FROM usuarios')->fetchColumn();

echo json_encode([
    'ok'                  => true,
    'total_noticias'      => $totalNoticias,
    'noticias_publicadas' => $noticiasPublicadas,
    'noticias_pendientes' => $noticiasPendientes,
    'total_usuarios'      => $totalUsuarios,
]);
