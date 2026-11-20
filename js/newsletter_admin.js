/**
 * NewsCMS - Script administrativo del complemento Newsletter
 */

let csrfTokenNewsletter = "";
let correoDisponibleServidor = false;
let mensajeCorreoServidor = "";
let suscriptoresActivosGlobales = 0;
let vistaActivaNewsletter = "boletines";
let envioFormularioEnCurso = false;
let despachoEnCurso = false;

const POR_PAGINA_NEWSLETTER = 10;

const estadoBoletines = {
    pagina: 1,
    totalPaginas: 0,
    total: 0,
    secuencia: 0,
    temporizador: null,
    controlador: null,
    cargadoAlgunaVez: false
};

const estadoSuscriptores = {
    pagina: 1,
    totalPaginas: 0,
    total: 0,
    secuencia: 0,
    temporizador: null,
    controlador: null,
    cargadoAlgunaVez: false
};

document.addEventListener("DOMContentLoaded", () => {
    iniciarNewsletterAdmin();
});

async function iniciarNewsletterAdmin() {
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

        csrfTokenNewsletter = datos.csrf_token || "";
        mostrarCabeceraNewsletter(datos.usuario);
        renderizarSidebarNewsletter(datos.modulos_permitidos || ["Dashboard"]);
        inicializarSidebarMovilNewsletter();
        inicializarSalirNewsletter();
        inicializarPestanasNewsletter();
        inicializarControlesListadosNewsletter();
        inicializarFormularioBoletin();

        document.getElementById("contenedor-admin").hidden = false;
        await cargarBoletinesAdmin();
    } catch {
        window.location.href = "../acceso.html";
    }
}

function mostrarCabeceraNewsletter(usuario) {
    document.getElementById("nombre-usuario").textContent = usuario.nombre || "";
    document.getElementById("rol-usuario").textContent = usuario.rol || "";
    document.getElementById("rol-sidebar").textContent = usuario.rol || "";
}

function renderizarSidebarNewsletter(modulos) {
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

function inicializarPestanasNewsletter() {
    const tabBoletines = document.getElementById("tab-boletines");
    const tabSuscriptores = document.getElementById("tab-suscriptores");

    tabBoletines?.addEventListener("click", () => cambiarVistaNewsletter("boletines"));
    tabSuscriptores?.addEventListener("click", () => cambiarVistaNewsletter("suscriptores"));

    const pestanas = [tabBoletines, tabSuscriptores].filter(Boolean);
    pestanas.forEach((tab, idx) => {
        tab.addEventListener("keydown", (e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                const siguiente = pestanas[(idx + 1) % pestanas.length];
                siguiente.focus();
                cambiarVistaNewsletter(siguiente.id === "tab-suscriptores" ? "suscriptores" : "boletines");
            }
        });
    });
}

function cambiarVistaNewsletter(vista) {
    vistaActivaNewsletter = vista === "suscriptores" ? "suscriptores" : "boletines";

    const tabBoletines = document.getElementById("tab-boletines");
    const tabSuscriptores = document.getElementById("tab-suscriptores");
    const vistaBoletines = document.getElementById("vista-boletines");
    const vistaSuscriptores = document.getElementById("vista-suscriptores");

    const verSuscriptores = vistaActivaNewsletter === "suscriptores";

    tabBoletines?.classList.toggle("activa", !verSuscriptores);
    tabBoletines?.setAttribute("aria-selected", verSuscriptores ? "false" : "true");

    tabSuscriptores?.classList.toggle("activa", verSuscriptores);
    tabSuscriptores?.setAttribute("aria-selected", verSuscriptores ? "true" : "false");

    if (vistaBoletines) vistaBoletines.hidden = verSuscriptores;
    if (vistaSuscriptores) vistaSuscriptores.hidden = !verSuscriptores;

    if (verSuscriptores) {
        if (!estadoSuscriptores.cargadoAlgunaVez) {
            cargarSuscriptoresAdmin();
        }
    } else if (!estadoBoletines.cargadoAlgunaVez) {
        cargarBoletinesAdmin();
    }
}

function inicializarControlesListadosNewsletter() {
    enlazarControlesListado({
        inputId: "filtro-busqueda-boletin",
        btnLimpiarId: "btn-limpiar-busqueda-boletin",
        selectEstadoId: "filtro-estado-boletin",
        btnPrimeraId: "btn-boletines-primera",
        btnAnteriorId: "btn-boletines-anterior",
        btnSiguienteId: "btn-boletines-siguiente",
        btnUltimaId: "btn-boletines-ultima",
        estadoObj: estadoBoletines,
        cargarFn: cargarBoletinesAdmin
    });

    enlazarControlesListado({
        inputId: "filtro-busqueda-suscriptor",
        btnLimpiarId: "btn-limpiar-busqueda-suscriptor",
        selectEstadoId: "filtro-estado-suscriptor",
        btnPrimeraId: "btn-suscriptores-primera",
        btnAnteriorId: "btn-suscriptores-anterior",
        btnSiguienteId: "btn-suscriptores-siguiente",
        btnUltimaId: "btn-suscriptores-ultima",
        estadoObj: estadoSuscriptores,
        cargarFn: cargarSuscriptoresAdmin
    });
}

