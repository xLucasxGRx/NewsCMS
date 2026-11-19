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
    } elseif ($accion === 'detalle_propuesta') {
        consultarDetallePropuesta($pdo, $usuario);
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
    if (!tienePermiso('consultar_revision')) {
        http_response_code(403);
        echo json_encode(['exito' => false, 'mensaje' => 'No autorizado para consultar la revisión editorial.']);
        return;
    }

    $consultaNuevas = $pdo->query(
        "SELECT n.id, n.id AS noticia_id, NULL AS actualizacion_id,
                n.titulo, NULL AS titulo_publicado, n.estado, n.fecha_creacion,
                c.nombre AS categoria, u.nombre AS redactor,
                'nueva_publicacion' AS tipo_revision
         FROM noticias n
         INNER JOIN categorias c ON c.id = n.categoria_id
         INNER JOIN usuarios u ON u.id = n.autor_id
         WHERE n.estado = 'pendiente_revision'"
    );
    $nuevas = $consultaNuevas->fetchAll();

    $consultaPropuestas = $pdo->query(
        "SELECT n.id, a.noticia_id, a.id AS actualizacion_id,
                a.titulo, n.titulo AS titulo_publicado, a.estado, a.fecha_actualizacion AS fecha_creacion,
                c.nombre AS categoria, u.nombre AS redactor,
                'actualizacion_pendiente' AS tipo_revision
         FROM actualizaciones_noticias a
         INNER JOIN noticias n ON n.id = a.noticia_id
         INNER JOIN categorias c ON c.id = a.categoria_id
         INNER JOIN usuarios u ON u.id = a.autor_id
         WHERE a.estado = 'pendiente_revision'
           AND n.estado = 'publicada'"
    );
    $propuestas = $consultaPropuestas->fetchAll();

    $noticias = array_merge($nuevas, $propuestas);
    foreach ($noticias as &$item) {
        $item['id'] = (int) $item['id'];
        $item['noticia_id'] = (int) $item['noticia_id'];
        $item['actualizacion_id'] = $item['actualizacion_id'] !== null ? (int) $item['actualizacion_id'] : null;
        $item['clave_item'] = $item['actualizacion_id'] !== null
            ? 'actualizacion:' . $item['actualizacion_id']
            : 'noticia:' . $item['noticia_id'];
    }
    unset($item);

    usort($noticias, static function (array $a, array $b): int {
        $cmpFecha = strcmp((string) $a['fecha_creacion'], (string) $b['fecha_creacion']);
        if ($cmpFecha !== 0) {
            return $cmpFecha;
        }
        return ($a['noticia_id'] <=> $b['noticia_id']);
    });

    echo json_encode([
        'exito'    => true,
        'total'    => count($noticias),
        'noticias' => $noticias,
    ]);
}

/**
 * Devuelve el contenido completo de una propuesta de actualización junto con la versión publicada vigente.
 */
