/**
 * NewsCMS - Script de revisión y aprobación editorial (admin/revision.html)
 */

let csrfTokenRevision = "";
let permisosRevision = {};

document.addEventListener("DOMContentLoaded", () => {
    iniciarRevisionEditorial();
});

async function iniciarRevisionEditorial() {
    try {
        const respuesta = await fetch("../php/comprobar_sesion.php", {
            credentials: "same-origin"
        });
        if (!respuesta.ok) {
            window.location.href = "../acceso.html";
            return;
        }

        const datos = await respuesta.json();
        if (!datos.autenticado || !datos.usuario) {
            window.location.href = "../acceso.html";
            return;
        }

        permisosRevision = datos.permisos || {};
        if (!permisosRevision.consultar_revision) {
            window.location.href = "index.html";
            return;
        }

        csrfTokenRevision = datos.csrf_token || "";
        mostrarCabeceraRevision(datos.usuario);
        renderizarSidebarRevision(datos.modulos_permitidos || ["Dashboard"]);
        inicializarSidebarMovilRevision();
        inicializarSalirRevision();
        inicializarPanelesRevision();

        document.getElementById("contenedor-admin").hidden = false;
        await cargarPendientes();
    } catch {
        window.location.href = "../acceso.html";
    }
}

function mostrarCabeceraRevision(usuario) {
    document.getElementById("nombre-usuario").textContent = usuario.nombre || "";
    document.getElementById("rol-usuario").textContent = usuario.rol || "";
    document.getElementById("rol-sidebar").textContent = usuario.rol || "";
}

function renderizarSidebarRevision(modulos) {
    const lista = document.getElementById("lista-modulos");
    if (!lista) {
        return;
    }
    lista.textContent = "";

    modulos.forEach((modulo) => {
        const li = document.createElement("li");
        const enlace = document.createElement("a");
        enlace.className = modulo === "Revisión editorial" ? "boton-modulo activo" : "boton-modulo";
        enlace.textContent = modulo;

        if (modulo === "Noticias") {
            enlace.href = "noticias.html";
        } else if (modulo === "Categorías") {
            enlace.href = "categorias.html";
        } else if (modulo === "Etiquetas") {
            enlace.href = "etiquetas.html";
        } else if (modulo === "Revisión editorial") {
            enlace.href = "revision.html";
        } else if (modulo === "Usuarios") {
            enlace.href = "usuarios.html";
        } else if (modulo === "Complementos") {
            enlace.href = "complementos.html";
        } else if (modulo === "Temas") {
            enlace.href = "temas.html";
        } else if (modulo === "Configuración") {
            enlace.href = "configuracion.html";
        } else {
            enlace.href = `index.html?modulo=${encodeURIComponent(modulo)}`;
        }

        li.appendChild(enlace);
        lista.appendChild(li);
    });
}

