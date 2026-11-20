/**
 * NewsCMS - Script de detalle de noticia (noticia.html?id=...)
 */

document.addEventListener("DOMContentLoaded", () => {
    mostrarFechaDetalle();
    cargarDetalleNoticia();
});

function mostrarFechaDetalle() {
    const el = document.getElementById("fecha-actual");
    if (el) {
        const texto = new Intl.DateTimeFormat("es-ES", {
            weekday: "long", year: "numeric", month: "long", day: "numeric"
        }).format(new Date());
        el.textContent = texto.charAt(0).toUpperCase() + texto.slice(1);
    }
    const anio = document.getElementById("anio-actual");
    if (anio) {
        anio.textContent = String(new Date().getFullYear());
    }
}

async function cargarDetalleNoticia() {
    const contenedor = document.getElementById("articulo-detalle");
    const params = new URLSearchParams(window.location.search);
    const id = Number(params.get("id") || 0);

    if (id <= 0) {
        mostrarNoDisponible(contenedor, "No se especificó una noticia válida.");
        return;
    }

    try {
        const respuesta = await fetch(`php/noticias.php?modo=detalle&id=${encodeURIComponent(id)}`, {
            credentials: "same-origin"
        });
        const datos = await respuesta.json();

        if (!respuesta.ok || !datos.ok || !datos.noticia) {
            mostrarNoDisponible(contenedor, datos.mensaje || "La noticia solicitada no está disponible.");
            return;
        }

        const n = datos.noticia;
        document.title = `${n.titulo} — NewsCMS`;
        contenedor.textContent = "";

        const cabecera = document.createElement("header");
        cabecera.className = "cabecera-detalle";

        const cat = document.createElement("span");
        cat.className = "marcador-categoria";
        cat.textContent = n.categoria;

        const h1 = document.createElement("h1");
        h1.className = "titulo-detalle";
        h1.textContent = n.titulo;

        const meta = document.createElement("p");
        meta.className = "meta-noticia";
        const fecha = (n.fecha_publicacion || n.fecha_creacion || "").slice(0, 10);
        meta.textContent = `Por ${n.autor}${fecha ? " · Publicado el " + fecha : ""}`;

        cabecera.appendChild(cat);
        cabecera.appendChild(h1);
        cabecera.appendChild(meta);
        contenedor.appendChild(cabecera);

        if (n.resumen) {
            const resumen = document.createElement("p");
            resumen.className = "resumen-detalle";
            resumen.textContent = n.resumen;
            contenedor.appendChild(resumen);
        }

        if (n.imagen) {
            const figura = document.createElement("figure");
            figura.className = "imagen-detalle";
            const img = document.createElement("img");
            img.src = n.imagen;
            img.alt = n.titulo;
            figura.appendChild(img);
            contenedor.appendChild(figura);
        }

        const cuerpo = document.createElement("div");
        cuerpo.className = "contenido-articulo";
        // El servidor ya sanitizó estrictamente el HTML editorial en php/noticias.php
        cuerpo.innerHTML = n.contenido || "";
        contenedor.appendChild(cuerpo);

        if (Array.isArray(n.etiquetas) && n.etiquetas.length > 0) {
            const pieEtiquetas = document.createElement("div");
            pieEtiquetas.className = "etiquetas-detalle";
            const tituloEtiq = document.createElement("span");
            tituloEtiq.className = "etiquetas-detalle-label";
            tituloEtiq.textContent = "Etiquetas:";
            pieEtiquetas.appendChild(tituloEtiq);
            n.etiquetas.forEach((etiq) => {
                const badge = document.createElement("a");
                badge.href = `noticias.html?etiqueta=${encodeURIComponent(etiq.identificador)}`;
                badge.className = "marcador-categoria etiqueta-enlace-detalle";
                badge.textContent = `#${etiq.nombre}`;
                pieEtiquetas.appendChild(badge);
            });
            contenedor.appendChild(pieEtiquetas);
        }
    } catch {
        mostrarNoDisponible(contenedor, "No se pudo cargar el contenido de la noticia.");
    }
}

function mostrarNoDisponible(contenedor, mensaje) {
    contenedor.textContent = "";
    const div = document.createElement("div");
    div.className = "estado-vacio";
    const p = document.createElement("p");
    p.className = "titulo-vacio";
    p.textContent = mensaje;
    div.appendChild(p);
    contenedor.appendChild(div);
}
