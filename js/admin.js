/**
 * NewsCMS - Script del panel administrativo
 * Verifica la sesión en el servidor, carga estadísticas reales y gestiona la navegación.
 */

let csrfTokenActual = "";

document.addEventListener("DOMContentLoaded", () => {
    iniciarPanel();
});

/**
 * Comprueba la sesión en php/comprobar_sesion.php antes de mostrar el panel.
 */
async function iniciarPanel() {
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

        csrfTokenActual = datos.csrf_token || "";
        const permisos = datos.permisos || {};

        mostrarDatosUsuario(datos.usuario);
        renderizarModulos(datos.modulos_permitidos || ["Dashboard"]);
        inicializarSidebarMovil();
        inicializarCierreSesion();

        if (datos.permisos && !permisos.crear_noticias) {
            document.querySelectorAll('a[href="editar_noticia.html"]').forEach((enlace) => {
                enlace.hidden = true;
            });
        }

        const moduloUrl = new URLSearchParams(window.location.search).get("modulo");
        if (moduloUrl === "Configuración") {
            window.location.href = "configuracion.html";
            return;
        }
        if (moduloUrl && moduloUrl !== "Dashboard") {
            const botonDestino = document.querySelector(`.boton-modulo[data-modulo="${CSS.escape(moduloUrl)}"]`);
            if (botonDestino) {
                seleccionarModulo(moduloUrl, botonDestino);
            }
        }

        const contenedor = document.getElementById("contenedor-admin");
        if (contenedor) {
            contenedor.hidden = false;
        }

        if (!datos.permisos || permisos.ver_dashboard) {
            await cargarEstadisticas();
        } else {
            const bloqueStats = document.getElementById("bloque-estadisticas") || document.querySelector(".rejilla-estadisticas");
            if (bloqueStats) {
                bloqueStats.hidden = true;
            }
        }

        if (!datos.permisos || permisos.consultar_noticias_propias || permisos.consultar_noticias_ajenas) {
            await cargarTablaDashboard();
        } else {
            const panelTabla = document.querySelector(".panel-noticias-dashboard");
            if (panelTabla) {
                panelTabla.hidden = true;
            }
        }
    } catch {
        window.location.href = "../acceso.html";
    }
}

/**
 * Muestra el nombre y rol del usuario autenticado usando textContent.
 */
function mostrarDatosUsuario(usuario) {
    const elNombre = document.getElementById("nombre-usuario");
    const elRol = document.getElementById("rol-usuario");
    const elRolSidebar = document.getElementById("rol-sidebar");

    if (elNombre) {
        elNombre.textContent = usuario.nombre || "";
    }
    if (elRol) {
        elRol.textContent = usuario.rol || "";
    }
    if (elRolSidebar) {
        elRolSidebar.textContent = usuario.rol || "";
    }
}

/**
 * Construye los botones de módulos autorizados en la barra lateral.
 */
function renderizarModulos(modulosPermitidos) {
    const lista = document.getElementById("lista-modulos");
    if (!lista) {
        return;
    }

    lista.textContent = "";

    modulosPermitidos.forEach((modulo, indice) => {
        const li = document.createElement("li");
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = indice === 0 ? "boton-modulo activo" : "boton-modulo";
        boton.setAttribute("data-modulo", modulo);
        boton.textContent = modulo;

        boton.addEventListener("click", () => {
            if (modulo === "Noticias") {
                window.location.href = "noticias.html";
                return;
            }
            if (modulo === "Categorías") {
                window.location.href = "categorias.html";
                return;
            }
            if (modulo === "Etiquetas") {
                window.location.href = "etiquetas.html";
                return;
            }
            if (modulo === "Revisión editorial") {
                window.location.href = "revision.html";
                return;
            }
            if (modulo === "Usuarios") {
                window.location.href = "usuarios.html";
                return;
            }
            if (modulo === "Complementos") {
                window.location.href = "complementos.html";
                return;
            }
            if (modulo === "Temas") {
                window.location.href = "temas.html";
                return;
            }
            if (modulo === "Configuración") {
                window.location.href = "configuracion.html";
                return;
            }
            seleccionarModulo(modulo, boton);
        });

        li.appendChild(boton);
        lista.appendChild(li);
    });
}

/**
 * Cambia entre el Dashboard y los módulos pendientes autorizados.
 */
