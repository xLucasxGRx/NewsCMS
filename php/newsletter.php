<?php
/**
 * Endpoint del complemento Newsletter para NewsCMS.
 */

require_once __DIR__ . '/../config/conexion.php';
require_once __DIR__ . '/../config/seguridad.php';
require_once __DIR__ . '/servicio_correo.php';

header('Content-Type: application/json; charset=utf-8');

if (!$conexionActiva || !$pdo) {
    http_response_code(503);
    echo json_encode(['ok' => false, 'mensaje' => 'Base de datos no disponible.']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $modo = $_GET['modo'] ?? 'estado_publico';

    if ($modo === 'estado_publico') {
        echo json_encode(['ok' => true, 'activo' => estaPluginNewsletterActivo($pdo)]);
    } elseif ($modo === 'admin_datos') {
        responderDatosAdmin($pdo);
    } elseif ($modo === 'admin_resumen') {
        responderResumenAdmin($pdo);
    } elseif ($modo === 'admin_boletines') {
        responderBoletinesAdmin($pdo);
    } elseif ($modo === 'admin_suscriptores') {
        responderSuscriptoresAdmin($pdo);
    } else {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Modo no válido.']);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $accion = trim($_POST['accion'] ?? '');

    if ($accion === 'suscribir') {
        registrarSuscriptor($pdo);
    } elseif ($accion === 'baja') {
        cancelarSuscripcion($pdo);
    } elseif ($accion === 'guardar_boletin') {
        guardarBoletin($pdo);
    } elseif ($accion === 'enviar_prueba') {
        enviarBoletinPrueba();
    } elseif ($accion === 'enviar_boletin') {
        enviarBoletin($pdo);
    } else {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Acción no válida.']);
    }
    exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'mensaje' => 'Método no permitido.']);

function estaPluginNewsletterActivo(PDO $pdo): bool
{
    $stmt = $pdo->prepare("SELECT activo FROM complementos WHERE identificador = 'newsletter' LIMIT 1");
    $stmt->execute();
    $fila = $stmt->fetch();
    return $fila && (int) $fila['activo'] === 1;
}

/**
 * Registra o reactiva una suscripción pública con consentimiento obligatorio.
 */
function registrarSuscriptor(PDO $pdo): void
{
    if (!estaPluginNewsletterActivo($pdo)) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'El servicio de suscripción no está activo en este momento.']);
        return;
    }

    iniciarSesionSegura();
    $ahora = time();
    $ultimo = $_SESSION['newsletter_ultimo_envio'] ?? 0;
    if (($ahora - $ultimo) < 3) {
        http_response_code(429);
        echo json_encode(['ok' => false, 'mensaje' => 'Espera unos segundos antes de intentar nuevamente.']);
        return;
    }
    $_SESSION['newsletter_ultimo_envio'] = $ahora;

    $consentimiento = $_POST['consentimiento'] ?? '';
    if ((string) $consentimiento !== '1') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Debes aceptar recibir boletines para suscribirte.']);
        return;
    }

    $correo = strtolower(trim($_POST['correo'] ?? ''));
    if ($correo === '' || mb_strlen($correo) > 150 || !filter_var($correo, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Ingresa una dirección de correo electrónico válida.']);
        return;
    }

    $stmtBuscar = $pdo->prepare('SELECT id, estado FROM suscriptores_newsletter WHERE correo = ? LIMIT 1');
    $stmtBuscar->execute([$correo]);
    $existente = $stmtBuscar->fetch();

    if ($existente) {
        if ($existente['estado'] === 'inactivo') {
            $nuevoToken = bin2hex(random_bytes(32));
            $stmtReactivar = $pdo->prepare(
                "UPDATE suscriptores_newsletter
                 SET estado = 'activo', token_baja = ?, fecha_baja = NULL
                 WHERE id = ?"
            );
            $stmtReactivar->execute([$nuevoToken, $existente['id']]);
        }

        // Mensaje neutral sin revelar innecesariamente si la dirección ya existía
        echo json_encode([
            'ok'      => true,
            'mensaje' => 'Tu solicitud de suscripción fue procesada correctamente.',
        ]);
        return;
    }

    $tokenBaja = bin2hex(random_bytes(32));
    $stmtInsertar = $pdo->prepare(
        "INSERT INTO suscriptores_newsletter (correo, estado, token_baja)
         VALUES (?, 'activo', ?)"
    );
    $stmtInsertar->execute([$correo, $tokenBaja]);

    echo json_encode([
        'ok'      => true,
        'mensaje' => 'Tu solicitud de suscripción fue procesada correctamente.',
    ]);
}

