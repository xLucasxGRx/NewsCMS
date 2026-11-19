<?php
/**
 * Endpoint de administración de cuentas internas (usuarios) para NewsCMS.
 */

require_once __DIR__ . '/../config/conexion.php';
require_once __DIR__ . '/../config/seguridad.php';

header('Content-Type: application/json; charset=utf-8');

if (!$conexionActiva || !$pdo) {
    http_response_code(503);
    echo json_encode(['ok' => false, 'mensaje' => 'Base de datos no disponible.']);
    exit;
}

iniciarSesionSegura();

if (!estaAutenticado()) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'mensaje' => 'No autenticado.']);
    exit;
}

if (!tieneRol(['administrador'])) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'mensaje' => 'Solo el administrador puede gestionar usuarios.']);
    exit;
}

$usuarioActual = obtenerUsuarioActual();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $accion = $_GET['accion'] ?? 'listar';
    if ($accion === 'listar') {
        listarUsuarios($pdo, (int) $usuarioActual['id']);
    } elseif ($accion === 'obtener') {
        obtenerUsuario($pdo, (int) $usuarioActual['id']);
    } else {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Acción no válida.']);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!validarTokenCsrf($_POST['csrf_token'] ?? '')) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'Token CSRF inválido. Recarga la página.']);
        exit;
    }

    $accion = trim($_POST['accion'] ?? '');
    if ($accion === 'crear') {
        crearUsuario($pdo);
    } elseif ($accion === 'editar') {
        editarUsuario($pdo, (int) $usuarioActual['id']);
    } elseif ($accion === 'cambiar_estado') {
        cambiarEstadoUsuario($pdo, (int) $usuarioActual['id']);
    } elseif ($accion === 'restablecer_contrasena') {
        restablecerContrasena($pdo);
    } else {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Acción no válida.']);
    }
    exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'mensaje' => 'Método no permitido.']);

function listarUsuarios(PDO $pdo, int $idActual): void
{
    $busqueda = trim($_GET['q'] ?? '');
    $rol = trim($_GET['rol'] ?? '');
    $estado = trim($_GET['estado'] ?? '');

    $sql = 'SELECT id, nombre, usuario, correo, rol, estado, fecha_creacion
            FROM usuarios
            WHERE 1=1';
    $parametros = [];

    if ($busqueda !== '') {
        $sql .= ' AND (nombre LIKE ? OR usuario LIKE ? OR correo LIKE ?)';
        $like = '%' . $busqueda . '%';
        $parametros[] = $like;
        $parametros[] = $like;
        $parametros[] = $like;
    }

    if (in_array($rol, ['administrador', 'editor', 'redactor'], true)) {
        $sql .= ' AND rol = ?';
        $parametros[] = $rol;
    }

    if (in_array($estado, ['activo', 'inactivo'], true)) {
        $sql .= ' AND estado = ?';
        $parametros[] = $estado;
    }

    $sql .= ' ORDER BY id ASC';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($parametros);
    $filas = $stmt->fetchAll();

    foreach ($filas as &$fila) {
        $fila['es_actual'] = ((int) $fila['id'] === $idActual);
    }

    echo json_encode([
        'ok'       => true,
        'usuarios' => $filas,
    ]);
}

function obtenerUsuario(PDO $pdo, int $idActual): void
{
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Usuario no válido.']);
        return;
    }

    $stmt = $pdo->prepare(
        'SELECT id, nombre, usuario, correo, rol, estado, fecha_creacion
         FROM usuarios
         WHERE id = ?
         LIMIT 1'
    );
    $stmt->execute([$id]);
    $fila = $stmt->fetch();

    if (!$fila) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'mensaje' => 'Usuario no encontrado.']);
        return;
    }

    $fila['es_actual'] = ((int) $fila['id'] === $idActual);

    echo json_encode([
        'ok'      => true,
        'usuario' => $fila,
    ]);
}

