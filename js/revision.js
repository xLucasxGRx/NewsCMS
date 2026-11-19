/**
 * NewsCMS - Script de revisión y aprobación editorial (admin/revision.html)
 */

let csrfTokenRevision = "";

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

        const rol = datos.usuario.rol || "";
        if (rol !== "administrador" && rol !== "editor") {
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
            contador.textContent = `${noticias.length} pendientes`;
        }

        cuerpo.textContent = "";
        if (noticias.length === 0) {
            const tr = document.createElement("tr");
            const td = document.createElement("td");
            td.colSpan = 6;
            td.className = "fila-vacia";
            td.textContent = "No hay noticias pendientes de revisión en este momento.";
            tr.appendChild(td);
            cuerpo.appendChild(tr);
            return;
        }

        noticias.forEach((n) => {
            const tr = document.createElement("tr");

            const tdTitulo = document.createElement("td");
            tdTitulo.textContent = n.titulo;

            const tdRedactor = document.createElement("td");
            tdRedactor.textContent = n.redactor;

            const tdCategoria = document.createElement("td");
            tdCategoria.textContent = n.categoria;

            const tdFecha = document.createElement("td");
            tdFecha.textContent = (n.fecha_creacion || "").slice(0, 10) || "-";

            const tdEstado = document.createElement("td");
            const badge = document.createElement("span");
            badge.className = "estado-badge estado-pendiente_revision";
            badge.textContent = "Pendiente de revisión";
            tdEstado.appendChild(badge);

            const tdAcciones = document.createElement("td");
            tdAcciones.className = "celda-acciones";

            const btnVer = document.createElement("button");
            btnVer.type = "button";
            btnVer.className = "enlace-accion enlace-ver";
            btnVer.textContent = "Ver noticia";
            btnVer.addEventListener("click", () => abrirDetalleNoticia(n.id));

            const btnAprobar = document.createElement("button");
            btnAprobar.type = "button";
            btnAprobar.className = "enlace-accion";
            btnAprobar.textContent = "Aprobar y publicar";
            btnAprobar.addEventListener("click", () => aprobarNoticia(n.id, n.titulo));

            const btnCambios = document.createElement("button");
            btnCambios.type = "button";
            btnCambios.className = "enlace-accion enlace-cambios";
            btnCambios.textContent = "Solicitar cambios";
            btnCambios.addEventListener("click", () => abrirFormularioCambios(n.id, n.titulo));

            tdAcciones.appendChild(btnVer);
            tdAcciones.appendChild(btnAprobar);
            tdAcciones.appendChild(btnCambios);

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
    panel.hidden = false;
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function inicializarPanelesRevision() {
    document.getElementById("cerrar-detalle")?.addEventListener("click", () => {
        document.getElementById("panel-detalle-revision").hidden = true;
    });

    document.getElementById("cancelar-cambios")?.addEventListener("click", () => {
        document.getElementById("panel-solicitar-cambios").hidden = true;
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