/**
 * Cancela la suscripción mediante POST y token aleatorio válido.
 */
function cancelarSuscripcion(PDO $pdo): void
{
    $token = trim($_POST['token'] ?? '');
    if (!preg_match('/^[a-f0-9]{64}$/', $token)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'El enlace de cancelación no es válido.']);
        return;
    }

    $stmt = $pdo->prepare('SELECT id, estado FROM suscriptores_newsletter WHERE token_baja = ? LIMIT 1');
    $stmt->execute([$token]);
    $suscriptor = $stmt->fetch();

    if (!$suscriptor) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'mensaje' => 'No se encontró una suscripción asociada a este enlace.']);
        return;
    }

    if ($suscriptor['estado'] === 'inactivo') {
        echo json_encode(['ok' => true, 'mensaje' => 'Tu suscripción ya se encontraba cancelada.']);
        return;
    }

    $upd = $pdo->prepare(
        "UPDATE suscriptores_newsletter
         SET estado = 'inactivo', fecha_baja = NOW()
         WHERE id = ?"
    );
    $upd->execute([$suscriptor['id']]);

    echo json_encode([
        'ok'      => true,
        'mensaje' => 'Tu suscripción ha sido cancelada correctamente.',
    ]);
}

/**
 * Devuelve suscriptores, boletines y disponibilidad real de correo (solo administrador).
 */
function responderDatosAdmin(PDO $pdo): void
{
    iniciarSesionSegura();

    if (!estaAutenticado()) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'mensaje' => 'No autenticado.']);
        return;
    }

    if (!tieneRol(['administrador'])) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'Solo el administrador puede gestionar el newsletter.']);
        return;
    }

    $totalSuscriptores = (int) $pdo->query('SELECT COUNT(*) FROM suscriptores_newsletter')->fetchColumn();
    $suscriptoresActivos = (int) $pdo->query(
        "SELECT COUNT(*) FROM suscriptores_newsletter WHERE estado = 'activo'"
    )->fetchColumn();

    $suscriptores = $pdo->query(
        'SELECT id, correo, estado, fecha_registro, fecha_baja
         FROM suscriptores_newsletter
         ORDER BY fecha_registro DESC, id DESC'
    )->fetchAll();

    $boletines = $pdo->query(
        'SELECT id, asunto, contenido, estado, fecha_creacion, fecha_envio
         FROM boletines_newsletter
         ORDER BY fecha_creacion DESC, id DESC'
    )->fetchAll();

    $estadoCorreo = cargarConfiguracionSmtp();

    echo json_encode([
        'ok'                   => true,
        'total_suscriptores'   => $totalSuscriptores,
        'suscriptores_activos' => $suscriptoresActivos,
        'suscriptores'         => $suscriptores,
        'boletines'            => $boletines,
        'correo_disponible'    => $estadoCorreo['disponible'],
        'estado_correo'        => [
            'codigo'    => $estadoCorreo['codigo'],
            'mensaje'   => $estadoCorreo['mensaje'],
            'remitente' => $estadoCorreo['remitente_visible'],
        ],
    ]);
}

/**
 * Verifica autenticación y rol de administrador para lecturas del panel Newsletter.
 */
function verificarSoloAdminLectura(): bool
{
    iniciarSesionSegura();

    if (!estaAutenticado()) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'mensaje' => 'No autenticado.']);
        return false;
    }

    if (!tieneRol(['administrador'])) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'Solo el administrador puede gestionar el newsletter.']);
        return false;
    }

    return true;
}

