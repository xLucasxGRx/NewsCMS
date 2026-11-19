<?php
/**
 * Gestor sencillo de temas visuales ZIP para NewsCMS.
 */

require_once __DIR__ . '/../config/conexion.php';
require_once __DIR__ . '/../config/seguridad.php';

header('Content-Type: application/json; charset=utf-8');

if (!$conexionActiva || !$pdo) {
    http_response_code(503);
    echo json_encode(['ok' => false, 'mensaje' => 'Base de datos no disponible.']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $modo = $_GET['modo'] ?? 'activo';

    if ($modo === 'activo') {
        responderTemaActivo($pdo);
    } elseif ($modo === 'admin_lista') {
        listarTemasAdmin($pdo);
    } else {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Modo no válido.']);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    procesarAccionTema($pdo);
    exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'mensaje' => 'Método no permitido.']);

/**
 * Devuelve únicamente la ruta CSS del tema activo para el portal público.
 */
function responderTemaActivo(PDO $pdo): void
{
    $stmt = $pdo->query('SELECT identificador, archivo_css FROM temas WHERE activo = 1 LIMIT 1');
    $tema = $stmt->fetch();

    if (!$tema) {
        echo json_encode([
            'ok'            => true,
            'activo'        => false,
            'identificador' => null,
            'ruta_css'      => null,
        ]);
        return;
    }

    $identificador = $tema['identificador'];
    $archivoCss = $tema['archivo_css'];
    $rutaCss = "temas/{$identificador}/{$archivoCss}";

    if (
        !preg_match('/^[a-z][a-z0-9_]{1,50}$/', $identificador) ||
        !preg_match('/^[a-zA-Z0-9._-]+\.css$/', $archivoCss) ||
        !file_exists(__DIR__ . '/../' . $rutaCss)
    ) {
        echo json_encode([
            'ok'            => true,
            'activo'        => false,
            'identificador' => null,
            'ruta_css'      => null,
        ]);
        return;
    }

    echo json_encode([
        'ok'            => true,
        'activo'        => true,
        'identificador' => $identificador,
        'ruta_css'      => $rutaCss,
    ]);
}

/**
 * Lista todos los temas instalados (solo administrador).
 */
function listarTemasAdmin(PDO $pdo): void
{
    iniciarSesionSegura();

    if (!estaAutenticado()) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'mensaje' => 'No autenticado.']);
        return;
    }

    if (!tieneRol(['administrador'])) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'Solo el administrador puede gestionar temas.']);
        return;
    }

    $temas = $pdo->query(
        'SELECT id, nombre, identificador, descripcion, version, archivo_css, activo, fecha_instalacion
         FROM temas
         ORDER BY fecha_instalacion DESC, id DESC'
    )->fetchAll();

    echo json_encode([
        'ok'    => true,
        'temas' => $temas,
    ]);
}

/**
 * Procesa instalación, activación o restauración al diseño original (solo administrador).
 */
function procesarAccionTema(PDO $pdo): void
{
    iniciarSesionSegura();

    if (!estaAutenticado()) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'mensaje' => 'No autenticado.']);
        return;
    }

    if (!tieneRol(['administrador'])) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'Solo el administrador puede gestionar temas.']);
        return;
    }

    if (!validarTokenCsrf($_POST['csrf_token'] ?? '')) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'Token CSRF inválido. Recarga la página.']);
        return;
    }

    $accion = trim($_POST['accion'] ?? '');

    if ($accion === 'instalar') {
        instalarTemaZip($pdo);
    } elseif ($accion === 'activar') {
        activarTema($pdo);
    } elseif ($accion === 'usar_original') {
        restaurarOriginal($pdo);
    } else {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Acción no válida.']);
    }
}

/**
 * Valida, extrae de forma segura e instala un tema ZIP en temas/.
 */
