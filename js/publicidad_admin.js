/**
 * NewsCMS - Script administrativo del complemento Gestor de Publicidad
 */

let csrfTokenPublicidad = "";

document.addEventListener("DOMContentLoaded", () => {
    iniciarPublicidadAdmin();
});

async function iniciarPublicidadAdmin() {
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

        csrfTokenPublicidad = datos.csrf_token || "";
        mostrarCabeceraPublicidad(datos.usuario);
        renderizarSidebarPublicidad(datos.modulos_permitidos || ["Dashboard"]);
        inicializarSidebarMovilPublicidad();
        inicializarSalirPublicidad();
        inicializarVistaPreviaAnuncio();
        inicializarFormularioPublicidad();

        document.getElementById("contenedor-admin").hidden = false;
        await cargarAnuncios();
    } catch {
        window.location.href = "../acceso.html";
    }
}

function mostrarCabeceraPublicidad(usuario) {
    document.getElementById("nombre-usuario").textContent = usuario.nombre || "";
    document.getElementById("rol-usuario").textContent = usuario.rol || "";
    document.getElementById("rol-sidebar").textContent = usuario.rol || "";
}

function renderizarSidebarPublicidad(modulos) {
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

async function cargarAnuncios() {
    const cuerpo = document.getElementById("cuerpo-tabla-publicidad");
    const totalEl = document.getElementById("total-anuncios");

    try {
        const respuesta = await fetch("../php/publicidad.php?modo=admin_lista", {
            credentials: "same-origin"
        });
        if (!respuesta.ok) {
            return;
        }

        const datos = await respuesta.json();
        const anuncios = datos.anuncios || [];

        if (totalEl) {
            totalEl.textContent = `${anuncios.length} anuncios`;
        }

        cuerpo.textContent = "";
        if (anuncios.length === 0) {
            const tr = document.createElement("tr");
            const td = document.createElement("td");
            td.colSpan = 5;
            td.className = "fila-vacia";
            td.textContent = "Aún no hay anuncios registrados.";
            tr.appendChild(td);
            cuerpo.appendChild(tr);
            return;
        }

        anuncios.forEach((item) => {
            const tr = document.createElement("tr");

            const tdImg = document.createElement("td");
            const img = document.createElement("img");
            img.src = `../${item.imagen}`;
            img.alt = item.titulo;
            img.className = "miniatura-publicidad";
            tdImg.appendChild(img);

            const tdTitulo = document.createElement("td");
            tdTitulo.textContent = item.titulo;

            const tdEnlace = document.createElement("td");
            const a = document.createElement("a");
            a.href = item.enlace;
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            a.className = "enlace-secundario";
            a.textContent = item.enlace;
            tdEnlace.appendChild(a);

            const esVisible = Number(item.visible) === 1;
            const tdEstado = document.createElement("td");
            const badge = document.createElement("span");
            badge.className = esVisible ? "estado-badge estado-publicada" : "estado-badge estado-borrador";
            badge.textContent = esVisible ? "Visible" : "Inactivo";
            tdEstado.appendChild(badge);

            const tdAcciones = document.createElement("td");
            tdAcciones.className = "celda-acciones";

            const btnEditar = document.createElement("button");
            btnEditar.type = "button";
            btnEditar.className = "enlace-accion";
            btnEditar.textContent = "Editar";
            btnEditar.addEventListener("click", () => abrirEdicionAnuncio(item));

            const btnVis = document.createElement("button");
            btnVis.type = "button";
            btnVis.className = "enlace-accion enlace-ver";
            btnVis.textContent = esVisible ? "Desactivar" : "Activar";
            btnVis.addEventListener("click", () => cambiarVisibilidadAnuncio(item.id, esVisible ? 0 : 1));

            const btnElim = document.createElement("button");
            btnElim.type = "button";
            btnElim.className = "enlace-accion enlace-eliminar";
            btnElim.textContent = "Eliminar";
            btnElim.addEventListener("click", () => eliminarAnuncioItem(item));

            tdAcciones.appendChild(btnEditar);
            tdAcciones.appendChild(btnVis);
            tdAcciones.appendChild(btnElim);

            tr.appendChild(tdImg);
            tr.appendChild(tdTitulo);
            tr.appendChild(tdEnlace);
            tr.appendChild(tdEstado);
            tr.appendChild(tdAcciones);
            cuerpo.appendChild(tr);
        });
    } catch {
        mostrarMensajePublicidad("No se pudieron cargar los anuncios.", true);
    }
}

function inicializarVistaPreviaAnuncio() {
    const input = document.getElementById("anuncio-imagen");
    const cont = document.getElementById("contenedor-previa-anuncio");
    const img = document.getElementById("imagen-previa-anuncio");

    input?.addEventListener("change", () => {
        const archivo = input.files && input.files[0];
        if (!archivo) {
            return;
        }
        const lector = new FileReader();
        lector.onload = (e) => {
            img.src = e.target.result;
            cont.hidden = false;
        };
        lector.readAsDataURL(archivo);
    });
}

function inicializarFormularioPublicidad() {
    const btnNuevo = document.getElementById("btn-nuevo-anuncio");
    const btnCancelar = document.getElementById("btn-cancelar-publicidad");
    const formulario = document.getElementById("formulario-publicidad");

    btnNuevo?.addEventListener("click", () => {
        formulario.reset();
        document.getElementById("anuncio-id").value = "0";
        document.getElementById("contenedor-previa-anuncio").hidden = true;
        document.getElementById("titulo-form-publicidad").textContent = "Nuevo anuncio";
        document.getElementById("panel-formulario-publicidad").hidden = false;
    });

    btnCancelar?.addEventListener("click", () => {
        document.getElementById("panel-formulario-publicidad").hidden = true;
    });

    formulario?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = Number(document.getElementById("anuncio-id").value || 0);
        const titulo = document.getElementById("anuncio-titulo").value.trim();
        const enlace = document.getElementById("anuncio-enlace").value.trim();
        const inputImg = document.getElementById("anuncio-imagen");

        if (!titulo || !enlace) {
            mostrarMensajePublicidad("El título y la URL de destino son obligatorios.", true);
            return;
        }

        if (id === 0 && (!inputImg.files || inputImg.files.length === 0)) {
            mostrarMensajePublicidad("Selecciona una imagen publicitaria.", true);
            return;
        }

        const form = new FormData(formulario);
        form.append("csrf_token", csrfTokenPublicidad);
        form.append("accion", id > 0 ? "editar" : "crear");

        try {
            const respuesta = await fetch("../php/publicidad.php", {
                method: "POST",
                body: form,
                credentials: "same-origin"
            });
            const resultado = await respuesta.json();

            if (respuesta.ok && resultado.ok) {
                mostrarMensajePublicidad(resultado.mensaje || "Anuncio guardado.", false);
                document.getElementById("panel-formulario-publicidad").hidden = true;
                await cargarAnuncios();
                return;
            }

            mostrarMensajePublicidad(resultado.mensaje || "No se pudo guardar el anuncio.", true);
        } catch {
            mostrarMensajePublicidad("Error de comunicación con el servidor.", true);
        }
    });
}