/**
 * Obtiene contadores globales reales de suscriptores y boletines.
 *
 * @return array{total_suscriptores:int,suscriptores_activos:int,total_boletines:int}
 */
function obtenerResumenContadoresNewsletter(PDO $pdo): array
{
    $totalSuscriptores = (int) $pdo->query('SELECT COUNT(*) FROM suscriptores_newsletter')->fetchColumn();
    $suscriptoresActivos = (int) $pdo->query(
        "SELECT COUNT(*) FROM suscriptores_newsletter WHERE estado = 'activo'"
    )->fetchColumn();
    $totalBoletines = (int) $pdo->query('SELECT COUNT(*) FROM boletines_newsletter')->fetchColumn();

    return [
        'total_suscriptores'   => $totalSuscriptores,
        'suscriptores_activos' => $suscriptoresActivos,
        'total_boletines'      => $totalBoletines,
    ];
}

/**
 * Escapa comodines de LIKE para búsquedas parciales seguras.
 */
function escaparLikeNewsletter(string $texto): string
{
    return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $texto);
}

/**
 * Ejecuta una consulta paginada y ordenada de forma estable en MySQL.
 *
 * @param list<mixed> $parametros
 * @return array{filas:array<int,array<string,mixed>>,total:int,pagina:int,por_pagina:int,total_paginas:int}
 */
function ejecutarConsultaPaginadaNewsletter(
    PDO $pdo,
    string $tabla,
    string $columnas,
    string $whereSql,
    string $orderBy,
    array $parametros,
    int $paginaSolicitada,
    int $porPaginaSolicitado
): array {
    $pagina = max(1, $paginaSolicitada);
    $porPagina = max(1, min(50, $porPaginaSolicitado > 0 ? $porPaginaSolicitado : 10));

    $stmtTotal = $pdo->prepare("SELECT COUNT(*) FROM {$tabla} WHERE {$whereSql}");
    $stmtTotal->execute($parametros);
    $totalFiltrado = (int) $stmtTotal->fetchColumn();

    $totalPaginas = $totalFiltrado > 0 ? (int) ceil($totalFiltrado / $porPagina) : 0;
    if ($totalPaginas > 0 && $pagina > $totalPaginas) {
        $pagina = $totalPaginas;
    } elseif ($totalFiltrado === 0) {
        $pagina = 1;
    }

    $offset = ($pagina - 1) * $porPagina;
    $stmtLista = $pdo->prepare(
        "SELECT {$columnas}
         FROM {$tabla}
         WHERE {$whereSql}
         ORDER BY {$orderBy}
         LIMIT ? OFFSET ?"
    );

    $idx = 1;
    foreach ($parametros as $valor) {
        $stmtLista->bindValue($idx, $valor);
        $idx++;
    }
    $stmtLista->bindValue($idx, $porPagina, PDO::PARAM_INT);
    $stmtLista->bindValue($idx + 1, $offset, PDO::PARAM_INT);
    $stmtLista->execute();

    return [
        'filas'         => $stmtLista->fetchAll(),
        'total'         => $totalFiltrado,
        'pagina'        => $pagina,
        'por_pagina'    => $porPagina,
        'total_paginas' => $totalPaginas,
    ];
}

/**
 * Devuelve resumen compacto general y estado interno de disponibilidad de envío (sin exponer remitente).
 */
function responderResumenAdmin(PDO $pdo): void
{
    if (!verificarSoloAdminLectura()) {
        return;
    }

    $contadores = obtenerResumenContadoresNewsletter($pdo);
    $estadoCorreo = cargarConfiguracionSmtp();
    $disponible = (bool) ($estadoCorreo['disponible'] ?? false);

    echo json_encode([
        'ok'                   => true,
        'total_suscriptores'   => $contadores['total_suscriptores'],
        'suscriptores_activos' => $contadores['suscriptores_activos'],
        'total_boletines'      => $contadores['total_boletines'],
        'correo_disponible'    => $disponible,
        'mensaje_correo'       => $disponible ? '' : (string) ($estadoCorreo['mensaje'] ?? 'Servicio de correo no disponible.'),
    ]);
}

/**
 * Lista boletines paginados en servidor con búsqueda por asunto y filtro real por estado.
 */