function enlazarControlesListado(cfg) {
    const input = document.getElementById(cfg.inputId);
    const btnLimpiar = document.getElementById(cfg.btnLimpiarId);
    const selectEstado = document.getElementById(cfg.selectEstadoId);
    const btnPrimera = document.getElementById(cfg.btnPrimeraId);
    const btnAnterior = document.getElementById(cfg.btnAnteriorId);
    const btnSiguiente = document.getElementById(cfg.btnSiguienteId);
    const btnUltima = document.getElementById(cfg.btnUltimaId);

    const ejecutarAhora = () => {
        if (cfg.estadoObj.temporizador) {
            clearTimeout(cfg.estadoObj.temporizador);
            cfg.estadoObj.temporizador = null;
        }
        if (btnLimpiar && input) {
            btnLimpiar.hidden = input.value.trim() === "";
        }
        cfg.estadoObj.pagina = 1;
        cfg.cargarFn();
    };

    input?.addEventListener("input", () => {
        if (btnLimpiar) {
            btnLimpiar.hidden = input.value.trim() === "";
        }
        if (cfg.estadoObj.temporizador) {
            clearTimeout(cfg.estadoObj.temporizador);
        }
        cfg.estadoObj.pagina = 1;
        cfg.estadoObj.temporizador = setTimeout(() => {
            cfg.estadoObj.temporizador = null;
            cfg.cargarFn();
        }, 240);
    });

    input?.addEventListener("search", ejecutarAhora);

    btnLimpiar?.addEventListener("click", () => {
        if (input) {
            input.value = "";
            input.focus();
        }
        btnLimpiar.hidden = true;
        cfg.estadoObj.pagina = 1;
        cfg.cargarFn();
    });

    selectEstado?.addEventListener("change", () => {
        cfg.estadoObj.pagina = 1;
        cfg.cargarFn();
    });

    btnPrimera?.addEventListener("click", () => {
        if (cfg.estadoObj.pagina > 1) {
            cfg.estadoObj.pagina = 1;
            cfg.cargarFn();
        }
    });

    btnAnterior?.addEventListener("click", () => {
        if (cfg.estadoObj.pagina > 1) {
            cfg.estadoObj.pagina--;
            cfg.cargarFn();
        }
    });

    btnSiguiente?.addEventListener("click", () => {
        if (cfg.estadoObj.pagina < cfg.estadoObj.totalPaginas) {
            cfg.estadoObj.pagina++;
            cfg.cargarFn();
        }
    });

    btnUltima?.addEventListener("click", () => {
        if (cfg.estadoObj.totalPaginas > 1 && cfg.estadoObj.pagina < cfg.estadoObj.totalPaginas) {
            cfg.estadoObj.pagina = cfg.estadoObj.totalPaginas;
            cfg.cargarFn();
        }
    });
}

function actualizarResumenGlobalNewsletter(datos) {
    const totalBoletines = Number(datos.total_boletines ?? 0);
    const totalSuscriptores = Number(datos.total_suscriptores ?? 0);
    const suscriptoresActivos = Number(datos.suscriptores_activos ?? 0);

    suscriptoresActivosGlobales = suscriptoresActivos;

    const elTotalBol = document.getElementById("stat-total-boletines");
    const elTotalSubs = document.getElementById("stat-total-suscriptores");
    const elActivos = document.getElementById("stat-suscriptores-activos");
    const badgeTabBol = document.getElementById("badge-tab-boletines");
    const badgeTabSubs = document.getElementById("badge-tab-suscriptores");

    if (elTotalBol) elTotalBol.textContent = String(totalBoletines);
    if (elTotalSubs) elTotalSubs.textContent = String(totalSuscriptores);
    if (elActivos) elActivos.textContent = String(suscriptoresActivos);
    if (badgeTabBol) badgeTabBol.textContent = String(totalBoletines);
    if (badgeTabSubs) badgeTabSubs.textContent = String(totalSuscriptores);

    if (typeof datos.correo_disponible === "boolean") {
        correoDisponibleServidor = datos.correo_disponible;
        mensajeCorreoServidor = datos.mensaje_correo || "";
        sincronizarEstadoDespachoComposer();
    }
}

function sincronizarEstadoDespachoComposer() {
    const avisoCorreo = document.getElementById("aviso-servicio-correo");
    const btnEnviar = document.getElementById("btn-enviar-boletin");
    const notaDespacho = document.getElementById("nota-despacho-boletin");

    if (avisoCorreo) {
        if (!correoDisponibleServidor) {
            avisoCorreo.textContent = mensajeCorreoServidor || "El servicio de envío de correos no está disponible en este momento.";
            avisoCorreo.hidden = false;
        } else {
            avisoCorreo.textContent = "";
            avisoCorreo.hidden = true;
        }
    }

    if (btnEnviar && !despachoEnCurso) {
        btnEnviar.disabled = !correoDisponibleServidor;
    }

    if (notaDespacho) {
        if (!correoDisponibleServidor) {
            notaDespacho.textContent = "El envío quedará bloqueado hasta que el servicio de correo esté operativo.";
        } else if (suscriptoresActivosGlobales === 0) {
            notaDespacho.textContent = "Actualmente no hay suscriptores activos para recibir envíos.";
        } else if (suscriptoresActivosGlobales === 1) {
            notaDespacho.textContent = "Este envío remitirá un correo individual al suscriptor activo actual.";
        } else {
            notaDespacho.textContent = `Este envío remitirá correos individuales a los ${suscriptoresActivosGlobales} suscriptores activos.`;
        }
    }
}

