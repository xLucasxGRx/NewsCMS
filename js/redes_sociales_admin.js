/**
 * NewsCMS - Script administrativo del complemento Feed de Redes Sociales
 */

let csrfTokenSocial = "";

document.addEventListener("DOMContentLoaded", () => {
    iniciarRedesSocialesAdmin();
});

async function iniciarRedesSocialesAdmin() {
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

        csrfTokenSocial = datos.csrf_token || "";
        mostrarCabeceraSocial(datos.usuario);
        renderizarSidebarSocial(datos.modulos_permitidos || ["Dashboard"]);
        inicializarSidebarMovilSocial();
        inicializarSalirSocial();
        inicializarFormularioSocial();

        document.getElementById("contenedor-admin").hidden = false;
        await cargarEnlacesSociales();
    } catch {
        window.location.href = "../acceso.html";
    }
}

function mostrarCabeceraSocial(usuario) {
    document.getElementById("nombre-usuario").textContent = usuario.nombre || "";
    document.getElementById("rol-usuario").textContent = usuario.rol || "";
    document.getElementById("rol-sidebar").textContent = usuario.rol || "";
}

function renderizarSidebarSocial(modulos) {
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

async function cargarEnlacesSociales() {
    const cuerpo = document.getElementById("cuerpo-tabla-social");
    const totalEl = document.getElementById("total-social");

    try {
        const respuesta = await fetch("../php/redes_sociales.php?modo=admin_lista", {
            credentials: "same-origin"
        });
        if (!respuesta.ok) {
            return;
        }

        const datos = await respuesta.json();
        const enlaces = datos.enlaces || [];

        if (totalEl) {
            totalEl.textContent = `${enlaces.length} enlaces`;
        }

        cuerpo.textContent = "";
        if (enlaces.length === 0) {
            const tr = document.createElement("tr");
            const td = document.createElement("td");
            td.colSpan = 5;
            td.className = "fila-vacia";
            td.textContent = "Aún no hay enlaces sociales registrados.";
            tr.appendChild(td);
            cuerpo.appendChild(tr);
            return;
        }

        enlaces.forEach((item) => {
            const tr = document.createElement("tr");

            const tdPlat = document.createElement("td");
            tdPlat.textContent = item.plataforma;

            const tdTitulo = document.createElement("td");
            tdTitulo.textContent = item.titulo;

            const tdUrl = document.createElement("td");
            const aUrl = document.createElement("a");
            aUrl.href = item.url;
            aUrl.target = "_blank";
            aUrl.rel = "noopener noreferrer";
            aUrl.className = "enlace-secundario";
            aUrl.textContent = item.url;
            tdUrl.appendChild(aUrl);

            const esVisible = Number(item.visible) === 1;
            const tdVis = document.createElement("td");
            const badge = document.createElement("span");
            badge.className = esVisible ? "estado-badge estado-publicada" : "estado-badge estado-borrador";
            badge.textContent = esVisible ? "Sí" : "No";
            tdVis.appendChild(badge);

            const tdAcciones = document.createElement("td");
            tdAcciones.className = "celda-acciones";

            const btnEditar = document.createElement("button");
            btnEditar.type = "button";
            btnEditar.className = "enlace-accion";
            btnEditar.textContent = "Editar";
            btnEditar.addEventListener("click", () => abrirEdicionSocial(item));

            const btnVis = document.createElement("button");
            btnVis.type = "button";
            btnVis.className = "enlace-accion enlace-ver";
            btnVis.textContent = esVisible ? "Ocultar" : "Mostrar";
            btnVis.addEventListener("click", () => cambiarVisibilidad(item.id, esVisible ? 0 : 1));

            const btnElim = document.createElement("button");
            btnElim.type = "button";
            btnElim.className = "enlace-accion enlace-eliminar";
            btnElim.textContent = "Eliminar";
            btnElim.addEventListener("click", () => eliminarEnlace(item));

            tdAcciones.appendChild(btnEditar);
            tdAcciones.appendChild(btnVis);
            tdAcciones.appendChild(btnElim);

            tr.appendChild(tdPlat);
            tr.appendChild(tdTitulo);
            tr.appendChild(tdUrl);
            tr.appendChild(tdVis);
            tr.appendChild(tdAcciones);
            cuerpo.appendChild(tr);
        });
    } catch {
        mostrarMensajeSocial("No se pudieron cargar los enlaces sociales.", true);
    }
}

function inicializarFormularioSocial() {
    const btnNuevo = document.getElementById("btn-nuevo-enlace");
    const btnCancelar = document.getElementById("btn-cancelar-social");
    const formulario = document.getElementById("formulario-social");

    btnNuevo?.addEventListener("click", () => {
        document.getElementById("social-id").value = "0";
        document.getElementById("social-plataforma").value = "Facebook";
        document.getElementById("social-titulo").value = "";
        document.getElementById("social-descripcion").value = "";
        document.getElementById("social-url").value = "";
        document.getElementById("social-visible").value = "1";
        document.getElementById("titulo-form-social").textContent = "Agregar enlace social";
        document.getElementById("panel-formulario-social").hidden = false;
    });

    btnCancelar?.addEventListener("click", () => {
        document.getElementById("panel-formulario-social").hidden = true;
    });

    formulario?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = Number(document.getElementById("social-id").value || 0);
        const plataforma = document.getElementById("social-plataforma").value;
        const titulo = document.getElementById("social-titulo").value.trim();
        const descripcion = document.getElementById("social-descripcion").value.trim();
        const url = document.getElementById("social-url").value.trim();
        const visible = document.getElementById("social-visible").value;

        if (!titulo || !url) {
            mostrarMensajeSocial("El título y la URL son obligatorios.", true);
            return;
        }

        const form = new FormData();
        form.append("csrf_token", csrfTokenSocial);
        form.append("accion", id > 0 ? "editar" : "crear");
        form.append("plataforma", plataforma);
        form.append("titulo", titulo);
        form.append("descripcion", descripcion);
        form.append("url", url);
        form.append("visible", visible);
        if (id > 0) {
            form.append("id", String(id));
        }

        try {
            const respuesta = await fetch("../php/redes_sociales.php", {
                method: "POST",
                body: form,
                credentials: "same-origin"
            });
            const resultado = await respuesta.json();

            if (respuesta.ok && resultado.ok) {
                mostrarMensajeSocial(resultado.mensaje || "Enlace guardado.", false);
                document.getElementById("panel-formulario-social").hidden = true;
                await cargarEnlacesSociales();
                return;
            }

            mostrarMensajeSocial(resultado.mensaje || "No se pudo guardar el enlace.", true);
        } catch {
            mostrarMensajeSocial("Error de comunicación con el servidor.", true);
        }
    });
}