async function cargarPendientes() {
    const cuerpo = document.getElementById("cuerpo-tabla-revision");
    const contador = document.getElementById("contador-pendientes");

    try {
        const respuesta = await fetch("../php/revision.php?accion=pendientes", {
            credentials: "same-origin"
        });
        if (!respuesta.ok) {
            return;
        }

        const datos = await respuesta.json();
        const noticias = datos.noticias || [];

        if (contador) {
            contador.textContent = noticias.length === 1 ? "1 pendiente" : `${noticias.length} pendientes`;
        }

        cuerpo.textContent = "";
        if (noticias.length === 0) {
            renderizarEstadoVacioRevision(cuerpo);
            return;
        }

        noticias.forEach((n) => {
            const tr = document.createElement("tr");
            tr.dataset.noticiaId = String(n.id);

            const tdTitulo = document.createElement("td");
            tdTitulo.className = "celda-titulo-revision";
            tdTitulo.setAttribute("data-etiqueta", "Título");
            const spanTitulo = document.createElement("span");
            spanTitulo.className = "titulo-noticia-revision";
            spanTitulo.textContent = n.titulo;
            tdTitulo.appendChild(spanTitulo);

            const tdRedactor = document.createElement("td");
            tdRedactor.className = "celda-redactor-revision";
            tdRedactor.setAttribute("data-etiqueta", "Redactor");
            tdRedactor.textContent = n.redactor;

            const tdCategoria = document.createElement("td");
            tdCategoria.setAttribute("data-etiqueta", "Categoría");
            const chipCat = document.createElement("span");
            chipCat.className = "chip-categoria-revision";
            chipCat.textContent = n.categoria;
            tdCategoria.appendChild(chipCat);

            const tdFecha = document.createElement("td");
            tdFecha.className = "celda-fecha-revision";
            tdFecha.setAttribute("data-etiqueta", "Fecha");
            tdFecha.textContent = (n.fecha_creacion || "").slice(0, 10) || "-";

            const tdEstado = document.createElement("td");
            tdEstado.className = "celda-estado-revision";
            tdEstado.setAttribute("data-etiqueta", "Estado");
            const badge = document.createElement("span");
            badge.className = "estado-badge estado-pendiente_revision";
            badge.textContent = "Pendiente de revisión";
            tdEstado.appendChild(badge);

            const tdAcciones = document.createElement("td");
            tdAcciones.className = "celda-acciones celda-acciones-revision";
            tdAcciones.setAttribute("data-etiqueta", "Acciones");

            const btnVer = document.createElement("button");
            btnVer.type = "button";
            btnVer.className = "enlace-accion enlace-ver boton-accion-revision";
            btnVer.appendChild(crearIconoRevisionSvg("ver"));
            const lblVer = document.createElement("span");
            lblVer.textContent = "Ver noticia";
            btnVer.appendChild(lblVer);
            btnVer.addEventListener("click", () => abrirDetalleNoticia(n.id));

            tdAcciones.appendChild(btnVer);

            if (permisosRevision.aprobar_noticias) {
                const btnAprobar = document.createElement("button");
                btnAprobar.type = "button";
                btnAprobar.className = "enlace-accion boton-accion-revision boton-aprobar-revision";
                btnAprobar.appendChild(crearIconoRevisionSvg("aprobar"));
                const lblAprobar = document.createElement("span");
                lblAprobar.textContent = "Aprobar y publicar";
                btnAprobar.appendChild(lblAprobar);
                btnAprobar.addEventListener("click", () => aprobarNoticia(n.id, n.titulo));
                tdAcciones.appendChild(btnAprobar);
            }

            if (permisosRevision.solicitar_correcciones) {
                const btnCambios = document.createElement("button");
                btnCambios.type = "button";
                btnCambios.className = "enlace-accion enlace-cambios boton-accion-revision";
                btnCambios.appendChild(crearIconoRevisionSvg("cambios"));
                const lblCambios = document.createElement("span");
                lblCambios.textContent = "Solicitar cambios";
                btnCambios.appendChild(lblCambios);
                btnCambios.addEventListener("click", () => abrirFormularioCambios(n.id, n.titulo));
                tdAcciones.appendChild(btnCambios);
            }

            tr.appendChild(tdTitulo);
            tr.appendChild(tdRedactor);
            tr.appendChild(tdCategoria);
            tr.appendChild(tdFecha);
            tr.appendChild(tdEstado);
            tr.appendChild(tdAcciones);
            cuerpo.appendChild(tr);
        });
    } catch {
        mostrarMensajeRevision("No se pudo cargar la bandeja de revisión.", true);
    }
}

async function abrirDetalleNoticia(id) {
    const panel = document.getElementById("panel-detalle-revision");
    const titulo = document.getElementById("detalle-titulo");
    const meta = document.getElementById("detalle-meta");
    const resumen = document.getElementById("detalle-resumen");
    const contImg = document.getElementById("detalle-imagen-contenedor");
    const img = document.getElementById("detalle-imagen");
    const contenido = document.getElementById("detalle-contenido");

    try {
        const respuesta = await fetch(`../php/noticias.php?modo=detalle&id=${encodeURIComponent(id)}`, {
            credentials: "same-origin"
        });
        const datos = await respuesta.json();
        if (!respuesta.ok || !datos.ok || !datos.noticia) {
            mostrarMensajeRevision(datos.mensaje || "No se pudo cargar la noticia.", true);
            return;
        }

        const n = datos.noticia;
        titulo.textContent = n.titulo;
        meta.textContent = `Redactor: ${n.autor} · Categoría: ${n.categoria}`;
        resumen.textContent = n.resumen || "";
        resumen.hidden = !n.resumen;

        if (n.imagen) {
            img.src = `../${n.imagen}`;
            contImg.hidden = false;
        } else {
            contImg.hidden = true;
        }

        // Contenido previamente sanitizado en el servidor por php/noticias.php
        contenido.innerHTML = n.contenido || "";
        resaltarFilaRevision(id);
        panel.hidden = false;
        panel.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
        mostrarMensajeRevision("Error al consultar el contenido de la noticia.", true);
    }
}

async function aprobarNoticia(id, titulo) {
    const confirmado = window.confirm(`¿Deseas aprobar y publicar la noticia "${titulo}"?`);
    if (!confirmado) {
        return;
    }

    const form = new FormData();
    form.append("csrf_token", csrfTokenRevision);
    form.append("accion", "aprobar");
    form.append("noticia_id", String(id));

    try {
        const respuesta = await fetch("../php/revision.php", {
            method: "POST",
            body: form,
            credentials: "same-origin"
        });
        const datos = await respuesta.json();

        if (respuesta.ok && datos.exito) {
            mostrarMensajeRevision(datos.mensaje || "Noticia aprobada y publicada.", false);
            document.getElementById("panel-detalle-revision").hidden = true;
            document.getElementById("panel-solicitar-cambios").hidden = true;
            await cargarPendientes();
            return;
        }

        mostrarMensajeRevision(datos.mensaje || "No se pudo aprobar la noticia.", true);
    } catch {
        mostrarMensajeRevision("Error de comunicación con el servidor.", true);
    }
}