async function cargarBoletinesAdmin() {
    const cuerpo = document.getElementById("cuerpo-tabla-boletines");
    const totalEl = document.getElementById("total-boletines");
    const resumenEl = document.getElementById("resumen-resultados-boletines");

    const q = (document.getElementById("filtro-busqueda-boletin")?.value || "").trim();
    const estado = document.getElementById("filtro-estado-boletin")?.value || "";
    const hayFiltros = q !== "" || estado !== "";

    const miSecuencia = ++estadoBoletines.secuencia;
    if (estadoBoletines.controlador) {
        estadoBoletines.controlador.abort();
    }
    estadoBoletines.controlador = typeof AbortController !== "undefined" ? new AbortController() : null;

    if (cuerpo) {
        renderizarFilaCargaNewsletter(cuerpo, 4, "Cargando boletines...");
    }

    const params = new URLSearchParams({
        modo: "admin_boletines",
        pagina: String(estadoBoletines.pagina),
        por_pagina: String(POR_PAGINA_NEWSLETTER)
    });
    if (q !== "") params.set("q", q);
    if (estado !== "") params.set("estado", estado);

    try {
        const respuesta = await fetch(`../php/newsletter.php?${params.toString()}`, {
            credentials: "same-origin",
            signal: estadoBoletines.controlador ? estadoBoletines.controlador.signal : undefined
        });

        let datos = null;
        try {
            datos = await respuesta.json();
        } catch {
            datos = null;
        }

        if (miSecuencia !== estadoBoletines.secuencia) {
            return;
        }

        if (!respuesta.ok || !datos || datos.ok !== true || !Array.isArray(datos.boletines)) {
            const msgErr = (datos && datos.mensaje) ? datos.mensaje : "No se pudieron cargar los boletines.";
            renderizarEstadoTablaNewsletter(cuerpo, 4, {
                esError: true,
                titulo: "Error al cargar boletines",
                mensaje: msgErr,
                textoAccion: "Reintentar",
                alPulsar: cargarBoletinesAdmin
            });
            ocultarPaginacionNewsletter("paginacion-boletines");
            return;
        }

        estadoBoletines.cargadoAlgunaVez = true;
        actualizarResumenGlobalNewsletter(datos);

        const boletines = datos.boletines;
        const totalFiltrado = Number(datos.total ?? boletines.length);
        const totalGlobal = Number(datos.total_boletines ?? totalFiltrado);
        const porPagina = Number(datos.por_pagina ?? POR_PAGINA_NEWSLETTER);
        estadoBoletines.pagina = Number(datos.pagina ?? 1);
        estadoBoletines.totalPaginas = Number(datos.total_paginas ?? 0);
        estadoBoletines.total = totalFiltrado;

        if (totalEl) {
            totalEl.textContent = totalGlobal === 1 ? "1 boletín" : `${totalGlobal} boletines`;
        }

        if (resumenEl) {
            resumenEl.textContent = hayFiltros
                ? `Resultados de búsqueda: ${totalFiltrado} de ${totalGlobal}`
                : "Orden cronológico reciente";
        }

        actualizarPaginacionNewsletter({
            bloqueId: "paginacion-boletines",
            infoId: "info-paginacion-boletines",
            detalleId: "detalle-pagina-boletines",
            controlesId: "controles-paginacion-boletines",
            numerosId: "numeros-paginacion-boletines",
            btnPrimeraId: "btn-boletines-primera",
            btnAnteriorId: "btn-boletines-anterior",
            btnSiguienteId: "btn-boletines-siguiente",
            btnUltimaId: "btn-boletines-ultima",
            sustantivoSingular: "boletín",
            sustantivoPlural: "boletines",
            totalFiltrado,
            pagina: estadoBoletines.pagina,
            porPagina,
            totalPaginas: estadoBoletines.totalPaginas,
            irAPagina: (nuevaPagina) => {
                estadoBoletines.pagina = nuevaPagina;
                cargarBoletinesAdmin();
            }
        });

        if (!cuerpo) {
            return;
        }
        cuerpo.textContent = "";

        if (boletines.length === 0) {
            renderizarEstadoTablaNewsletter(cuerpo, 4, {
                esError: false,
                titulo: hayFiltros
                    ? "No se encontraron boletines con esos filtros."
                    : "Aún no hay boletines registrados.",
                mensaje: hayFiltros
                    ? "Prueba con otro término en el asunto o cambia el filtro de estado."
                    : "Pulsa «+ Nuevo boletín» para redactar el primer borrador.",
                textoAccion: hayFiltros ? "Limpiar filtros" : "",
                alPulsar: hayFiltros ? limpiarFiltrosBoletines : null
            });
            return;
        }

        boletines.forEach((b) => {
            cuerpo.appendChild(construirFilaBoletin(b));
        });
    } catch (error) {
        if (error && error.name === "AbortError") {
            return;
        }
        if (miSecuencia === estadoBoletines.secuencia) {
            renderizarEstadoTablaNewsletter(cuerpo, 4, {
                esError: true,
                titulo: "Error de conexión",
                mensaje: "No se pudo consultar el listado de boletines.",
                textoAccion: "Reintentar",
                alPulsar: cargarBoletinesAdmin
            });
            ocultarPaginacionNewsletter("paginacion-boletines");
        }
    }
}