function responderBoletinesAdmin(PDO $pdo): void
{
    if (!verificarSoloAdminLectura()) {
        return;
    }

    $busqueda = mb_substr(trim((string) ($_GET['q'] ?? '')), 0, 180);
    $estado = trim((string) ($_GET['estado'] ?? ''));
    if (!in_array($estado, ['', 'borrador', 'enviado'], true)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Filtro de estado de boletín no válido.']);
        return;
    }

    $condiciones = ['1=1'];
    $parametros = [];
    if ($busqueda !== '') {
        $condiciones[] = 'asunto LIKE ?';
        $parametros[] = '%' . escaparLikeNewsletter($busqueda) . '%';
    }
    if ($estado !== '') {
        $condiciones[] = 'estado = ?';
        $parametros[] = $estado;
    }

    $pagina = (int) ($_GET['pagina'] ?? 1);
    $porPagina = (int) ($_GET['por_pagina'] ?? 10);

    $resultado = ejecutarConsultaPaginadaNewsletter(
        $pdo,
        'boletines_newsletter',
        'id, asunto, contenido, estado, fecha_creacion, fecha_envio',
        implode(' AND ', $condiciones),
        'COALESCE(fecha_envio, fecha_creacion) DESC, id DESC',
        $parametros,
        $pagina,
        $porPagina
    );

    $contadores = obtenerResumenContadoresNewsletter($pdo);
    $estadoCorreo = cargarConfiguracionSmtp();
    $disponible = (bool) ($estadoCorreo['disponible'] ?? false);

    echo json_encode([
        'ok'                   => true,
        'boletines'            => $resultado['filas'],
        'total'                => $resultado['total'],
        'total_registrado'     => $contadores['total_boletines'],
        'total_boletines'      => $contadores['total_boletines'],
        'total_suscriptores'   => $contadores['total_suscriptores'],
        'suscriptores_activos' => $contadores['suscriptores_activos'],
        'pagina'               => $resultado['pagina'],
        'por_pagina'           => $resultado['por_pagina'],
        'total_paginas'        => $resultado['total_paginas'],
        'correo_disponible'    => $disponible,
        'mensaje_correo'       => $disponible ? '' : (string) ($estadoCorreo['mensaje'] ?? 'Servicio de correo no disponible.'),
    ]);
}

/**
 * Lista suscriptores paginados en servidor sin exponer token_baja, con búsqueda y filtro de estado.
 */
function responderSuscriptoresAdmin(PDO $pdo): void
{
    if (!verificarSoloAdminLectura()) {
        return;
    }

    $busqueda = mb_substr(trim((string) ($_GET['q'] ?? '')), 0, 150);
    $estado = trim((string) ($_GET['estado'] ?? ''));
    if (!in_array($estado, ['', 'activo', 'inactivo'], true)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Filtro de estado de suscriptor no válido.']);
        return;
    }

    $condiciones = ['1=1'];
    $parametros = [];
    if ($busqueda !== '') {
        $condiciones[] = 'correo LIKE ?';
        $parametros[] = '%' . escaparLikeNewsletter($busqueda) . '%';
    }
    if ($estado !== '') {
        $condiciones[] = 'estado = ?';
        $parametros[] = $estado;
    }

    $pagina = (int) ($_GET['pagina'] ?? 1);
    $porPagina = (int) ($_GET['por_pagina'] ?? 10);

    $resultado = ejecutarConsultaPaginadaNewsletter(
        $pdo,
        'suscriptores_newsletter',
        'id, correo, estado, fecha_registro, fecha_baja',
        implode(' AND ', $condiciones),
        'fecha_registro DESC, id DESC',
        $parametros,
        $pagina,
        $porPagina
    );

    $contadores = obtenerResumenContadoresNewsletter($pdo);

    echo json_encode([
        'ok'                   => true,
        'suscriptores'         => $resultado['filas'],
        'total'                => $resultado['total'],
        'total_registrado'     => $contadores['total_suscriptores'],
        'total_boletines'      => $contadores['total_boletines'],
        'total_suscriptores'   => $contadores['total_suscriptores'],
        'suscriptores_activos' => $contadores['suscriptores_activos'],
        'pagina'               => $resultado['pagina'],
        'por_pagina'           => $resultado['por_pagina'],
        'total_paginas'        => $resultado['total_paginas'],
    ]);
}