function abrirEdicionAnuncio(item) {
    document.getElementById("anuncio-id").value = String(item.id);
    document.getElementById("anuncio-titulo").value = item.titulo || "";
    document.getElementById("anuncio-descripcion").value = item.descripcion || "";
    document.getElementById("anuncio-enlace").value = item.enlace || "";
    document.getElementById("anuncio-visible").value = String(Number(item.visible) === 1 ? 1 : 0);
    document.getElementById("anuncio-imagen").value = "";

    if (item.imagen) {
        document.getElementById("imagen-previa-anuncio").src = `../${item.imagen}`;
        document.getElementById("contenedor-previa-anuncio").hidden = false;
    }

    document.getElementById("titulo-form-publicidad").textContent = "Editar anuncio";
    document.getElementById("panel-formulario-publicidad").hidden = false;
}

async function cambiarVisibilidadAnuncio(id, visible) {
    const form = new FormData();
    form.append("csrf_token", csrfTokenPublicidad);
    form.append("accion", "cambiar_visibilidad");
    form.append("id", String(id));
    form.append("visible", String(visible));

    try {
        const respuesta = await fetch("../php/publicidad.php", {
            method: "POST",
            body: form,
            credentials: "same-origin"
        });
        const resultado = await respuesta.json();
        if (respuesta.ok && resultado.ok) {
            mostrarMensajePublicidad(resultado.mensaje || "Visibilidad actualizada.", false);
            await cargarAnuncios();
        }
    } catch {
        mostrarMensajePublicidad("Error al actualizar el estado.", true);
    }
}

async function eliminarAnuncioItem(item) {
    if (!window.confirm(`¿Deseas eliminar el anuncio "${item.titulo}"?`)) {
        return;
    }

    const form = new FormData();
    form.append("csrf_token", csrfTokenPublicidad);
    form.append("accion", "eliminar");
    form.append("id", String(item.id));

    try {
        const respuesta = await fetch("../php/publicidad.php", {
            method: "POST",
            body: form,
            credentials: "same-origin"
        });
        const resultado = await respuesta.json();
        if (respuesta.ok && resultado.ok) {
            mostrarMensajePublicidad(resultado.mensaje || "Anuncio eliminado.", false);
            await cargarAnuncios();
        }
    } catch {
        mostrarMensajePublicidad("Error al eliminar el anuncio.", true);
    }
}

function mostrarMensajePublicidad(texto, esError) {
    const alerta = document.getElementById("mensaje-publicidad");
    if (!alerta) {
        return;
    }
    alerta.textContent = texto;
    alerta.className = esError ? "alerta-admin alerta-admin-error" : "alerta-admin alerta-admin-exito";
    alerta.hidden = false;
}

function inicializarSidebarMovilPublicidad() {
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

function inicializarSalirPublicidad() {
    const boton = document.getElementById("boton-salir");
    if (!boton) {
        return;
    }
    boton.addEventListener("click", async () => {
        const form = new FormData();
        form.append("csrf_token", csrfTokenPublicidad);
        await fetch("../php/cerrar_sesion.php", {
            method: "POST",
            body: form,
            credentials: "same-origin"
        });
        window.location.href = "../acceso.html";
    });
}
