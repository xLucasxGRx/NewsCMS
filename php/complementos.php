<?php
/**
 * Gestor sencillo de complementos ZIP para NewsCMS.
 */

require_once __DIR__ . '/../config/conexion.php';
require_once __DIR__ . '/../config/seguridad.php';

header('Content-Type: application/json; charset=utf-8');

if (!$conexionActiva || !$pdo) {
    http_response_code(503);
    echo json_encode(['ok' => false, 'mensaje' => 'Base de datos no disponible.']);
    exit;
}

if (($_GET['canal'] ?? '') === 'patrocinios' || ($_POST['canal'] ?? '') === 'patrocinios') {
    require __DIR__ . '/publicidad.php';
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $modo = $_GET['modo'] ?? 'activos';

    if ($modo === 'activos') {
        listarComplementosActivos($pdo);
    } elseif ($modo === 'admin_lista') {
        listarComplementosAdmin($pdo);
    } else {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Modo no válido.']);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    procesarAccionComplemento($pdo);
    exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'mensaje' => 'Método no permitido.']);

/**
 * Devuelve únicamente los complementos activos para el portal público.
 */
function listarComplementosActivos(PDO $pdo): void
{
    $consulta = $pdo->query(
        'SELECT identificador, nombre, zona, archivo_js, archivo_css
         FROM complementos
         WHERE activo = 1
         ORDER BY id ASC'
    );

    echo json_encode([
        'ok'           => true,
        'complementos' => $consulta->fetchAll(),
    ]);
}

/**
 * Lista todos los complementos instalados (solo administrador).
 */
function listarComplementosAdmin(PDO $pdo): void
{
    iniciarSesionSegura();

    if (!estaAutenticado()) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'mensaje' => 'No autenticado.']);
        return;
    }

    if (!tieneRol(['administrador'])) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'Solo el administrador puede gestionar complementos.']);
        return;
    }

    $consulta = $pdo->query(
        'SELECT id, nombre, identificador, descripcion, version, zona, activo, fecha_instalacion
         FROM complementos
         ORDER BY fecha_instalacion DESC, id DESC'
    );

    echo json_encode([
        'ok'           => true,
        'complementos' => $consulta->fetchAll(),
    ]);
}

/**
 * Procesa instalación, activación o desactivación de complementos (solo administrador).
 */
function procesarAccionComplemento(PDO $pdo): void
{
    iniciarSesionSegura();

    if (!estaAutenticado()) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'mensaje' => 'No autenticado.']);
        return;
    }

    if (!tieneRol(['administrador'])) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'Solo el administrador puede gestionar complementos.']);
        return;
    }

    if (!validarTokenCsrf($_POST['csrf_token'] ?? '')) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'Token CSRF inválido. Recarga la página.']);
        return;
    }

    $accion = trim($_POST['accion'] ?? '');

    if ($accion === 'instalar') {
        instalarComplementoZip($pdo);
    } elseif ($accion === 'activar') {
        cambiarEstadoComplemento($pdo, 1);
    } elseif ($accion === 'desactivar') {
        cambiarEstadoComplemento($pdo, 0);
    } else {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Acción no válida.']);
    }
}

/**
 * Valida, extrae de forma segura e instala un paquete ZIP de complemento.
 */
