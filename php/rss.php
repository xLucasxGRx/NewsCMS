<?php
/**
 * Generador automático de feed RSS 2.0 para las últimas 20 noticias publicadas.
 */

require_once __DIR__ . '/../config/conexion.php';

date_default_timezone_set('America/Lima');
header('Content-Type: application/rss+xml; charset=UTF-8');

$urlBase = 'http://localhost:8081/NewsCMS';
$noticias = [];

if ($conexionActiva && $pdo) {
    $consulta = $pdo->query(
        "SELECT n.id, n.titulo, n.resumen, n.fecha_publicacion, c.nombre AS categoria
         FROM noticias n
         INNER JOIN categorias c ON c.id = n.categoria_id
         WHERE n.estado = 'publicada'
         ORDER BY n.fecha_publicacion DESC, n.id DESC
         LIMIT 20"
    );
    $noticias = $consulta->fetchAll();
}

/**
 * Elimina caracteres no permitidos en XML y escapa entidades especiales.
 */
function escaparXml(?string $texto): string
{
    $limpio = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', (string) $texto);
    return htmlspecialchars((string) $limpio, ENT_XML1 | ENT_QUOTES, 'UTF-8');
}

echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
?>
<rss version="2.0">
    <channel>
        <title>NewsCMS</title>
        <link><?php echo escaparXml($urlBase . '/'); ?></link>
        <description>Portal informativo universitario NewsCMS — Últimas noticias publicadas.</description>
        <language>es-PE</language>
        <lastBuildDate><?php echo date(DATE_RSS); ?></lastBuildDate>
<?php foreach ($noticias as $noticia): ?>
<?php
    $enlaceNoticia = $urlBase . '/noticia.html?id=' . (int) $noticia['id'];
    $resumenTexto = trim((string) ($noticia['resumen'] ?? ''));
    if ($resumenTexto === '') {
        $resumenTexto = (string) $noticia['titulo'];
    }
    $marcaTiempo = !empty($noticia['fecha_publicacion'])
        ? strtotime($noticia['fecha_publicacion'])
        : time();
?>
        <item>
            <title><?php echo escaparXml($noticia['titulo']); ?></title>
            <link><?php echo escaparXml($enlaceNoticia); ?></link>
            <description><?php echo escaparXml($resumenTexto); ?></description>
            <category><?php echo escaparXml($noticia['categoria']); ?></category>
            <pubDate><?php echo date(DATE_RSS, $marcaTiempo); ?></pubDate>
            <guid isPermaLink="true"><?php echo escaparXml($enlaceNoticia); ?></guid>
        </item>
<?php endforeach; ?>
    </channel>
</rss>