function guardarBoletin(PDO $pdo): void
{
    if (!verificarAdminYCsrf()) {
        return;
    }

    $id = (int) ($_POST['id'] ?? 0);
    $asunto = trim($_POST['asunto'] ?? '');
    $contenido = trim($_POST['contenido'] ?? '');

    if ($asunto === '' || mb_strlen($asunto) > 180) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'El asunto es obligatorio (máximo 180 caracteres).']);
        return;
    }

    if ($contenido === '') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'El contenido del boletín es obligatorio.']);
        return;
    }

    if ($id === 0) {
        $stmt = $pdo->prepare(
            "INSERT INTO boletines_newsletter (asunto, contenido, estado) VALUES (?, ?, 'borrador')"
        );
        $stmt->execute([$asunto, $contenido]);
        $id = (int) $pdo->lastInsertId();
    } else {
        $stmtCheck = $pdo->prepare('SELECT estado FROM boletines_newsletter WHERE id = ? LIMIT 1');
        $stmtCheck->execute([$id]);
        $actual = $stmtCheck->fetch();
        if (!$actual) {
            http_response_code(404);
            echo json_encode(['ok' => false, 'mensaje' => 'Boletín no encontrado.']);
            return;
        }
        if ($actual['estado'] !== 'borrador') {
            http_response_code(409);
            echo json_encode(['ok' => false, 'mensaje' => 'Solo se pueden editar boletines en borrador.']);
            return;
        }

        $stmt = $pdo->prepare('UPDATE boletines_newsletter SET asunto = ?, contenido = ? WHERE id = ?');
        $stmt->execute([$asunto, $contenido, $id]);
    }

    echo json_encode([
        'ok'      => true,
        'id'      => $id,
        'mensaje' => 'Borrador de boletín guardado correctamente.',
    ]);
}

function enviarBoletinPrueba(): void
{
    if (!verificarAdminYCsrf()) {
        return;
    }

    $ahora = time();
    $ultimo = (int) ($_SESSION['newsletter_prueba_ultimo'] ?? 0);
    if (($ahora - $ultimo) < 5) {
        http_response_code(429);
        echo json_encode(['ok' => false, 'estado' => 'limite_frecuencia', 'mensaje' => 'Espera unos segundos antes de enviar otra prueba.']);
        return;
    }

    $historial = $_SESSION['newsletter_prueba_historial'] ?? [];
    $ventanaInicio = $ahora - 600;
    $historial = array_values(array_filter(is_array($historial) ? $historial : [], static function ($ts) use ($ventanaInicio) {
        return (int) $ts >= $ventanaInicio;
    }));
    if (count($historial) >= 5) {
        http_response_code(429);
        echo json_encode(['ok' => false, 'estado' => 'limite_frecuencia', 'mensaje' => 'Se alcanzó el límite temporal de correos de prueba (máximo 5 cada 10 minutos).']);
        return;
    }

    $correoPrueba = strtolower(trim($_POST['correo_prueba'] ?? ''));
    $asunto = trim($_POST['asunto'] ?? '');
    $contenido = trim($_POST['contenido'] ?? '');

    if ($correoPrueba === '' || mb_strlen($correoPrueba) > 150 || !filter_var($correoPrueba, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'estado' => 'destinatario_invalido', 'mensaje' => 'Ingresa una dirección de correo válida para enviar la prueba.']);
        return;
    }

    if ($asunto === '' || mb_strlen($asunto) > 180) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'estado' => 'datos_invalidos', 'mensaje' => 'El asunto es obligatorio (máximo 180 caracteres).']);
        return;
    }

    if ($contenido === '') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'estado' => 'datos_invalidos', 'mensaje' => 'El contenido del boletín es obligatorio para la prueba.']);
        return;
    }

    $_SESSION['newsletter_prueba_ultimo'] = $ahora;
    $historial[] = $ahora;
    $_SESSION['newsletter_prueba_historial'] = $historial;

    $resultado = enviarCorreoPruebaSmtp($correoPrueba, $asunto, $contenido);

    http_response_code($resultado['http']);
    echo json_encode([
        'ok'      => $resultado['ok'],
        'estado'  => $resultado['estado'],
        'mensaje' => $resultado['mensaje'],
    ]);
}

