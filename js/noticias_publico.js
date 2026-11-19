/**
 * NewsCMS - Script del listado público de noticias (noticias.html)
 */

document.addEventListener("DOMContentLoaded", () => {
    mostrarFechaListado();
    comprobarSesionListado();
    cargarCategoriasFiltro();
    inicializarFiltrosListado();
    cargarListadoPublico();
});

function mostrarFechaListado() {
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

async function comprobarSesionListado() {
    const enlace = document.getElementById("enlace-acceso");
    if (!enlace) {
        return;
    }
    try {
        const r = await fetch("php/comprobar_sesion.php", { credentials: "same-origin" });
        const d = await r.json();
        if (d.autenticado) {
            enlace.textContent = "Ir al panel";
            enlace.href = "admin/index.html";
        }
    } catch {
        // Mantener enlace por defecto
    }
}

async function cargarCategoriasFiltro() {
    const select = document.getElementById("filtro-categoria-publica");
    if (!select) {
        return;
    }
    try {
        const r = await fetch("php/catalogos.php");
        const d = await r.json();
        (d.categorias || []).forEach((cat) => {
            const opt = document.createElement("option");
            opt.value = cat.identificador;
            opt.textContent = cat.nombre;
            select.appendChild(opt);
        });

        const params = new URLSearchParams(window.location.search);
        const catInicial = params.get("categoria") || "";
        if (catInicial) {
            select.value = catInicial;
        }
    } catch {
        // Sin categorías adicionales
    }
}

function inicializarFiltrosListado() {
    const form = document.getElementById("formulario-busqueda-listado");
    const select = document.getElementById("filtro-categoria-publica");
    const input = document.getElementById("campo-busqueda-listado");

    const params = new URLSearchParams(window.location.search);
    if (input && params.get("q")) {
        input.value = params.get("q");
    }

    if (form) {
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            cargarListadoPublico();
        });
    }
    if (select) {
        select.addEventListener("change", () => cargarListadoPublico());
    }
}

async function cargarListadoPublico() {
    const contenedor = document.getElementById("contenedor-listado-noticias");
    const q = (document.getElementById("campo-busqueda-listado")?.value || "").trim();
    const categoria = document.getElementById("filtro-categoria-publica")?.value || "";

    const params = new URLSearchParams({ modo: "listado" });
    if (q) {
        params.set("q", q);
    }
    if (categoria) {
        params.set("categoria", categoria);
    }

    try {
        const respuesta = await fetch(`php/noticias.php?${params.toString()}`);
        const datos = await respuesta.json();
        const noticias = datos.noticias || [];

        contenedor.textContent = "";
        if (noticias.length === 0) {
            const vacio = document.createElement("div");
            vacio.className = "estado-vacio";
            const p = document.createElement("p");
            p.className = "titulo-vacio";
            p.textContent = "No hay noticias publicadas para mostrar.";
            vacio.appendChild(p);
            contenedor.appendChild(vacio);
            return;
        }

        noticias.forEach((n) => {
            const tarjeta = document.createElement("article");
            tarjeta.className = "tarjeta-noticia";

            if (n.imagen) {
                const img = document.createElement("img");
                img.src = n.imagen;
                img.alt = n.titulo;
                img.className = "imagen-tarjeta-noticia";
                tarjeta.appendChild(img);
            }

            const cuerpo = document.createElement("div");
            cuerpo.className = "cuerpo-tarjeta-noticia";

            const cat = document.createElement("span");
            cat.className = "marcador-categoria";
            cat.textContent = n.categoria;

            const h2 = document.createElement("h2");
            h2.className = "titulo-tarjeta-noticia";
            const enlace = document.createElement("a");
            enlace.href = `noticia.html?id=${encodeURIComponent(n.id)}`;
            enlace.textContent = n.titulo;
            h2.appendChild(enlace);

            const resumen = document.createElement("p");
            resumen.className = "resumen-tarjeta-noticia";
            resumen.textContent = n.resumen || "";

            const meta = document.createElement("p");
            meta.className = "meta-noticia";
            const fecha = n.fecha_publicacion ? n.fecha_publicacion.slice(0, 10) : "";
            meta.textContent = `${n.autor}${fecha ? " · " + fecha : ""}`;

            cuerpo.appendChild(cat);
            cuerpo.appendChild(h2);
            if (n.resumen) {
                cuerpo.appendChild(resumen);
            }
            cuerpo.appendChild(meta);
            tarjeta.appendChild(cuerpo);
            contenedor.appendChild(tarjeta);
        });
    } catch {
        contenedor.textContent = "No se pudieron cargar las noticias.";
    }
}
