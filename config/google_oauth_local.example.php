<?php
/**
 * Plantilla de configuración para Google OAuth 2.0.
 * Copia este archivo como config/google_oauth_local.php y coloca tus credenciales reales.
 */

if (PHP_SAPI !== 'cli' && realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    http_response_code(403);
    exit('Acceso denegado.');
}

return [
    'client_id'     => '',
    'client_secret' => '',
    'redirect_uri'  => 'http://localhost:8081/NewsCMS/php/google_retorno.php',
];