function seleccionarModulo(modulo, botonActivo) {
    const botones = document.querySelectorAll(".boton-modulo");
    const tituloModulo = document.getElementById("titulo-modulo");
    const vistaDashboard = document.getElementById("vista-dashboard");
    const vistaModuloVacio = document.getElementById("vista-modulo-vacio");
    const nombreModuloDetalle = document.getElementById("nombre-modulo-detalle");
    const descripcionModuloDetalle = document.getElementById("descripcion-modulo-detalle");
    const barraLateral = document.getElementById("barra-lateral");
    const botonSidebar = document.getElementById("boton-sidebar");

    const descripciones = {
        "Noticias": "Este módulo permitirá redactar, editar y administrar las noticias del portal.",
        "Categorías": "Este módulo permitirá gestionar las secciones temáticas del sitio.",
        "Etiquetas": "Este módulo permitirá organizar etiquetas para clasificar artículos.",
        "Revisión editorial": "Este módulo permitirá revisar y aprobar borradores antes de publicarlos.",
        "Usuarios": "Este módulo permitirá administrar cuentas y roles del sistema.",
        "Complementos": "Este módulo permitirá activar o desactivar extensiones de NewsCMS.",
        "Temas": "Este módulo permitirá configurar la apariencia visual del portal.",
        "Configuración": "Este módulo permitirá ajustar los parámetros generales del CMS."
    };

    botones.forEach((item) => item.classList.remove("activo"));
    botonActivo.classList.add("activo");

    if (tituloModulo) {
        tituloModulo.textContent = modulo;
    }

    if (modulo === "Dashboard") {
        vistaDashboard.classList.remove("oculto");
        vistaModuloVacio.classList.add("oculto");
    } else {
        vistaDashboard.classList.add("oculto");
        vistaModuloVacio.classList.remove("oculto");
        if (nombreModuloDetalle) {
            nombreModuloDetalle.textContent = modulo;
        }
        if (descripcionModuloDetalle) {
            descripcionModuloDetalle.textContent =
                descripciones[modulo] || "Módulo pendiente de desarrollo en próximas fases.";
        }
    }

    if (barraLateral && barraLateral.classList.contains("abierta")) {
        barraLateral.classList.remove("abierta");
        if (botonSidebar) {
            botonSidebar.setAttribute("aria-expanded", "false");
        }
    }
}

/**
 * Obtiene las estadísticas reales desde php/estadisticas.php mediante fetch().
 */
async function cargarEstadisticas() {
    try {
        const respuesta = await fetch("../php/estadisticas.php", {
            credentials: "same-origin"
        });

        if (respuesta.status === 401) {
            window.location.href = "../acceso.html";
            return;
        }

        if (!respuesta.ok) {
            return;
        }

        const datos = await respuesta.json();
        if (!datos.ok) {
            return;
        }

        const total = Number(datos.total_noticias ?? 0);
        const publicadas = Number(datos.noticias_publicadas ?? 0);
        const pendientes = Number(datos.noticias_pendientes ?? 0);
        const usuarios = Number(datos.total_usuarios ?? 0);

        document.getElementById("stat-total-noticias").textContent = String(total);
        document.getElementById("stat-noticias-publicadas").textContent = String(publicadas);
        document.getElementById("stat-noticias-pendientes").textContent = String(pendientes);
        document.getElementById("stat-total-usuarios").textContent = String(usuarios);

        const etiquetaTabla = document.getElementById("etiqueta-tabla");
        if (etiquetaTabla) {
            etiquetaTabla.textContent = total === 0 ? "Estado: vacía" : `Estado: ${total} registros`;
        }
    } catch {
        // Mantener valores en 0 si no se pudo consultar el servidor
    }
}

/**
 * Carga las noticias recientes en la tabla del Dashboard desde MySQL.
 */
