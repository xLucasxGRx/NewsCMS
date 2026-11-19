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

async function cargarEnlacesSociales() {
    const contenedorTarjetas = document.getElementById("cuerpo-tabla-social");
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
            totalEl.textContent = enlaces.length === 1 ? "1 enlace" : `${enlaces.length} enlaces`;
        }

        contenedorTarjetas.textContent = "";
        if (enlaces.length === 0) {
            const vacio = document.createElement("div");
            vacio.className = "estado-vacio-social";

            const iconoVacio = document.createElement("div");
            iconoVacio.className = "icono-vacio-social";
            iconoVacio.setAttribute("aria-hidden", "true");
            iconoVacio.appendChild(crearSvgPlataformaAdmin("Enlace"));

            const tituloVacio = document.createElement("h3");
            tituloVacio.className = "titulo-vacio-social";
            tituloVacio.textContent = "Aún no hay enlaces sociales registrados";

            const textoVacio = document.createElement("p");
            textoVacio.className = "texto-vacio-social";
            textoVacio.textContent = "Agrega los enlaces oficiales de Facebook, Instagram, TikTok o X para mostrarlos en el portal.";

            const btnVacio = document.createElement("button");
            btnVacio.type = "button";
            btnVacio.className = "boton-primario-admin";
            btnVacio.textContent = "+ Agregar enlace";
            btnVacio.addEventListener("click", abrirModalNuevoEnlace);

            vacio.appendChild(iconoVacio);
            vacio.appendChild(tituloVacio);
            vacio.appendChild(textoVacio);
            vacio.appendChild(btnVacio);
            contenedorTarjetas.appendChild(vacio);
            return;
        }

        enlaces.forEach((item) => {
            const plataforma = String(item.plataforma || "").trim();
            const platSlug = plataforma.toLowerCase();
            const esVisible = Number(item.visible) === 1;

            const tarjeta = document.createElement("article");
            tarjeta.className = esVisible
                ? "tarjeta-social-admin"
                : "tarjeta-social-admin tarjeta-social-oculta";

            const cabecera = document.createElement("div");
            cabecera.className = "tarjeta-social-cabecera";

            const bloquePlat = document.createElement("div");
            bloquePlat.className = "tarjeta-social-identidad";

            const icono = document.createElement("span");
            icono.className = `icono-social-admin icono-${platSlug}`;
            icono.setAttribute("aria-hidden", "true");
            icono.appendChild(crearSvgPlataformaAdmin(plataforma));

            const platNombre = document.createElement("span");
            platNombre.className = "nombre-plataforma-card";
            platNombre.textContent = plataforma || "Red social";

            bloquePlat.appendChild(icono);
            bloquePlat.appendChild(platNombre);

            const badge = document.createElement("span");
            badge.className = esVisible ? "estado-badge estado-publicada" : "estado-badge estado-borrador";
            badge.textContent = esVisible ? "Visible" : "Oculto";

            cabecera.appendChild(bloquePlat);
            cabecera.appendChild(badge);

            const cuerpoCard = document.createElement("div");
            cuerpoCard.className = "tarjeta-social-cuerpo";

            const tituloEl = document.createElement("h3");
            tituloEl.className = "titulo-tarjeta-social";
            tituloEl.textContent = item.titulo;
            cuerpoCard.appendChild(tituloEl);

            const aUrl = document.createElement("a");
            aUrl.href = item.url;
            aUrl.target = "_blank";
            aUrl.rel = "noopener noreferrer";
            aUrl.className = "url-tarjeta-social";
            aUrl.title = item.url;
            aUrl.textContent = resumirUrlSocial(item.url);
            cuerpoCard.appendChild(aUrl);

            if (item.descripcion) {
                const descEl = document.createElement("p");
                descEl.className = "desc-tarjeta-social";
                descEl.textContent = item.descripcion;
                cuerpoCard.appendChild(descEl);
            }

            const pie = document.createElement("div");
            pie.className = "tarjeta-social-pie";

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

            pie.appendChild(btnEditar);
            pie.appendChild(btnVis);
            pie.appendChild(btnElim);

            tarjeta.appendChild(cabecera);
            tarjeta.appendChild(cuerpoCard);
            tarjeta.appendChild(pie);
            contenedorTarjetas.appendChild(tarjeta);
        });
    } catch {
        mostrarMensajeSocial("No se pudieron cargar los enlaces sociales.", true);
    }
}

function resumirUrlSocial(url) {
    try {
        const u = new URL(url);
        const ruta = u.pathname && u.pathname !== "/" ? u.pathname : "";
        return `${u.hostname.replace(/^www\./, "")}${ruta}`;
    } catch {
        return url;
    }
}

