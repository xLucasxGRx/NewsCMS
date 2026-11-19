<?php
/**
 * Endpoint de noticias para el portal público y el panel administrativo.
 * Todas las respuestas se devuelven en formato JSON.
 */

require_once __DIR__ . '/../config/conexion.php';
require_once __DIR__ . '/../config/seguridad.php';

header('Content-Type: application/json; charset=utf-8');

if (!$conexionActiva || !$pdo) {
    http_response_code(503);
    echo json_encode(['ok' => false, 'mensaje' => 'Base de datos no disponible.']);
    exit;
}

iniciarSesionSegura();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $modo = $_GET['modo'] ?? 'publico';

    if ($modo === 'publico') {
        responderPortadaPublica($pdo);
    } elseif ($modo === 'listado') {
        responderListadoPublico($pdo);
    } elseif ($modo === 'archivo') {
        responderArchivoHistorico($pdo);
    } elseif ($modo === 'detalle') {
        responderDetalleNoticia($pdo);
    } elseif ($modo === 'admin_lista') {
        responderListaAdmin($pdo);
    } elseif ($modo === 'admin_obtener') {
        responderNoticiaAdmin($pdo);
    } else {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Modo de consulta no válido.']);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    guardarNoticia($pdo);
    exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'mensaje' => 'Método no permitido.']);

/**
 * Devuelve las noticias publicadas para la portada index.html.
 */
function responderPortadaPublica(PDO $pdo): void
{
    $sqlBase = "SELECT n.id, n.titulo, n.resumen, n.imagen, n.es_destacada, n.es_ultima_hora,
                       n.fecha_publicacion, c.nombre AS categoria, c.identificador AS categoria_slug,
                       u.nombre AS autor
                FROM noticias n
                INNER JOIN categorias c ON c.id = n.categoria_id
                INNER JOIN usuarios u ON u.id = n.autor_id
                WHERE n.estado = 'publicada'";

    $principal = $pdo->query(
        $sqlBase . ' ORDER BY n.es_destacada DESC, n.fecha_publicacion DESC, n.id DESC LIMIT 1'
    )->fetch();

    $destacadas = $pdo->query(
        $sqlBase . ' AND n.es_destacada = 1 ORDER BY n.fecha_publicacion DESC, n.id DESC LIMIT 3'
    )->fetchAll();

    $ultimasHora = $pdo->query(
        $sqlBase . ' AND n.es_ultima_hora = 1 ORDER BY n.fecha_publicacion DESC, n.id DESC LIMIT 3'
    )->fetchAll();

    $ultimas = $pdo->query(
        $sqlBase . ' ORDER BY n.fecha_publicacion DESC, n.id DESC LIMIT 5'
    )->fetchAll();

    $porCategoria = $pdo->query(
        $sqlBase . ' ORDER BY n.fecha_publicacion DESC, n.id DESC LIMIT 20'
    )->fetchAll();

    echo json_encode([
        'ok'            => true,
        'principal'     => $principal ?: null,
        'destacadas'    => $destacadas,
        'ultimas_hora'  => $ultimasHora,
        'ultimas'       => $ultimas,
        'por_categoria' => $porCategoria,
    ]);
}

/**
 * Devuelve el listado público de noticias publicadas con filtros opcionales.
 */
function responderListadoPublico(PDO $pdo): void
{
    $busqueda = trim($_GET['q'] ?? '');
    $categoria = trim($_GET['categoria'] ?? '');

    $sql = "SELECT n.id, n.titulo, n.resumen, n.imagen, n.es_destacada, n.es_ultima_hora,
                   n.fecha_publicacion, c.nombre AS categoria, c.identificador AS categoria_slug,
                   u.nombre AS autor
            FROM noticias n
            INNER JOIN categorias c ON c.id = n.categoria_id
            INNER JOIN usuarios u ON u.id = n.autor_id
            WHERE n.estado = 'publicada'";

    $parametros = [];

    if ($busqueda !== '') {
        $sql .= ' AND (n.titulo LIKE ? OR n.resumen LIKE ?)';
        $like = '%' . $busqueda . '%';
        $parametros[] = $like;
        $parametros[] = $like;
    }

    if ($categoria !== '') {
        $sql .= ' AND (c.identificador = ? OR c.nombre = ?)';
        $parametros[] = $categoria;
        $parametros[] = $categoria;
    }

    $sql .= ' ORDER BY n.fecha_publicacion DESC, n.id DESC';

    $consulta = $pdo->prepare($sql);
    $consulta->execute($parametros);

    echo json_encode([
        'ok'       => true,
        'noticias' => $consulta->fetchAll(),
    ]);
}