function instalarTemaZip(PDO $pdo): void
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
    if ($archivo['size'] <= 0 || $archivo['size'] > 5 * 1024 * 1024) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'El archivo ZIP no debe superar los 5 MB.']);
        return;
    }

    $zip = new ZipArchive();
    if ($zip->open($archivo['tmp_name']) !== true) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'El archivo recibido no es un ZIP válido.']);
        return;
    }

    $validacion = validarEntradasZipTema($zip);
    if (!$validacion['ok']) {
        $zip->close();
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => $validacion['mensaje']]);
        return;
    }

    $contenidoJson = $zip->getFromName('tema.json');
    if ($contenidoJson === false) {
        $zip->close();
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'El paquete ZIP debe incluir tema.json en su raíz.']);
        return;
    }

    $manifiesto = json_decode($contenidoJson, true);
    if (!is_array($manifiesto)) {
        $zip->close();
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'El archivo tema.json no tiene formato JSON válido.']);
        return;
    }

    $datosTema = validarManifiestoTema($manifiesto, $validacion['archivos']);
    if (!$datosTema['ok']) {
        $zip->close();
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => $datosTema['mensaje']]);
        return;
    }

    // Validar que ningún archivo CSS contenga recursos remotos o expresiones peligrosas
    foreach ($validacion['archivos'] as $rutaArchivo) {
        if (strtolower(pathinfo($rutaArchivo, PATHINFO_EXTENSION)) === 'css') {
            $contenidoCss = $zip->getFromName($rutaArchivo);
            if ($contenidoCss === false || !cssEsSeguro($contenidoCss)) {
                $zip->close();
                http_response_code(400);
                echo json_encode(['ok' => false, 'mensaje' => 'El CSS del tema contiene importaciones o URLs remotas no permitidas.']);
                return;
            }
        }
    }

    $meta = $datosTema['datos'];
    $identificador = $meta['identificador'];

    $stmtExiste = $pdo->prepare('SELECT id FROM temas WHERE identificador = ? LIMIT 1');
    $stmtExiste->execute([$identificador]);
    if ($stmtExiste->fetch()) {
        $zip->close();
        http_response_code(409);
        echo json_encode(['ok' => false, 'mensaje' => 'Ya existe un tema instalado con ese identificador.']);
        return;
    }

    $directorioDestino = __DIR__ . '/../temas/' . $identificador;
    if (file_exists($directorioDestino)) {
        $zip->close();
        http_response_code(409);
        echo json_encode(['ok' => false, 'mensaje' => 'La carpeta del tema ya existe en temas/.']);
        return;
    }

    if (!mkdir($directorioDestino, 0755, true)) {
        $zip->close();
        http_response_code(500);
        echo json_encode(['ok' => false, 'mensaje' => 'No se pudo crear la carpeta del tema.']);
        return;
    }

    foreach ($validacion['archivos'] as $rutaRelativa) {
        $contenido = $zip->getFromName($rutaRelativa);
        if ($contenido === false) {
            $zip->close();
            limpiarDirectorioTema($directorioDestino);
            http_response_code(500);
            echo json_encode(['ok' => false, 'mensaje' => 'Error al leer un archivo del ZIP.']);
            return;
        }

        $rutaDestino = $directorioDestino . '/' . $rutaRelativa;
        $subcarpeta = dirname($rutaDestino);
        if (!is_dir($subcarpeta) && !mkdir($subcarpeta, 0755, true)) {
            $zip->close();
            limpiarDirectorioTema($directorioDestino);
            http_response_code(500);
            echo json_encode(['ok' => false, 'mensaje' => 'No se pudo crear una subcarpeta del tema.']);
            return;
        }

        if (file_put_contents($rutaDestino, $contenido) === false) {
            $zip->close();
            limpiarDirectorioTema($directorioDestino);
            http_response_code(500);
            echo json_encode(['ok' => false, 'mensaje' => 'No se pudo escribir un archivo del tema.']);
            return;
        }
    }

    $zip->close();

    try {
        $stmtInsert = $pdo->prepare(
            'INSERT INTO temas (nombre, identificador, descripcion, version, archivo_css, activo)
             VALUES (?, ?, ?, ?, ?, 0)'
        );
        $stmtInsert->execute([
            $meta['nombre'],
            $identificador,
            $meta['descripcion'],
            $meta['version'],
            $meta['archivo_css'],
        ]);

        echo json_encode([
            'ok'      => true,
            'id'      => (int) $pdo->lastInsertId(),
            'mensaje' => 'Tema instalado correctamente en estado inactivo.',
        ]);
    } catch (Throwable $e) {
        limpiarDirectorioTema($directorioDestino);
        error_log('NewsCMS - Error al registrar tema: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['ok' => false, 'mensaje' => 'No se pudo registrar el tema en MySQL.']);
    }
}

function validarEntradasZipTema(ZipArchive $zip): array
{
    if ($zip->numFiles <= 0 || $zip->numFiles > 30) {
        return ['ok' => false, 'mensaje' => 'El paquete ZIP excede el límite de archivos permitido (máximo 30).'];
    }

    $extensionesSeguras = ['json', 'css', 'png', 'jpg', 'jpeg', 'webp', 'woff2'];
    $archivosValidados = [];
    $tamanoAcumulado = 0;

    for ($i = 0; $i < $zip->numFiles; $i++) {
        $stat = $zip->statIndex($i);
        if (!$stat) {
            return ['ok' => false, 'mensaje' => 'No se pudo inspeccionar una entrada del ZIP.'];
        }

        $nombre = $stat['name'];
        if (
            strpos($nombre, "\0") !== false ||
            strpos($nombre, '..') !== false ||
            strpos($nombre, '\\') !== false ||
            strpos($nombre, ':') !== false ||
            strpos($nombre, '/') === 0
        ) {
            return ['ok' => false, 'mensaje' => 'El paquete ZIP contiene rutas peligrosas o no permitidas.'];
        }

        $modoPosix = (($stat['external_attributes'] ?? 0) >> 16) & 0170000;
        if ($modoPosix === 0120000) {
            return ['ok' => false, 'mensaje' => 'El paquete ZIP contiene enlaces simbólicos no permitidos.'];
        }

        if (substr($nombre, -1) === '/') {
            continue;
        }

        $nombreBase = strtolower(basename($nombre));
        if ($nombreBase === '.htaccess' || strpos($nombreBase, '.php') !== false) {
            return ['ok' => false, 'mensaje' => 'El paquete ZIP contiene archivos ejecutables o prohibidos.'];
        }

        $ext = strtolower(pathinfo($nombreBase, PATHINFO_EXTENSION));
        if (!in_array($ext, $extensionesSeguras, true)) {
            return ['ok' => false, 'mensaje' => "Tipo de archivo no permitido en un tema: {$nombreBase}"];
        }

        $tamanoAcumulado += (int) $stat['size'];
        if ($tamanoAcumulado > 10 * 1024 * 1024) {
            return ['ok' => false, 'mensaje' => 'El tamaño descomprimido del tema supera el límite de 10 MB.'];
        }

        $archivosValidados[] = $nombre;
    }

    return ['ok' => true, 'archivos' => $archivosValidados];
}

