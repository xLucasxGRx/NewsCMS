/**
 * NewsCMS - Script de administración de complementos ZIP (admin/complementos.html)
 */

let csrfTokenComplementos = "";

document.addEventListener("DOMContentLoaded", () => {
    iniciarComplementosAdmin();
});

async function iniciarComplementosAdmin() {
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

        csrfTokenComplementos = datos.csrf_token || "";
        mostrarCabeceraComplementos(datos.usuario);
        renderizarSidebarComplementos(datos.modulos_permitidos || ["Dashboard"]);
        inicializarSidebarMovilComplementos();
        inicializarSalirComplementos();
        inicializarFormularioZip();

        document.getElementById("contenedor-admin").hidden = false;
        await cargarComplementosInstalados();
    } catch {
        window.location.href = "../acceso.html";
    }
}

function mostrarCabeceraComplementos(usuario) {
    document.getElementById("nombre-usuario").textContent = usuario.nombre || "";
    document.getElementById("rol-usuario").textContent = usuario.rol || "";
    document.getElementById("rol-sidebar").textContent = usuario.rol || "";
}

function renderizarSidebarComplementos(modulos) {
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

async function cargarComplementosInstalados() {
    const cuerpo = document.getElementById("cuerpo-tabla-complementos");
    const totalEl = document.getElementById("total-complementos");

    try {
        const respuesta = await fetch("../php/complementos.php?modo=admin_lista", {
            credentials: "same-origin"
        });
        if (!respuesta.ok) {
            return;
        }

        const datos = await respuesta.json();
        const lista = datos.complementos || [];

        if (totalEl) {
            totalEl.textContent = `${lista.length} instalados`;
        }

        cuerpo.textContent = "";
        if (lista.length === 0) {
            const tr = document.createElement("tr");
            const td = document.createElement("td");
            td.colSpan = 5;
            td.className = "fila-vacia";
            td.textContent = "Aún no hay complementos instalados.";
            tr.appendChild(td);
            cuerpo.appendChild(tr);
            return;
        }

        lista.forEach((item) => {
            const tr = document.createElement("tr");

            const tdNombre = document.createElement("td");
            tdNombre.textContent = item.nombre;

            const tdDesc = document.createElement("td");
            tdDesc.textContent = item.descripcion || "—";

            const tdVersion = document.createElement("td");
            tdVersion.textContent = item.version;

            const estaActivo = Number(item.activo) === 1;
            const tdEstado = document.createElement("td");
            const badge = document.createElement("span");
            badge.className = estaActivo ? "estado-badge estado-publicada" : "estado-badge estado-borrador";
            badge.textContent = estaActivo ? "Activo" : "Inactivo";
            tdEstado.appendChild(badge);

            const tdAcciones = document.createElement("td");
            tdAcciones.className = "celda-acciones";

            const botonEstado = document.createElement("button");
            botonEstado.type = "button";
            botonEstado.className = estaActivo ? "enlace-accion enlace-eliminar" : "enlace-accion";
            botonEstado.textContent = estaActivo ? "Desactivar" : "Activar";
            botonEstado.addEventListener("click", () => {
                cambiarEstado(item.id, estaActivo ? "desactivar" : "activar");
            });

            tdAcciones.appendChild(botonEstado);

            if (item.identificador === "feed_redes_sociales") {
                const enlaceConfig = document.createElement("a");
                enlaceConfig.href = "redes_sociales.html";
                enlaceConfig.className = "enlace-accion enlace-ver";
                enlaceConfig.textContent = "Configurar";
                tdAcciones.appendChild(enlaceConfig);
            } else if (item.identificador === "gestor_publicidad") {
                const enlaceConfig = document.createElement("a");
                enlaceConfig.href = "publicidad.html";
                enlaceConfig.className = "enlace-accion enlace-ver";
                enlaceConfig.textContent = "Configurar";
                tdAcciones.appendChild(enlaceConfig);
            } else if (item.identificador === "newsletter") {
                const enlaceConfig = document.createElement("a");
                enlaceConfig.href = "newsletter.html";
                enlaceConfig.className = "enlace-accion enlace-ver";
                enlaceConfig.textContent = "Configurar";
                tdAcciones.appendChild(enlaceConfig);
            } else if (item.identificador === "comentarios_sociales") {
                const enlaceConfig = document.createElement("a");
                enlaceConfig.href = "comentarios.html";
                enlaceConfig.className = "enlace-accion enlace-ver";
                enlaceConfig.textContent = "Configurar";
                tdAcciones.appendChild(enlaceConfig);
            }

            tr.appendChild(tdNombre);
            tr.appendChild(tdDesc);
            tr.appendChild(tdVersion);
            tr.appendChild(tdEstado);
            tr.appendChild(tdAcciones);
            cuerpo.appendChild(tr);
        });
    } catch {
        mostrarMensajeComplemento("No se pudo cargar la lista de complementos.", true);
    }
}

function inicializarFormularioZip() {
    const formulario = document.getElementById("formulario-instalar-zip");
    const boton = document.getElementById("btn-instalar-zip");

    formulario?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const input = document.getElementById("archivo-zip");
        const archivo = input.files && input.files[0];

        if (!archivo) {
            mostrarMensajeComplemento("Selecciona un archivo ZIP para instalar.", true);
            return;
        }

        boton.disabled = true;
        boton.textContent = "Instalando...";

        const form = new FormData();
        form.append("csrf_token", csrfTokenComplementos);
        form.append("accion", "instalar");
        form.append("archivo_zip", archivo);

        try {
            const respuesta = await fetch("../php/complementos.php", {
                method: "POST",
                body: form,
                credentials: "same-origin"
            });
            const resultado = await respuesta.json();

            if (respuesta.ok && resultado.ok) {
                mostrarMensajeComplemento(resultado.mensaje || "Complemento instalado.", false);
                formulario.reset();
                await cargarComplementosInstalados();
                return;
            }

            mostrarMensajeComplemento(resultado.mensaje || "No se pudo instalar el complemento.", true);
        } catch {
            mostrarMensajeComplemento("Error de comunicación con el servidor.", true);
        } finally {
            boton.disabled = false;
            boton.textContent = "Instalar complemento";
        }
    });
}