function crearUsuario(PDO $pdo): void
{
    $nombre = trim($_POST['nombre'] ?? '');
    $usuario = trim($_POST['usuario'] ?? '');
    $correo = strtolower(trim($_POST['correo'] ?? ''));
    $contrasena = $_POST['contrasena'] ?? '';
    $confirmar = $_POST['confirmar_contrasena'] ?? '';
    $rol = trim($_POST['rol'] ?? '');
    $estado = trim($_POST['estado'] ?? '');

    $errorValidacion = validarCamposUsuario($nombre, $usuario, $correo, $rol, $estado);
    if ($errorValidacion !== null) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => $errorValidacion]);
        return;
    }

    if (mb_strlen($contrasena) < 10) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'La contraseña inicial debe tener al menos 10 caracteres.']);
        return;
    }

    if ($contrasena !== $confirmar) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Las contraseñas no coinciden.']);
        return;
    }

    if (existeDuplicadoUsuario($pdo, 'usuario', $usuario, 0)) {
        http_response_code(409);
        echo json_encode(['ok' => false, 'mensaje' => 'El nombre de usuario ya está registrado.']);
        return;
    }

    if (existeDuplicadoUsuario($pdo, 'correo', $correo, 0)) {
        http_response_code(409);
        echo json_encode(['ok' => false, 'mensaje' => 'El correo electrónico ya está registrado.']);
        return;
    }

    $hash = password_hash($contrasena, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare(
        'INSERT INTO usuarios (nombre, usuario, correo, contrasena, rol, estado)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([$nombre, $usuario, $correo, $hash, $rol, $estado]);

    echo json_encode([
        'ok'      => true,
        'id'      => (int) $pdo->lastInsertId(),
        'mensaje' => 'Usuario creado correctamente.',
    ]);
}

function editarUsuario(PDO $pdo, int $idActual): void
{
    $id = (int) ($_POST['id'] ?? 0);
    $nombre = trim($_POST['nombre'] ?? '');
    $usuario = trim($_POST['usuario'] ?? '');
    $correo = strtolower(trim($_POST['correo'] ?? ''));
    $rol = trim($_POST['rol'] ?? '');
    $estado = trim($_POST['estado'] ?? '');

    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Usuario no válido.']);
        return;
    }

    $stmtActual = $pdo->prepare('SELECT id, rol, estado FROM usuarios WHERE id = ? LIMIT 1');
    $stmtActual->execute([$id]);
    $destino = $stmtActual->fetch();

    if (!$destino) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'mensaje' => 'Usuario no encontrado.']);
        return;
    }

    $errorValidacion = validarCamposUsuario($nombre, $usuario, $correo, $rol, $estado);
    if ($errorValidacion !== null) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => $errorValidacion]);
        return;
    }

    if ($id === $idActual && $estado !== 'activo') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'No puedes desactivar tu propia cuenta.']);
        return;
    }

    if ($id === $idActual && $rol !== 'administrador') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'No puedes cambiar tu propio rol de administrador.']);
        return;
    }

    // Impedir dejar el sistema sin al menos un administrador activo
    if ($destino['rol'] === 'administrador' && $destino['estado'] === 'activo') {
        if ($rol !== 'administrador' || $estado !== 'activo') {
            if (!existeOtroAdministradorActivo($pdo, $id)) {
                http_response_code(409);
                echo json_encode(['ok' => false, 'mensaje' => 'Debe permanecer al menos un administrador activo en el sistema.']);
                return;
            }
        }
    }

    if (existeDuplicadoUsuario($pdo, 'usuario', $usuario, $id)) {
        http_response_code(409);
        echo json_encode(['ok' => false, 'mensaje' => 'El nombre de usuario ya pertenece a otra cuenta.']);
        return;
    }

    if (existeDuplicadoUsuario($pdo, 'correo', $correo, $id)) {
        http_response_code(409);
        echo json_encode(['ok' => false, 'mensaje' => 'El correo electrónico ya pertenece a otra cuenta.']);
        return;
    }

    $stmt = $pdo->prepare(
        'UPDATE usuarios
         SET nombre = ?, usuario = ?, correo = ?, rol = ?, estado = ?
         WHERE id = ?'
    );
    $stmt->execute([$nombre, $usuario, $correo, $rol, $estado, $id]);

    echo json_encode([
        'ok'      => true,
        'mensaje' => 'Usuario actualizado correctamente.',
    ]);
}