/**
 * Devuelve el archivo histórico paginado de noticias publicadas con filtros opcionales.
 */
function responderArchivoHistorico(PDO $pdo): void
{
    $anioTexto = trim($_GET['anio'] ?? '');
    $mesTexto = trim($_GET['mes'] ?? '');
    $categoria = trim($_GET['categoria'] ?? '');
    $pagina = max(1, (int) ($_GET['pagina'] ?? 1));
    $porPagina = 10;

    $anio = 0;
    if ($anioTexto !== '') {
        $anio = (int) $anioTexto;
        if ($anio < 1970 || $anio > 2100) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'mensaje' => 'Año no válido.']);
            return;
        }
    }

    $mes = 0;
    if ($mesTexto !== '') {
        $mes = (int) $mesTexto;
        if ($mes < 1 || $mes > 12) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'mensaje' => 'Mes no válido.']);
            return;
        }
    }

    $condiciones = ["n.estado = 'publicada'", 'n.fecha_publicacion IS NOT NULL'];
    $parametros = [];

    if ($anio > 0 && $mes > 0) {
        $inicio = sprintf('%04d-%02d-01 00:00:00', $anio, $mes);
        $fin = (new DateTimeImmutable($inicio))->modify('+1 month')->format('Y-m-d H:i:s');
        $condiciones[] = 'n.fecha_publicacion >= ? AND n.fecha_publicacion < ?';
        $parametros[] = $inicio;
        $parametros[] = $fin;
    } elseif ($anio > 0) {
        $inicio = sprintf('%04d-01-01 00:00:00', $anio);
        $fin = sprintf('%04d-01-01 00:00:00', $anio + 1);
        $condiciones[] = 'n.fecha_publicacion >= ? AND n.fecha_publicacion < ?';
        $parametros[] = $inicio;
        $parametros[] = $fin;
    } elseif ($mes > 0) {
        $condiciones[] = 'MONTH(n.fecha_publicacion) = ?';
        $parametros[] = $mes;
    }

    if ($categoria !== '') {
        $condiciones[] = 'c.identificador = ?';
        $parametros[] = $categoria;
    }

    $whereSql = implode(' AND ', $condiciones);

    $stmtTotal = $pdo->prepare(
        "SELECT COUNT(*)
         FROM noticias n
         INNER JOIN categorias c ON c.id = n.categoria_id
         WHERE {$whereSql}"
    );
    $stmtTotal->execute($parametros);
    $total = (int) $stmtTotal->fetchColumn();

    $totalPaginas = $total > 0 ? (int) ceil($total / $porPagina) : 0;
    if ($totalPaginas > 0 && $pagina > $totalPaginas) {
        $pagina = $totalPaginas;
    }
    $offset = ($pagina - 1) * $porPagina;

    $stmtLista = $pdo->prepare(
        "SELECT n.id, n.titulo, n.resumen, n.imagen, n.fecha_publicacion,
                c.nombre AS categoria, c.identificador AS categoria_slug, u.nombre AS autor
         FROM noticias n
         INNER JOIN categorias c ON c.id = n.categoria_id
         INNER JOIN usuarios u ON u.id = n.autor_id
         WHERE {$whereSql}
         ORDER BY n.fecha_publicacion DESC, n.id DESC
         LIMIT ? OFFSET ?"
    );

    $indice = 1;
    foreach ($parametros as $valor) {
        $stmtLista->bindValue($indice, $valor);
        $indice++;
    }
    $stmtLista->bindValue($indice, $porPagina, PDO::PARAM_INT);
    $stmtLista->bindValue($indice + 1, $offset, PDO::PARAM_INT);
    $stmtLista->execute();

    $anios = $pdo->query(
        "SELECT DISTINCT YEAR(fecha_publicacion) AS anio
         FROM noticias
         WHERE estado = 'publicada' AND fecha_publicacion IS NOT NULL
         ORDER BY anio DESC"
    )->fetchAll(PDO::FETCH_COLUMN);

    echo json_encode([
        'ok'                => true,
        'noticias'          => $stmtLista->fetchAll(),
        'total'             => $total,
        'pagina'            => $pagina,
        'por_pagina'        => $porPagina,
        'total_paginas'     => $totalPaginas,
        'anios_disponibles' => array_map('intval', $anios),
    ]);
}