function abrirFormularioCambios(id, titulo) {
    const panel = document.getElementById("panel-solicitar-cambios");
    document.getElementById("cambios-noticia-id").value = String(id);
    document.getElementById("cambios-noticia-titulo").textContent = `Noticia: ${titulo}`;
    document.getElementById("campo-observaciones").value = "";
    resaltarFilaRevision(id);
    panel.hidden = false;
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function inicializarPanelesRevision() {
    document.getElementById("cerrar-detalle")?.addEventListener("click", () => {
        document.getElementById("panel-detalle-revision").hidden = true;
        if (document.getElementById("panel-solicitar-cambios")?.hidden) {
            resaltarFilaRevision(0);
        }
    });

    document.getElementById("cancelar-cambios")?.addEventListener("click", () => {
        document.getElementById("panel-solicitar-cambios").hidden = true;
        if (document.getElementById("panel-detalle-revision")?.hidden) {
            resaltarFilaRevision(0);
        }
    });

    document.getElementById("formulario-cambios")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const noticiaId = document.getElementById("cambios-noticia-id").value;
        const observaciones = document.getElementById("campo-observaciones").value.trim();

        if (!observaciones) {
            mostrarMensajeRevision("Las observaciones son obligatorias para solicitar cambios.", true);
            return;
        }

        const form = new FormData();
        form.append("csrf_token", csrfTokenRevision);
        form.append("accion", "solicitar_cambios");
        form.append("noticia_id", noticiaId);
        form.append("observaciones", observaciones);

        try {
            const respuesta = await fetch("../php/revision.php", {
                method: "POST",
                body: form,
                credentials: "same-origin"
            });
            const datos = await respuesta.json();

            if (respuesta.ok && datos.exito) {
                mostrarMensajeRevision(datos.mensaje || "Cambios solicitados correctamente.", false);
                document.getElementById("panel-solicitar-cambios").hidden = true;
                document.getElementById("panel-detalle-revision").hidden = true;
                await cargarPendientes();
                return;
            }

            mostrarMensajeRevision(datos.mensaje || "No se pudieron enviar las observaciones.", true);
        } catch {
            mostrarMensajeRevision("Error de comunicación con el servidor.", true);
        }
    });
}

function mostrarMensajeRevision(texto, esError) {
    const alerta = document.getElementById("mensaje-revision");
    if (!alerta) {
        return;
    }
    alerta.textContent = texto;
    alerta.className = esError ? "alerta-admin alerta-admin-error" : "alerta-admin alerta-admin-exito";
    alerta.hidden = false;
}

function inicializarSidebarMovilRevision() {
    const boton = document.getElementById("boton-sidebar");
    const barra = document.getElementById("barra-lateral");
    if (!boton || !barra) {
        return;
    }
    boton.addEventListener("click", () => {
        const abierta = barra.classList.toggle("abierta");
        boton.setAttribute("aria-expanded", abierta ? "true" : "false");
    });
}

function inicializarSalirRevision() {
    const boton = document.getElementById("boton-salir");
    if (!boton) {
        return;
    }
    boton.addEventListener("click", async () => {
        const form = new FormData();
        form.append("csrf_token", csrfTokenRevision);
        await fetch("../php/cerrar_sesion.php", {
            method: "POST",
            body: form,
            credentials: "same-origin"
        });
        window.location.href = "../acceso.html";
    });
}

function renderizarEstadoVacioRevision(cuerpo) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.className = "fila-vacia";

    const caja = document.createElement("div");
    caja.className = "estado-vacio-revision";

    const titulo = document.createElement("strong");
    titulo.className = "titulo-estado-vacio";
    titulo.textContent = "No hay noticias pendientes de revisión en este momento.";

    const nota = document.createElement("p");
    nota.className = "descripcion-estado-vacio";
    nota.textContent = "Cuando un redactor envíe un artículo a revisión editorial, aparecerá en esta bandeja.";

    caja.appendChild(titulo);
    caja.appendChild(nota);
    td.appendChild(caja);
    tr.appendChild(td);
    cuerpo.appendChild(tr);
}

function resaltarFilaRevision(id) {
    const objetivo = String(id || "");
    document.querySelectorAll("#cuerpo-tabla-revision tr[data-noticia-id]").forEach((fila) => {
        fila.classList.toggle("fila-revision-activa", objetivo !== "0" && fila.dataset.noticiaId === objetivo);
    });
}

function crearIconoRevisionSvg(tipo) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("class", "icono-accion-tabla");
    svg.setAttribute("aria-hidden", "true");

    const agregar = (tag, attrs) => {
        const el = document.createElementNS(ns, tag);
        Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
        svg.appendChild(el);
    };

    if (tipo === "ver") {
        agregar("path", { d: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" });
        agregar("circle", { cx: "12", cy: "12", r: "3" });
    } else if (tipo === "aprobar") {
        agregar("circle", { cx: "12", cy: "12", r: "9" });
        agregar("path", { d: "m8.5 12.5 2.5 2.5 4.5-5" });
    } else if (tipo === "cambios") {
        agregar("path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" });
    }

    return svg;
}