function instalarComplementoZip(PDO $pdo): void
{
    if (!class_exists('ZipArchive')) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'mensaje' => 'ZipArchive no está disponible en PHP.']);
        return;
    }

    if (!isset($_FILES['archivo_zip']) || $_FILES['archivo_zip']['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Selecciona un archivo ZIP válido.']);
        return;
    }

    $archivo = $_FILES['archivo_zip'];
    $maxZipBytes = 5 * 1024 * 1024; // 5 MB
    if ($archivo['size'] <= 0 || $archivo['size'] > $maxZipBytes) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'El archivo ZIP no debe superar los 5 MB.']);
        return;
    }

    $zip = new ZipArchive();
    if ($zip->open($archivo['tmp_name']) !== true) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'El archivo recibido no es un paquete ZIP válido.']);
        return;
    }

    $validacion = validarEntradasZip($zip);
    if (!$validacion['ok']) {
        $zip->close();
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => $validacion['mensaje']]);
        return;
    }

    $contenidoJson = $zip->getFromName('plugin.json');
    if ($contenidoJson === false) {
        $zip->close();
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'El paquete ZIP debe incluir plugin.json en su raíz.']);
        return;
    }

    $manifiesto = json_decode($contenidoJson, true);
    if (!is_array($manifiesto)) {
        $zip->close();
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'El archivo plugin.json no tiene formato JSON válido.']);
        return;
    }

    $datosPlugin = validarManifiestoPlugin($manifiesto, $validacion['archivos']);
    if (!$datosPlugin['ok']) {
        $zip->close();
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => $datosPlugin['mensaje']]);
        return;
    }

    $meta = $datosPlugin['datos'];
    $identificador = $meta['identificador'];

    // Comprobar duplicado en MySQL
    $stmtExiste = $pdo->prepare('SELECT id FROM complementos WHERE identificador = ? LIMIT 1');
    $stmtExiste->execute([$identificador]);
    if ($stmtExiste->fetch()) {
        $zip->close();
        http_response_code(409);
        echo json_encode(['ok' => false, 'mensaje' => 'Ya existe un complemento instalado con ese identificador.']);
        return;
    }

    $directorioDestino = __DIR__ . '/../plugins/' . $identificador;
    if (file_exists($directorioDestino)) {
        $zip->close();
        http_response_code(409);
        echo json_encode(['ok' => false, 'mensaje' => 'La carpeta del complemento ya existe en plugins/.']);
        return;
    }

    if (!mkdir($directorioDestino, 0755, true)) {
        $zip->close();
        http_response_code(500);
        echo json_encode(['ok' => false, 'mensaje' => 'No se pudo crear la carpeta del complemento.']);
        return;
    }

    // Extraer únicamente los archivos ya validados sin usar rutas peligrosas
    foreach ($validacion['archivos'] as $rutaRelativa) {
        $contenido = $zip->getFromName($rutaRelativa);
        if ($contenido === false) {
            $zip->close();
            eliminarDirectorioRecursivo($directorioDestino);
            http_response_code(500);
            echo json_encode(['ok' => false, 'mensaje' => 'Error al leer un archivo del paquete ZIP.']);
            return;
        }

        $rutaDestino = $directorioDestino . '/' . $rutaRelativa;
        $subcarpeta = dirname($rutaDestino);
        if (!is_dir($subcarpeta) && !mkdir($subcarpeta, 0755, true)) {
            $zip->close();
            eliminarDirectorioRecursivo($directorioDestino);
            http_response_code(500);
            echo json_encode(['ok' => false, 'mensaje' => 'No se pudo crear una subcarpeta del complemento.']);
            return;
        }

        if (file_put_contents($rutaDestino, $contenido) === false) {
            $zip->close();
            eliminarDirectorioRecursivo($directorioDestino);
            http_response_code(500);
            echo json_encode(['ok' => false, 'mensaje' => 'No se pudo escribir un archivo del complemento.']);
            return;
        }
    }

    $zip->close();

    try {
        $stmtInsert = $pdo->prepare(
            'INSERT INTO complementos (nombre, identificador, descripcion, version, zona, archivo_js, archivo_css, activo)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0)'
        );
        $stmtInsert->execute([
            $meta['nombre'],
            $identificador,
            $meta['descripcion'],
            $meta['version'],
            $meta['zona'],
            $meta['archivo_js'],
            $meta['archivo_css'],
        ]);

        echo json_encode([
            'ok'      => true,
            'id'      => (int) $pdo->lastInsertId(),
            'mensaje' => 'Complemento instalado correctamente en estado inactivo.',
        ]);
    } catch (Throwable $e) {
        eliminarDirectorioRecursivo($directorioDestino);
        error_log('NewsCMS - Error al registrar complemento: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['ok' => false, 'mensaje' => 'No se pudo registrar el complemento en MySQL.']);
    }
}

/**
 * Inspecciona todas las entradas del ZIP antes de extraerlas.
 */
function validarEntradasZip(ZipArchive $zip): array
{
    $maxArchivos = 30;
    $maxDescomprimido = 10 * 1024 * 1024; // 10 MB

    if ($zip->numFiles <= 0 || $zip->numFiles > $maxArchivos) {
        return ['ok' => false, 'mensaje' => 'El paquete ZIP excede el límite de archivos permitido (máximo 30).'];
    }

    $extensionesSeguras = ['json', 'js', 'css', 'png', 'jpg', 'jpeg', 'webp', 'woff2', 'txt'];
    $extensionesProhibidas = ['php', 'phtml', 'php3', 'php4', 'php5', 'php7', 'phps', 'exe', 'bat', 'cmd', 'sh', 'ps1', 'cgi', 'pl', 'py', 'asp', 'aspx', 'jsp'];
    $archivosValidados = [];
    $tamanoAcumulado = 0;

    for ($i = 0; $i < $zip->numFiles; $i++) {
        $stat = $zip->statIndex($i);
        if (!$stat) {
            return ['ok' => false, 'mensaje' => 'No se pudo inspeccionar una entrada del ZIP.'];
        }

        $nombre = $stat['name'];

        // Rechazar rutas absolutas, traversals o caracteres nulos
        if (
            strpos($nombre, "\0") !== false ||
            strpos($nombre, '..') !== false ||
            strpos($nombre, '\\') !== false ||
            strpos($nombre, ':') !== false ||
            strpos($nombre, '/') === 0
        ) {
            return ['ok' => false, 'mensaje' => 'El paquete ZIP contiene rutas peligrosas o no permitidas.'];
        }

        // Rechazar enlaces simbólicos (modo POSIX 0120000)
        $modoPosix = (($stat['external_attributes'] ?? 0) >> 16) & 0170000;
        if ($modoPosix === 0120000) {
            return ['ok' => false, 'mensaje' => 'El paquete ZIP contiene enlaces simbólicos no permitidos.'];
        }

        // Omitir entradas de directorio
        if (substr($nombre, -1) === '/') {
            continue;
        }

        $nombreBase = strtolower(basename($nombre));
        if ($nombreBase === '.htaccess' || strpos($nombreBase, '.php') !== false) {
            return ['ok' => false, 'mensaje' => 'El paquete ZIP contiene archivos ejecutables o de configuración prohibidos.'];
        }

        $ext = strtolower(pathinfo($nombreBase, PATHINFO_EXTENSION));
        if (in_array($ext, $extensionesProhibidas, true) || !in_array($ext, $extensionesSeguras, true)) {
            return ['ok' => false, 'mensaje' => "Tipo de archivo no permitido dentro del ZIP: {$nombreBase}"];
        }

        $tamanoAcumulado += (int) $stat['size'];
        if ($tamanoAcumulado > $maxDescomprimido) {
            return ['ok' => false, 'mensaje' => 'El tamaño descomprimido del paquete supera el límite de 10 MB.'];
        }

        $archivosValidados[] = $nombre;
    }

    return ['ok' => true, 'archivos' => $archivosValidados];
}

