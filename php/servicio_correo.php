<?php
/**
 * Servicio interno de correo SMTP con PHPMailer y Gmail para NewsCMS.
 * Se ejecuta exclusivamente en servidor y lee credenciales fuera del DocumentRoot.
 */

if (PHP_SAPI !== 'cli' && realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    http_response_code(403);
    exit('Acceso denegado.');
}

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as PHPMailerException;

const NEWSCMS_URL_BAJA_BASE = 'http://localhost:8081/NewsCMS/baja_newsletter.html';
const NEWSCMS_MAX_ENVIOS_BOLETIN = 25;

/**
 * Devuelve la ruta del archivo privado SMTP ubicado fuera del DocumentRoot.
 */
function obtenerRutaConfigSmtpPrivada(): string
{
    if (PHP_SAPI === 'cli') {
        $rutaTest = getenv('NEWSCMS_TEST_SMTP_CONFIG');
        if (is_string($rutaTest) && $rutaTest !== '' && file_exists($rutaTest)) {
            return $rutaTest;
        }
    }

    return dirname(__DIR__, 3)
        . DIRECTORY_SEPARATOR . 'newscms_secrets'
        . DIRECTORY_SEPARATOR . 'smtp_local.php';
}

/**
 * Comprueba que una ruta no resida dentro del DocumentRoot público de Apache.
 */
function esRutaFueraDeDocumentRoot(string $rutaArchivo): bool
{
    $realArchivo = realpath($rutaArchivo);
    if ($realArchivo === false) {
        return false;
    }

    $normArchivo = strtolower(str_replace('\\', '/', $realArchivo));
    $candidatosPublicos = [];

    $htdocsProyecto = realpath(dirname(__DIR__, 2));
    if ($htdocsProyecto !== false) {
        $candidatosPublicos[] = $htdocsProyecto;
    }

    if (!empty($_SERVER['DOCUMENT_ROOT'])) {
        $docRoot = realpath((string) $_SERVER['DOCUMENT_ROOT']);
        if ($docRoot !== false) {
            $candidatosPublicos[] = $docRoot;
        }
    }

    foreach ($candidatosPublicos as $raizPublica) {
        $normRaiz = rtrim(strtolower(str_replace('\\', '/', $raizPublica)), '/');
        if ($normRaiz !== '' && strpos($normArchivo, $normRaiz . '/') === 0) {
            return false;
        }
    }

    return true;
}

/**
 * Carga PHPMailer manualmente mediante require_once.
 */
function cargarClasesPHPMailer(): bool
{
    $base = __DIR__ . '/../vendor/phpmailer/src';
    $archivos = [
        $base . '/Exception.php',
        $base . '/PHPMailer.php',
        $base . '/SMTP.php',
    ];

    foreach ($archivos as $archivo) {
        if (!is_file($archivo)) {
            return false;
        }
    }

    require_once $archivos[0];
    require_once $archivos[1];
    require_once $archivos[2];

    return class_exists(PHPMailer::class) && class_exists(PHPMailerException::class);
}

/**
 * Valida que una cadena no contenga saltos de línea ni bytes nulos (prevención de inyección de cabeceras).
 */
function contieneSaltoCabecera(string $valor): bool
{
    return preg_match('/[\r\n\0]/', $valor) === 1;
}

/**
 * Lee y valida la configuración SMTP privada sin exponer secretos en la salida.
 *
 * @return array{disponible:bool,codigo:string,mensaje:string,config:?array,remitente_visible:?string}
 */
