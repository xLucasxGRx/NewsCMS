<?php
/**
 * Endpoint del flujo de revisión y aprobación editorial de NewsCMS.
 */

require_once __DIR__ . '/../config/conexion.php';
require_once __DIR__ . '/../config/seguridad.php';

header('Content-Type: application/json; charset=utf-8');

if (!$conexionActiva || !$pdo) {
    http_response_code(503);
    echo json_encode(['exito' => false, 'mensaje' => 'Base de datos no disponible.']);
    exit;
}

iniciarSesionSegura();

if (!estaAutenticado()) {
    http_response_code(401);
    echo json_encode(['exito' => false, 'mensaje' => 'No autenticado.']);
    exit;
}

$usuario = obtenerUsuarioActual();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $accion = $_GET['accion'] ?? 'pendientes';

    if ($accion === 'pendientes') {
        listarNoticiasPendientes($pdo, $usuario);
    } elseif ($accion === 'historial') {
        consultarHistorialRevisiones($pdo, $usuario);
    } else {
        http_response_code(400);
        echo json_encode(['exito' => false, 'mensaje' => 'Acción no válida.']);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    procesarDecisionEditorial($pdo, $usuario);
    exit;
}

http_response_code(405);
echo json_encode(['exito' => false, 'mensaje' => 'Método no permitido.']);

/**
 * Lista las noticias con estado pendiente_revision (solo administrador y editor).
 */
function listarNoticiasPendientes(PDO $pdo, array $usuario): void
{
    if (!in_array($usuario['rol'], ['administrador', 'editor'], true)) {
        http_response_code(403);
        echo json_encode(['exito' => false, 'mensaje' => 'No autorizado para revisar noticias.']);
        return;
    }

    $consulta = $pdo->query(
        "SELECT n.id, n.titulo, n.estado, n.fecha_creacion,
                c.nombre AS categoria, u.nombre AS redactor
         FROM noticias n
         INNER JOIN categorias c ON c.id = n.categoria_id
         INNER JOIN usuarios u ON u.id = n.autor_id
         WHERE n.estado = 'pendiente_revision'
         ORDER BY n.fecha_creacion ASC, n.id ASC"
    );
    $noticias = $consulta->fetchAll();

    echo json_encode([
        'exito'    => true,
        'total'    => count($noticias),
        'noticias' => $noticias,
    ]);
}

/**
 * Consulta las revisiones registradas de una noticia si el usuario está autorizado.
 */
function consultarHistorialRevisiones(PDO $pdo, array $usuario): void
{
    $noticiaId = (int) ($_GET['noticia_id'] ?? 0);
    if ($noticiaId <= 0) {
        http_response_code(400);
        echo json_encode(['exito' => false, 'mensaje' => 'Identificador de noticia no válido.']);
        return;
    }

    $stmtNoticia = $pdo->prepare('SELECT id, autor_id FROM noticias WHERE id = ? LIMIT 1');
    $stmtNoticia->execute([$noticiaId]);
    $noticia = $stmtNoticia->fetch();

    if (!$noticia) {
        http_response_code(404);
        echo json_encode(['exito' => false, 'mensaje' => 'Noticia no encontrada.']);
        return;
    }

    $autorizado = in_array($usuario['rol'], ['administrador', 'editor'], true)
        || (int) $noticia['autor_id'] === (int) $usuario['id'];

    if (!$autorizado) {
        http_response_code(403);
        echo json_encode(['exito' => false, 'mensaje' => 'No tienes permisos para ver estas revisiones.']);
        return;
    }

    $stmtRev = $pdo->prepare(
        'SELECT r.id, r.accion, r.observaciones, r.fecha_creacion, u.nombre AS editor
         FROM revisiones_editoriales r
         INNER JOIN usuarios u ON u.id = r.editor_id
         WHERE r.noticia_id = ?
         ORDER BY r.fecha_creacion DESC, r.id DESC'
    );
    $stmtRev->execute([$noticiaId]);

    echo json_encode([
        'exito'      => true,
        'revisiones' => $stmtRev->fetchAll(),
    ]);
}

