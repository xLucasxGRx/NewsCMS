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
    if (!isset($_SESSION['usuario_id']) || !is_int($_SESSION['usuario_id'])) {
        return false;
    }

    global $pdo, $conexionActiva;
    if (!isset($pdo)) {
        require_once __DIR__ . '/conexion.php';
    }

    if (!empty($conexionActiva) && $pdo instanceof PDO) {
        $stmt = $pdo->prepare('SELECT nombre, usuario, rol, estado FROM usuarios WHERE id = ? LIMIT 1');
        $stmt->execute([$_SESSION['usuario_id']]);
        $fila = $stmt->fetch();

        if (!$fila || $fila['estado'] !== 'activo') {
            unset(
                $_SESSION['usuario_id'],
                $_SESSION['usuario_nombre'],
                $_SESSION['usuario_login'],
                $_SESSION['usuario_rol']
            );
            return false;
        }

        $_SESSION['usuario_nombre'] = $fila['nombre'];
        $_SESSION['usuario_login']  = $fila['usuario'];
        $_SESSION['usuario_rol']    = $fila['rol'];
    }

    return true;
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

/**
 * Devuelve la definición de todos los permisos editoriales editables y protegidos.
 */
function obtenerCatalogoPermisos(): array
{
    return [
        'editables' => [
            'ver_dashboard' => [
                'etiqueta' => 'Ver dashboard',
                'descripcion' => 'Consultar estadísticas y resumen del panel principal.',
                'grupo' => 'Panel',
                'por_defecto' => ['administrador' => true, 'editor' => true, 'redactor' => true],
            ],
            'crear_noticias' => [
                'etiqueta' => 'Crear noticias',
                'descripcion' => 'Registrar nuevas noticias en borrador o flujo editorial.',
                'grupo' => 'Noticias',
                'por_defecto' => ['administrador' => true, 'editor' => true, 'redactor' => true],
            ],
            'consultar_noticias_propias' => [
                'etiqueta' => 'Consultar noticias propias',
                'descripcion' => 'Listar y abrir las noticias creadas por el propio usuario.',
                'grupo' => 'Noticias',
                'por_defecto' => ['administrador' => true, 'editor' => true, 'redactor' => true],
            ],
            'consultar_noticias_ajenas' => [
                'etiqueta' => 'Consultar noticias de otros autores',
                'descripcion' => 'Visualizar y previsualizar noticias creadas por otros usuarios.',
                'grupo' => 'Noticias',
                'por_defecto' => ['administrador' => true, 'editor' => true, 'redactor' => false],
            ],
            'editar_noticias_propias' => [
                'etiqueta' => 'Editar noticias propias',
                'descripcion' => 'Modificar noticias creadas por el propio usuario según su estado.',
                'grupo' => 'Noticias',
                'por_defecto' => ['administrador' => true, 'editor' => true, 'redactor' => true],
            ],
            'editar_noticias_ajenas' => [
                'etiqueta' => 'Editar noticias de otros autores',
                'descripcion' => 'Modificar noticias creadas por otros miembros del equipo.',
                'grupo' => 'Noticias',
                'por_defecto' => ['administrador' => true, 'editor' => true, 'redactor' => false],
            ],
            'enviar_revision' => [
                'etiqueta' => 'Enviar a revisión',
                'descripcion' => 'Enviar noticias propias o editables a la cola de revisión editorial.',
                'grupo' => 'Flujo editorial',
                'por_defecto' => ['administrador' => true, 'editor' => true, 'redactor' => true],
            ],
            'publicar_noticias' => [
                'etiqueta' => 'Gestionar visibilidad editorial',
                'descripcion' => 'Retirar o restaurar noticias aprobadas y marcarlas como destacadas o de última hora.',
                'grupo' => 'Flujo editorial',
                'por_defecto' => ['administrador' => true, 'editor' => true, 'redactor' => false],
            ],
            'consultar_revision' => [
                'etiqueta' => 'Consultar revisión editorial',
                'descripcion' => 'Acceder a la bandeja de noticias pendientes de revisión y su historial.',
                'grupo' => 'Revisión editorial',
                'por_defecto' => ['administrador' => true, 'editor' => true, 'redactor' => false],
            ],
            'aprobar_noticias' => [
                'etiqueta' => 'Aprobar noticias',
                'descripcion' => 'Aprobar y publicar noticias enviadas a revisión editorial.',
                'grupo' => 'Revisión editorial',
                'por_defecto' => ['administrador' => true, 'editor' => true, 'redactor' => false],
            ],
            'solicitar_correcciones' => [
                'etiqueta' => 'Solicitar correcciones',
                'descripcion' => 'Devolver noticias con observaciones editoriales al autor.',
                'grupo' => 'Revisión editorial',
                'por_defecto' => ['administrador' => true, 'editor' => true, 'redactor' => false],
            ],
            'gestionar_categorias' => [
                'etiqueta' => 'Gestionar categorías',
                'descripcion' => 'Crear, editar y eliminar categorías del portal.',
                'grupo' => 'Catálogos',
                'por_defecto' => ['administrador' => true, 'editor' => true, 'redactor' => false],
            ],
            'gestionar_etiquetas' => [
                'etiqueta' => 'Gestionar etiquetas',
                'descripcion' => 'Crear, editar y eliminar etiquetas del portal.',
                'grupo' => 'Catálogos',
                'por_defecto' => ['administrador' => true, 'editor' => true, 'redactor' => false],
            ],
        ],
        'protegidos' => [
            'administrar_usuarios' => [
                'etiqueta' => 'Administrar usuarios',
                'descripcion' => 'Crear, editar, activar o desactivar cuentas internas y restablecer contraseñas.',
                'grupo' => 'Administración del sistema',
            ],
            'modificar_roles_permisos' => [
                'etiqueta' => 'Modificar roles y permisos',
                'descripcion' => 'Configurar la matriz de permisos editoriales por rol.',
                'grupo' => 'Administración del sistema',
            ],
            'configurar_sistema' => [
                'etiqueta' => 'Configurar sistema',
                'descripcion' => 'Editar la configuración general e institucional del portal.',
                'grupo' => 'Administración del sistema',
            ],
            'gestionar_complementos' => [
                'etiqueta' => 'Gestionar complementos',
                'descripcion' => 'Instalar, activar, desactivar o eliminar complementos.',
                'grupo' => 'Administración del sistema',
            ],
            'configurar_complementos' => [
                'etiqueta' => 'Configurar complementos',
                'descripcion' => 'Modificar parámetros técnicos de los complementos instalados.',
                'grupo' => 'Administración del sistema',
            ],
            'gestionar_temas' => [
                'etiqueta' => 'Gestionar temas visuales',
                'descripcion' => 'Instalar, activar, desactivar o eliminar temas del portal.',
                'grupo' => 'Administración del sistema',
            ],
            'moderar_comentarios' => [
                'etiqueta' => 'Moderar comentarios',
                'descripcion' => 'Aprobar, rechazar o eliminar comentarios sociales publicados.',
                'grupo' => 'Administración del sistema',
            ],
        ],
    ];
}