function construirFilaBoletin(b) {
    const tr = document.createElement("tr");

    const tdAsunto = document.createElement("td");
    tdAsunto.dataset.etiqueta = "Asunto";
    const spanAsunto = document.createElement("strong");
    spanAsunto.className = "asunto-boletin-fila";
    spanAsunto.textContent = b.asunto || "";
    tdAsunto.appendChild(spanAsunto);

    const tdEstado = document.createElement("td");
    tdEstado.dataset.etiqueta = "Estado";
    const badge = document.createElement("span");
    const esEnviado = b.estado === "enviado";
    badge.className = esEnviado ? "estado-badge estado-publicada" : "estado-badge estado-borrador";
    badge.textContent = esEnviado ? "Enviado" : "Borrador";
    tdEstado.appendChild(badge);

    const tdFecha = document.createElement("td");
    tdFecha.dataset.etiqueta = "Fecha";
    const fechaRaw = (esEnviado ? b.fecha_envio : b.fecha_creacion) || b.fecha_creacion || "";
    tdFecha.textContent = fechaRaw ? fechaRaw.slice(0, 10) : "-";
    if (fechaRaw) {
        tdFecha.title = esEnviado ? `Enviado: ${fechaRaw}` : `Creado: ${fechaRaw}`;
    }

    const tdAcciones = document.createElement("td");
    tdAcciones.dataset.etiqueta = "Acciones";
    tdAcciones.className = "celda-acciones celda-acciones-newsletter";
    if (!esEnviado) {
        const btnEditar = document.createElement("button");
        btnEditar.type = "button";
        btnEditar.className = "enlace-accion";
        btnEditar.textContent = "Editar";
        btnEditar.addEventListener("click", () => abrirEdicionBoletin(b));
        tdAcciones.appendChild(btnEditar);
    } else {
        const spanCerrado = document.createElement("span");
        spanCerrado.className = "nota-boletin-enviado";
        spanCerrado.textContent = "Enviado";
        tdAcciones.appendChild(spanCerrado);
    }

    tr.appendChild(tdAsunto);
    tr.appendChild(tdEstado);
    tr.appendChild(tdFecha);
    tr.appendChild(tdAcciones);
    return tr;
}

function limpiarFiltrosBoletines() {
    const input = document.getElementById("filtro-busqueda-boletin");
    const btnX = document.getElementById("btn-limpiar-busqueda-boletin");
    const select = document.getElementById("filtro-estado-boletin");
    if (input) input.value = "";
    if (btnX) btnX.hidden = true;
    if (select) select.value = "";
    estadoBoletines.pagina = 1;
    cargarBoletinesAdmin();
}