function cargarConfiguracionSmtp(): array
{
    if (!cargarClasesPHPMailer()) {
        return [
            'disponible'        => false,
            'codigo'            => 'libreria_faltante',
            'mensaje'           => 'PHPMailer no está disponible en el servidor.',
            'config'            => null,
            'remitente_visible' => null,
        ];
    }

    if (!extension_loaded('openssl')) {
        return [
            'disponible'        => false,
            'codigo'            => 'openssl_faltante',
            'mensaje'           => 'La extensión OpenSSL de PHP no está habilitada para conexiones TLS.',
            'config'            => null,
            'remitente_visible' => null,
        ];
    }

    $rutaPrivada = obtenerRutaConfigSmtpPrivada();
    if (!is_file($rutaPrivada)) {
        return [
            'disponible'        => false,
            'codigo'            => 'config_incompleta',
            'mensaje'           => 'Falta el archivo privado de credenciales SMTP fuera del directorio público.',
            'config'            => null,
            'remitente_visible' => null,
        ];
    }

    if (!esRutaFueraDeDocumentRoot($rutaPrivada)) {
        return [
            'disponible'        => false,
            'codigo'            => 'ruta_insegura',
            'mensaje'           => 'El archivo de credenciales SMTP debe ubicarse fuera del DocumentRoot de Apache.',
            'config'            => null,
            'remitente_visible' => null,
        ];
    }

    $raw = require $rutaPrivada;
    if (!is_array($raw)) {
        return [
            'disponible'        => false,
            'codigo'            => 'config_incompleta',
            'mensaje'           => 'El archivo de configuración SMTP no tiene un formato válido.',
            'config'            => null,
            'remitente_visible' => null,
        ];
    }

    $host = trim((string) ($raw['host'] ?? 'smtp.gmail.com'));
    $puertoConfig = (int) ($raw['puerto'] ?? 465);
    $cifradoConfig = strtolower(trim((string) ($raw['cifrado'] ?? 'ssl')));
    $usuario = strtolower(trim((string) ($raw['usuario'] ?? '')));
    $clave = preg_replace('/\s+/', '', trim((string) ($raw['clave_aplicacion'] ?? '')));
    $remitenteCorreo = strtolower(trim((string) ($raw['remitente_correo'] ?? '')));
    if ($remitenteCorreo === '') {
        $remitenteCorreo = $usuario;
    }
    $remitenteNombre = trim(str_replace(["\r", "\n", "\0"], '', (string) ($raw['remitente_nombre'] ?? 'NewsCMS')));
    if ($remitenteNombre === '') {
        $remitenteNombre = 'NewsCMS';
    }

    $puertosAdmitidos = [465, 587];
    $cifradosAdmitidos = ['ssl', 'smtps', 'tls'];

    if (
        $host !== 'smtp.gmail.com'
        || !in_array($puertoConfig, $puertosAdmitidos, true)
        || !in_array($cifradoConfig, $cifradosAdmitidos, true)
        || $usuario === ''
        || $clave === ''
        || !filter_var($usuario, FILTER_VALIDATE_EMAIL)
        || !filter_var($remitenteCorreo, FILTER_VALIDATE_EMAIL)
        || contieneSaltoCabecera($usuario)
        || contieneSaltoCabecera($remitenteCorreo)
        || contieneSaltoCabecera($host)
    ) {
        return [
            'disponible'        => false,
            'codigo'            => 'config_incompleta',
            'mensaje'           => 'Falta configurar la cuenta Gmail autorizada o su contraseña de aplicación en el archivo privado SMTP.',
            'config'            => null,
            'remitente_visible' => null,
        ];
    }

    // Gmail SMTP en este entorno opera mediante TLS implícito (SMTPS) sobre el puerto 465.
    $puertoEfectivo = 465;
    $cifradoEfectivo = PHPMailer::ENCRYPTION_SMTPS;

    return [
        'disponible' => true,
        'codigo'     => 'listo',
        'mensaje'    => 'Servicio SMTP configurado con Gmail (SMTPS puerto 465).',
        'config'     => [
            'host'             => $host,
            'puerto'           => $puertoEfectivo,
            'cifrado'          => $cifradoEfectivo,
            'usuario'          => $usuario,
            'clave_aplicacion' => $clave,
            'remitente_correo' => $remitenteCorreo,
            'remitente_nombre' => $remitenteNombre,
        ],
        'remitente_visible' => $remitenteCorreo,
    ];
}

/**
 * Construye una instancia segura de PHPMailer para smtp.gmail.com:465 con SMTPS (TLS implícito estricto).
 */
