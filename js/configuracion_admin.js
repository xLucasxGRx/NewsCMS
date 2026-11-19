/**
 * NewsCMS - Script de administración de Configuración General (admin/configuracion.html)
 */

let csrfTokenConfig = "";
let valoresGuardadosConfig = null;
let catalogoRolesPermisos = null;
let matrizGuardadaPermisos = null;

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
        inicializarEventosRolesPermisos();

        document.getElementById("contenedor-admin").hidden = false;
        await cargarConfiguracionPersistida();
        await cargarMatrizRolesPermisos();
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

async function cargarMatrizRolesPermisos() {
    try {
        const respuesta = await fetch("../php/roles_permisos.php", {
            credentials: "same-origin"
        });
        const datos = await respuesta.json();
        if (!respuesta.ok || !datos.ok || !datos.matriz) {
            mostrarMensajeRoles(datos.mensaje || "No se pudo cargar la matriz de roles y permisos.", true);
            return;
        }

        catalogoRolesPermisos = {
            editables: datos.editables || [],
            protegidos: datos.protegidos || []
        };
        matrizGuardadaPermisos = datos.matriz;
        renderizarMatrizPermisos(catalogoRolesPermisos, matrizGuardadaPermisos);
    } catch {
        mostrarMensajeRoles("Error de comunicación al consultar los permisos de roles.", true);
    }
}

function renderizarMatrizPermisos(catalogo, matriz) {
    const cuerpo = document.getElementById("cuerpo-matriz-permisos");
    if (!cuerpo) {
        return;
    }

    cuerpo.textContent = "";
    let grupoActual = "";

    (catalogo.editables || []).forEach((permiso) => {
        if (permiso.grupo && permiso.grupo !== grupoActual) {
            grupoActual = permiso.grupo;
            const nombreGrupo = grupoActual === "Catálogos" ? "Categorías y etiquetas" : grupoActual;
            cuerpo.appendChild(crearFilaGrupoMatriz(nombreGrupo, false));
        }

        const tr = document.createElement("tr");
        tr.className = "fila-permiso";

        const tdInfo = document.createElement("td");
        tdInfo.className = "col-permiso-matriz";

        const cabeceraPermiso = document.createElement("div");
        cabeceraPermiso.className = "cabecera-permiso";

        const titulo = document.createElement("strong");
        titulo.className = "titulo-permiso";
        titulo.textContent = permiso.etiqueta;
        cabeceraPermiso.appendChild(titulo);

        const desc = document.createElement("p");
        desc.className = "descripcion-permiso";
        desc.textContent = permiso.descripcion;

        tdInfo.appendChild(cabeceraPermiso);
        tdInfo.appendChild(desc);
        tr.appendChild(tdInfo);

        ["administrador", "editor", "redactor"].forEach((rol) => {
            const td = document.createElement("td");
            td.className = rol === "administrador" ? "col-rol-matriz col-rol-fija" : "col-rol-matriz";

            const contenedorControl = document.createElement("div");
            contenedorControl.className = "celda-control-permiso";

            const input = document.createElement("input");
            input.type = "checkbox";
            input.className = "checkbox-permiso";
            input.checked = Boolean(matriz?.[rol]?.[permiso.clave]);

            if (rol === "administrador") {
                input.disabled = true;
                input.title = "El rol Administrador conserva todos los permisos activos.";
                input.setAttribute("aria-label", `${permiso.etiqueta} para Administrador (fijo)`);
            } else {
                input.dataset.rol = rol;
                input.dataset.permiso = permiso.clave;
                input.setAttribute("aria-label", `${permiso.etiqueta} para ${rol}`);
            }

            contenedorControl.appendChild(input);
            td.appendChild(contenedorControl);
            tr.appendChild(td);
        });

        cuerpo.appendChild(tr);
    });

    if ((catalogo.protegidos || []).length > 0) {
        cuerpo.appendChild(crearFilaGrupoMatriz("Permisos administrativos protegidos", true));

        catalogo.protegidos.forEach((permiso) => {
            const tr = document.createElement("tr");
            tr.className = "fila-permiso fila-permiso-protegido";

            const tdInfo = document.createElement("td");
            tdInfo.className = "col-permiso-matriz";

            const cabeceraPermiso = document.createElement("div");
            cabeceraPermiso.className = "cabecera-permiso";

            const titulo = document.createElement("strong");
            titulo.className = "titulo-permiso";
            titulo.textContent = permiso.etiqueta;

            const insignia = document.createElement("span");
            insignia.className = "etiqueta-protegido";
            insignia.textContent = "Solo admin";

            cabeceraPermiso.appendChild(titulo);
            cabeceraPermiso.appendChild(insignia);

            const desc = document.createElement("p");
            desc.className = "descripcion-permiso";
            desc.textContent = permiso.descripcion;

            tdInfo.appendChild(cabeceraPermiso);
            tdInfo.appendChild(desc);
            tr.appendChild(tdInfo);

            ["administrador", "editor", "redactor"].forEach((rol) => {
                const td = document.createElement("td");
                td.className = rol === "administrador" ? "col-rol-matriz col-rol-fija" : "col-rol-matriz";

                const contenedorControl = document.createElement("div");
                contenedorControl.className = "celda-control-permiso";

                const input = document.createElement("input");
                input.type = "checkbox";
                input.className = "checkbox-permiso";
                input.disabled = true;
                input.checked = rol === "administrador";
                input.title = "Permiso administrativo protegido y no modificable.";
                input.setAttribute("aria-label", `${permiso.etiqueta} para ${rol} (protegido)`);

                contenedorControl.appendChild(input);
                td.appendChild(contenedorControl);
                tr.appendChild(td);
            });

            cuerpo.appendChild(tr);
        });
    }
}