async function cargarSuscriptoresAdmin() {
    const cuerpo = document.getElementById("cuerpo-tabla-suscriptores");
    const totalEl = document.getElementById("total-suscriptores-vista");
    const resumenEl = document.getElementById("resumen-resultados-suscriptores");

    const q = (document.getElementById("filtro-busqueda-suscriptor")?.value || "").trim();
    const estado = document.getElementById("filtro-estado-suscriptor")?.value || "";
    const hayFiltros = q !== "" || estado !== "";

    const miSecuencia = ++estadoSuscriptores.secuencia;
    if (estadoSuscriptores.controlador) {
        estadoSuscriptores.controlador.abort();
    }
    estadoSuscriptores.controlador = typeof AbortController !== "undefined" ? new AbortController() : null;

    if (cuerpo) {
        renderizarFilaCargaNewsletter(cuerpo, 3, "Cargando suscriptores...");
    }

    const params = new URLSearchParams({
        modo: "admin_suscriptores",
        pagina: String(estadoSuscriptores.pagina),
        por_pagina: String(POR_PAGINA_NEWSLETTER)
    });
    if (q !== "") params.set("q", q);
    if (estado !== "") params.set("estado", estado);

    try {
        const respuesta = await fetch(`../php/newsletter.php?${params.toString()}`, {
            credentials: "same-origin",
            signal: estadoSuscriptores.controlador ? estadoSuscriptores.controlador.signal : undefined
        });

        let datos = null;
        try {
            datos = await respuesta.json();
        } catch {
            datos = null;
        }

        if (miSecuencia !== estadoSuscriptores.secuencia) {
            return;
        }

        if (!respuesta.ok || !datos || datos.ok !== true || !Array.isArray(datos.suscriptores)) {
            const msgErr = (datos && datos.mensaje) ? datos.mensaje : "No se pudieron cargar los suscriptores.";
            renderizarEstadoTablaNewsletter(cuerpo, 3, {
                esError: true,
                titulo: "Error al cargar suscriptores",
                mensaje: msgErr,
                textoAccion: "Reintentar",
                alPulsar: cargarSuscriptoresAdmin
            });
            ocultarPaginacionNewsletter("paginacion-suscriptores");
            return;
        }

        estadoSuscriptores.cargadoAlgunaVez = true;
        actualizarResumenGlobalNewsletter(datos);

        const suscriptores = datos.suscriptores;
        const totalFiltrado = Number(datos.total ?? suscriptores.length);
        const totalGlobal = Number(datos.total_suscriptores ?? totalFiltrado);
        const porPagina = Number(datos.por_pagina ?? POR_PAGINA_NEWSLETTER);
        estadoSuscriptores.pagina = Number(datos.pagina ?? 1);
        estadoSuscriptores.totalPaginas = Number(datos.total_paginas ?? 0);
        estadoSuscriptores.total = totalFiltrado;

        if (totalEl) {
            totalEl.textContent = totalGlobal === 1 ? "1 suscriptor" : `${totalGlobal} suscriptores`;
        }

        if (resumenEl) {
            resumenEl.textContent = hayFiltros
                ? `Resultados de búsqueda: ${totalFiltrado} de ${totalGlobal}`
                : "Orden cronológico reciente";
        }

        actualizarPaginacionNewsletter({
            bloqueId: "paginacion-suscriptores",
            infoId: "info-paginacion-suscriptores",
            detalleId: "detalle-pagina-suscriptores",
            controlesId: "controles-paginacion-suscriptores",
            numerosId: "numeros-paginacion-suscriptores",
            btnPrimeraId: "btn-suscriptores-primera",
            btnAnteriorId: "btn-suscriptores-anterior",
            btnSiguienteId: "btn-suscriptores-siguiente",
            btnUltimaId: "btn-suscriptores-ultima",
            sustantivoSingular: "suscriptor",
            sustantivoPlural: "suscriptores",
            totalFiltrado,
            pagina: estadoSuscriptores.pagina,
            porPagina,
            totalPaginas: estadoSuscriptores.totalPaginas,
            irAPagina: (nuevaPagina) => {
                estadoSuscriptores.pagina = nuevaPagina;
                cargarSuscriptoresAdmin();
            }
        });

        if (!cuerpo) {
            return;
        }
        cuerpo.textContent = "";

        if (suscriptores.length === 0) {
            renderizarEstadoTablaNewsletter(cuerpo, 3, {
                esError: false,
                titulo: hayFiltros
                    ? "No se encontraron suscriptores con esos filtros."
                    : "Aún no hay suscriptores registrados.",
                mensaje: hayFiltros
                    ? "Prueba con otro correo o cambia el filtro de estado."
                    : "Cuando los lectores se suscriban desde el portal aparecerán en este listado.",
                textoAccion: hayFiltros ? "Limpiar filtros" : "",
                alPulsar: hayFiltros ? limpiarFiltrosSuscriptores : null
            });
            return;
        }

        suscriptores.forEach((s) => {
            cuerpo.appendChild(construirFilaSuscriptor(s));
        });
    } catch (error) {
        if (error && error.name === "AbortError") {
            return;
        }
        if (miSecuencia === estadoSuscriptores.secuencia) {
            renderizarEstadoTablaNewsletter(cuerpo, 3, {
                esError: true,
                titulo: "Error de conexión",
                mensaje: "No se pudo consultar el listado de suscriptores.",
                textoAccion: "Reintentar",
                alPulsar: cargarSuscriptoresAdmin
            });
            ocultarPaginacionNewsletter("paginacion-suscriptores");
        }
    }
}

function construirFilaSuscriptor(s) {
    const tr = document.createElement("tr");

    const tdCorreo = document.createElement("td");
    tdCorreo.dataset.etiqueta = "Correo electrónico";
    tdCorreo.className = "celda-correo-suscriptor";
    tdCorreo.textContent = s.correo || "";

    const tdEstado = document.createElement("td");
    tdEstado.dataset.etiqueta = "Estado";
    const badge = document.createElement("span");
    const esActivo = s.estado === "activo";
    badge.className = esActivo ? "estado-badge estado-publicada" : "estado-badge estado-borrador";
    badge.textContent = esActivo ? "Activo" : "Inactivo";
    tdEstado.appendChild(badge);

    const tdFecha = document.createElement("td");
    tdFecha.dataset.etiqueta = "Fecha de registro";
    const fechaReg = s.fecha_registro || "";
    tdFecha.textContent = fechaReg ? fechaReg.slice(0, 10) : "-";
    if (fechaReg) {
        tdFecha.title = s.fecha_baja
            ? `Registro: ${fechaReg} | Baja: ${s.fecha_baja}`
            : `Registro: ${fechaReg}`;
    }

    tr.appendChild(tdCorreo);
    tr.appendChild(tdEstado);
    tr.appendChild(tdFecha);
    return tr;
}