function validarManifiestoTema(array $manifiesto, array $archivosZip): array
{
    $identificador = trim((string) ($manifiesto['identificador'] ?? ''));
    $nombre = trim((string) ($manifiesto['nombre'] ?? ''));
    $descripcion = trim((string) ($manifiesto['descripcion'] ?? ''));
    $version = trim((string) ($manifiesto['version'] ?? ''));
    $archivoCss = trim((string) ($manifiesto['archivo_css'] ?? 'tema.css'));

    if (!preg_match('/^[a-z][a-z0-9_]{1,50}$/', $identificador)) {
        return ['ok' => false, 'mensaje' => 'El identificador del tema no es válido.'];
    }

    if ($nombre === '' || mb_strlen($nombre) > 120) {
        return ['ok' => false, 'mensaje' => 'El nombre del tema es obligatorio (máximo 120 caracteres).'];
    }

    if (mb_strlen($descripcion) > 255) {
        return ['ok' => false, 'mensaje' => 'La descripción supera los 255 caracteres.'];
    }

    if ($version === '' || mb_strlen($version) > 30) {
        return ['ok' => false, 'mensaje' => 'La versión del tema es obligatoria.'];
    }

    if (!preg_match('/^[a-zA-Z0-9._-]+\.css$/', $archivoCss) || !in_array($archivoCss, $archivosZip, true)) {
        return ['ok' => false, 'mensaje' => 'El archivo CSS indicado en tema.json no existe o no es válido.'];
    }

    return [
        'ok'    => true,
        'datos' => [
            'identificador' => $identificador,
            'nombre'        => $nombre,
            'descripcion'   => $descripcion !== '' ? $descripcion : null,
            'version'       => $version,
            'archivo_css'   => $archivoCss,
        ],
    ];
}

function cssEsSeguro(string $css): bool
{
    if (preg_match('/@import\b/i', $css)) {
        return false;
    }
    if (preg_match('/url\(\s*[\'"]?\s*(https?:|\/\/|javascript:|data:text\/html)/i', $css)) {
        return false;
    }
    if (preg_match('/expression\s*\(/i', $css)) {
        return false;
    }
    return true;
}

/**
 * Activa un tema único dentro de una transacción PDO.
 */
function activarTema(PDO $pdo): void
{
    $id = (int) ($_POST['id'] ?? 0);
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Tema no válido.']);
        return;
    }

    $stmtExiste = $pdo->prepare('SELECT id FROM temas WHERE id = ? LIMIT 1');
    $stmtExiste->execute([$id]);
    if (!$stmtExiste->fetch()) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'mensaje' => 'Tema no encontrado.']);
        return;
    }

    try {
        $pdo->beginTransaction();
        $pdo->exec('UPDATE temas SET activo = 0 WHERE activo = 1');
        $stmtActivar = $pdo->prepare('UPDATE temas SET activo = 1 WHERE id = ?');
        $stmtActivar->execute([$id]);
        $pdo->commit();

        echo json_encode(['ok' => true, 'mensaje' => 'Tema activado correctamente.']);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log('NewsCMS - Error al activar tema: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['ok' => false, 'mensaje' => 'No se pudo activar el tema.']);
    }
}

/**
 * Desactiva todos los temas para restaurar los estilos originales.
 */
function restaurarOriginal(PDO $pdo): void
{
    $pdo->exec('UPDATE temas SET activo = 0 WHERE activo = 1');
    echo json_encode(['ok' => true, 'mensaje' => 'Se restauró el diseño original de NewsCMS.']);
}

function limpiarDirectorioTema(string $ruta): void
{
    if (!is_dir($ruta)) {
        return;
    }
    $elementos = scandir($ruta);
    if ($elementos === false) {
        return;
    }
    foreach ($elementos as $el) {
        if ($el === '.' || $el === '..') {
            continue;
        }
        $sub = $ruta . '/' . $el;
        is_dir($sub) ? limpiarDirectorioTema($sub) : @unlink($sub);
    }
    @rmdir($ruta);
}
