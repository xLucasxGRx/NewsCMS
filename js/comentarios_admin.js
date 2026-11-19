/**
 * NewsCMS - Script de moderación administrativa de comentarios (admin/comentarios.html)
 */

let csrfTokenComentarios = "";

document.addEventListener("DOMContentLoaded", () => {
    iniciarComentariosAdmin();
});

async function iniciarComentariosAdmin() {
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

        if (datos.usuario.rol !== "administrador") {
            window.location.href = "index.html";
            return;
        }

        csrfTokenComentarios = datos.csrf_token || "";
        mostrarCabeceraComentarios(datos.usuario);
        renderizarSidebarComentarios(datos.modulos_permitidos || ["Dashboard"]);
        inicializarSidebarMovilComentarios();
        inicializarSalirComentarios();

        document.getElementById("filtro-estado-comentarios")?.addEventListener("change", () => {
            cargarComentariosAdmin();
        });

        document.getElementById("contenedor-admin").hidden = false;
        await cargarComentariosAdmin();
    } catch {
        window.location.href = "../acceso.html";
    }
}

function mostrarCabeceraComentarios(usuario) {
    document.getElementById("nombre-usuario").textContent = usuario.nombre || "";
    document.getElementById("rol-usuario").textContent = usuario.rol || "";
    document.getElementById("rol-sidebar").textContent = usuario.rol || "";
}

function renderizarSidebarComentarios(modulos) {
    const lista = document.getElementById("lista-modulos");
    if (!lista) {
        return;
    }
    lista.textContent = "";

    modulos.forEach((modulo) => {
        const li = document.createElement("li");
        const enlace = document.createElement("a");
        enlace.className = modulo === "Complementos" ? "boton-modulo activo" : "boton-modulo";
        enlace.textContent = modulo;

        if (modulo === "Noticias") {
            enlace.href = "noticias.html";
        } else if (modulo === "Categorías") {
            enlace.href = "categorias.html";
        } else if (modulo === "Etiquetas") {
            enlace.href = "etiquetas.html";
        } else if (modulo === "Revisión editorial") {
            enlace.href = "revision.html";
        } else if (modulo === "Complementos") {
            enlace.href = "complementos.html";
        } else if (modulo === "Temas") {
            enlace.href = "temas.html";
        } else {
            enlace.href = `index.html?modulo=${encodeURIComponent(modulo)}`;
        }

        li.appendChild(enlace);
        lista.appendChild(li);
    });
}

async function cargarComentariosAdmin() {
    const cuerpo = document.getElementById("cuerpo-tabla-comentarios");
    const totalEl = document.getElementById("total-comentarios");
    const estado = document.getElementById("filtro-estado-comentarios")?.value || "";

    const params = new URLSearchParams({ modo: "admin_lista" });
    if (estado) {
        params.set("estado", estado);
    }

    try {
        const respuesta = await fetch(`../php/comentarios.php?${params.toString()}`, {
            credentials: "same-origin"
        });
        if (!respuesta.ok) {
            return;
        }

        const datos = await respuesta.json();
        const lista = datos.comentarios || [];

        if (totalEl) {
            totalEl.textContent = `${lista.length} comentarios`;
        }

        cuerpo.textContent = "";
        if (lista.length === 0) {
            const tr = document.createElement("tr");
            const td = document.createElement("td");
            td.colSpan = 6;
            td.className = "fila-vacia";
            td.textContent = "No hay comentarios registrados para este filtro.";
            tr.appendChild(td);
            cuerpo.appendChild(tr);
            return;
        }

        const clasesEstado = {
            pendiente: "estado-pendiente_revision",
            aprobado: "estado-publicada",
            rechazado: "estado-cambios_solicitados"
        };

        lista.forEach((item) => {
            const tr = document.createElement("tr");

            const tdAutor = document.createElement("td");
            tdAutor.textContent = item.autor;

            const tdNoticia = document.createElement("td");
            tdNoticia.textContent = item.noticia;

            const tdContenido = document.createElement("td");
            tdContenido.textContent = item.contenido;

            const tdFecha = document.createElement("td");
            tdFecha.textContent = (item.fecha_creacion || "").slice(0, 10) || "-";

            const tdEstado = document.createElement("td");
            const badge = document.createElement("span");
            badge.className = `estado-badge ${clasesEstado[item.estado] || "estado-borrador"}`;
            badge.textContent = item.estado;
            tdEstado.appendChild(badge);

            const tdAcciones = document.createElement("td");
            tdAcciones.className = "celda-acciones";

            if (item.estado !== "aprobado") {
                const btnAprobar = document.createElement("button");
                btnAprobar.type = "button";
                btnAprobar.className = "enlace-accion";
                btnAprobar.textContent = "Aprobar";
                btnAprobar.addEventListener("click", () => moderarComentario(item.id, "aprobar"));
                tdAcciones.appendChild(btnAprobar);
            }

            if (item.estado !== "rechazado") {
                const btnRechazar = document.createElement("button");
                btnRechazar.type = "button";
                btnRechazar.className = "enlace-accion enlace-cambios";
                btnRechazar.textContent = "Rechazar";
                btnRechazar.addEventListener("click", () => moderarComentario(item.id, "rechazar"));
                tdAcciones.appendChild(btnRechazar);
            }

            const btnEliminar = document.createElement("button");
            btnEliminar.type = "button";
            btnEliminar.className = "enlace-accion enlace-eliminar";
            btnEliminar.textContent = "Eliminar";
            btnEliminar.addEventListener("click", () => {
                if (window.confirm("¿Deseas eliminar este comentario?")) {
                    moderarComentario(item.id, "eliminar");
                }
            });
            tdAcciones.appendChild(btnEliminar);

            tr.appendChild(tdAutor);
            tr.appendChild(tdNoticia);
            tr.appendChild(tdContenido);
            tr.appendChild(tdFecha);
            tr.appendChild(tdEstado);
            tr.appendChild(tdAcciones);
            cuerpo.appendChild(tr);
        });
    } catch {
        mostrarMensajeComentarios("No se pudieron cargar los comentarios.", true);
    }
}

async function moderarComentario(id, accion) {
    const form = new FormData();
    form.append("csrf_token", csrfTokenComentarios);
    form.append("accion", accion);
    form.append("id", String(id));

    try {
        const respuesta = await fetch("../php/comentarios.php", {
            method: "POST",
            body: form,
            credentials: "same-origin"
        });
        const resultado = await respuesta.json();

        if (respuesta.ok && resultado.ok) {
            mostrarMensajeComentarios(resultado.mensaje || "Acción completada.", false);
            await cargarComentariosAdmin();
            return;
        }

        mostrarMensajeComentarios(resultado.mensaje || "No se pudo completar la acción.", true);
    } catch {
        mostrarMensajeComentarios("Error de comunicación con el servidor.", true);
    }
}

function mostrarMensajeComentarios(texto, esError) {
    const alerta = document.getElementById("mensaje-comentarios");
    if (!alerta) {
        return;
    }
    alerta.textContent = texto;
    alerta.className = esError ? "alerta-admin alerta-admin-error" : "alerta-admin alerta-admin-exito";
    alerta.hidden = false;
}

function inicializarSidebarMovilComentarios() {
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

function inicializarSalirComentarios() {
    const boton = document.getElementById("boton-salir");
    if (!boton) {
        return;
    }
    boton.addEventListener("click", async () => {
        const form = new FormData();
        form.append("csrf_token", csrfTokenComentarios);
        await fetch("../php/cerrar_sesion.php", {
            method: "POST",
            body: form,
            credentials: "same-origin"
        });
        window.location.href = "../acceso.html";
    });
}