function limpiarFiltrosSuscriptores() {
    const input = document.getElementById("filtro-busqueda-suscriptor");
    const btnX = document.getElementById("btn-limpiar-busqueda-suscriptor");
    const select = document.getElementById("filtro-estado-suscriptor");
    if (input) input.value = "";
    if (btnX) btnX.hidden = true;
    if (select) select.value = "";
    estadoSuscriptores.pagina = 1;
    cargarSuscriptoresAdmin();
}

function renderizarFilaCargaNewsletter(cuerpo, colSpan, texto) {
    cuerpo.textContent = "";
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = colSpan;
    td.className = "fila-vacia";
    td.textContent = texto;
    tr.appendChild(td);
    cuerpo.appendChild(tr);
}

function renderizarEstadoTablaNewsletter(cuerpo, colSpan, cfg) {
    if (!cuerpo) {
        return;
    }
    cuerpo.textContent = "";

    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = colSpan;
    td.className = "celda-estado-newsletter";

    const caja = document.createElement("div");
    caja.className = cfg.esError
        ? "estado-lista-newsletter es-error"
        : "estado-lista-newsletter";

    const titulo = document.createElement("strong");
    titulo.textContent = cfg.titulo;
    caja.appendChild(titulo);

    if (cfg.mensaje) {
        const desc = document.createElement("p");
        desc.textContent = cfg.mensaje;
        caja.appendChild(desc);
    }

    if (cfg.textoAccion && typeof cfg.alPulsar === "function") {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "boton-secundario-admin";
        btn.textContent = cfg.textoAccion;
        btn.addEventListener("click", cfg.alPulsar);
        caja.appendChild(btn);
    }

    td.appendChild(caja);
    tr.appendChild(td);
    cuerpo.appendChild(tr);
}

function ocultarPaginacionNewsletter(bloqueId) {
    const bloque = document.getElementById(bloqueId);
    if (bloque) {
        bloque.hidden = true;
    }
}

function construirVentanaPaginasNewsletter(actual, total) {
    if (total <= 1) {
        return [];
    }
    const seleccion = new Set([1, total]);
    for (let i = actual - 1; i <= actual + 1; i++) {
        if (i >= 1 && i <= total) {
            seleccion.add(i);
        }
    }
    const ordenadas = Array.from(seleccion).sort((a, b) => a - b);
    const salida = [];
    ordenadas.forEach((n, idx) => {
        if (idx > 0 && n - ordenadas[idx - 1] > 1) {
            salida.push("...");
        }
        salida.push(n);
    });
    return salida;
}

function actualizarPaginacionNewsletter(cfg) {
    const bloque = document.getElementById(cfg.bloqueId);
    const infoEl = document.getElementById(cfg.infoId);
    const detalleEl = document.getElementById(cfg.detalleId);
    const controlesEl = document.getElementById(cfg.controlesId);
    const numerosEl = document.getElementById(cfg.numerosId);
    const btnPri = document.getElementById(cfg.btnPrimeraId);
    const btnAnt = document.getElementById(cfg.btnAnteriorId);
    const btnSig = document.getElementById(cfg.btnSiguienteId);
    const btnUlt = document.getElementById(cfg.btnUltimaId);

    if (!bloque) {
        return;
    }

    if (cfg.totalFiltrado <= 0 || cfg.totalPaginas <= 0) {
        bloque.hidden = true;
        return;
    }

    bloque.hidden = false;
    const inicio = (cfg.pagina - 1) * cfg.porPagina + 1;
    const fin = Math.min(cfg.pagina * cfg.porPagina, cfg.totalFiltrado);
    const palabra = cfg.totalFiltrado === 1 ? cfg.sustantivoSingular : cfg.sustantivoPlural;

    if (infoEl) {
        infoEl.textContent = `Mostrando ${inicio}\u2013${fin} de ${cfg.totalFiltrado} ${palabra}`;
    }
    if (detalleEl) {
        detalleEl.textContent = `Página ${cfg.pagina} de ${cfg.totalPaginas}`;
    }

    if (controlesEl) {
        controlesEl.hidden = cfg.totalPaginas <= 1;
    }

    if (cfg.totalPaginas <= 1) {
        if (numerosEl) numerosEl.textContent = "";
        return;
    }

    if (btnPri) btnPri.disabled = cfg.pagina <= 1;
    if (btnAnt) btnAnt.disabled = cfg.pagina <= 1;
    if (btnSig) btnSig.disabled = cfg.pagina >= cfg.totalPaginas;
    if (btnUlt) btnUlt.disabled = cfg.pagina >= cfg.totalPaginas;

    if (numerosEl) {
        numerosEl.textContent = "";
        construirVentanaPaginasNewsletter(cfg.pagina, cfg.totalPaginas).forEach((item) => {
            if (item === "...") {
                const span = document.createElement("span");
                span.className = "elipsis-paginacion-newsletter";
                span.setAttribute("aria-hidden", "true");
                span.textContent = "...";
                numerosEl.appendChild(span);
                return;
            }
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = item === cfg.pagina ? "btn-pagina-newsletter activa" : "btn-pagina-newsletter";
            btn.textContent = String(item);
            btn.setAttribute("aria-label", `Página ${item}`);
            if (item === cfg.pagina) {
                btn.setAttribute("aria-current", "page");
                btn.disabled = true;
            } else {
                btn.addEventListener("click", () => cfg.irAPagina(item));
            }
            numerosEl.appendChild(btn);
        });
    }
}