function enviarBoletin(PDO $pdo): void
{
    if (!verificarAdminYCsrf()) {
        return;
    }

    $estadoCorreo = cargarConfiguracionSmtp();
    if (!$estadoCorreo['disponible']) {
        http_response_code(503);
        echo json_encode([
            'ok'      => false,
            'estado'  => $estadoCorreo['codigo'],
            'mensaje' => $estadoCorreo['mensaje'],
        ]);
        return;
    }

    $id = (int) ($_POST['id'] ?? 0);
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'estado' => 'datos_invalidos', 'mensaje' => 'Boletín no válido.']);
        return;
    }

    $stmt = $pdo->prepare('SELECT id, asunto, contenido, estado FROM boletines_newsletter WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $boletin = $stmt->fetch();

    if (!$boletin || $boletin['estado'] !== 'borrador') {
        http_response_code(409);
        echo json_encode(['ok' => false, 'estado' => 'estado_invalido', 'mensaje' => 'El boletín no existe o ya fue enviado.']);
        return;
    }

    $totalActivos = (int) $pdo->query("SELECT COUNT(*) FROM suscriptores_newsletter WHERE estado = 'activo'")->fetchColumn();
    $stmtSubs = $pdo->prepare(
        "SELECT correo, token_baja
         FROM suscriptores_newsletter
         WHERE estado = 'activo'
         ORDER BY id ASC
         LIMIT ?"
    );
    $stmtSubs->bindValue(1, NEWSCMS_MAX_ENVIOS_BOLETIN, PDO::PARAM_INT);
    $stmtSubs->execute();
    $suscriptores = $stmtSubs->fetchAll();

    if (empty($suscriptores)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'estado' => 'sin_destinatarios', 'mensaje' => 'No hay suscriptores activos para enviar el boletín.']);
        return;
    }

    $resultado = enviarBoletinSuscriptoresSmtp($boletin, $suscriptores);

    if (!empty($resultado['marcar_enviado'])) {
        $upd = $pdo->prepare("UPDATE boletines_newsletter SET estado = 'enviado', fecha_envio = NOW() WHERE id = ? AND estado = 'borrador'");
        $upd->execute([$id]);
    }

    $mensaje = $resultado['mensaje'];
    if ($resultado['ok'] && $totalActivos > NEWSCMS_MAX_ENVIOS_BOLETIN) {
        $mensaje .= ' Nota: la ejecución está limitada a ' . NEWSCMS_MAX_ENVIOS_BOLETIN . ' destinatarios por lote (total activos: ' . $totalActivos . ').';
    }

    http_response_code($resultado['http']);
    echo json_encode([
        'ok'        => $resultado['ok'],
        'estado'    => $resultado['estado'],
        'enviados'  => $resultado['enviados'],
        'fallidos'  => $resultado['fallidos'],
        'parcial'   => $resultado['parcial'],
        'mensaje'   => $mensaje,
    ]);
}

function verificarAdminYCsrf(): bool
{
    iniciarSesionSegura();

    if (!estaAutenticado()) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'mensaje' => 'No autenticado.']);
        return false;
    }

    if (!tieneRol(['administrador'])) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'Solo el administrador puede gestionar el newsletter.']);
        return false;
    }

    if (!validarTokenCsrf($_POST['csrf_token'] ?? '')) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'Token CSRF inválido. Recarga la página.']);
        return false;
    }

    return true;
}

/**
 * Comprueba si PHPMailer y la configuración privada SMTP de Gmail están listas.
 */
function verificarServicioCorreoDisponible(): bool
{
    $estado = cargarConfiguracionSmtp();
    return (bool) ($estado['disponible'] ?? false);
}