/**
 * Valida reglas de coherencia funcional para un rol y un mapa de permisos editables.
 * Devuelve null si es válido o un mensaje descriptivo del error.
 */
function validarDependenciasPermisos(string $rol, array $permisos): ?string
{
    if ($rol === 'administrador') {
        $catalogo = obtenerCatalogoPermisos();
        foreach (array_keys($catalogo['editables']) as $clave) {
            if (empty($permisos[$clave])) {
                return 'El rol administrador no puede perder ningún permiso del sistema.';
            }
        }
        return null;
    }

    if (!empty($permisos['editar_noticias_propias']) && empty($permisos['consultar_noticias_propias'])) {
        return 'Para editar noticias propias primero debe permitirse consultar noticias propias.';
    }

    if (!empty($permisos['editar_noticias_ajenas']) && empty($permisos['consultar_noticias_ajenas'])) {
        return 'Para editar noticias de otros autores primero debe permitirse consultarlas.';
    }

    if (
        !empty($permisos['enviar_revision']) &&
        empty($permisos['crear_noticias']) &&
        empty($permisos['editar_noticias_propias'])
    ) {
        return 'Para enviar noticias a revisión debe permitirse crear noticias o editar noticias propias.';
    }

    if (
        !empty($permisos['publicar_noticias']) &&
        empty($permisos['crear_noticias']) &&
        empty($permisos['editar_noticias_propias']) &&
        empty($permisos['editar_noticias_ajenas'])
    ) {
        return 'Para publicar noticias directamente debe permitirse crear o editar noticias.';
    }

    if (
        (!empty($permisos['aprobar_noticias']) || !empty($permisos['solicitar_correcciones'])) &&
        empty($permisos['consultar_revision'])
    ) {
        return 'Para aprobar noticias o solicitar correcciones debe permitirse consultar la revisión editorial.';
    }

    return null;
}