async function cambiarEstado(id, accion) {
    const form = new FormData();
    form.append("csrf_token", csrfTokenComplementos);
    form.append("accion", accion);
    form.append("id", String(id));

    try {
        const respuesta = await fetch("../php/complementos.php", {
            method: "POST",
            body: form,
            credentials: "same-origin"
        });
        const resultado = await respuesta.json();

        if (respuesta.ok && resultado.ok) {
            mostrarMensajeComplemento(resultado.mensaje || "Estado actualizado.", false);
            await cargarComplementosInstalados();
            return;
        }

        mostrarMensajeComplemento(resultado.mensaje || "No se pudo actualizar el estado.", true);
    } catch {
        mostrarMensajeComplemento("Error de comunicación con el servidor.", true);
    }
}

function mostrarMensajeComplemento(texto, esError) {
    const alerta = document.getElementById("mensaje-complementos");
    if (!alerta) {
        return;
    }
    alerta.textContent = texto;
    alerta.className = esError ? "alerta-admin alerta-admin-error" : "alerta-admin alerta-admin-exito";
    alerta.hidden = false;
}

function inicializarSidebarMovilComplementos() {
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

function inicializarSalirComplementos() {
    const boton = document.getElementById("boton-salir");
    if (!boton) {
        return;
    }
    boton.addEventListener("click", async () => {
        const form = new FormData();
        form.append("csrf_token", csrfTokenComplementos);
        await fetch("../php/cerrar_sesion.php", {
            method: "POST",
            body: form,
            credentials: "same-origin"
        });
        window.location.href = "../acceso.html";
    });
}
