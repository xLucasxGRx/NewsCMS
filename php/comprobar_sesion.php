<?php
/**
 * Comprueba el estado de la sesión actual y devuelve JSON.
 * También entrega el token CSRF para formularios HTML.
 */

require_once __DIR__ . '/../config/conexion.php';
require_once __DIR__ . '/../config/seguridad.php';

header('Content-Type: application/json; charset=utf-8');

iniciarSesionSegura();
$tokenCsrf = generarTokenCsrf();

if (!estaAutenticado()) {
    echo json_encode([
        'autenticado' => false,
        'csrf_token'  => $tokenCsrf,
    ]);
    exit;
}

$usuario = obtenerUsuarioActual();
$rol = $usuario['rol'];
$permisos = obtenerPermisosPorRol($rol);

$modulosPermitidos = [];
if (!empty($permisos['ver_dashboard'])) {
    $modulosPermitidos[] = 'Dashboard';
}
if (
    !empty($permisos['crear_noticias']) ||
    !empty($permisos['consultar_noticias_propias']) ||
    !empty($permisos['consultar_noticias_ajenas'])
) {
    $modulosPermitidos[] = 'Noticias';
}
if (!empty($permisos['gestionar_categorias'])) {
    $modulosPermitidos[] = 'Categorías';
}
if (!empty($permisos['gestionar_etiquetas'])) {
    $modulosPermitidos[] = 'Etiquetas';
}
if (!empty($permisos['consultar_revision'])) {
    $modulosPermitidos[] = 'Revisión editorial';
}
if (!empty($permisos['administrar_usuarios'])) {
    $modulosPermitidos[] = 'Usuarios';
}
if (!empty($permisos['gestionar_complementos'])) {
    $modulosPermitidos[] = 'Complementos';
}
if (!empty($permisos['gestionar_temas'])) {
    $modulosPermitidos[] = 'Temas';
}
if (!empty($permisos['configurar_sistema'])) {
    $modulosPermitidos[] = 'Configuración';
}

echo json_encode([
    'autenticado'        => true,
    'usuario'            => [
        'id'      => $usuario['id'],
        'nombre'  => $usuario['nombre'],
        'usuario' => $usuario['usuario'],
        'rol'     => $rol,
    ],
    'modulos_permitidos' => $modulosPermitidos,
    'permisos'           => $permisos,
    'csrf_token'         => $tokenCsrf,
]);