function inicializarFormularioBoletin() {
    const btnNuevo = document.getElementById("btn-nuevo-boletin");
    const btnCancelar = document.getElementById("btn-cancelar-boletin");
    const btnPrevia = document.getElementById("btn-vista-previa-boletin");
    const btnEnviar = document.getElementById("btn-enviar-boletin");
    const formulario = document.getElementById("formulario-boletin");

    btnNuevo?.addEventListener("click", abrirNuevoBoletin);
    btnCancelar?.addEventListener("click", cerrarRedaccionBoletin);

    btnPrevia?.addEventListener("click", () => {
        const asunto = document.getElementById("boletin-asunto").value.trim();
        const contenido = document.getElementById("boletin-contenido").value.trim();
        const cajaPrevia = document.getElementById("vista-previa-boletin");
        const elAsunto = document.getElementById("previa-asunto");
        const elCuerpo = document.getElementById("previa-cuerpo");

        elAsunto.textContent = asunto || "(Sin asunto)";
        elCuerpo.textContent = "";

        const lineas = contenido.split(/\r?\n/);
        lineas.forEach((linea) => {
            if (linea.trim() !== "") {
                const p = document.createElement("p");
                p.textContent = linea;
                elCuerpo.appendChild(p);
            }
        });

        if (elCuerpo.childElementCount === 0) {
            const vacio = document.createElement("p");
            vacio.textContent = "(Sin contenido)";
            elCuerpo.appendChild(vacio);
        }

        cajaPrevia.hidden = false;
    });

    formulario?.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (envioFormularioEnCurso || despachoEnCurso) {
            return;
        }

        const id = document.getElementById("boletin-id").value;
        const asuntoEl = document.getElementById("boletin-asunto");
        const contenidoEl = document.getElementById("boletin-contenido");
        const asunto = (asuntoEl?.value || "").trim();
        const contenido = (contenidoEl?.value || "").trim();

        if (!asunto) {
            mostrarMensajeNewsletter("El asunto es obligatorio.", true);
            asuntoEl?.focus();
            return;
        }

        if (asunto.length > 180) {
            mostrarMensajeNewsletter("El asunto no puede superar los 180 caracteres.", true);
            asuntoEl?.focus();
            return;
        }

        if (!contenido) {
            mostrarMensajeNewsletter("El contenido del boletín es obligatorio.", true);
            contenidoEl?.focus();
            return;
        }

        const form = new FormData();
        form.append("csrf_token", csrfTokenNewsletter);
        form.append("accion", "guardar_boletin");
        form.append("id", id);
        form.append("asunto", asunto);
        form.append("contenido", contenido);

        const btnGuardar = document.getElementById("btn-guardar-borrador");
        envioFormularioEnCurso = true;
        if (btnGuardar) {
            btnGuardar.disabled = true;
            btnGuardar.textContent = "Guardando...";
        }

        try {
            const respuesta = await fetch("../php/newsletter.php", {
                method: "POST",
                body: form,
                credentials: "same-origin"
            });
            const resultado = await respuesta.json();

            if (respuesta.ok && resultado.ok) {
                const idFinal = String(resultado.id || id);
                document.getElementById("boletin-id").value = idFinal;
                document.getElementById("titulo-form-boletin").textContent = "Editar borrador";
                mostrarMensajeNewsletter(resultado.mensaje || "Borrador guardado.", false);
                await cargarBoletinesAdmin();
                return;
            }

            mostrarMensajeNewsletter(resultado.mensaje || "No se pudo guardar el boletín.", true);
        } catch {
            mostrarMensajeNewsletter("Error de comunicación con el servidor.", true);
        } finally {
            envioFormularioEnCurso = false;
            if (btnGuardar) {
                btnGuardar.disabled = false;
                btnGuardar.textContent = "Guardar borrador";
            }
        }
    });

    btnEnviar?.addEventListener("click", async () => {
        if (despachoEnCurso || envioFormularioEnCurso) {
            return;
        }

        if (!correoDisponibleServidor) {
            mostrarMensajeNewsletter(
                mensajeCorreoServidor || "No disponible: el servicio de envío no está listo en el servidor.",
                true
            );
            return;
        }

        const id = Number(document.getElementById("boletin-id").value || 0);
        if (id <= 0) {
            mostrarMensajeNewsletter("Guarda primero el borrador del boletín antes de enviarlo.", true);
            return;
        }

        const detalleDest = suscriptoresActivosGlobales > 0
            ? ` Se enviará un correo real a los ${suscriptoresActivosGlobales} suscriptores activos.`
            : " Se enviará a los suscriptores activos autorizados.";

        const confirmado = window.confirm(
            `¿Confirmas el envío de este boletín a los suscriptores activos?${detalleDest} Esta acción marcará el boletín como enviado.`
        );
        if (!confirmado) {
            return;
        }

        const form = new FormData();
        form.append("csrf_token", csrfTokenNewsletter);
        form.append("accion", "enviar_boletin");
        form.append("id", String(id));

        const btnGuardar = document.getElementById("btn-guardar-borrador");
        despachoEnCurso = true;
        btnEnviar.disabled = true;
        btnEnviar.textContent = "Enviando boletín...";
        if (btnGuardar) btnGuardar.disabled = true;

        try {
            const respuesta = await fetch("../php/newsletter.php", {
                method: "POST",
                body: form,
                credentials: "same-origin"
            });
            const resultado = await respuesta.json();
            const esError = !respuesta.ok || !resultado.ok;
            mostrarMensajeNewsletter(resultado.mensaje || "Operación completada.", esError);
            await cargarBoletinesAdmin();
            if (!esError) {
                cerrarRedaccionBoletin();
            }
        } catch {
            mostrarMensajeNewsletter("Error de comunicación con el servidor.", true);
        } finally {
            despachoEnCurso = false;
            btnEnviar.disabled = !correoDisponibleServidor;
            btnEnviar.textContent = "Enviar boletín a suscriptores";
            if (btnGuardar) btnGuardar.disabled = false;
        }
    });
}