/**
 * Valida las propiedades obligatorias del archivo plugin.json.
 */
function validarManifiestoPlugin(array $manifiesto, array $archivosZip): array
{
    $identificador = trim((string) ($manifiesto['identificador'] ?? ''));
    $nombre = trim((string) ($manifiesto['nombre'] ?? ''));
    $descripcion = trim((string) ($manifiesto['descripcion'] ?? ''));
    $version = trim((string) ($manifiesto['version'] ?? ''));
    $zona = trim((string) ($manifiesto['zona'] ?? 'portada_inferior'));
    $archivoJs = trim((string) ($manifiesto['archivo_js'] ?? 'principal.js'));
    $archivoCss = trim((string) ($manifiesto['archivo_css'] ?? ''));

    if (!preg_match('/^[a-z][a-z0-9_]{1,50}$/', $identificador)) {
        return ['ok' => false, 'mensaje' => 'El identificador del complemento no es válido.'];
    }

    if ($nombre === '' || mb_strlen($nombre) > 120) {
        return ['ok' => false, 'mensaje' => 'El nombre del complemento es obligatorio (máximo 120 caracteres).'];
    }

    if (mb_strlen($descripcion) > 255) {
        return ['ok' => false, 'mensaje' => 'La descripción del complemento supera los 255 caracteres.'];
    }

    if ($version === '' || mb_strlen($version) > 30) {
        return ['ok' => false, 'mensaje' => 'La versión del complemento es obligatoria.'];
    }

    if (!preg_match('/^[a-z][a-z0-9_]{1,50}$/', $zona)) {
        return ['ok' => false, 'mensaje' => 'La zona indicada en plugin.json no es válida.'];
    }

    if (!preg_match('/^[a-zA-Z0-9._-]+\.js$/', $archivoJs) || !in_array($archivoJs, $archivosZip, true)) {
        return ['ok' => false, 'mensaje' => 'El archivo JavaScript principal indicado en plugin.json no existe o no es válido.'];
    }

    if ($archivoCss !== '') {
        if (!preg_match('/^[a-zA-Z0-9._-]+\.css$/', $archivoCss) || !in_array($archivoCss, $archivosZip, true)) {
            return ['ok' => false, 'mensaje' => 'El archivo CSS indicado en plugin.json no existe o no es válido.'];
        }
    }

    return [
        'ok'    => true,
        'datos' => [
            'identificador' => $identificador,
            'nombre'        => $nombre,
            'descripcion'   => $descripcion !== '' ? $descripcion : null,
            'version'       => $version,
            'zona'          => $zona,
            'archivo_js'    => $archivoJs,
            'archivo_css'   => $archivoCss !== '' ? $archivoCss : null,
        ],
    ];
}

/**
 * Activa (1) o desactiva (0) un complemento existente en MySQL.
 */
function cambiarEstadoComplemento(PDO $pdo, int $nuevoEstado): void
{
    $id = (int) ($_POST['id'] ?? 0);
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Complemento no válido.']);
        return;
    }

    $stmt = $pdo->prepare('SELECT id FROM complementos WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    if (!$stmt->fetch()) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'mensaje' => 'Complemento no encontrado.']);
        return;
    }

    $upd = $pdo->prepare('UPDATE complementos SET activo = ? WHERE id = ?');
    $upd->execute([$nuevoEstado, $id]);

    echo json_encode([
        'ok'      => true,
        'mensaje' => $nuevoEstado === 1 ? 'Complemento activado.' : 'Complemento desactivado.',
    ]);
}

/**
 * Limpia una carpeta si falla la instalación del ZIP.
 */
function eliminarDirectorioRecursivo(string $ruta): void
{
    if (!is_dir($ruta)) {
        return;
    }
    $elementos = scandir($ruta);
    if ($elementos === false) {
        return;
    }
    foreach ($elementos as $elemento) {
        if ($elemento === '.' || $elemento === '..') {
            continue;
        }
        $subruta = $ruta . '/' . $elemento;
        if (is_dir($subruta)) {
            eliminarDirectorioRecursivo($subruta);
        } else {
            @unlink($subruta);
        }
    }
    @rmdir($ruta);
}