function crearInstanciaPHPMailer(array $config, bool $keepAlive = false): PHPMailer
{
    $mail = new PHPMailer(true);
    $langDir = __DIR__ . '/../vendor/phpmailer/language/';
    if (is_dir($langDir)) {
        $mail->setLanguage('es', $langDir);
    }

    $mail->isSMTP();
    $mail->Host = $config['host'];
    $mail->Port = 465;
    $mail->SMTPAuth = true;
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    $mail->SMTPAutoTLS = false;
    $mail->Username = $config['usuario'];
    $mail->Password = $config['clave_aplicacion'];
    $mail->CharSet = 'UTF-8';
    $mail->Encoding = 'base64';
    $mail->Timeout = 15;
    $mail->SMTPKeepAlive = $keepAlive;
    $mail->XMailer = 'NewsCMS';

    $mail->setFrom($config['remitente_correo'], $config['remitente_nombre']);

    return $mail;
}

/**
 * Construye el cuerpo HTML limpio y escapado del boletín sin contenido ejecutable ni recursos externos.
 */
function construirHtmlBoletin(string $asunto, string $contenidoTexto, ?string $tokenBaja, bool $esPrueba = false): string
{
    $asuntoHtml = htmlspecialchars($asunto, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

    $lineas = preg_split("/\r\n|\r|\n/", trim($contenidoTexto)) ?: [];
    $bloquesHtml = '';
    foreach ($lineas as $linea) {
        $limpia = trim($linea);
        if ($limpia === '') {
            continue;
        }
        $bloquesHtml .= '<p style="margin:0 0 14px;color:#1e293b;font-size:15px;line-height:1.65;">'
            . htmlspecialchars($limpia, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')
            . "</p>\n";
    }

    if ($bloquesHtml === '') {
        $bloquesHtml = '<p style="margin:0 0 14px;color:#1e293b;font-size:15px;line-height:1.65;">'
            . htmlspecialchars($contenidoTexto, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')
            . "</p>\n";
    }

    if ($esPrueba) {
        $pieHtml = '<p style="margin:0;color:#64748b;font-size:12px;line-height:1.5;">'
            . 'Correo de prueba enviado desde el panel administrativo de NewsCMS. '
            . 'En los envíos reales a suscriptores se incluirá aquí su enlace individual para cancelar la suscripción.'
            . '</p>';
    } else {
        $urlBaja = NEWSCMS_URL_BAJA_BASE . '?token=' . rawurlencode((string) $tokenBaja);
        $urlBajaHtml = htmlspecialchars($urlBaja, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $pieHtml = '<p style="margin:0 0 6px;color:#64748b;font-size:12px;line-height:1.5;">'
            . 'Recibes este mensaje porque te suscribiste al boletín informativo de NewsCMS.'
            . '</p>'
            . '<p style="margin:0;color:#64748b;font-size:12px;line-height:1.5;">'
            . 'Si ya no deseas recibir correos, puedes '
            . '<a href="' . $urlBajaHtml . '" style="color:#1d4ed8;text-decoration:underline;">cancelar tu suscripción aquí</a>.'
            . '</p>';
    }

    return '<!DOCTYPE html>'
        . '<html lang="es">'
        . '<head><meta charset="UTF-8"><title>' . $asuntoHtml . '</title></head>'
        . '<body style="margin:0;padding:24px 12px;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Arial,sans-serif;">'
        . '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px;margin:0 auto;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">'
        . '<tr><td style="background-color:#0f172a;padding:18px 24px;">'
        . '<span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.3px;">News<span style="color:#60a5fa;">CMS</span></span>'
        . '</td></tr>'
        . '<tr><td style="padding:26px 24px 18px;">'
        . '<h1 style="margin:0 0 18px;color:#0f172a;font-size:20px;font-weight:700;line-height:1.35;">' . $asuntoHtml . '</h1>'
        . $bloquesHtml
        . '</td></tr>'
        . '<tr><td style="padding:16px 24px;background-color:#f8fafc;border-top:1px solid #e2e8f0;">'
        . $pieHtml
        . '</td></tr>'
        . '</table>'
        . '</body></html>';
}

/**
 * Construye la versión alternativa en texto plano UTF-8 del boletín.
 */
function construirTextoPlanoBoletin(string $asunto, string $contenidoTexto, ?string $tokenBaja, bool $esPrueba = false): string
{
    $cuerpo = "NewsCMS — Boletín informativo\n"
        . $asunto . "\n"
        . str_repeat('-', 40) . "\n\n"
        . trim($contenidoTexto) . "\n\n"
        . str_repeat('-', 40) . "\n";

    if ($esPrueba) {
        $cuerpo .= "Correo de prueba administrativo. En los envíos reales se incluye el enlace individual de cancelación.\n";
    } else {
        $urlBaja = NEWSCMS_URL_BAJA_BASE . '?token=' . rawurlencode((string) $tokenBaja);
        $cuerpo .= "Para cancelar tu suscripción visita:\n" . $urlBaja . "\n";
    }

    return $cuerpo;
}

/**
 * Clasifica fallos de PHPMailer/SMTP sin exponer contraseñas ni secretos.
 *
 * @return array{estado:string,http:int,mensaje:string,fatal_lote:bool}
 */
function clasificarExcepcionSmtp(string $mensajeBruto): array
{
    $lower = strtolower($mensajeBruto);

    if (
        strpos($lower, 'authenticate') !== false
        || strpos($lower, '535') !== false
        || strpos($lower, '534') !== false
        || strpos($lower, 'username and password') !== false
        || strpos($lower, 'application-specific password') !== false
    ) {
        return [
            'estado'     => 'error_autenticacion',
            'http'       => 502,
            'mensaje'    => 'Error de autenticación en Gmail SMTP. Verifica el usuario y la contraseña de aplicación configurados.',
            'fatal_lote' => true,
        ];
    }

    if (
        strpos($lower, 'connect') !== false
        || strpos($lower, 'timed out') !== false
        || strpos($lower, 'starttls') !== false
        || strpos($lower, 'ssl') !== false
        || strpos($lower, 'tls') !== false
        || strpos($lower, 'certificate') !== false
        || strpos($lower, 'stream_socket') !== false
    ) {
        return [
            'estado'     => 'error_conexion',
            'http'       => 503,
            'mensaje'    => 'No se pudo establecer una conexión TLS segura con smtp.gmail.com en el puerto 465.',
            'fatal_lote' => true,
        ];
    }

    if (
        strpos($lower, 'invalid address') !== false
        || strpos($lower, 'recipient') !== false
        || strpos($lower, '550') !== false
        || strpos($lower, '553') !== false
    ) {
        return [
            'estado'     => 'destinatario_invalido',
            'http'       => 400,
            'mensaje'    => 'El servidor SMTP rechazó la dirección del destinatario.',
            'fatal_lote' => false,
        ];
    }

    return [
        'estado'     => 'error_smtp',
        'http'       => 502,
        'mensaje'    => 'El servidor SMTP no aceptó el envío del correo.',
        'fatal_lote' => false,
    ];
}

/**
 * Envía un único correo de prueba al destinatario especificado sin afectar suscriptores ni boletines.
 *
 * @return array{ok:bool,http:int,estado:string,mensaje:string}
 */
function enviarCorreoPruebaSmtp(string $destinatario, string $asunto, string $contenido): array
{
    $correo = strtolower(trim($destinatario));
    if ($correo === '' || mb_strlen($correo) > 150 || contieneSaltoCabecera($correo) || !filter_var($correo, FILTER_VALIDATE_EMAIL)) {
        return [
            'ok'      => false,
            'http'    => 400,
            'estado'  => 'destinatario_invalido',
            'mensaje' => 'Ingresa una dirección de correo válida para la prueba.',
        ];
    }

    if (contieneSaltoCabecera($asunto)) {
        return [
            'ok'      => false,
            'http'    => 400,
            'estado'  => 'datos_invalidos',
            'mensaje' => 'El asunto contiene caracteres no permitidos.',
        ];
    }

    $estadoConfig = cargarConfiguracionSmtp();
    if (!$estadoConfig['disponible'] || !$estadoConfig['config']) {
        return [
            'ok'      => false,
            'http'    => 503,
            'estado'  => $estadoConfig['codigo'],
            'mensaje' => $estadoConfig['mensaje'],
        ];
    }

    try {
        $mail = crearInstanciaPHPMailer($estadoConfig['config'], false);
        $mail->addAddress($correo);
        $mail->Subject = '[Prueba] ' . $asunto;
        $mail->isHTML(true);
        $mail->Body = construirHtmlBoletin($asunto, $contenido, null, true);
        $mail->AltBody = construirTextoPlanoBoletin($asunto, $contenido, null, true);
        $mail->send();

        return [
            'ok'      => true,
            'http'    => 200,
            'estado'  => 'aceptado_smtp',
            'mensaje' => "El servidor SMTP aceptó el correo de prueba para {$correo}. Revisa manualmente la bandeja de entrada.",
        ];
    } catch (PHPMailerException $e) {
        error_log('NewsCMS SMTP prueba error: ' . get_class($e));
        $clasificacion = clasificarExcepcionSmtp($e->getMessage());
        return [
            'ok'      => false,
            'http'    => $clasificacion['http'],
            'estado'  => $clasificacion['estado'],
            'mensaje' => $clasificacion['mensaje'],
        ];
    } catch (\Throwable $e) {
        error_log('NewsCMS SMTP prueba fallo interno.');
        return [
            'ok'      => false,
            'http'    => 500,
            'estado'  => 'error_interno',
            'mensaje' => 'Ocurrió un error interno al preparar el envío SMTP.',
        ];
    }
}

/**
 * Envía individualmente un boletín a suscriptores activos autorizados (sin revelar otras direcciones).
 * No reintenta automáticamente envíos parciales para prevenir mensajes duplicados.
 *
 * @param array{id:int|string,asunto:string,contenido:string} $boletin
 * @param array<int,array{correo:string,token_baja:string}> $suscriptores
 * @return array{ok:bool,http:int,estado:string,enviados:int,fallidos:int,marcar_enviado:bool,parcial:bool,mensaje:string}
 */
function enviarBoletinSuscriptoresSmtp(array $boletin, array $suscriptores): array
{
    $asunto = trim((string) ($boletin['asunto'] ?? ''));
    $contenido = (string) ($boletin['contenido'] ?? '');

    if ($asunto === '' || contieneSaltoCabecera($asunto)) {
        return [
            'ok'             => false,
            'http'           => 400,
            'estado'         => 'datos_invalidos',
            'enviados'       => 0,
            'fallidos'       => 0,
            'marcar_enviado' => false,
            'parcial'        => false,
            'mensaje'        => 'El asunto del boletín no es válido.',
        ];
    }

    $estadoConfig = cargarConfiguracionSmtp();
    if (!$estadoConfig['disponible'] || !$estadoConfig['config']) {
        return [
            'ok'             => false,
            'http'           => 503,
            'estado'         => $estadoConfig['codigo'],
            'enviados'       => 0,
            'fallidos'       => 0,
            'marcar_enviado' => false,
            'parcial'        => false,
            'mensaje'        => $estadoConfig['mensaje'],
        ];
    }

    $destinatariosUnicos = [];
    foreach ($suscriptores as $fila) {
        $correo = strtolower(trim((string) ($fila['correo'] ?? '')));
        $token = trim((string) ($fila['token_baja'] ?? ''));

        if ($correo === '' || contieneSaltoCabecera($correo) || !filter_var($correo, FILTER_VALIDATE_EMAIL)) {
            continue;
        }
        if (!preg_match('/^[a-f0-9]{64}$/', $token)) {
            continue;
        }
        if (isset($destinatariosUnicos[$correo])) {
            continue;
        }

        $destinatariosUnicos[$correo] = [
            'correo'     => $correo,
            'token_baja' => $token,
        ];

        if (count($destinatariosUnicos) >= NEWSCMS_MAX_ENVIOS_BOLETIN) {
            break;
        }
    }

    if (empty($destinatariosUnicos)) {
        return [
            'ok'             => false,
            'http'           => 400,
            'estado'         => 'sin_destinatarios',
            'enviados'       => 0,
            'fallidos'       => 0,
            'marcar_enviado' => false,
            'parcial'        => false,
            'mensaje'        => 'No hay suscriptores activos con direcciones válidas para enviar el boletín.',
        ];
    }

    $enviados = 0;
    $fallidos = 0;
    $ultimoError = null;
    $totalObjetivo = count($destinatariosUnicos);
    $mail = null;

    try {
        $mail = crearInstanciaPHPMailer($estadoConfig['config'], true);
        $mail->Subject = $asunto;
        $mail->isHTML(true);

        foreach ($destinatariosUnicos as $dest) {
            try {
                $mail->clearAllRecipients();
                $mail->addAddress($dest['correo']);
                $mail->Body = construirHtmlBoletin($asunto, $contenido, $dest['token_baja'], false);
                $mail->AltBody = construirTextoPlanoBoletin($asunto, $contenido, $dest['token_baja'], false);
                $mail->send();
                $enviados++;
            } catch (PHPMailerException $e) {
                $fallidos++;
                $ultimoError = clasificarExcepcionSmtp($e->getMessage());
                error_log('NewsCMS SMTP lote error: ' . $ultimoError['estado']);

                if ($ultimoError['fatal_lote']) {
                    // Abortar sin reintentos automáticos para evitar envíos duplicados o bloqueos del proveedor.
                    break;
                }
            }
        }
    } catch (\Throwable $e) {
        error_log('NewsCMS SMTP lote fallo inicial.');
        return [
            'ok'             => false,
            'http'           => 500,
            'estado'         => 'error_interno',
            'enviados'       => 0,
            'fallidos'       => $totalObjetivo,
            'marcar_enviado' => false,
            'parcial'        => false,
            'mensaje'        => 'Error interno al inicializar el envío SMTP.',
        ];
    } finally {
        if ($mail instanceof PHPMailer) {
            try {
                $mail->smtpClose();
            } catch (\Throwable $ignorado) {
                // Ignorar error de cierre de socket tras fallo previo.
            }
        }
    }

    $pendientesSinIntentar = max(0, $totalObjetivo - ($enviados + $fallidos));
    $fallidosTotales = $fallidos + $pendientesSinIntentar;

    if ($enviados === 0) {
        return [
            'ok'             => false,
            'http'           => $ultimoError['http'] ?? 502,
            'estado'         => $ultimoError['estado'] ?? 'error_smtp',
            'enviados'       => 0,
            'fallidos'       => $fallidosTotales,
            'marcar_enviado' => false,
            'parcial'        => false,
            'mensaje'        => $ultimoError['mensaje'] ?? 'No se pudo aceptar ningún correo en el servidor SMTP.',
        ];
    }

    if ($fallidosTotales > 0) {
        return [
            'ok'             => true,
            'http'           => 200,
            'estado'         => 'envio_parcial',
            'enviados'       => $enviados,
            'fallidos'       => $fallidosTotales,
            'marcar_enviado' => true,
            'parcial'        => true,
            'mensaje'        => "Envío parcial: el servidor SMTP aceptó {$enviados} de {$totalObjetivo} correos ({$fallidosTotales} no se completaron). "
                . "El boletín se registró como enviado para evitar reintentos duplicados, ya que la tabla actual no almacena entregas individuales.",
        ];
    }

    return [
        'ok'             => true,
        'http'           => 200,
        'estado'         => 'aceptado_smtp',
        'enviados'       => $enviados,
        'fallidos'       => 0,
        'marcar_enviado' => true,
        'parcial'        => false,
        'mensaje'        => "El servidor SMTP aceptó el envío individual para {$enviados} suscriptor(es) activo(s).",
    ];
}
