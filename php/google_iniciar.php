<?php
/**
 * Inicia el flujo OAuth 2.0 + PKCE con Google.
 */

require_once __DIR__ . '/../config/conexion.php';
require_once __DIR__ . '/../config/seguridad.php';

iniciarSesionSegura();

$rutaConfig = __DIR__ . '/../config/google_oauth_local.php';
if (!file_exists($rutaConfig)) {
    http_response_code(503);
    exit('El inicio de sesión con Google aún no está configurado.');
}

$config = require $rutaConfig;
$clientId = trim((string) ($config['client_id'] ?? ''));
$clientSecret = trim((string) ($config['client_secret'] ?? ''));
$redirectUri = trim((string) ($config['redirect_uri'] ?? ''));

if ($clientId === '' || $clientSecret === '' || $redirectUri === '') {
    http_response_code(503);
    exit('El inicio de sesión con Google aún no está configurado.');
}

$noticiaId = (int) ($_GET['noticia_id'] ?? 0);
$state = bin2hex(random_bytes(32));
$codeVerifier = bin2hex(random_bytes(32));
$codeChallenge = rtrim(strtr(base64_encode(hash('sha256', $codeVerifier, true)), '+/', '-_'), '=');

$_SESSION['oauth_google_state'] = $state;
$_SESSION['oauth_google_verifier'] = $codeVerifier;
$_SESSION['oauth_google_noticia_id'] = $noticiaId > 0 ? $noticiaId : 0;

$parametros = http_build_query([
    'client_id'             => $clientId,
    'redirect_uri'          => $redirectUri,
    'response_type'         => 'code',
    'scope'                 => 'openid email profile',
    'state'                 => $state,
    'code_challenge'        => $codeChallenge,
    'code_challenge_method' => 'S256',
    'prompt'                => 'select_account',
]);

header('Location: https://accounts.google.com/o/oauth2/v2/auth?' . $parametros);
exit;
