<?php
/**
 * Endpoint de Configuración General del portal NewsCMS.
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
    $modo = $_GET['modo'] ?? 'publico';

    if ($modo === 'publico') {
        echo json_encode([
            'ok'            => true,
            'configuracion' => obtenerConfiguracionGeneral($pdo),
        ]);
    } elseif ($modo === 'admin_obtener') {
        responderConfiguracionAdmin($pdo);
    } else {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Modo no válido.']);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    guardarConfiguracionAdmin($pdo);
    exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'mensaje' => 'Método no permitido.']);

function obtenerConfiguracionGeneral(PDO $pdo): array
{
    $valores = [
        'nombre_portal'      => 'NewsCMS',
        'subtitulo_portal'   => 'Portal informativo universitario',
        'descripcion_portal' => 'Sistema de gestión de contenidos de noticias desarrollado con HTML5, CSS3, JavaScript, PHP nativo y MySQL.',
        'texto_pie_pagina'   => 'Sistema de gestión de contenidos de noticias desarrollado sin frameworks con HTML5, CSS3, JavaScript, PHP y MySQL.',
        'correo_contacto'    => '',
    ];

    $stmt = $pdo->query(
        "SELECT clave, valor
         FROM configuracion
         WHERE clave IN ('nombre_portal', 'subtitulo_portal', 'descripcion_portal', 'texto_pie_pagina', 'correo_contacto')"
    );

    foreach ($stmt->fetchAll() as $fila) {
        if (array_key_exists($fila['clave'], $valores)) {
            $valores[$fila['clave']] = (string) $fila['valor'];
        }
    }

    return $valores;
}

function responderConfiguracionAdmin(PDO $pdo): void
{
    iniciarSesionSegura();

    if (!estaAutenticado()) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'mensaje' => 'No autenticado.']);
        return;
    }

    if (!tieneRol(['administrador'])) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'Solo el administrador puede consultar esta configuración.']);
        return;
    }

    echo json_encode([
        'ok'            => true,
        'configuracion' => obtenerConfiguracionGeneral($pdo),
    ]);
}

function guardarConfiguracionAdmin(PDO $pdo): void
{
    iniciarSesionSegura();

    if (!estaAutenticado()) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'mensaje' => 'No autenticado.']);
        return;
    }

    if (!tieneRol(['administrador'])) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'Solo el administrador puede modificar la configuración.']);
        return;
    }

    if (!validarTokenCsrf($_POST['csrf_token'] ?? '')) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'Token CSRF inválido. Recarga la página.']);
        return;
    }

    $accion = trim($_POST['accion'] ?? '');
    if ($accion !== 'guardar') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Acción no válida.']);
        return;
    }

    $campos = [
        'nombre_portal'      => trim((string) ($_POST['nombre_portal'] ?? '')),
        'subtitulo_portal'   => trim((string) ($_POST['subtitulo_portal'] ?? '')),
        'descripcion_portal' => trim((string) ($_POST['descripcion_portal'] ?? '')),
        'texto_pie_pagina'   => trim((string) ($_POST['texto_pie_pagina'] ?? '')),
        'correo_contacto'    => trim((string) ($_POST['correo_contacto'] ?? '')),
    ];

    foreach ($campos as $valor) {
        if (strip_tags($valor) !== $valor) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'mensaje' => 'No se permiten etiquetas HTML en la configuración general.']);
            return;
        }
    }

    if ($campos['nombre_portal'] === '' || mb_strlen($campos['nombre_portal']) > 80) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'El nombre del portal es obligatorio (máximo 80 caracteres).']);
        return;
    }

    if (mb_strlen($campos['subtitulo_portal']) > 150) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'El subtítulo no debe superar los 150 caracteres.']);
        return;
    }

    if (mb_strlen($campos['descripcion_portal']) > 300) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'La descripción del sitio no debe superar los 300 caracteres.']);
        return;
    }

    if (mb_strlen($campos['texto_pie_pagina']) > 300) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'El texto del pie de página no debe superar los 300 caracteres.']);
        return;
    }

    if ($campos['correo_contacto'] !== '') {
        if (mb_strlen($campos['correo_contacto']) > 150 || !filter_var($campos['correo_contacto'], FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'mensaje' => 'Ingresa un correo de contacto válido.']);
            return;
        }
    }

    try {
        $pdo->beginTransaction();
        $stmt = $pdo->prepare(
            'INSERT INTO configuracion (clave, valor)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE valor = VALUES(valor)'
        );

        foreach ($campos as $clave => $valor) {
            $stmt->execute([$clave, $valor]);
        }

        $pdo->commit();

        echo json_encode([
            'ok'            => true,
            'mensaje'       => 'Configuración guardada correctamente.',
            'configuracion' => $campos,
        ]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log('NewsCMS - Error al guardar configuración: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['ok' => false, 'mensaje' => 'No se pudo guardar la configuración.']);
    }
}
