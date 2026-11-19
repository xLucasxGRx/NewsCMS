/**
 * NewsCMS - Cargador de configuración general pública del portal.
 */

document.addEventListener("DOMContentLoaded", () => {
    aplicarConfiguracionPortal();
});

async function aplicarConfiguracionPortal() {
    try {
        const respuesta = await fetch("php/configuracion.php?modo=publico");
        if (!respuesta.ok) {
            return;
        }

        const datos = await respuesta.json();
        if (!datos.ok || !datos.configuracion) {
            return;
        }

        const cfg = datos.configuracion;

        // Subtítulo del portal
        const lema = document.querySelector(".lema");
        if (lema && cfg.subtitulo_portal !== undefined) {
            lema.textContent = cfg.subtitulo_portal;
        }

        // Meta descripción del documento
        if (cfg.descripcion_portal) {
            let metaDesc = document.querySelector('meta[name="description"]');
            if (!metaDesc) {
                metaDesc = document.createElement("meta");
                metaDesc.setAttribute("name", "description");
                document.head.appendChild(metaDesc);
            }
            metaDesc.setAttribute("content", cfg.descripcion_portal);
        }

        // Nombre del portal (conserva la marca visual NewsCMS si mantiene el nombre original)
        if (cfg.nombre_portal) {
            if (cfg.nombre_portal !== "NewsCMS") {
                const logotipo = document.querySelector(".logotipo");
                if (logotipo) {
                    logotipo.textContent = cfg.nombre_portal;
                }
                const logotipoPie = document.querySelector(".logotipo-pie");
                if (logotipoPie) {
                    logotipoPie.textContent = cfg.nombre_portal;
                }
            }

            // No sobrescribir el título específico del artículo en noticia.html
            const esDetalleNoticia = window.location.pathname.endsWith("/noticia.html");
            if (!esDetalleNoticia && document.title.includes(" — ")) {
                const partes = document.title.split(" — ");
                document.title = `${partes[0]} — ${cfg.nombre_portal}`;
            }

            const pieCopyright = document.querySelector(".pie-meta p");
            if (pieCopyright && cfg.nombre_portal !== "NewsCMS") {
                const anio = document.getElementById("anio-actual")?.textContent || String(new Date().getFullYear());
                pieCopyright.textContent = "";
                pieCopyright.appendChild(document.createTextNode("© "));
                const spanAnio = document.createElement("span");
                spanAnio.id = "anio-actual";
                spanAnio.textContent = anio;
                pieCopyright.appendChild(spanAnio);
                pieCopyright.appendChild(document.createTextNode(` ${cfg.nombre_portal}. Todos los derechos reservados.`));
            }
        }

        // Texto del pie de página
        const textoPie = document.querySelector(".pie-marca p");
        if (textoPie && cfg.texto_pie_pagina) {
            textoPie.textContent = cfg.texto_pie_pagina;
        }

        // Correo de contacto opcional en el pie de página
        const pieMeta = document.querySelector(".pie-meta");
        if (pieMeta) {
            let elCorreo = document.getElementById("correo-contacto-pie");
            if (cfg.correo_contacto) {
                if (!elCorreo) {
                    elCorreo = document.createElement("p");
                    elCorreo.id = "correo-contacto-pie";
                    pieMeta.appendChild(elCorreo);
                }
                elCorreo.textContent = `Contacto: ${cfg.correo_contacto}`;
            } else if (elCorreo) {
                elCorreo.remove();
            }
        }
    } catch {
        // Si falla, se conservan los textos predeterminados del HTML
    }
}
