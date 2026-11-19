<?php
/**
 * Plantilla de configuración SMTP de Gmail para el módulo Newsletter de NewsCMS.
 *
 * INSTRUCCIONES:
 * 1. NO guardes contraseñas reales dentro de C:\xampp\htdocs\NewsCMS.
 * 2. Edita el archivo privado fuera del DocumentRoot de Apache:
 *    C:\xampp\newscms_secrets\smtp_local.php
 * 3. Activa la verificación en dos pasos en tu cuenta de Google y genera una
 *    Contraseña de aplicación específica para correo.
 * 4. Coloca tu correo Gmail en 'usuario' y 'remitente_correo', y la contraseña de
 *    aplicación (sin espacios) en 'clave_aplicacion'.
 */

if (PHP_SAPI !== 'cli' && realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    http_response_code(403);
    exit('Acceso denegado.');
}

return [
    'host'             => 'smtp.gmail.com',
    'puerto'           => 465,
    'cifrado'          => 'ssl',
    'usuario'          => '',
    'clave_aplicacion' => '',
    'remitente_correo' => '',
    'remitente_nombre' => 'NewsCMS',
];
