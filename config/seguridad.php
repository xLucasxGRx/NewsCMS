<?php
/**
 * Funciones de seguridad, sesiones, CSRF y control de roles para NewsCMS.
 */

// Evitar acceso directo desde el navegador a este archivo
if (PHP_SAPI !== 'cli' && realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    http_response_code(403);
    exit('Acceso denegado.');
}

/**
 * Inicia la sesión PHP con parámetros básicos de seguridad.
 */
function iniciarSesionSegura(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    ini_set('session.use_strict_mode', '1');
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);

    session_start();
}

/**
 * Comprueba si existe una sesión de usuario autenticada.
 */
function estaAutenticado(): bool
{
    iniciarSesionSegura();
    return isset($_SESSION['usuario_id']) && is_int($_SESSION['usuario_id']);
}

/**
 * Devuelve los datos básicos del usuario autenticado o null si no hay sesión.
 */
function obtenerUsuarioActual(): ?array
{
    if (!estaAutenticado()) {
        return null;
    }

    return [
        'id'      => $_SESSION['usuario_id'],
        'nombre'  => $_SESSION['usuario_nombre'] ?? '',
        'usuario' => $_SESSION['usuario_login'] ?? '',
        'rol'     => $_SESSION['usuario_rol'] ?? '',
    ];
}

/**
 * Verifica si el usuario autenticado posee uno de los roles permitidos.
 */
function tieneRol($rolesPermitidos): bool
{
    $usuario = obtenerUsuarioActual();
    if ($usuario === null) {
        return false;
    }

    $listaRoles = is_array($rolesPermitidos) ? $rolesPermitidos : [$rolesPermitidos];
    return in_array($usuario['rol'], $listaRoles, true);
}

/**
 * Protege una página exigiendo que el usuario haya iniciado sesión.
 */
function requerirAutenticacion(string $rutaAcceso = 'acceso.php'): void
{
    if (!estaAutenticado()) {
        header('Location: ' . $rutaAcceso);
        exit;
    }
}

/**
 * Verifica en el servidor que el rol del usuario esté autorizado.
 */
function requerirRol($rolesPermitidos): void
{
    if (!tieneRol($rolesPermitidos)) {
        http_response_code(403);
        exit('No tienes permisos para acceder a esta sección.');
    }
}

/**
 * Genera o devuelve el token CSRF almacenado en la sesión.
 */
function generarTokenCsrf(): string
{
    iniciarSesionSegura();

    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }

    return $_SESSION['csrf_token'];
}

/**
 * Valida un token CSRF recibido por POST.
 */
function validarTokenCsrf(?string $token): bool
{
    iniciarSesionSegura();

    if (empty($_SESSION['csrf_token']) || empty($token)) {
        return false;
    }

    return hash_equals($_SESSION['csrf_token'], $token);
}

/**
 * Cierra la sesión actual e invalida la cookie de sesión.
 */
function cerrarSesion(): void
{
    iniciarSesionSegura();

    $_SESSION = [];

    if (ini_get('session.use_cookies')) {
        $parametros = session_get_cookie_params();
        setcookie(
            session_name(),
            '',
            time() - 42000,
            $parametros['path'],
            $parametros['domain'],
            $parametros['secure'],
            $parametros['httponly']
        );
    }

    session_destroy();
}

/**
 * Escapa texto para mostrarlo de forma segura en HTML.
 */
function escaparHtml(?string $texto): string
{
    return htmlspecialchars((string) $texto, ENT_QUOTES, 'UTF-8');
}