/**
 * Devuelve el detalle de una noticia publicada (o vista previa si el usuario está autorizado).
 */
function responderDetalleNoticia(PDO $pdo): void
{
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Identificador de noticia no válido.']);
        return;
    }

    $consulta = $pdo->prepare(
        "SELECT n.id, n.titulo, n.resumen, n.contenido, n.imagen, n.estado, n.autor_id,
                n.es_destacada, n.es_ultima_hora, n.fecha_publicacion, n.fecha_creacion,
                c.nombre AS categoria, u.nombre AS autor
         FROM noticias n
         INNER JOIN categorias c ON c.id = n.categoria_id
         INNER JOIN usuarios u ON u.id = n.autor_id
         WHERE n.id = ?
         LIMIT 1"
    );
    $consulta->execute([$id]);
    $noticia = $consulta->fetch();

    if (!$noticia) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'mensaje' => 'Noticia no encontrada.']);
        return;
    }

    if ($noticia['estado'] !== 'publicada') {
        $usuario = obtenerUsuarioActual();
        $puedeVerBorrador = $usuario !== null && (
            in_array($usuario['rol'], ['administrador', 'editor'], true) ||
            (int) $noticia['autor_id'] === (int) $usuario['id']
        );

        if (!$puedeVerBorrador) {
            http_response_code(404);
            echo json_encode(['ok' => false, 'mensaje' => 'Noticia no disponible.']);
            return;
        }
    }

    $stmtEtiquetas = $pdo->prepare(
        'SELECT e.id, e.nombre
         FROM etiquetas e
         INNER JOIN noticias_etiquetas ne ON ne.etiqueta_id = e.id
         WHERE ne.noticia_id = ?
         ORDER BY e.nombre ASC'
    );
    $stmtEtiquetas->execute([$id]);
    $noticia['etiquetas'] = $stmtEtiquetas->fetchAll();

    echo json_encode([
        'ok'      => true,
        'noticia' => $noticia,
    ]);
}

/**
 * Devuelve el listado administrativo de noticias según el rol del usuario.
 */
