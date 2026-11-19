/**
 * NewsCMS - Script del archivo histórico de noticias (archivo.html)
 */

let paginaActualArchivo = 1;

document.addEventListener("DOMContentLoaded", () => {
    iniciarArchivo();
});

async function iniciarArchivo() {
    mostrarFechaArchivo();
    comprobarSesionArchivo();
    await cargarCategoriasArchivo();
    aplicarParametrosUrl();
    inicializarEventosArchivo();
    await consultarArchivo();
}

function mostrarFechaArchivo() {
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

async function comprobarSesionArchivo() {
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

async function cargarCategoriasArchivo() {
    const select = document.getElementById("filtro-categoria");
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
    } catch {
        // Sin categorías adicionales
    }
}

function aplicarParametrosUrl() {
    const params = new URLSearchParams(window.location.search);
    const mes = params.get("mes") || "";
    const categoria = params.get("categoria") || "";
    const pagina = Number(params.get("pagina") || 1);

    const selMes = document.getElementById("filtro-mes");
    const selCat = document.getElementById("filtro-categoria");

    if (selMes && mes) {
        selMes.value = mes;
    }
    if (selCat && categoria) {
        selCat.value = categoria;
    }
    paginaActualArchivo = pagina >= 1 ? pagina : 1;
}

function inicializarEventosArchivo() {
    const formulario = document.getElementById("formulario-archivo");
    const btnLimpiar = document.getElementById("btn-limpiar-filtros");

    formulario?.addEventListener("submit", (e) => {
        e.preventDefault();
        paginaActualArchivo = 1;
        actualizarUrlArchivo();
        consultarArchivo();
    });

    btnLimpiar?.addEventListener("click", () => {
        document.getElementById("filtro-anio").value = "";
        document.getElementById("filtro-mes").value = "";
        document.getElementById("filtro-categoria").value = "";
        paginaActualArchivo = 1;
        actualizarUrlArchivo();
        consultarArchivo();
    });
}

function obtenerFiltrosActuales() {
    const paramsUrl = new URLSearchParams(window.location.search);
    const selectAnio = document.getElementById("filtro-anio");
    const anio = selectAnio && selectAnio.options.length > 1
        ? selectAnio.value
        : (paramsUrl.get("anio") || "");

    const mes = document.getElementById("filtro-mes")?.value || "";
    const categoria = document.getElementById("filtro-categoria")?.value || "";

    return { anio, mes, categoria, pagina: paginaActualArchivo };
}

function actualizarUrlArchivo() {
    const filtros = obtenerFiltrosActuales();
    const params = new URLSearchParams();

    if (filtros.anio) {
        params.set("anio", filtros.anio);
    }
    if (filtros.mes) {
        params.set("mes", filtros.mes);
    }
    if (filtros.categoria) {
        params.set("categoria", filtros.categoria);
    }
    if (filtros.pagina > 1) {
        params.set("pagina", String(filtros.pagina));
    }

    const query = params.toString();
    const nuevaUrl = query ? `archivo.html?${query}` : "archivo.html";
    window.history.replaceState(null, "", nuevaUrl);
}

async function consultarArchivo() {
    const filtros = obtenerFiltrosActuales();
    const params = new URLSearchParams({
        modo: "archivo",
        pagina: String(filtros.pagina)
    });

    if (filtros.anio) {
        params.set("anio", filtros.anio);
    }
    if (filtros.mes) {
        params.set("mes", filtros.mes);
    }
    if (filtros.categoria) {
        params.set("categoria", filtros.categoria);
    }

    const contenedor = document.getElementById("contenedor-archivo");
    const resumen = document.getElementById("resumen-resultados-archivo");

    try {
        const respuesta = await fetch(`php/noticias.php?${params.toString()}`);
        const datos = await respuesta.json();

        if (!respuesta.ok || !datos.ok) {
            contenedor.textContent = "";
            return;
        }

        poblarSelectAnios(datos.anios_disponibles || [], filtros.anio);

        const noticias = datos.noticias || [];
        const total = Number(datos.total || 0);
        const totalPaginas = Number(datos.total_paginas || 0);
        paginaActualArchivo = Number(datos.pagina || 1);

        if (resumen) {
            resumen.textContent = total === 1
                ? "1 noticia encontrada."
                : `${total} noticias encontradas.`;
        }

        renderizarResultadosArchivo(contenedor, noticias);
        renderizarPaginacionArchivo(totalPaginas, paginaActualArchivo);
    } catch {
        if (resumen) {
            resumen.textContent = "No se pudo consultar el archivo histórico.";
        }
    }
}

function poblarSelectAnios(anios, anioSeleccionado) {
    const select = document.getElementById("filtro-anio");
    if (!select) {
        return;
    }

    select.textContent = "";
    const opcionTodas = document.createElement("option");
    opcionTodas.value = "";
    opcionTodas.textContent = "Todos los años";
    select.appendChild(opcionTodas);

    anios.forEach((anio) => {
        const opt = document.createElement("option");
        opt.value = String(anio);
        opt.textContent = String(anio);
        select.appendChild(opt);
    });

    if (anioSeleccionado) {
        select.value = anioSeleccionado;
    }
}

function renderizarResultadosArchivo(contenedor, noticias) {
    contenedor.textContent = "";

    if (noticias.length === 0) {
        const vacio = document.createElement("div");
        vacio.className = "estado-vacio";
        const p = document.createElement("p");
        p.className = "titulo-vacio";
        p.textContent = "No se encontraron noticias con los filtros seleccionados";
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

        cuerpo.appendChild(cat);
        cuerpo.appendChild(h2);

        if (n.resumen) {
            const res = document.createElement("p");
            res.className = "resumen-tarjeta-noticia";
            res.textContent = n.resumen;
            cuerpo.appendChild(res);
        }

        const meta = document.createElement("p");
        meta.className = "meta-noticia";
        const fecha = n.fecha_publicacion ? n.fecha_publicacion.slice(0, 10) : "";
        meta.textContent = `${n.autor}${fecha ? " · " + fecha : ""}`;
        cuerpo.appendChild(meta);

        tarjeta.appendChild(cuerpo);
        contenedor.appendChild(tarjeta);
    });
}

function renderizarPaginacionArchivo(totalPaginas, paginaActual) {
    const nav = document.getElementById("paginacion-archivo");
    if (!nav) {
        return;
    }

    nav.textContent = "";
    if (totalPaginas <= 1) {
        nav.hidden = true;
        return;
    }

    nav.hidden = false;

    const btnAnterior = document.createElement("button");
    btnAnterior.type = "button";
    btnAnterior.className = "boton-login";
    btnAnterior.textContent = "Anterior";
    btnAnterior.disabled = paginaActual <= 1;
    btnAnterior.addEventListener("click", () => {
        paginaActualArchivo = Math.max(1, paginaActual - 1);
        actualizarUrlArchivo();
        consultarArchivo();
    });

    const indicador = document.createElement("span");
    indicador.className = "meta-noticia";
    indicador.textContent = `Página ${paginaActual} de ${totalPaginas}`;

    const btnSiguiente = document.createElement("button");
    btnSiguiente.type = "button";
    btnSiguiente.className = "boton-login";
    btnSiguiente.textContent = "Siguiente";
    btnSiguiente.disabled = paginaActual >= totalPaginas;
    btnSiguiente.addEventListener("click", () => {
        paginaActualArchivo = Math.min(totalPaginas, paginaActual + 1);
        actualizarUrlArchivo();
        consultarArchivo();
    });

    nav.appendChild(btnAnterior);
    nav.appendChild(indicador);
    nav.appendChild(btnSiguiente);
}
