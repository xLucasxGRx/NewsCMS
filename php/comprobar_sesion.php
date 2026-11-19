<?php
/**
 * Comprueba el estado de la sesión actual y devuelve JSON.
 * También entrega el token CSRF para formularios HTML.
 */

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

$modulosPorRol = [
    'administrador' => [
        'Dashboard',
        'Noticias',
        'Categorías',
        'Etiquetas',
        'Revisión editorial',
        'Usuarios',
        'Complementos',
        'Temas',
        'Configuración',
    ],
    'editor' => [
        'Dashboard',
        'Noticias',
        'Categorías',
        'Etiquetas',
        'Revisión editorial',
    ],
    'redactor' => [
        'Dashboard',
        'Noticias',
    ],
];

echo json_encode([
    'autenticado'        => true,
    'usuario'            => [
        'nombre'  => $usuario['nombre'],
        'usuario' => $usuario['usuario'],
        'rol'     => $rol,
    ],
    'modulos_permitidos' => $modulosPorRol[$rol] ?? ['Dashboard'],
    'csrf_token'         => $tokenCsrf,
]);
