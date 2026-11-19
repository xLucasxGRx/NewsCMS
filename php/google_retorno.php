<?php
/**
 * Recibe la respuesta OAuth 2.0 de Google, intercambia el código e inicia la sesión social.
 */

require_once __DIR__ . '/../config/conexion.php';
require_once __DIR__ . '/../config/seguridad.php';

iniciarSesionSegura();

$noticiaId = (int) ($_SESSION['oauth_google_noticia_id'] ?? 0);
$destinoRetorno = $noticiaId > 0 ? '../noticia.html?id=' . $noticiaId : '../index.html';

$rutaConfig = __DIR__ . '/../config/google_oauth_local.php';
if (!file_exists($rutaConfig) || !$conexionActiva || !$pdo) {
    header('Location: ' . $destinoRetorno);
    exit;
}

$config = require $rutaConfig;
$clientId = trim((string) ($config['client_id'] ?? ''));
$clientSecret = trim((string) ($config['client_secret'] ?? ''));
$redirectUri = trim((string) ($config['redirect_uri'] ?? ''));

$stateRecibido = (string) ($_GET['state'] ?? '');
$stateEsperado = (string) ($_SESSION['oauth_google_state'] ?? '');
$codeVerifier = (string) ($_SESSION['oauth_google_verifier'] ?? '');
$codigo = (string) ($_GET['code'] ?? '');

unset($_SESSION['oauth_google_state'], $_SESSION['oauth_google_verifier'], $_SESSION['oauth_google_noticia_id']);

if (
    $clientId === '' ||
    $clientSecret === '' ||
    $codigo === '' ||
    $stateEsperado === '' ||
    !hash_equals($stateEsperado, $stateRecibido)
) {
    header('Location: ' . $destinoRetorno);
    exit;
}

// Intercambiar código por token de acceso mediante HTTPS cURL con verificación TLS
$chToken = curl_init('https://oauth2.googleapis.com/token');
curl_setopt_array($chToken, [
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 10,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2,
    CURLOPT_POSTFIELDS     => http_build_query([
        'code'          => $codigo,
        'client_id'     => $clientId,
        'client_secret' => $clientSecret,
        'redirect_uri'  => $redirectUri,
        'grant_type'    => 'authorization_code',
        'code_verifier' => $codeVerifier,
    ]),
]);
$respuestaToken = curl_exec($chToken);
$codigoHttpToken = curl_getinfo($chToken, CURLINFO_HTTP_CODE);
curl_close($chToken);

if ($respuestaToken === false || $codigoHttpToken !== 200) {
    header('Location: ' . $destinoRetorno);
    exit;
}

$datosToken = json_decode($respuestaToken, true);
$accessToken = $datosToken['access_token'] ?? '';
if ($accessToken === '') {
    header('Location: ' . $destinoRetorno);
    exit;
}

// Consultar identidad oficial en Google OpenID UserInfo
$chPerfil = curl_init('https://openidconnect.googleapis.com/v1/userinfo');
curl_setopt_array($chPerfil, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 10,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2,
    CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $accessToken],
]);
$respuestaPerfil = curl_exec($chPerfil);
$codigoHttpPerfil = curl_getinfo($chPerfil, CURLINFO_HTTP_CODE);
curl_close($chPerfil);

if ($respuestaPerfil === false || $codigoHttpPerfil !== 200) {
    header('Location: ' . $destinoRetorno);
    exit;
}

$perfil = json_decode($respuestaPerfil, true);
$sub = trim((string) ($perfil['sub'] ?? ''));
$nombre = trim((string) ($perfil['name'] ?? ''));
$correo = trim((string) ($perfil['email'] ?? ''));
$correoVerificado = !empty($perfil['email_verified']);

if ($sub === '' || $nombre === '' || !$correoVerificado) {
    header('Location: ' . $destinoRetorno);
    exit;
}

// Registrar o actualizar visitante en usuarios_sociales sin guardar tokens OAuth
$stmtBuscar = $pdo->prepare(
    "SELECT id FROM usuarios_sociales WHERE proveedor = 'google' AND proveedor_id = ? LIMIT 1"
);
$stmtBuscar->execute([$sub]);
$usuarioSocial = $stmtBuscar->fetch();

if ($usuarioSocial) {
    $usuarioSocialId = (int) $usuarioSocial['id'];
    $stmtUpd = $pdo->prepare('UPDATE usuarios_sociales SET nombre = ?, correo = ? WHERE id = ?');
    $stmtUpd->execute([$nombre, $correo !== '' ? $correo : null, $usuarioSocialId]);
} else {
    $stmtIns = $pdo->prepare(
        "INSERT INTO usuarios_sociales (proveedor, proveedor_id, nombre, correo)
         VALUES ('google', ?, ?, ?)"
    );
    $stmtIns->execute([$sub, $nombre, $correo !== '' ? $correo : null]);
    $usuarioSocialId = (int) $pdo->lastInsertId();
}

session_regenerate_id(true);
$_SESSION['social_usuario_id'] = $usuarioSocialId;
$_SESSION['social_nombre'] = $nombre;

header('Location: ' . $destinoRetorno);
exit;