function consultarDetallePropuesta(PDO $pdo, array $usuario): void
{
    if (!tienePermiso('consultar_revision')) {
        http_response_code(403);
        echo json_encode(['exito' => false, 'mensaje' => 'No autorizado para consultar revisiones.']);
        return;
    }

    $actualizacionId = (int) ($_GET['actualizacion_id'] ?? 0);
    if ($actualizacionId <= 0) {
        http_response_code(400);
        echo json_encode(['exito' => false, 'mensaje' => 'Identificador de propuesta no válido.']);
        return;
    }

    $stmtProp = $pdo->prepare(
        'SELECT a.id, a.noticia_id, a.autor_id, a.titulo, a.resumen, a.contenido,
                a.categoria_id, a.imagen, a.etiquetas_json, a.es_destacada, a.es_ultima_hora,
                a.estado, a.observaciones, a.fecha_actualizacion,
                c.nombre AS categoria, u.nombre AS autor
         FROM actualizaciones_noticias a
         INNER JOIN categorias c ON c.id = a.categoria_id
         INNER JOIN usuarios u ON u.id = a.autor_id
         WHERE a.id = ?
         LIMIT 1'
    );
    $stmtProp->execute([$actualizacionId]);
    $propuesta = $stmtProp->fetch();

    if (!$propuesta) {
        http_response_code(404);
        echo json_encode(['exito' => false, 'mensaje' => 'Propuesta de actualización no encontrada.']);
        return;
    }

    $stmtNot = $pdo->prepare(
        'SELECT n.id, n.titulo, n.resumen, n.contenido, n.imagen, n.estado, n.autor_id,
                n.es_destacada, n.es_ultima_hora, n.fecha_publicacion, n.fecha_creacion,
                c.nombre AS categoria, u.nombre AS autor
         FROM noticias n
         INNER JOIN categorias c ON c.id = n.categoria_id
         INNER JOIN usuarios u ON u.id = n.autor_id
         WHERE n.id = ?
         LIMIT 1'
    );
    $stmtNot->execute([(int) $propuesta['noticia_id']]);
    $publicada = $stmtNot->fetch();

    if (!$publicada) {
        http_response_code(404);
        echo json_encode(['exito' => false, 'mensaje' => 'Noticia original no encontrada.']);
        return;
    }

    $esAutor = (int) $propuesta['autor_id'] === (int) $usuario['id']
        || (int) $publicada['autor_id'] === (int) $usuario['id'];
    $puedeLeer = ($esAutor && tienePermiso('consultar_noticias_propias'))
        || (!$esAutor && tienePermiso('consultar_noticias_ajenas'));

    if (!$puedeLeer) {
        http_response_code(404);
        echo json_encode(['exito' => false, 'mensaje' => 'Propuesta no disponible para lectura.']);
        return;
    }

    $idsEtiquetasProp = json_decode((string) ($propuesta['etiquetas_json'] ?? '[]'), true);
    $propuesta['etiquetas'] = [];
    if (is_array($idsEtiquetasProp) && !empty($idsEtiquetasProp)) {
        $limpios = array_values(array_filter(array_map('intval', $idsEtiquetasProp), static fn(int $v): bool => $v > 0));
        if (!empty($limpios)) {
            $placeholders = implode(',', array_fill(0, count($limpios), '?'));
            $stmtEtProp = $pdo->prepare("SELECT id, nombre FROM etiquetas WHERE id IN ($placeholders) ORDER BY nombre ASC");
            $stmtEtProp->execute($limpios);
            $propuesta['etiquetas'] = $stmtEtProp->fetchAll();
        }
    }

    $stmtEtPub = $pdo->prepare(
        'SELECT e.id, e.nombre
         FROM etiquetas e
         INNER JOIN noticias_etiquetas ne ON ne.etiqueta_id = e.id
         WHERE ne.noticia_id = ?
         ORDER BY e.nombre ASC'
    );
    $stmtEtPub->execute([(int) $publicada['id']]);
    $publicada['etiquetas'] = $stmtEtPub->fetchAll();

    echo json_encode([
        'exito'     => true,
        'propuesta' => $propuesta,
        'publicada' => $publicada,
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

    $autorizado = tienePermiso('consultar_revision')
        || ((int) $noticia['autor_id'] === (int) $usuario['id'] && tienePermiso('consultar_noticias_propias'));

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
    if (!tienePermiso('consultar_revision')) {
        http_response_code(403);
        echo json_encode(['exito' => false, 'mensaje' => 'No tienes permisos para acceder a la revisión editorial.']);
        return;
    }

    if (!validarTokenCsrf($_POST['csrf_token'] ?? '')) {
        http_response_code(403);
        echo json_encode(['exito' => false, 'mensaje' => 'Token CSRF inválido. Recarga la página.']);
        return;
    }

    $accion = trim($_POST['accion'] ?? '');
    $noticiaId = (int) ($_POST['noticia_id'] ?? 0);
    $actualizacionId = (int) ($_POST['actualizacion_id'] ?? 0);
    $observaciones = trim($_POST['observaciones'] ?? '');

    if ($noticiaId <= 0 || !in_array($accion, ['aprobar', 'solicitar_cambios'], true)) {
        http_response_code(400);
        echo json_encode(['exito' => false, 'mensaje' => 'Datos de revisión no válidos.']);
        return;
    }

    if ($accion === 'aprobar' && !tienePermiso('aprobar_noticias')) {
        http_response_code(403);
        echo json_encode(['exito' => false, 'mensaje' => 'Tu rol no tiene permiso para aprobar noticias.']);
        return;
    }

    if ($accion === 'solicitar_cambios' && !tienePermiso('solicitar_correcciones')) {
        http_response_code(403);
        echo json_encode(['exito' => false, 'mensaje' => 'Tu rol no tiene permiso para solicitar correcciones.']);
        return;
    }

    if ($accion === 'solicitar_cambios' && $observaciones === '') {
        http_response_code(400);
        echo json_encode(['exito' => false, 'mensaje' => 'Las observaciones son obligatorias para solicitar cambios.']);
        return;
    }

    if ($actualizacionId > 0) {
        procesarDecisionActualizacion($pdo, $usuario, $accion, $noticiaId, $actualizacionId, $observaciones);
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

/**
 * Aprueba una propuesta de actualización sobre una noticia publicada o solicita correcciones conservando la publicación vigente.
 */
function procesarDecisionActualizacion(
    PDO $pdo,
    array $usuario,
    string $accion,
    int $noticiaId,
    int $actualizacionId,
    string $observaciones
): void {
    $imagenAnteriorLimpiar = null;

    try {
        $pdo->beginTransaction();

        $stmtProp = $pdo->prepare(
            'SELECT *
             FROM actualizaciones_noticias
             WHERE id = ?
             LIMIT 1
             FOR UPDATE'
        );
        $stmtProp->execute([$actualizacionId]);
        $propuesta = $stmtProp->fetch();

        if (!$propuesta || (int) $propuesta['noticia_id'] !== $noticiaId) {
            $pdo->rollBack();
            http_response_code(404);
            echo json_encode(['exito' => false, 'mensaje' => 'Propuesta de actualización no encontrada.']);
            return;
        }

        if ($propuesta['estado'] !== 'pendiente_revision') {
            $pdo->rollBack();
            http_response_code(409);
            echo json_encode(['exito' => false, 'mensaje' => 'Esta propuesta de actualización ya fue revisada o no está pendiente.']);
            return;
        }

        $stmtNoticia = $pdo->prepare(
            'SELECT id, estado, imagen
             FROM noticias
             WHERE id = ?
             LIMIT 1
             FOR UPDATE'
        );
        $stmtNoticia->execute([$noticiaId]);
        $noticia = $stmtNoticia->fetch();

        if (!$noticia) {
            $pdo->rollBack();
            http_response_code(404);
            echo json_encode(['exito' => false, 'mensaje' => 'La noticia original no existe.']);
            return;
        }

        if ($noticia['estado'] !== 'publicada') {
            $stmtDescartar = $pdo->prepare("UPDATE actualizaciones_noticias SET estado = 'descartada' WHERE id = ?");
            $stmtDescartar->execute([$actualizacionId]);
            $pdo->commit();
            http_response_code(409);
            echo json_encode([
                'exito'   => false,
                'mensaje' => 'La noticia original ya no está publicada (fue archivada o retirada) y no puede aplicarse esta actualización.',
            ]);
            return;
        }

        if ($accion === 'aprobar') {
            $imagenAnterior = $noticia['imagen'];
            $imagenPropuesta = $propuesta['imagen'];

            $stmtUpdNoticia = $pdo->prepare(
                "UPDATE noticias
                 SET titulo = ?, resumen = ?, contenido = ?, categoria_id = ?, imagen = ?,
                     es_destacada = ?, es_ultima_hora = ?
                 WHERE id = ? AND estado = 'publicada'"
            );
            $stmtUpdNoticia->execute([
                $propuesta['titulo'],
                $propuesta['resumen'],
                $propuesta['contenido'],
                (int) $propuesta['categoria_id'],
                $imagenPropuesta,
                (int) $propuesta['es_destacada'],
                (int) $propuesta['es_ultima_hora'],
                $noticiaId,
            ]);

            $stmtDelEt = $pdo->prepare('DELETE FROM noticias_etiquetas WHERE noticia_id = ?');
            $stmtDelEt->execute([$noticiaId]);

            $etiquetasProp = json_decode((string) ($propuesta['etiquetas_json'] ?? '[]'), true);
            if (is_array($etiquetasProp) && !empty($etiquetasProp)) {
                $stmtExisteEt = $pdo->prepare('SELECT id FROM etiquetas WHERE id = ? LIMIT 1');
                $stmtInsEt = $pdo->prepare('INSERT IGNORE INTO noticias_etiquetas (noticia_id, etiqueta_id) VALUES (?, ?)');
                foreach ($etiquetasProp as $etId) {
                    $etId = (int) $etId;
                    if ($etId <= 0) {
                        continue;
                    }
                    $stmtExisteEt->execute([$etId]);
                    if ($stmtExisteEt->fetch()) {
                        $stmtInsEt->execute([$noticiaId, $etId]);
                    }
                }
            }

            $notaFinal = $observaciones !== '' ? $observaciones : 'Actualización aprobada y aplicada a la publicación.';
            $stmtUpdProp = $pdo->prepare(
                "UPDATE actualizaciones_noticias
                 SET estado = 'aprobada', editor_id = ?, observaciones = ?, fecha_revision = NOW()
                 WHERE id = ?"
            );
            $stmtUpdProp->execute([$usuario['id'], $notaFinal, $actualizacionId]);

            $stmtRev = $pdo->prepare(
                'INSERT INTO revisiones_editoriales (noticia_id, editor_id, accion, observaciones)
                 VALUES (?, ?, ?, ?)'
            );
            $stmtRev->execute([$noticiaId, $usuario['id'], 'actualizacion_aprobada', $notaFinal]);

            if (!empty($imagenAnterior) && $imagenAnterior !== $imagenPropuesta) {
                $imagenAnteriorLimpiar = (string) $imagenAnterior;
            }

            $pdo->commit();
            if ($imagenAnteriorLimpiar !== null) {
                limpiarImagenPortadaRevision($pdo, $imagenAnteriorLimpiar);
            }

            echo json_encode([
                'exito'   => true,
                'mensaje' => 'Actualización aprobada y publicada correctamente.',
            ]);
            return;
        }

        // Solicitar cambios sobre la actualización: conserva la versión publicada intacta
        $stmtUpdProp = $pdo->prepare(
            "UPDATE actualizaciones_noticias
             SET estado = 'cambios_solicitados', observaciones = ?, editor_id = ?, fecha_revision = NOW()
             WHERE id = ?"
        );
        $stmtUpdProp->execute([$observaciones, $usuario['id'], $actualizacionId]);

        $stmtRev = $pdo->prepare(
            'INSERT INTO revisiones_editoriales (noticia_id, editor_id, accion, observaciones)
             VALUES (?, ?, ?, ?)'
        );
        $stmtRev->execute([$noticiaId, $usuario['id'], 'cambios_actualizacion', $observaciones]);

        $pdo->commit();
        echo json_encode([
            'exito'   => true,
            'mensaje' => 'Cambios solicitados sobre la actualización. La versión publicada continúa visible sin alteraciones.',
        ]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log('NewsCMS - Error al procesar actualización editorial: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['exito' => false, 'mensaje' => 'No se pudo registrar la decisión sobre la actualización.']);
    }
}

function limpiarImagenPortadaRevision(PDO $pdo, string $rutaRelativa): void
{
    $ruta = trim($rutaRelativa);
    if ($ruta === '' || strpos($ruta, 'uploads/portadas/') !== 0 || strpos($ruta, '..') !== false) {
        return;
    }

    try {
        $stmtNot = $pdo->prepare('SELECT COUNT(*) FROM noticias WHERE imagen = ?');
        $stmtNot->execute([$ruta]);
        if ((int) $stmtNot->fetchColumn() > 0) {
            return;
        }

        $stmtAct = $pdo->prepare("SELECT COUNT(*) FROM actualizaciones_noticias WHERE imagen = ? AND estado IN ('borrador', 'pendiente_revision', 'cambios_solicitados')");
        $stmtAct->execute([$ruta]);
        if ((int) $stmtAct->fetchColumn() > 0) {
            return;
        }
    } catch (Throwable $e) {
        return;
    }

    $dirPermitido = realpath(__DIR__ . '/../uploads/portadas');
    $archivoReal = realpath(__DIR__ . '/../' . $ruta);
    if (
        $dirPermitido !== false
        && $archivoReal !== false
        && strpos($archivoReal, $dirPermitido . DIRECTORY_SEPARATOR) === 0
        && is_file($archivoReal)
    ) {
        @unlink($archivoReal);
    }
}