/**
 * Obtiene el mapa efectivo de permisos (editables + protegidos) para un rol.
 */
function obtenerPermisosPorRol(string $rol): array
{
    $catalogo = obtenerCatalogoPermisos();
    $resultado = [];

    $esAdmin = ($rol === 'administrador');
    foreach ($catalogo['editables'] as $clave => $meta) {
        $resultado[$clave] = $esAdmin ? true : (bool) ($meta['por_defecto'][$rol] ?? false);
    }

    // Los permisos protegidos están reservados exclusivamente al administrador.
    foreach ($catalogo['protegidos'] as $clave => $_meta) {
        $resultado[$clave] = $esAdmin;
    }

    if ($esAdmin || !in_array($rol, ['editor', 'redactor'], true)) {
        return $resultado;
    }

    global $pdo;
    if (!isset($pdo) || !($pdo instanceof PDO)) {
        $rutaConexion = __DIR__ . '/conexion.php';
        if (is_file($rutaConexion)) {
            require_once $rutaConexion;
        }
    }

    if (isset($pdo) && ($pdo instanceof PDO)) {
        try {
            $sentencia = $pdo->prepare('SELECT permiso, permitido FROM permisos_roles WHERE rol = ?');
            $sentencia->execute([$rol]);
            $filas = $sentencia->fetchAll(PDO::FETCH_ASSOC);
            foreach ($filas as $fila) {
                $clave = (string) ($fila['permiso'] ?? '');
                if (array_key_exists($clave, $catalogo['editables'])) {
                    $resultado[$clave] = ((int) $fila['permitido']) === 1;
                }
            }
        } catch (Throwable $e) {
            // Si la tabla aún no existe, conserva los valores por defecto.
        }
    }

    return $resultado;
}

/**
 * Devuelve todos los permisos efectivos del usuario autenticado actual.
 */
function obtenerPermisosUsuarioActual(): array
{
    $usuario = obtenerUsuarioActual();
    if ($usuario === null) {
        return [];
    }

    return obtenerPermisosPorRol((string) $usuario['rol']);
}

/**
 * Verifica si el usuario autenticado posee un permiso efectivo específico.
 */
function tienePermiso(string $permiso): bool
{
    $usuario = obtenerUsuarioActual();
    if ($usuario === null) {
        return false;
    }

    $permisos = obtenerPermisosPorRol((string) $usuario['rol']);
    return !empty($permisos[$permiso]);
}

/**
 * Detiene la ejecución con HTTP 401/403 si el usuario no posee el permiso requerido.
 */
function requerirPermiso(string $permiso): void
{
    requerirAutenticacion();
    if (!tienePermiso($permiso)) {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => false, 'mensaje' => 'No tienes permiso para realizar esta acción.']);
        exit;
    }
}
