/**
 * NewsCMS - Script de administración de Configuración General (admin/configuracion.html)
 */

let csrfTokenConfig = "";
let valoresGuardadosConfig = null;

document.addEventListener("DOMContentLoaded", () => {
    iniciarConfiguracionAdmin();
});

async function iniciarConfiguracionAdmin() {
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

        csrfTokenConfig = datos.csrf_token || "";
        mostrarCabeceraConfig(datos.usuario);
        renderizarSidebarConfig(datos.modulos_permitidos || ["Dashboard"]);
        inicializarSidebarMovilConfig();
        inicializarSalirConfig();
        inicializarFormularioConfig();

        document.getElementById("contenedor-admin").hidden = false;
        await cargarConfiguracionPersistida();
    } catch {
        window.location.href = "../acceso.html";
    }
}

function mostrarCabeceraConfig(usuario) {
    document.getElementById("nombre-usuario").textContent = usuario.nombre || "";
    document.getElementById("rol-usuario").textContent = usuario.rol || "";
    document.getElementById("rol-sidebar").textContent = usuario.rol || "";
}

function renderizarSidebarConfig(modulos) {
    const lista = document.getElementById("lista-modulos");
    if (!lista) {
        return;
    }
    lista.textContent = "";

    modulos.forEach((modulo) => {
        const li = document.createElement("li");
        const enlace = document.createElement("a");
        enlace.className = modulo === "Configuración" ? "boton-modulo activo" : "boton-modulo";
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

async function cargarConfiguracionPersistida() {
    try {
        const respuesta = await fetch("../php/configuracion.php?modo=admin_obtener", {
            credentials: "same-origin"
        });
        if (!respuesta.ok) {
            return;
        }

        const datos = await respuesta.json();
        if (datos.ok && datos.configuracion) {
            valoresGuardadosConfig = datos.configuracion;
            llenarFormularioConfig(valoresGuardadosConfig);
        }
    } catch {
        mostrarMensajeConfig("No se pudo cargar la configuración actual.", true);
    }
}

function llenarFormularioConfig(cfg) {
    document.getElementById("nombre-portal").value = cfg.nombre_portal || "";
    document.getElementById("subtitulo-portal").value = cfg.subtitulo_portal || "";
    document.getElementById("descripcion-portal").value = cfg.descripcion_portal || "";
    document.getElementById("texto-pie-pagina").value = cfg.texto_pie_pagina || "";
    document.getElementById("correo-contacto").value = cfg.correo_contacto || "";
}

function inicializarFormularioConfig() {
    const formulario = document.getElementById("formulario-configuracion");
    const btnRestaurar = document.getElementById("btn-restaurar-config");

    formulario?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const nombre = document.getElementById("nombre-portal").value.trim();
        const subtitulo = document.getElementById("subtitulo-portal").value.trim();
        const descripcion = document.getElementById("descripcion-portal").value.trim();
        const textoPie = document.getElementById("texto-pie-pagina").value.trim();
        const correo = document.getElementById("correo-contacto").value.trim();

        if (!nombre || nombre.length > 80) {
            mostrarMensajeConfig("El nombre del portal es obligatorio (máximo 80 caracteres).", true);
            return;
        }
        if (subtitulo.length > 150 || descripcion.length > 300 || textoPie.length > 300) {
            mostrarMensajeConfig("Uno de los campos supera la longitud máxima permitida.", true);
            return;
        }
        if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
            mostrarMensajeConfig("Ingresa un correo de contacto válido.", true);
            return;
        }

        const form = new FormData(formulario);
        form.append("csrf_token", csrfTokenConfig);
        form.append("accion", "guardar");

        try {
            const respuesta = await fetch("../php/configuracion.php", {
                method: "POST",
                body: form,
                credentials: "same-origin"
            });
            const resultado = await respuesta.json();

            if (respuesta.ok && resultado.ok) {
                if (resultado.configuracion) {
                    valoresGuardadosConfig = resultado.configuracion;
                }
                mostrarMensajeConfig(resultado.mensaje || "Configuración guardada.", false);
                return;
            }

            mostrarMensajeConfig(resultado.mensaje || "No se pudo guardar la configuración.", true);
        } catch {
            mostrarMensajeConfig("Error de comunicación con el servidor.", true);
        }
    });

    btnRestaurar?.addEventListener("click", async () => {
        await cargarConfiguracionPersistida();
        mostrarMensajeConfig("Se restauraron los últimos valores guardados en MySQL.", false);
    });
}

function mostrarMensajeConfig(texto, esError) {
    const alerta = document.getElementById("mensaje-configuracion");
    if (!alerta) {
        return;
    }
    alerta.textContent = texto;
    alerta.className = esError ? "alerta-admin alerta-admin-error" : "alerta-admin alerta-admin-exito";
    alerta.hidden = false;
}

function inicializarSidebarMovilConfig() {
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

function inicializarSalirConfig() {
    const boton = document.getElementById("boton-salir");
    if (!boton) {
        return;
    }
    boton.addEventListener("click", async () => {
        const form = new FormData();
        form.append("csrf_token", csrfTokenConfig);
        await fetch("../php/cerrar_sesion.php", {
            method: "POST",
            body: form,
            credentials: "same-origin"
        });
        window.location.href = "../acceso.html";
    });
}
