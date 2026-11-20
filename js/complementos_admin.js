/**
 * NewsCMS - Script de administración de complementos ZIP (admin/complementos.html)
 */

let csrfTokenComplementos = "";
let permisosComplementos = {};

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
        permisosComplementos = datos.permisos || {};
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

async function cargarComplementosInstalados() {
    const contenedor = document.getElementById("cuerpo-tabla-complementos");
    const totalEl = document.getElementById("total-complementos");

    try {
        const respuesta = await fetch("../php/complementos.php?modo=admin_lista", {
            credentials: "same-origin"
        });
        if (!respuesta.ok) {
            mostrarMensajeComplemento("No se pudo cargar la lista de complementos.", true);
            return;
        }

        const datos = await respuesta.json();
        const lista = datos.complementos || [];

        if (totalEl) {
            totalEl.textContent = lista.length === 1 ? "1 instalado" : `${lista.length} instalados`;
        }

        contenedor.textContent = "";
        if (lista.length === 0) {
            renderizarEstadoVacioComplementos(contenedor);
            return;
        }

        const rutasConfig = {
            feed_redes_sociales: "redes_sociales.html",
            gestor_publicidad: "publicidad.html",
            newsletter: "newsletter.html",
            comentarios_sociales: "comentarios.html"
        };

        const etiquetasZona = {
            portada_superior: "Portada superior",
            portada_inferior: "Portada inferior",
            detalle_noticia: "Detalle de noticia"
        };

        lista.forEach((item) => {
            const estaActivo = Number(item.activo) === 1;

            const tarjeta = document.createElement("article");
            tarjeta.className = estaActivo
                ? "tarjeta-extension extension-activa"
                : "tarjeta-extension extension-inactiva";

            const cabecera = document.createElement("div");
            cabecera.className = "cabecera-extension";

            const identidad = document.createElement("div");
            identidad.className = "identidad-extension";

            const icono = document.createElement("span");
            icono.className = "icono-extension";
            icono.appendChild(crearIconoComplementoSvg(item.identificador));

            const titulos = document.createElement("div");
            titulos.className = "titulos-extension";

            const nombre = document.createElement("h3");
            nombre.className = "nombre-extension";
            nombre.textContent = item.nombre;

            const meta = document.createElement("div");
            meta.className = "meta-extension";

            const version = document.createElement("span");
            version.className = "version-extension";
            version.textContent = `v${item.version}`;
            meta.appendChild(version);

            if (item.zona) {
                const zona = document.createElement("span");
                zona.className = "zona-extension";
                zona.textContent = etiquetasZona[item.zona] || item.zona;
                meta.appendChild(zona);
            }

            titulos.appendChild(nombre);
            titulos.appendChild(meta);
            identidad.appendChild(icono);
            identidad.appendChild(titulos);

            const badge = document.createElement("span");
            badge.className = estaActivo
                ? "estado-extension estado-ext-activo"
                : "estado-extension estado-ext-inactivo";
            badge.textContent = estaActivo ? "Activo" : "Inactivo";

            cabecera.appendChild(identidad);
            cabecera.appendChild(badge);

            const desc = document.createElement("p");
            desc.className = "descripcion-extension";
            desc.textContent = item.descripcion || "Sin descripción disponible.";

            const pie = document.createElement("div");
            pie.className = "pie-extension";

            const acciones = document.createElement("div");
            acciones.className = "acciones-extension";

            const rutaConfig = rutasConfig[item.identificador];
            const puedeConfigurar = permisosComplementos.configurar_complementos !== false;
            if (rutaConfig && puedeConfigurar) {
                const enlaceConfig = document.createElement("a");
                enlaceConfig.href = rutaConfig;
                enlaceConfig.className = "enlace-accion enlace-ver boton-extension boton-config-extension";
                enlaceConfig.appendChild(crearIconoComplementoAccion("config"));
                const lblConfig = document.createElement("span");
                lblConfig.textContent = "Configurar";
                enlaceConfig.appendChild(lblConfig);
                acciones.appendChild(enlaceConfig);
            }

            const botonEstado = document.createElement("button");
            botonEstado.type = "button";
            botonEstado.className = estaActivo
                ? "enlace-accion boton-extension boton-desactivar-extension"
                : "enlace-accion boton-extension boton-activar-extension";
            botonEstado.appendChild(crearIconoComplementoAccion(estaActivo ? "desactivar" : "activar"));
            const lblEstado = document.createElement("span");
            lblEstado.textContent = estaActivo ? "Desactivar" : "Activar";
            botonEstado.appendChild(lblEstado);
            botonEstado.addEventListener("click", () => {
                cambiarEstado(item.id, estaActivo ? "desactivar" : "activar");
            });

            acciones.appendChild(botonEstado);
            pie.appendChild(acciones);

            tarjeta.appendChild(cabecera);
            tarjeta.appendChild(desc);
            tarjeta.appendChild(pie);
            contenedor.appendChild(tarjeta);
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

function renderizarEstadoVacioComplementos(contenedor) {
    const caja = document.createElement("div");
    caja.className = "estado-vacio-complementos";

    const titulo = document.createElement("strong");
    titulo.className = "titulo-estado-vacio";
    titulo.textContent = "Aún no hay complementos instalados.";

    const nota = document.createElement("p");
    nota.className = "descripcion-estado-vacio";
    nota.textContent = "Utiliza el cargador superior para instalar un complemento oficial desde su paquete ZIP.";

    caja.appendChild(titulo);
    caja.appendChild(nota);
    contenedor.appendChild(caja);
}

function crearIconoComplementoSvg(identificador) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.9");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");

    const agregar = (tag, attrs) => {
        const el = document.createElementNS(ns, tag);
        Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
        svg.appendChild(el);
    };

    if (identificador === "ticker_ultima_hora") {
        agregar("polygon", { points: "13 2 3 14 12 14 11 22 21 10 12 10 13 2" });
    } else if (identificador === "nube_etiquetas") {
        agregar("path", { d: "M12 2H2v10l9.29 9.29a1 1 0 0 0 1.41 0l6.59-6.59a1 1 0 0 0 0-1.41Z" });
        agregar("circle", { cx: "7", cy: "7", r: "1.5" });
    } else if (identificador === "feed_redes_sociales") {
        agregar("circle", { cx: "18", cy: "5", r: "3" });
        agregar("circle", { cx: "6", cy: "12", r: "3" });
        agregar("circle", { cx: "18", cy: "19", r: "3" });
        agregar("path", { d: "m8.59 13.51 6.83 3.98" });
        agregar("path", { d: "m15.41 6.51-6.82 3.98" });
    } else if (identificador === "gestor_publicidad") {
        agregar("path", { d: "m3 11 18-5v12L3 14v-3Z" });
        agregar("path", { d: "M11.6 16.8a3 3 0 1 1-5.8-1.6" });
    } else if (identificador === "newsletter") {
        agregar("rect", { x: "3", y: "5", width: "18", height: "14", rx: "2" });
        agregar("path", { d: "m3 7 9 6 9-6" });
    } else if (identificador === "comentarios_sociales") {
        agregar("path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" });
    } else {
        agregar("path", { d: "M12 2v4" });
        agregar("path", { d: "m6.8 6.8 2.8 2.8" });
        agregar("path", { d: "M20 12h-4" });
        agregar("rect", { x: "6", y: "6", width: "12", height: "12", rx: "3" });
    }

    return svg;
}

function crearIconoComplementoAccion(tipo) {
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

    if (tipo === "config") {
        agregar("circle", { cx: "12", cy: "12", r: "3" });
        agregar("path", { d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" });
    } else if (tipo === "activar") {
        agregar("circle", { cx: "12", cy: "12", r: "9" });
        agregar("path", { d: "m8.5 12.5 2.5 2.5 4.5-5" });
    } else if (tipo === "desactivar") {
        agregar("circle", { cx: "12", cy: "12", r: "9" });
        agregar("path", { d: "m4.9 4.9 14.2 14.2" });
    }

    return svg;
}