function abrirEdicionSocial(item) {
    document.getElementById("social-id").value = String(item.id);
    document.getElementById("social-plataforma").value = item.plataforma || "Facebook";
    document.getElementById("social-titulo").value = item.titulo || "";
    document.getElementById("social-descripcion").value = item.descripcion || "";
    document.getElementById("social-url").value = item.url || "";
    document.getElementById("social-visible").value = String(Number(item.visible) === 1 ? 1 : 0);
    document.getElementById("titulo-form-social").textContent = "Editar enlace social";
    document.getElementById("panel-formulario-social").hidden = false;
}

async function cambiarVisibilidad(id, visible) {
    const form = new FormData();
    form.append("csrf_token", csrfTokenSocial);
    form.append("accion", "cambiar_visibilidad");
    form.append("id", String(id));
    form.append("visible", String(visible));

    try {
        const respuesta = await fetch("../php/redes_sociales.php", {
            method: "POST",
            body: form,
            credentials: "same-origin"
        });
        const resultado = await respuesta.json();
        if (respuesta.ok && resultado.ok) {
            mostrarMensajeSocial(resultado.mensaje || "Visibilidad actualizada.", false);
            await cargarEnlacesSociales();
        }
    } catch {
        mostrarMensajeSocial("Error al cambiar la visibilidad.", true);
    }
}

async function eliminarEnlace(item) {
    if (!window.confirm(`¿Deseas eliminar el enlace "${item.titulo}"?`)) {
        return;
    }

    const form = new FormData();
    form.append("csrf_token", csrfTokenSocial);
    form.append("accion", "eliminar");
    form.append("id", String(item.id));

    try {
        const respuesta = await fetch("../php/redes_sociales.php", {
            method: "POST",
            body: form,
            credentials: "same-origin"
        });
        const resultado = await respuesta.json();
        if (respuesta.ok && resultado.ok) {
            mostrarMensajeSocial(resultado.mensaje || "Enlace eliminado.", false);
            await cargarEnlacesSociales();
        }
    } catch {
        mostrarMensajeSocial("Error al eliminar el enlace.", true);
    }
}

function mostrarMensajeSocial(texto, esError) {
    const alerta = document.getElementById("mensaje-social");
    if (!alerta) {
        return;
    }
    alerta.textContent = texto;
    alerta.className = esError ? "alerta-admin alerta-admin-error" : "alerta-admin alerta-admin-exito";
    alerta.hidden = false;
}

function inicializarSidebarMovilSocial() {
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

function inicializarSalirSocial() {
    const boton = document.getElementById("boton-salir");
    if (!boton) {
        return;
    }
    boton.addEventListener("click", async () => {
        const form = new FormData();
        form.append("csrf_token", csrfTokenSocial);
        await fetch("../php/cerrar_sesion.php", {
            method: "POST",
            body: form,
            credentials: "same-origin"
        });
        window.location.href = "../acceso.html";
    });
}