function crearSvgPlataformaAdmin(plataforma) {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "17");
    svg.setAttribute("height", "17");
    svg.setAttribute("fill", "currentColor");
    svg.setAttribute("aria-hidden", "true");

    const path = document.createElementNS(svgNS, "path");
    if (plataforma === "Facebook") {
        path.setAttribute("d", "M13.5 21v-8.2h2.75l.41-3.2H13.5V7.55c0-.93.26-1.56 1.59-1.56h1.7V3.13c-.3-.04-1.31-.13-2.49-.13-2.46 0-4.15 1.5-4.15 4.26V9.6H7.37v3.2h2.78V21h3.35Z");
    } else if (plataforma === "Instagram") {
        path.setAttribute("d", "M7.8 3h8.4A4.8 4.8 0 0 1 21 7.8v8.4a4.8 4.8 0 0 1-4.8 4.8H7.8A4.8 4.8 0 0 1 3 16.2V7.8A4.8 4.8 0 0 1 7.8 3Zm0 1.8A3 3 0 0 0 4.8 7.8v8.4a3 3 0 0 0 3 3h8.4a3 3 0 0 0 3-3V7.8a3 3 0 0 0-3-3H7.8Zm8.95 1.35a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2ZM12 7.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Zm0 1.8a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 0 0 0-5.4Z");
    } else if (plataforma === "TikTok") {
        path.setAttribute("d", "M15.8 3c.35 2.04 1.56 3.45 3.55 3.8v2.68a6.2 6.2 0 0 1-3.55-1.1v5.92a5.5 5.5 0 1 1-4.78-5.45v2.75a2.82 2.82 0 1 0 2.08 2.72V3h2.7Z");
    } else if (plataforma === "X") {
        path.setAttribute("d", "M17.53 3h2.9l-6.34 7.25L21.55 21h-5.84l-4.57-5.98L5.9 21H3l6.78-7.75L2.6 3h5.98l4.13 5.46L17.53 3Zm-1.02 16.2h1.6L7.56 4.71H5.84L16.51 19.2Z");
    } else {
        path.setAttribute("d", "M10.59 13.41a1 1 0 0 0 1.41 1.41l4.95-4.95a3.5 3.5 0 0 0-4.95-4.95l-2.12 2.12a1 1 0 1 0 1.41 1.41l2.12-2.12a1.5 1.5 0 0 1 2.12 2.12l-4.94 4.96Zm2.82-2.82a1 1 0 0 0-1.41-1.41l-4.95 4.95a3.5 3.5 0 0 0 4.95 4.95l2.12-2.12a1 1 0 1 0-1.41-1.41l-2.12 2.12a1.5 1.5 0 0 1-2.12-2.12l4.94-4.96Z");
    }

    svg.appendChild(path);
    return svg;
}

function abrirModalNuevoEnlace() {
    document.getElementById("social-id").value = "0";
    document.getElementById("social-plataforma").value = "Facebook";
    document.getElementById("social-titulo").value = "";
    document.getElementById("social-descripcion").value = "";
    document.getElementById("social-url").value = "";
    document.getElementById("social-visible").value = "1";
    document.getElementById("titulo-form-social").textContent = "Agregar enlace social";
    ocultarMensajeModalSocial();
    document.getElementById("panel-formulario-social").hidden = false;
    document.getElementById("social-titulo")?.focus();
}

function cerrarModalSocial() {
    const modal = document.getElementById("panel-formulario-social");
    if (modal) {
        modal.hidden = true;
    }
    ocultarMensajeModalSocial();
}

function ocultarMensajeModalSocial() {
    const alertaModal = document.getElementById("mensaje-modal-social");
    if (alertaModal) {
        alertaModal.hidden = true;
        alertaModal.textContent = "";
    }
}

function mostrarErrorModalSocial(texto) {
    const alertaModal = document.getElementById("mensaje-modal-social");
    if (alertaModal) {
        alertaModal.textContent = texto;
        alertaModal.className = "alerta-admin alerta-admin-error alerta-modal-social";
        alertaModal.hidden = false;
    } else {
        mostrarMensajeSocial(texto, true);
    }
}

function inicializarFormularioSocial() {
    const btnNuevo = document.getElementById("btn-nuevo-enlace");
    const btnCancelar = document.getElementById("btn-cancelar-social");
    const btnCerrarX = document.getElementById("btn-cerrar-modal-social");
    const modal = document.getElementById("panel-formulario-social");
    const formulario = document.getElementById("formulario-social");

    btnNuevo?.addEventListener("click", abrirModalNuevoEnlace);
    btnCancelar?.addEventListener("click", cerrarModalSocial);
    btnCerrarX?.addEventListener("click", cerrarModalSocial);

    modal?.addEventListener("click", (e) => {
        if (e.target instanceof HTMLElement && e.target.dataset.cerrarModal === "1") {
            cerrarModalSocial();
        }
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modal && !modal.hidden) {
            cerrarModalSocial();
        }
    });

    formulario?.addEventListener("submit", async (e) => {
        e.preventDefault();
        ocultarMensajeModalSocial();
        const id = Number(document.getElementById("social-id").value || 0);
        const plataforma = document.getElementById("social-plataforma").value;
        const titulo = document.getElementById("social-titulo").value.trim();
        const descripcion = document.getElementById("social-descripcion").value.trim();
        const url = document.getElementById("social-url").value.trim();
        const visible = document.getElementById("social-visible").value;

        if (!titulo || !url) {
            mostrarErrorModalSocial("El título y la URL son obligatorios.");
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
                cerrarModalSocial();
                await cargarEnlacesSociales();
                return;
            }

            mostrarErrorModalSocial(resultado.mensaje || "No se pudo guardar el enlace.");
        } catch {
            mostrarErrorModalSocial("Error de comunicación con el servidor.");
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
    ocultarMensajeModalSocial();
    document.getElementById("panel-formulario-social").hidden = false;
    document.getElementById("social-titulo")?.focus();
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
