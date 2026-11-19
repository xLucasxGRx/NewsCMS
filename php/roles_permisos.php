<?php
/**
 * Administración de la matriz de roles y permisos editoriales.
 * Permite al administrador consultar y actualizar permisos editables en MySQL.
 */

require_once __DIR__ . '/../config/conexion.php';
require_once __DIR__ . '/../config/seguridad.php';

header('Content-Type: application/json; charset=utf-8');

iniciarSesionSegura();

if (!estaAutenticado()) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'mensaje' => 'Sesión no iniciada.']);
    exit;
}

if (!tieneRol(['administrador']) || !tienePermiso('modificar_roles_permisos')) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'mensaje' => 'Solo el administrador puede consultar o modificar roles y permisos.']);
    exit;
}

if (!$conexionActiva || !($pdo instanceof PDO)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'mensaje' => 'No hay conexión disponible con MySQL.']);
    exit;
}

/**
 * Construye la respuesta estructurada con catálogo y matriz efectiva de los 3 roles.
 */
function construirRespuestaMatriz(): array
{
    $catalogo = obtenerCatalogoPermisos();

    $editables = [];
    foreach ($catalogo['editables'] as $clave => $meta) {
        $editables[] = [
            'clave'       => $clave,
            'etiqueta'    => $meta['etiqueta'],
            'descripcion' => $meta['descripcion'],
            'grupo'       => $meta['grupo'],
        ];
    }

    $protegidos = [];
    foreach ($catalogo['protegidos'] as $clave => $meta) {
        $protegidos[] = [
            'clave'       => $clave,
            'etiqueta'    => $meta['etiqueta'],
            'descripcion' => $meta['descripcion'],
            'grupo'       => $meta['grupo'],
        ];
    }

    return [
        'roles' => [
            ['clave' => 'administrador', 'nombre' => 'Administrador', 'editable' => false],
            ['clave' => 'editor', 'nombre' => 'Editor', 'editable' => true],
            ['clave' => 'redactor', 'nombre' => 'Redactor', 'editable' => true],
        ],
        'editables'  => $editables,
        'protegidos' => $protegidos,
        'matriz'     => [
            'administrador' => obtenerPermisosPorRol('administrador'),
            'editor'        => obtenerPermisosPorRol('editor'),
            'redactor'      => obtenerPermisosPorRol('redactor'),
        ],
    ];
}

/**
 * Extrae datos de una petición POST FormData o JSON.
 */
function leerEntradaPostRoles(): array
{
    if (!empty($_POST)) {
        return $_POST;
    }

    $cuerpo = file_get_contents('php://input');
    if (is_string($cuerpo) && trim($cuerpo) !== '') {
        $decodificado = json_decode($cuerpo, true);
        if (is_array($decodificado)) {
            return $decodificado;
        }
    }

    return [];
}

$metodo = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($metodo === 'GET') {
    echo json_encode(array_merge(['ok' => true], construirRespuestaMatriz()));
    exit;
}

if ($metodo !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'mensaje' => 'Método HTTP no permitido.']);
    exit;
}

$entrada = leerEntradaPostRoles();
$tokenCsrf = (string) ($entrada['csrf_token'] ?? '');
if (!validarTokenCsrf($tokenCsrf)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'mensaje' => 'Token CSRF inválido o expirado.']);
    exit;
}

$accion = trim((string) ($entrada['accion'] ?? 'guardar'));
if ($accion !== 'guardar') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'mensaje' => 'Acción no reconocida.']);
    exit;
}

$permisosCrudos = $entrada['permisos'] ?? null;
if (is_string($permisosCrudos)) {
    $permisosCrudos = json_decode($permisosCrudos, true);
}

if (!is_array($permisosCrudos)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'mensaje' => 'No se recibió la matriz de permisos en un formato válido.']);
    exit;
}

$catalogo = obtenerCatalogoPermisos();
$clavesEditables = array_keys($catalogo['editables']);
$clavesProtegidas = array_keys($catalogo['protegidos']);
$rolesValidos = ['administrador', 'editor', 'redactor'];

foreach (array_keys($permisosCrudos) as $rolEnviado) {
    if (!in_array($rolEnviado, $rolesValidos, true)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Se recibió un rol no válido en la solicitud.']);
        exit;
    }
}

// El administrador no puede perder permisos en ningún caso.
if (isset($permisosCrudos['administrador']) && is_array($permisosCrudos['administrador'])) {
    foreach ($permisosCrudos['administrador'] as $clave => $valor) {
        if (!in_array($clave, $clavesEditables, true) && !in_array($clave, $clavesProtegidas, true)) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'mensaje' => 'Se recibió un permiso no reconocido: ' . $clave]);
            exit;
        }
        if (!filter_var($valor, FILTER_VALIDATE_BOOLEAN)) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'mensaje' => 'El rol administrador no puede perder ningún permiso del sistema.']);
            exit;
        }
    }
}

$mapasActualizados = [];
foreach (['editor', 'redactor'] as $rolEditable) {
    $actual = obtenerPermisosPorRol($rolEditable);
    $mapaRol = [];
    foreach ($clavesEditables as $clave) {
        $mapaRol[$clave] = !empty($actual[$clave]);
    }

    if (isset($permisosCrudos[$rolEditable])) {
        if (!is_array($permisosCrudos[$rolEditable])) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'mensaje' => 'Formato de permisos inválido para el rol ' . $rolEditable . '.']);
            exit;
        }

        foreach ($permisosCrudos[$rolEditable] as $clave => $valor) {
            if (in_array($clave, $clavesProtegidas, true)) {
                if (filter_var($valor, FILTER_VALIDATE_BOOLEAN)) {
                    http_response_code(400);
                    echo json_encode(['ok' => false, 'mensaje' => 'Los permisos administrativos protegidos son exclusivos del rol administrador.']);
                    exit;
                }
                continue;
            }

            if (!in_array($clave, $clavesEditables, true)) {
                http_response_code(400);
                echo json_encode(['ok' => false, 'mensaje' => 'Se recibió un permiso no reconocido: ' . $clave]);
                exit;
            }

            $mapaRol[$clave] = filter_var($valor, FILTER_VALIDATE_BOOLEAN);
        }
    }

    $errorDependencia = validarDependenciasPermisos($rolEditable, $mapaRol);
    if ($errorDependencia !== null) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => ucfirst($rolEditable) . ': ' . $errorDependencia]);
        exit;
    }

    $mapasActualizados[$rolEditable] = $mapaRol;
}

try {
    $pdo->beginTransaction();

    $sentencia = $pdo->prepare(
        'INSERT INTO permisos_roles (rol, permiso, permitido)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE permitido = VALUES(permitido)'
    );

    // Garantizar siempre los 13 permisos editables activos para administrador
    foreach ($clavesEditables as $clave) {
        $sentencia->execute(['administrador', $clave, 1]);
    }

    foreach ($mapasActualizados as $rol => $mapaRol) {
        foreach ($clavesEditables as $clave) {
            $sentencia->execute([$rol, $clave, !empty($mapaRol[$clave]) ? 1 : 0]);
        }
    }

    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['ok' => false, 'mensaje' => 'No se pudieron guardar los permisos en MySQL.']);
    exit;
}

echo json_encode(array_merge([
    'ok'      => true,
    'mensaje' => 'Permisos de roles actualizados correctamente.',
], construirRespuestaMatriz()));