function abrirNuevoBoletin() {
    document.getElementById("boletin-id").value = "0";
    document.getElementById("boletin-asunto").value = "";
    document.getElementById("boletin-contenido").value = "";
    document.getElementById("vista-previa-boletin").hidden = true;
    document.getElementById("titulo-form-boletin").textContent = "Nuevo boletín";
    const subtitulo = document.getElementById("subtitulo-form-boletin");
    if (subtitulo) {
        subtitulo.textContent = "Redacta el asunto y el contenido del boletín. Guárdalo como borrador antes de enviarlo a los suscriptores activos.";
    }
    mostrarSoloRedaccionBoletin();
    document.getElementById("boletin-asunto")?.focus();
}

function abrirEdicionBoletin(b) {
    if (!b || b.estado !== "borrador") {
        return;
    }
    document.getElementById("boletin-id").value = String(b.id);
    document.getElementById("boletin-asunto").value = b.asunto || "";
    document.getElementById("boletin-contenido").value = b.contenido || "";
    document.getElementById("vista-previa-boletin").hidden = true;
    document.getElementById("titulo-form-boletin").textContent = "Editar borrador";
    const subtitulo = document.getElementById("subtitulo-form-boletin");
    if (subtitulo) {
        subtitulo.textContent = "Actualiza el asunto o contenido de este borrador antes de enviarlo a los suscriptores activos.";
    }
    mostrarSoloRedaccionBoletin();
    document.getElementById("boletin-asunto")?.focus();
}

function mostrarSoloRedaccionBoletin() {
    const areaTrabajo = document.getElementById("area-trabajo-newsletter");
    const panelComposer = document.getElementById("panel-formulario-boletin");
    const btnNuevo = document.getElementById("btn-nuevo-boletin");

    if (areaTrabajo) areaTrabajo.hidden = true;
    if (btnNuevo) btnNuevo.hidden = true;
    if (panelComposer) panelComposer.hidden = false;

    sincronizarEstadoDespachoComposer();
}

function cerrarRedaccionBoletin() {
    const areaTrabajo = document.getElementById("area-trabajo-newsletter");
    const panelComposer = document.getElementById("panel-formulario-boletin");
    const btnNuevo = document.getElementById("btn-nuevo-boletin");

    if (panelComposer) panelComposer.hidden = true;
    if (areaTrabajo) areaTrabajo.hidden = false;
    if (btnNuevo) btnNuevo.hidden = false;
}

function mostrarMensajeNewsletter(texto, esError) {
    const alerta = document.getElementById("mensaje-newsletter");
    if (!alerta) {
        return;
    }
    alerta.textContent = texto;
    alerta.className = esError ? "alerta-admin alerta-admin-error" : "alerta-admin alerta-admin-exito";
    alerta.hidden = false;
}

function inicializarSidebarMovilNewsletter() {
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

function inicializarSalirNewsletter() {
    const boton = document.getElementById("boton-salir");
    if (!boton) {
        return;
    }
    boton.addEventListener("click", async () => {
        const form = new FormData();
        form.append("csrf_token", csrfTokenNewsletter);
        await fetch("../php/cerrar_sesion.php", {
            method: "POST",
            body: form,
            credentials: "same-origin"
        });
        window.location.href = "../acceso.html";
    });
}