/**
 * Aprueba y publica una noticia o solicita cambios registrando observaciones.
 */
function procesarDecisionEditorial(PDO $pdo, array $usuario): void
{
    if (!in_array($usuario['rol'], ['administrador', 'editor'], true)) {
        http_response_code(403);
        echo json_encode(['exito' => false, 'mensaje' => 'No tienes permisos para aprobar o revisar noticias.']);
        return;
    }

    if (!validarTokenCsrf($_POST['csrf_token'] ?? '')) {
        http_response_code(403);
        echo json_encode(['exito' => false, 'mensaje' => 'Token CSRF inválido. Recarga la página.']);
        return;
    }

    $accion = trim($_POST['accion'] ?? '');
    $noticiaId = (int) ($_POST['noticia_id'] ?? 0);
    $observaciones = trim($_POST['observaciones'] ?? '');

    if ($noticiaId <= 0 || !in_array($accion, ['aprobar', 'solicitar_cambios'], true)) {
        http_response_code(400);
        echo json_encode(['exito' => false, 'mensaje' => 'Datos de revisión no válidos.']);
        return;
    }

    if ($accion === 'solicitar_cambios' && $observaciones === '') {
        http_response_code(400);
        echo json_encode(['exito' => false, 'mensaje' => 'Las observaciones son obligatorias para solicitar cambios.']);
        return;
    }

    try {
        $pdo->beginTransaction();

        $stmtNoticia = $pdo->prepare(
            'SELECT id, estado, fecha_publicacion
             FROM noticias
             WHERE id = ?
             FOR UPDATE'
        );
        $stmtNoticia->execute([$noticiaId]);
        $noticia = $stmtNoticia->fetch();

        if (!$noticia) {
            $pdo->rollBack();
            http_response_code(404);
            echo json_encode(['exito' => false, 'mensaje' => 'Noticia no encontrada.']);
            return;
        }

        if ($noticia['estado'] !== 'pendiente_revision') {
            $pdo->rollBack();
            http_response_code(409);
            echo json_encode(['exito' => false, 'mensaje' => 'La noticia ya fue procesada o no está pendiente de revisión.']);
            return;
        }

        if ($accion === 'aprobar') {
            $stmtRev = $pdo->prepare(
                'INSERT INTO revisiones_editoriales (noticia_id, editor_id, accion, observaciones)
                 VALUES (?, ?, ?, ?)'
            );
            $stmtRev->execute([
                $noticiaId,
                $usuario['id'],
                'aprobada',
                $observaciones !== '' ? $observaciones : 'Aprobada y publicada.',
            ]);

            $stmtUpd = $pdo->prepare(
                "UPDATE noticias
                 SET estado = 'publicada',
                     fecha_publicacion = COALESCE(fecha_publicacion, NOW())
                 WHERE id = ?"
            );
            $stmtUpd->execute([$noticiaId]);

            $pdo->commit();
            echo json_encode([
                'exito'   => true,
                'mensaje' => 'Noticia aprobada y publicada correctamente.',
            ]);
            return;
        }

        $stmtRev = $pdo->prepare(
            'INSERT INTO revisiones_editoriales (noticia_id, editor_id, accion, observaciones)
             VALUES (?, ?, ?, ?)'
        );
        $stmtRev->execute([
            $noticiaId,
            $usuario['id'],
            'cambios_solicitados',
            $observaciones,
        ]);

        $stmtUpd = $pdo->prepare(
            "UPDATE noticias
             SET estado = 'cambios_solicitados'
             WHERE id = ?"
        );
        $stmtUpd->execute([$noticiaId]);

        $pdo->commit();
        echo json_encode([
            'exito'   => true,
            'mensaje' => 'Cambios solicitados y observaciones registradas.',
        ]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log('NewsCMS - Error en revisión editorial: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['exito' => false, 'mensaje' => 'No se pudo registrar la revisión editorial.']);
    }
}