function cambiarEstadoUsuario(PDO $pdo, int $idActual): void
{
    $id = (int) ($_POST['id'] ?? 0);
    $estado = trim($_POST['estado'] ?? '');

    if ($id <= 0 || !in_array($estado, ['activo', 'inactivo'], true)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Datos de estado no válidos.']);
        return;
    }

    if ($id === $idActual && $estado !== 'activo') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'No puedes desactivar tu propia cuenta.']);
        return;
    }

    $stmtActual = $pdo->prepare('SELECT id, rol, estado FROM usuarios WHERE id = ? LIMIT 1');
    $stmtActual->execute([$id]);
    $destino = $stmtActual->fetch();

    if (!$destino) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'mensaje' => 'Usuario no encontrado.']);
        return;
    }

    if ($destino['rol'] === 'administrador' && $destino['estado'] === 'activo' && $estado === 'inactivo') {
        if (!existeOtroAdministradorActivo($pdo, $id)) {
            http_response_code(409);
            echo json_encode(['ok' => false, 'mensaje' => 'Debe permanecer al menos un administrador activo en el sistema.']);
            return;
        }
    }

    $stmt = $pdo->prepare('UPDATE usuarios SET estado = ? WHERE id = ?');
    $stmt->execute([$estado, $id]);

    echo json_encode([
        'ok'      => true,
        'mensaje' => $estado === 'activo' ? 'Cuenta activada correctamente.' : 'Cuenta desactivada correctamente.',
    ]);
}

function restablecerContrasena(PDO $pdo): void
{
    $id = (int) ($_POST['id'] ?? 0);
    $nueva = $_POST['nueva_contrasena'] ?? '';
    $confirmar = $_POST['confirmar_contrasena'] ?? '';

    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Usuario no válido.']);
        return;
    }

    $stmtExiste = $pdo->prepare('SELECT id FROM usuarios WHERE id = ? LIMIT 1');
    $stmtExiste->execute([$id]);
    if (!$stmtExiste->fetch()) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'mensaje' => 'Usuario no encontrado.']);
        return;
    }

    if (mb_strlen($nueva) < 10) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'La nueva contraseña debe tener al menos 10 caracteres.']);
        return;
    }

    if ($nueva !== $confirmar) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Las contraseñas no coinciden.']);
        return;
    }

    $hash = password_hash($nueva, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare('UPDATE usuarios SET contrasena = ? WHERE id = ?');
    $stmt->execute([$hash, $id]);

    echo json_encode([
        'ok'      => true,
        'mensaje' => 'Contraseña restablecida correctamente.',
    ]);
}

function validarCamposUsuario(string $nombre, string $usuario, string $correo, string $rol, string $estado): ?string
{
    if ($nombre === '' || mb_strlen($nombre) > 120) {
        return 'El nombre completo es obligatorio (máximo 120 caracteres).';
    }

    if (!preg_match('/^[a-zA-Z0-9._-]{3,60}$/', $usuario)) {
        return 'El nombre de usuario debe tener entre 3 y 60 caracteres (letras, números, punto, guion o guion bajo).';
    }

    if ($correo === '' || mb_strlen($correo) > 150 || !filter_var($correo, FILTER_VALIDATE_EMAIL)) {
        return 'Ingresa un correo electrónico válido.';
    }

    if (!in_array($rol, ['administrador', 'editor', 'redactor'], true)) {
        return 'Selecciona un rol válido.';
    }

    if (!in_array($estado, ['activo', 'inactivo'], true)) {
        return 'Selecciona un estado válido.';
    }

    return null;
}

function existeDuplicadoUsuario(PDO $pdo, string $campo, string $valor, int $excluirId): bool
{
    $stmt = $pdo->prepare("SELECT id FROM usuarios WHERE LOWER({$campo}) = LOWER(?) AND id <> ? LIMIT 1");
    $stmt->execute([$valor, $excluirId]);
    return (bool) $stmt->fetch();
}

function existeOtroAdministradorActivo(PDO $pdo, int $excluirId): bool
{
    $stmt = $pdo->prepare(
        "SELECT COUNT(*) FROM usuarios WHERE rol = 'administrador' AND estado = 'activo' AND id <> ?"
    );
    $stmt->execute([$excluirId]);
    return (int) $stmt->fetchColumn() > 0;
}