async function cargarTablaDashboard() {
    const cuerpo = document.getElementById("cuerpo-tabla-dashboard");
    if (!cuerpo) {
        return;
    }

    try {
        const respuesta = await fetch("../php/noticias.php?modo=admin_lista", {
            credentials: "same-origin"
        });
        if (!respuesta.ok) {
            return;
        }

        const datos = await respuesta.json();
        const noticias = (datos.noticias || []).slice(0, 5);
        if (noticias.length === 0) {
            return;
        }

        const etiquetasEstado = {
            borrador: "Borrador",
            pendiente_revision: "Pendiente de revisión",
            cambios_solicitados: "Cambios solicitados",
            publicada: "Publicada",
            archivada: "Archivada"
        };

        cuerpo.textContent = "";
        noticias.forEach((n) => {
            const tr = document.createElement("tr");

            const tdTitulo = document.createElement("td");
            tdTitulo.className = "celda-titulo-dash";
            tdTitulo.setAttribute("data-etiqueta", "Título");
            const spanTitulo = document.createElement("span");
            spanTitulo.className = "titulo-noticia-dash";
            spanTitulo.textContent = n.titulo;
            tdTitulo.appendChild(spanTitulo);

            const tdCategoria = document.createElement("td");
            tdCategoria.setAttribute("data-etiqueta", "Categoría");
            const chipCat = document.createElement("span");
            chipCat.className = "chip-categoria-dash";
            chipCat.textContent = n.categoria;
            tdCategoria.appendChild(chipCat);

            const tdAutor = document.createElement("td");
            tdAutor.className = "celda-autor-dash";
            tdAutor.setAttribute("data-etiqueta", "Autor");
            tdAutor.textContent = n.autor;

            const tdEstado = document.createElement("td");
            tdEstado.className = "celda-estado-dash";
            tdEstado.setAttribute("data-etiqueta", "Estado");
            const badge = document.createElement("span");
            badge.className = `estado-badge estado-${n.estado}`;
            badge.textContent = etiquetasEstado[n.estado] || n.estado;
            tdEstado.appendChild(badge);

            const tdFecha = document.createElement("td");
            tdFecha.className = "celda-fecha-dash";
            tdFecha.setAttribute("data-etiqueta", "Fecha");
            const fechaBase = n.fecha_publicacion || n.fecha_creacion || "";
            tdFecha.textContent = fechaBase ? fechaBase.slice(0, 10) : "-";

            const tdAcciones = document.createElement("td");
            tdAcciones.className = "celda-acciones celda-acciones-dash";
            tdAcciones.setAttribute("data-etiqueta", "Acciones");
            if (n.puede_editar) {
                const aEdit = document.createElement("a");
                aEdit.href = `editar_noticia.html?id=${encodeURIComponent(n.id)}`;
                aEdit.className = "enlace-accion";
                aEdit.textContent = "Editar";
                tdAcciones.appendChild(aEdit);
            }
            const aVer = document.createElement("a");
            aVer.href = `../noticia.html?id=${encodeURIComponent(n.id)}`;
            aVer.className = "enlace-accion enlace-ver";
            aVer.textContent = "Ver";
            tdAcciones.appendChild(aVer);

            tr.appendChild(tdTitulo);
            tr.appendChild(tdCategoria);
            tr.appendChild(tdAutor);
            tr.appendChild(tdEstado);
            tr.appendChild(tdFecha);
            tr.appendChild(tdAcciones);
            cuerpo.appendChild(tr);
        });
    } catch {
        // Mantener mensaje por defecto si falla la consulta
    }
}

/**
 * Muestra u oculta la barra lateral en pantallas pequeñas.
 */
function inicializarSidebarMovil() {
    const botonSidebar = document.getElementById("boton-sidebar");
    const barraLateral = document.getElementById("barra-lateral");

    if (!botonSidebar || !barraLateral) {
        return;
    }

    botonSidebar.addEventListener("click", () => {
        const abierta = barraLateral.classList.toggle("abierta");
        botonSidebar.setAttribute("aria-expanded", abierta ? "true" : "false");
    });
}

/**
 * Envía la solicitud POST protegida por CSRF para cerrar sesión.
 */
function inicializarCierreSesion() {
    const botonSalir = document.getElementById("boton-salir");
    if (!botonSalir) {
        return;
    }

    botonSalir.addEventListener("click", async () => {
        const datosFormulario = new FormData();
        datosFormulario.append("csrf_token", csrfTokenActual);

        try {
            const respuesta = await fetch("../php/cerrar_sesion.php", {
                method: "POST",
                body: datosFormulario,
                credentials: "same-origin"
            });

            if (respuesta.ok) {
                const datos = await respuesta.json();
                window.location.href = datos.redirigir || "../acceso.html";
                return;
            }
        } catch {
            // Redirigir a acceso.html en caso de fallo de red
        }

        window.location.href = "../acceso.html";
    });
}