function responderListaAdmin(PDO $pdo): void
{
    if (!estaAutenticado()) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'mensaje' => 'No autenticado.']);
        return;
    }

    if (!tieneRol(['administrador', 'editor', 'redactor'])) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'No autorizado.']);
        return;
    }

    $usuario = obtenerUsuarioActual();
    $busqueda = trim($_GET['q'] ?? '');
    $estado = trim($_GET['estado'] ?? '');

    $sql = "SELECT n.id, n.titulo, n.estado, n.autor_id, n.es_destacada, n.es_ultima_hora,
                   n.fecha_publicacion, n.fecha_creacion,
                   c.nombre AS categoria, u.nombre AS autor,
                   (SELECT r.observaciones
                    FROM revisiones_editoriales r
                    WHERE r.noticia_id = n.id
                    ORDER BY r.fecha_creacion DESC, r.id DESC
                    LIMIT 1) AS ultima_observacion
            FROM noticias n
            INNER JOIN categorias c ON c.id = n.categoria_id
            INNER JOIN usuarios u ON u.id = n.autor_id
            WHERE 1=1";

    $parametros = [];

    if ($usuario['rol'] === 'redactor') {
        $sql .= ' AND n.autor_id = ?';
        $parametros[] = $usuario['id'];
    }

    if ($busqueda !== '') {
        $sql .= ' AND n.titulo LIKE ?';
        $parametros[] = '%' . $busqueda . '%';
    }

    if ($estado !== '') {
        $sql .= ' AND n.estado = ?';
        $parametros[] = $estado;
    }

    $sql .= ' ORDER BY n.fecha_creacion DESC, n.id DESC';

    $consulta = $pdo->prepare($sql);
    $consulta->execute($parametros);
    $filas = $consulta->fetchAll();

    foreach ($filas as &$fila) {
        $fila['puede_editar'] = puedeEditarNoticia($usuario, $fila);
    }

    echo json_encode([
        'ok'       => true,
        'noticias' => $filas,
    ]);
}

/**
 * Devuelve una noticia para editarla si el usuario tiene permiso.
 */
function responderNoticiaAdmin(PDO $pdo): void
{
    if (!estaAutenticado()) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'mensaje' => 'No autenticado.']);
        return;
    }

    if (!tieneRol(['administrador', 'editor', 'redactor'])) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'No autorizado.']);
        return;
    }

    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Identificador no válido.']);
        return;
    }

    $consulta = $pdo->prepare(
        'SELECT id, titulo, resumen, contenido, categoria_id, autor_id, imagen,
                estado, es_destacada, es_ultima_hora
         FROM noticias
         WHERE id = ?
         LIMIT 1'
    );
    $consulta->execute([$id]);
    $noticia = $consulta->fetch();

    if (!$noticia) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'mensaje' => 'Noticia no encontrada.']);
        return;
    }

    $usuario = obtenerUsuarioActual();
    if (!puedeEditarNoticia($usuario, $noticia)) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'No tienes permisos para editar esta noticia.']);
        return;
    }

    $stmtEtiquetas = $pdo->prepare('SELECT etiqueta_id FROM noticias_etiquetas WHERE noticia_id = ?');
    $stmtEtiquetas->execute([$id]);
    $noticia['etiquetas_ids'] = array_map('intval', $stmtEtiquetas->fetchAll(PDO::FETCH_COLUMN));

    echo json_encode([
        'ok'      => true,
        'noticia' => $noticia,
    ]);
}

/**
 * Crea o actualiza una noticia validando rol, CSRF, contenido e imagen.
 */
