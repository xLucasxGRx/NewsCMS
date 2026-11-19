<?php
/**
 * Procesa el inicio de sesión mediante POST y responde en JSON.
 */

require_once __DIR__ . '/../config/conexion.php';
require_once __DIR__ . '/../config/seguridad.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'mensaje' => 'Método no permitido.']);
    exit;
}

iniciarSesionSegura();

$identificador = trim($_POST['identificador'] ?? '');
$contrasena = $_POST['contrasena'] ?? '';
$tokenCsrf = $_POST['csrf_token'] ?? '';

if (!validarTokenCsrf($tokenCsrf)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'mensaje' => 'La solicitud no es válida. Recarga la página e inténtalo de nuevo.']);
    exit;
}

$tiempoActual = time();
$bloqueadoHasta = $_SESSION['bloqueo_acceso_hasta'] ?? 0;

if ($bloqueadoHasta > $tiempoActual) {
    $segundos = $bloqueadoHasta - $tiempoActual;
    http_response_code(429);
    echo json_encode(['ok' => false, 'mensaje' => "Demasiados intentos fallidos. Espera {$segundos} segundos."]);
    exit;
}

if ($identificador === '' || $contrasena === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'mensaje' => 'Ingresa tu usuario o correo electrónico y tu contraseña.']);
    exit;
}

if (!$conexionActiva || !$pdo) {
    http_response_code(503);
    echo json_encode(['ok' => false, 'mensaje' => 'El servicio de autenticación no está disponible en este momento.']);
    exit;
}

$consulta = $pdo->prepare(
    'SELECT id, nombre, usuario, correo, contrasena, rol, estado
     FROM usuarios
     WHERE usuario = ? OR correo = ?
     LIMIT 1'
);
$consulta->execute([$identificador, $identificador]);
$usuario = $consulta->fetch();

if ($usuario && password_verify($contrasena, $usuario['contrasena'])) {
    if ($usuario['estado'] !== 'activo') {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'Tu cuenta se encuentra inactiva.']);
        exit;
    }

    session_regenerate_id(true);
    unset($_SESSION['intentos_acceso'], $_SESSION['bloqueo_acceso_hasta']);

    $_SESSION['usuario_id']     = (int) $usuario['id'];
    $_SESSION['usuario_nombre'] = $usuario['nombre'];
    $_SESSION['usuario_login']  = $usuario['usuario'];
    $_SESSION['usuario_rol']    = $usuario['rol'];

    echo json_encode([
        'ok'        => true,
        'mensaje'   => 'Inicio de sesión correcto.',
        'redirigir' => 'admin/index.html',
    ]);
    exit;
}

$intentos = ($_SESSION['intentos_acceso'] ?? 0) + 1;
$_SESSION['intentos_acceso'] = $intentos;

if ($intentos >= 5) {
    $_SESSION['bloqueo_acceso_hasta'] = $tiempoActual + 60;
    $_SESSION['intentos_acceso'] = 0;
    http_response_code(429);
    echo json_encode(['ok' => false, 'mensaje' => 'Demasiados intentos fallidos. Espera 60 segundos.']);
    exit;
}

http_response_code(401);
echo json_encode(['ok' => false, 'mensaje' => 'Usuario o contraseña incorrectos.']);