function crearFilaGrupoMatriz(texto, esProtegido) {
    const tr = document.createElement("tr");
    tr.className = esProtegido ? "fila-grupo-matriz fila-grupo-protegido" : "fila-grupo-matriz";
    const td = document.createElement("td");
    td.colSpan = 4;

    const etiqueta = document.createElement("span");
    etiqueta.className = "texto-grupo-matriz";
    etiqueta.textContent = texto;

    td.appendChild(etiqueta);
    tr.appendChild(td);
    return tr;
}

function leerMatrizEditableFormulario() {
    const resultado = { editor: {}, redactor: {} };
    const casillas = document.querySelectorAll('#cuerpo-matriz-permisos input[type="checkbox"][data-rol][data-permiso]');
    casillas.forEach((casilla) => {
        const rol = casilla.dataset.rol;
        const permiso = casilla.dataset.permiso;
        if (resultado[rol] && permiso) {
            resultado[rol][permiso] = casilla.checked;
        }
    });
    return resultado;
}

function validarDependenciasMatrizCliente(permisosPorRol) {
    for (const rol of ["editor", "redactor"]) {
        const p = permisosPorRol[rol] || {};
        const etiquetaRol = rol === "editor" ? "Editor" : "Redactor";

        if (p.editar_noticias_propias && !p.consultar_noticias_propias) {
            return `${etiquetaRol}: Para editar noticias propias primero debe permitirse consultar noticias propias.`;
        }
        if (p.editar_noticias_ajenas && !p.consultar_noticias_ajenas) {
            return `${etiquetaRol}: Para editar noticias de otros autores primero debe permitirse consultarlas.`;
        }
        if (p.enviar_revision && !p.crear_noticias && !p.editar_noticias_propias) {
            return `${etiquetaRol}: Para enviar noticias a revisión debe permitirse crear noticias o editar noticias propias.`;
        }
        if (p.publicar_noticias && !p.crear_noticias && !p.editar_noticias_propias && !p.editar_noticias_ajenas) {
            return `${etiquetaRol}: Para publicar noticias directamente debe permitirse crear o editar noticias.`;
        }
        if ((p.aprobar_noticias || p.solicitar_correcciones) && !p.consultar_revision) {
            return `${etiquetaRol}: Para aprobar noticias o solicitar correcciones debe permitirse consultar la revisión editorial.`;
        }
    }
    return null;
}

function inicializarEventosRolesPermisos() {
    const btnGuardar = document.getElementById("btn-guardar-permisos");
    const btnDescartar = document.getElementById("btn-descartar-permisos");

    btnGuardar?.addEventListener("click", async () => {
        if (!matrizGuardadaPermisos) {
            return;
        }

        const matrizEditada = leerMatrizEditableFormulario();
        const errorDependencia = validarDependenciasMatrizCliente(matrizEditada);
        if (errorDependencia) {
            mostrarMensajeRoles(errorDependencia, true);
            return;
        }

        const form = new FormData();
        form.append("csrf_token", csrfTokenConfig);
        form.append("accion", "guardar");
        form.append("permisos", JSON.stringify(matrizEditada));

        try {
            const respuesta = await fetch("../php/roles_permisos.php", {
                method: "POST",
                body: form,
                credentials: "same-origin"
            });
            const resultado = await respuesta.json();

            if (respuesta.ok && resultado.ok && resultado.matriz) {
                matrizGuardadaPermisos = resultado.matriz;
                renderizarMatrizPermisos(catalogoRolesPermisos, matrizGuardadaPermisos);
                mostrarMensajeRoles(resultado.mensaje || "Permisos guardados correctamente.", false);
                return;
            }

            mostrarMensajeRoles(resultado.mensaje || "No se pudieron actualizar los permisos.", true);
        } catch {
            mostrarMensajeRoles("Error de comunicación al guardar la matriz de permisos.", true);
        }
    });

    btnDescartar?.addEventListener("click", () => {
        if (!catalogoRolesPermisos || !matrizGuardadaPermisos) {
            return;
        }
        renderizarMatrizPermisos(catalogoRolesPermisos, matrizGuardadaPermisos);
        mostrarMensajeRoles("Se descartaron los cambios no guardados.", false);
    });
}

function mostrarMensajeRoles(texto, esError) {
    const alerta = document.getElementById("mensaje-roles-permisos");
    if (!alerta) {
        return;
    }
    alerta.textContent = texto;
    alerta.className = esError ? "alerta-admin alerta-admin-error" : "alerta-admin alerta-admin-exito";
    alerta.hidden = false;
}