function guardarNoticia(PDO $pdo): void
{
    if (!estaAutenticado()) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'mensaje' => 'No autenticado.']);
        return;
    }

    if (!tieneRol(['administrador', 'editor', 'redactor'])) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'No autorizado.']);
        return;
    }

    if (!validarTokenCsrf($_POST['csrf_token'] ?? '')) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'Token CSRF inválido. Recarga la página.']);
        return;
    }

    $usuario = obtenerUsuarioActual();
    $rol = $usuario['rol'];

    $id = (int) ($_POST['id'] ?? 0);
    $titulo = trim($_POST['titulo'] ?? '');
    $resumen = trim($_POST['resumen'] ?? '');
    $contenidoBruto = $_POST['contenido'] ?? '';
    $categoriaId = (int) ($_POST['categoria_id'] ?? 0);
    $accion = trim($_POST['accion'] ?? 'borrador');
    $esDestacada = !empty($_POST['es_destacada']) ? 1 : 0;
    $esUltimaHora = !empty($_POST['es_ultima_hora']) ? 1 : 0;
    $etiquetasIds = $_POST['etiquetas'] ?? [];

    if ($titulo === '' || mb_strlen($titulo) > 200) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'El título es obligatorio (máximo 200 caracteres).']);
        return;
    }

    $contenidoLimpio = sanitizarHtmlEditorial($contenidoBruto);
    if (trim(strip_tags($contenidoLimpio)) === '') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'El contenido de la noticia es obligatorio.']);
        return;
    }

    // Validar que la categoría exista
    $stmtCat = $pdo->prepare('SELECT id FROM categorias WHERE id = ? LIMIT 1');
    $stmtCat->execute([$categoriaId]);
    if (!$stmtCat->fetch()) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Selecciona una categoría válida.']);
        return;
    }

    // Validar estado permitido según rol
    $estadosPermitidos = $rol === 'redactor'
        ? ['borrador', 'pendiente_revision']
        : ['borrador', 'pendiente_revision', 'publicada'];

    if (!in_array($accion, $estadosPermitidos, true)) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'Tu rol no tiene autorización para esta acción.']);
        return;
    }

    // El redactor no puede marcar noticias como destacadas ni de última hora
    if ($rol === 'redactor') {
        $esDestacada = 0;
        $esUltimaHora = 0;
    }

    $noticiaExistente = null;
    if ($id > 0) {
        $stmtNoticia = $pdo->prepare('SELECT * FROM noticias WHERE id = ? LIMIT 1');
        $stmtNoticia->execute([$id]);
        $noticiaExistente = $stmtNoticia->fetch();

        if (!$noticiaExistente) {
            http_response_code(404);
            echo json_encode(['ok' => false, 'mensaje' => 'La noticia solicitada no existe.']);
            return;
        }

        if (!puedeEditarNoticia($usuario, $noticiaExistente)) {
            http_response_code(403);
            echo json_encode(['ok' => false, 'mensaje' => 'No tienes permisos para editar esta noticia.']);
            return;
        }
    }

    // Procesar imagen si se subió una nueva
    $rutaImagen = $noticiaExistente ? $noticiaExistente['imagen'] : null;
    if (isset($_FILES['imagen']) && $_FILES['imagen']['error'] !== UPLOAD_ERR_NO_FILE) {
        $resultadoImagen = procesarImagenPortada($_FILES['imagen']);
        if (!$resultadoImagen['ok']) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'mensaje' => $resultadoImagen['mensaje']]);
            return;
        }
        $rutaImagen = $resultadoImagen['ruta'];
    }

    try {
        $pdo->beginTransaction();

        $fechaPublicacion = $noticiaExistente ? $noticiaExistente['fecha_publicacion'] : null;
        if ($accion === 'publicada' && empty($fechaPublicacion)) {
            $fechaPublicacion = date('Y-m-d H:i:s');
        }

        if ($id === 0) {
            $identificador = generarIdentificadorUnico($pdo, $titulo);
            $stmtInsert = $pdo->prepare(
                'INSERT INTO noticias
                 (titulo, identificador, resumen, contenido, categoria_id, autor_id, imagen,
                  estado, es_destacada, es_ultima_hora, fecha_publicacion)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $stmtInsert->execute([
                $titulo,
                $identificador,
                $resumen !== '' ? $resumen : null,
                $contenidoLimpio,
                $categoriaId,
                $usuario['id'],
                $rutaImagen,
                $accion,
                $esDestacada,
                $esUltimaHora,
                $fechaPublicacion,
            ]);
            $id = (int) $pdo->lastInsertId();
        } else {
            $stmtUpdate = $pdo->prepare(
                'UPDATE noticias
                 SET titulo = ?, resumen = ?, contenido = ?, categoria_id = ?, imagen = ?,
                     estado = ?, es_destacada = ?, es_ultima_hora = ?, fecha_publicacion = ?
                 WHERE id = ?'
            );
            $stmtUpdate->execute([
                $titulo,
                $resumen !== '' ? $resumen : null,
                $contenidoLimpio,
                $categoriaId,
                $rutaImagen,
                $accion,
                $esDestacada,
                $esUltimaHora,
                $fechaPublicacion,
                $id,
            ]);
        }

        guardarEtiquetasNoticia($pdo, $id, is_array($etiquetasIds) ? $etiquetasIds : []);
        $pdo->commit();

        echo json_encode([
            'ok'      => true,
            'id'      => $id,
            'estado'  => $accion,
            'mensaje' => 'Noticia guardada correctamente.',
        ]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log('NewsCMS - Error al guardar noticia: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['ok' => false, 'mensaje' => 'No se pudo guardar la noticia.']);
    }
}

/**
 * Verifica en el servidor si un usuario puede editar una noticia.
 */
function puedeEditarNoticia(array $usuario, array $noticia): bool
{
    if (in_array($usuario['rol'], ['administrador', 'editor'], true)) {
        return true;
    }

    if ($usuario['rol'] === 'redactor') {
        $esAutor = (int) $noticia['autor_id'] === (int) $usuario['id'];
        $estadoEditable = in_array($noticia['estado'], ['borrador', 'cambios_solicitados'], true);
        return $esAutor && $estadoEditable;
    }

    return false;
}

/**
 * Sanitiza HTML editorial conservando únicamente etiquetas y enlaces seguros.
 */
function sanitizarHtmlEditorial(string $html): string
{
    $html = trim($html);
    if ($html === '') {
        return '';
    }

    $etiquetasPermitidas = ['p', 'br', 'strong', 'em', 'h2', 'h3', 'ul', 'ol', 'li', 'a'];
    $equivalencias = ['b' => 'strong', 'i' => 'em'];

    $dom = new DOMDocument();
    libxml_use_internal_errors(true);
    $dom->loadHTML('<?xml encoding="utf-8" ?><div>' . $html . '</div>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
    libxml_clear_errors();

    $raiz = $dom->getElementsByTagName('div')->item(0);
    if (!$raiz) {
        return '';
    }

    limpiarNodoDom($dom, $raiz, $etiquetasPermitidas, $equivalencias);

    $resultado = '';
    foreach ($raiz->childNodes as $hijo) {
        $resultado .= $dom->saveHTML($hijo);
    }

    return trim($resultado);
}

/**
 * Recorre recursivamente los nodos DOM eliminando etiquetas, atributos y enlaces inseguros.
 */
function limpiarNodoDom(DOMDocument $dom, DOMNode $nodo, array $permitidas, array $equivalencias): void
{
    $hijos = [];
    foreach ($nodo->childNodes as $hijo) {
        $hijos[] = $hijo;
    }

    foreach ($hijos as $hijo) {
        if ($hijo->nodeType !== XML_ELEMENT_NODE) {
            continue;
        }

        $nombre = strtolower($hijo->nodeName);

        if (in_array($nombre, ['script', 'style', 'iframe', 'object', 'embed'], true)) {
            $nodo->removeChild($hijo);
            continue;
        }

        if (isset($equivalencias[$nombre])) {
            $nuevo = $dom->createElement($equivalencias[$nombre]);
            while ($hijo->firstChild) {
                $nuevo->appendChild($hijo->firstChild);
            }
            $nodo->replaceChild($nuevo, $hijo);
            $hijo = $nuevo;
            $nombre = $equivalencias[$nombre];
        }

        if (!in_array($nombre, $permitidas, true)) {
            limpiarNodoDom($dom, $hijo, $permitidas, $equivalencias);
            while ($hijo->firstChild) {
                $nodo->insertBefore($hijo->firstChild, $hijo);
            }
            $nodo->removeChild($hijo);
            continue;
        }

        // Eliminar todos los atributos excepto href seguro en <a>
        $hrefSeguro = null;
        if ($nombre === 'a' && $hijo->hasAttributes()) {
            $href = trim($hijo->getAttribute('href'));
            if (preg_match('/^(https?:\/\/|\/)/i', $href)) {
                $hrefSeguro = $href;
            }
        }

        while ($hijo->attributes && $hijo->attributes->length > 0) {
            $hijo->removeAttributeNode($hijo->attributes->item(0));
        }

        if ($nombre === 'a' && $hrefSeguro !== null) {
            $hijo->setAttribute('href', $hrefSeguro);
            $hijo->setAttribute('rel', 'noopener noreferrer');
        }

        limpiarNodoDom($dom, $hijo, $permitidas, $equivalencias);
    }
}

/**
 * Valida y almacena una imagen de portada en uploads/portadas/.
 */
function procesarImagenPortada(array $archivo): array
{
    if ($archivo['error'] !== UPLOAD_ERR_OK) {
        return ['ok' => false, 'mensaje' => 'Error al subir la imagen de portada.'];
    }

    $tamanoMaximo = 2 * 1024 * 1024; // 2 MB
    if ($archivo['size'] <= 0 || $archivo['size'] > $tamanoMaximo) {
        return ['ok' => false, 'mensaje' => 'La imagen no debe superar los 2 MB.'];
    }

    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime = finfo_file($finfo, $archivo['tmp_name']);
    finfo_close($finfo);

    $extensionesPermitidas = [
        'image/jpeg' => 'jpg',
        'image/png'  => 'png',
        'image/webp' => 'webp',
    ];

    if (!isset($extensionesPermitidas[$mime])) {
        return ['ok' => false, 'mensaje' => 'Solo se admiten imágenes JPG, PNG o WEBP.'];
    }

    if (@getimagesize($archivo['tmp_name']) === false) {
        return ['ok' => false, 'mensaje' => 'El archivo no contiene una imagen válida.'];
    }

    $directorioDestino = __DIR__ . '/../uploads/portadas';
    if (!is_dir($directorioDestino)) {
        mkdir($directorioDestino, 0755, true);
    }

    $nombreSeguro = bin2hex(random_bytes(16)) . '.' . $extensionesPermitidas[$mime];
    $rutaDestino = $directorioDestino . '/' . $nombreSeguro;

    if (!move_uploaded_file($archivo['tmp_name'], $rutaDestino)) {
        return ['ok' => false, 'mensaje' => 'No se pudo guardar la imagen en el servidor.'];
    }

    return [
        'ok'   => true,
        'ruta' => 'uploads/portadas/' . $nombreSeguro,
    ];
}

/**
 * Genera un identificador (slug) único para la noticia.
 */
function generarIdentificadorUnico(PDO $pdo, string $titulo): string
{
    $base = strtolower(trim($titulo));
    $reemplazos = [
        'á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n',
    ];
    $base = strtr($base, $reemplazos);
    $base = preg_replace('/[^a-z0-9]+/', '-', $base);
    $base = trim((string) $base, '-');
    if ($base === '') {
        $base = 'noticia';
    }
    $base = substr($base, 0, 180);

    $identificador = $base;
    $contador = 2;
    $stmt = $pdo->prepare('SELECT id FROM noticias WHERE identificador = ? LIMIT 1');

    while (true) {
        $stmt->execute([$identificador]);
        if (!$stmt->fetch()) {
            return $identificador;
        }
        $identificador = $base . '-' . $contador;
        $contador++;
    }
}

/**
 * Actualiza las etiquetas asociadas a una noticia en noticias_etiquetas.
 */
function guardarEtiquetasNoticia(PDO $pdo, int $noticiaId, array $etiquetasIds): void
{
    $stmtBorrar = $pdo->prepare('DELETE FROM noticias_etiquetas WHERE noticia_id = ?');
    $stmtBorrar->execute([$noticiaId]);

    if (empty($etiquetasIds)) {
        return;
    }

    $stmtExiste = $pdo->prepare('SELECT id FROM etiquetas WHERE id = ? LIMIT 1');
    $stmtInsertar = $pdo->prepare('INSERT IGNORE INTO noticias_etiquetas (noticia_id, etiqueta_id) VALUES (?, ?)');

    foreach ($etiquetasIds as $etiquetaId) {
        $idLimpio = (int) $etiquetaId;
        if ($idLimpio <= 0) {
            continue;
        }
        $stmtExiste->execute([$idLimpio]);
        if ($stmtExiste->fetch()) {
            $stmtInsertar->execute([$noticiaId, $idLimpio]);
        }
    }
}
