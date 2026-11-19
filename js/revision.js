/**
 * NewsCMS - Centro de Revisión Editorial (admin/revision.html)
 */

let csrfTokenRevision = "";
let permisosRevision = {};
let noticiasPendientes = [];
let noticiaSeleccionadaId = 0;
let noticiaSeleccionadaActual = null;
let secuenciaDetalleRevision = 0;
let controladorDetalleRevision = null;
let enviandoDecisionEditorial = false;

document.addEventListener("DOMContentLoaded", () => {
    iniciarRevisionEditorial();
});

async function iniciarRevisionEditorial() {
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

        permisosRevision = datos.permisos || {};
        if (!permisosRevision.consultar_revision) {
            window.location.href = "index.html";
            return;
        }

        csrfTokenRevision = datos.csrf_token || "";
        mostrarCabeceraRevision(datos.usuario);
        renderizarSidebarRevision(datos.modulos_permitidos || ["Dashboard"]);
        inicializarSidebarMovilRevision();
        inicializarSalirRevision();
        inicializarCentroRevision();

        document.getElementById("contenedor-admin").hidden = false;
        await cargarPendientes();
    } catch {
        window.location.href = "../acceso.html";
    }
}

function mostrarCabeceraRevision(usuario) {
    document.getElementById("nombre-usuario").textContent = usuario.nombre || "";
    document.getElementById("rol-usuario").textContent = usuario.rol || "";
    document.getElementById("rol-sidebar").textContent = usuario.rol || "";
}

function renderizarSidebarRevision(modulos) {
    const lista = document.getElementById("lista-modulos");
    if (!lista) {
        return;
    }
    lista.textContent = "";

    modulos.forEach((modulo) => {
        const li = document.createElement("li");
        const enlace = document.createElement("a");
        enlace.className = modulo === "Revisión editorial" ? "boton-modulo activo" : "boton-modulo";
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

function mostrarVistaCentroRevision(estado) {
    const cargando = document.getElementById("estado-cargando-revision");
    const error = document.getElementById("estado-error-revision");
    const vacio = document.getElementById("estado-vacio-centro-revision");
    const layout = document.getElementById("centro-revision-layout");

    if (cargando) cargando.hidden = estado !== "cargando";
    if (error) error.hidden = estado !== "error";
    if (vacio) vacio.hidden = estado !== "vacio";
    if (layout) layout.hidden = estado !== "activo";
}

async function cargarPendientes() {
    const listaEl = document.getElementById("cuerpo-tabla-revision");
    const contadorEl = document.getElementById("contador-pendientes");

    if (noticiasPendientes.length === 0) {
        mostrarVistaCentroRevision("cargando");
    }

    try {
        const respuesta = await fetch("../php/revision.php?accion=pendientes", {
            credentials: "same-origin"
        });
        let datos = null;
        try {
            datos = await respuesta.json();
        } catch {
            datos = null;
        }

        if (!respuesta.ok || !datos || datos.exito !== true || !Array.isArray(datos.noticias)) {
            const msg = (datos && datos.mensaje) ? datos.mensaje : `No se pudo cargar la bandeja (HTTP ${respuesta.status}).`;
            const errTxt = document.getElementById("texto-error-revision");
            if (errTxt) errTxt.textContent = msg;
            mostrarVistaCentroRevision("error");
            mostrarMensajeRevision(msg, true);
            return;
        }

        noticiasPendientes = datos.noticias;
        if (contadorEl) {
            contadorEl.textContent = noticiasPendientes.length === 1
                ? "1 pendiente"
                : `${noticiasPendientes.length} pendientes`;
        }

        if (listaEl) {
            listaEl.textContent = "";
        }

        if (noticiasPendientes.length === 0) {
            noticiaSeleccionadaId = 0;
            noticiaSeleccionadaActual = null;
            cerrarFormularioCambios();
            mostrarVistaCentroRevision("vacio");
            return;
        }

        mostrarVistaCentroRevision("activo");

        const sigueDisponible = noticiasPendientes.some((n) => Number(n.id) === Number(noticiaSeleccionadaId));
        const objetivo = sigueDisponible
            ? noticiasPendientes.find((n) => Number(n.id) === Number(noticiaSeleccionadaId))
            : noticiasPendientes[0];

        noticiasPendientes.forEach((n, indice) => {
            const itemBtn = construirElementoBandeja(n, indice);
            listaEl?.appendChild(itemBtn);
        });

        if (objetivo) {
            await seleccionarNoticiaRevision(objetivo, false);
        }
    } catch {
        const errTxt = document.getElementById("texto-error-revision");
        if (errTxt) errTxt.textContent = "Error de conexión con el servidor al cargar las revisiones.";
        mostrarVistaCentroRevision("error");
        mostrarMensajeRevision("No se pudo cargar la bandeja de revisión.", true);
    }
}

function construirElementoBandeja(noticia, indice) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "item-bandeja-revision";
    btn.dataset.noticiaId = String(noticia.id);
    btn.setAttribute("role", "option");
    btn.setAttribute("aria-selected", "false");

    const filaMeta = document.createElement("div");
    filaMeta.className = "item-bandeja-meta-top";

    const chipCat = document.createElement("span");
    chipCat.className = "chip-categoria-revision";
    chipCat.textContent = noticia.categoria || "General";

    const fecha = document.createElement("span");
    fecha.className = "item-bandeja-fecha";
    fecha.textContent = (noticia.fecha_creacion || "").slice(0, 10) || "-";

    filaMeta.appendChild(chipCat);
    filaMeta.appendChild(fecha);

    const titulo = document.createElement("span");
    titulo.className = "item-bandeja-titulo";
    titulo.textContent = noticia.titulo || "";

    const filaPie = document.createElement("div");
    filaPie.className = "item-bandeja-pie";

    const redactor = document.createElement("span");
    redactor.className = "item-bandeja-redactor";
    redactor.textContent = `Redactor: ${noticia.redactor || ""}`;

    const estadoPill = document.createElement("span");
    estadoPill.className = "item-bandeja-estado";
    estadoPill.textContent = "Pendiente";

    filaPie.appendChild(redactor);
    filaPie.appendChild(estadoPill);

    btn.appendChild(filaMeta);
    btn.appendChild(titulo);
    btn.appendChild(filaPie);

    btn.addEventListener("click", () => seleccionarNoticiaRevision(noticia, true));
    btn.addEventListener("keydown", (e) => manejarTecladoBandeja(e, indice));

    return btn;
}

function manejarTecladoBandeja(evento, indiceActual) {
    if (evento.key !== "ArrowDown" && evento.key !== "ArrowUp") {
        return;
    }
    evento.preventDefault();
    const botones = Array.from(document.querySelectorAll("#cuerpo-tabla-revision .item-bandeja-revision"));
    if (botones.length === 0) {
        return;
    }
    const delta = evento.key === "ArrowDown" ? 1 : -1;
    const siguienteIndice = Math.max(0, Math.min(botones.length - 1, indiceActual + delta));
    const destino = botones[siguienteIndice];
    if (destino) {
        destino.focus();
        destino.click();
    }
}

function resaltarItemBandeja(id) {
    const objetivo = String(id || "");
    document.querySelectorAll("#cuerpo-tabla-revision .item-bandeja-revision").forEach((btn) => {
        const esActiva = objetivo !== "0" && btn.dataset.noticiaId === objetivo;
        btn.classList.toggle("activa", esActiva);
        btn.setAttribute("aria-selected", esActiva ? "true" : "false");
    });
}

async function seleccionarNoticiaRevision(noticiaBase, desplazarEnMovil) {
    if (!noticiaBase) {
        return;
    }

    noticiaSeleccionadaId = Number(noticiaBase.id);
    noticiaSeleccionadaActual = noticiaBase;
    resaltarItemBandeja(noticiaSeleccionadaId);
    cerrarFormularioCambios();

    const miSecuencia = ++secuenciaDetalleRevision;
    if (controladorDetalleRevision) {
        controladorDetalleRevision.abort();
    }
    controladorDetalleRevision = typeof AbortController !== "undefined" ? new AbortController() : null;

    poblarEncabezadoEvaluacion(noticiaBase, null);
    configurarAccionesEvaluacion(noticiaBase);

    const resumenEl = document.getElementById("detalle-resumen");
    const contImg = document.getElementById("detalle-imagen-contenedor");
    const imgEl = document.getElementById("detalle-imagen");
    const avisoEl = document.getElementById("detalle-estado-contenido");
    const contenidoEl = document.getElementById("detalle-contenido");
    const etiquetasEl = document.getElementById("detalle-etiquetas");
    const historialBloque = document.getElementById("bloque-historial-revision");
    const historialLista = document.getElementById("lista-historial-revision");

    if (resumenEl) { resumenEl.textContent = ""; resumenEl.hidden = true; }
    if (contImg) contImg.hidden = true;
    if (imgEl) imgEl.src = "";
    if (etiquetasEl) { etiquetasEl.textContent = ""; etiquetasEl.hidden = true; }
    if (contenidoEl) contenidoEl.textContent = "";
    if (historialLista) historialLista.textContent = "";
    if (historialBloque) historialBloque.hidden = true;
    if (avisoEl) {
        avisoEl.textContent = "Cargando contenido completo para evaluación...";
        avisoEl.className = "aviso-contenido-revision";
        avisoEl.hidden = false;
    }

    if (desplazarEnMovil && window.innerWidth <= 960) {
        document.getElementById("panel-detalle-revision")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    const signal = controladorDetalleRevision ? controladorDetalleRevision.signal : undefined;

    try {
        const [resDetalle, resHistorial] = await Promise.allSettled([
            fetch(`../php/noticias.php?modo=detalle&id=${encodeURIComponent(noticiaSeleccionadaId)}`, {
                credentials: "same-origin",
                signal
            }),
            fetch(`../php/revision.php?accion=historial&noticia_id=${encodeURIComponent(noticiaSeleccionadaId)}`, {
                credentials: "same-origin",
                signal
            })
        ]);

        if (miSecuencia !== secuenciaDetalleRevision) {
            return;
        }

        // Procesar historial de revisiones previas
        if (resHistorial.status === "fulfilled" && resHistorial.value.ok) {
            try {
                const datosHist = await resHistorial.value.json();
                if (miSecuencia !== secuenciaDetalleRevision) return;
                if (datosHist.exito && Array.isArray(datosHist.revisiones) && datosHist.revisiones.length > 0) {
                    renderizarHistorialEditorial(datosHist.revisiones);
                }
            } catch {
                // Historial opcional
            }
        }

        // Procesar detalle completo autorizado
        if (resDetalle.status !== "fulfilled") {
            mostrarAvisoContenido("No se pudo recuperar el cuerpo del artículo desde el servidor. Puedes usar «Ver noticia» o decidir con los datos visibles.");
            return;
        }

        const respDet = resDetalle.value;
        let datosDet = null;
        try {
            datosDet = await respDet.json();
        } catch {
            datosDet = null;
        }

        if (miSecuencia !== secuenciaDetalleRevision) {
            return;
        }

        if (!respDet.ok || !datosDet || !datosDet.ok || !datosDet.noticia) {
            const mensajeAcceso = respDet.status === 404
                ? "Tu rol tiene acceso a la bandeja de revisión, pero no permiso para leer el borrador completo de noticias ajenas desde este panel."
                : ((datosDet && datosDet.mensaje) || "No se pudo cargar el contenido completo de la noticia.");
            mostrarAvisoContenido(mensajeAcceso);
            return;
        }

        const n = datosDet.noticia;
        poblarEncabezadoEvaluacion(noticiaBase, n);

        if (n.resumen && resumenEl) {
            resumenEl.textContent = n.resumen;
            resumenEl.hidden = false;
        }

        if (n.imagen && contImg && imgEl) {
            imgEl.src = `../${n.imagen}`;
            imgEl.alt = n.titulo || "Imagen de portada";
            contImg.hidden = false;
        }

        if (Array.isArray(n.etiquetas) && n.etiquetas.length > 0 && etiquetasEl) {
            etiquetasEl.textContent = "";
            n.etiquetas.forEach((et) => {
                const pill = document.createElement("span");
                pill.className = "tag-evaluacion-revision";
                pill.textContent = `#${et.nombre}`;
                etiquetasEl.appendChild(pill);
            });
            etiquetasEl.hidden = false;
        }

        if (avisoEl) {
            avisoEl.hidden = true;
        }

        if (contenidoEl) {
            renderizarHtmlEditorialSeguro(n.contenido || "", contenidoEl);
            if (!contenidoEl.textContent.trim() && !contenidoEl.querySelector("img")) {
                mostrarAvisoContenido("Esta noticia no tiene contenido desarrollado en el cuerpo.");
            }
        }
    } catch (error) {
        if (error && error.name === "AbortError") {
            return;
        }
        if (miSecuencia === secuenciaDetalleRevision) {
            mostrarAvisoContenido("Error al consultar el contenido completo de la noticia.");
        }
    }
}

function poblarEncabezadoEvaluacion(base, detalle) {
    const catEl = document.getElementById("detalle-categoria");
    const titEl = document.getElementById("detalle-titulo");
    const metaEl = document.getElementById("detalle-meta");

    const titulo = (detalle && detalle.titulo) || base.titulo || "";
    const autor = (detalle && detalle.autor) || base.redactor || "";
    const categoria = (detalle && detalle.categoria) || base.categoria || "";
    const fecha = ((detalle && detalle.fecha_creacion) || base.fecha_creacion || "").slice(0, 10) || "-";

    if (catEl) catEl.textContent = categoria;
    if (titEl) titEl.textContent = titulo;
    if (metaEl) metaEl.textContent = `Redactor: ${autor} · Enviado el ${fecha}`;
}

function configurarAccionesEvaluacion(noticia) {
    const enlaceVer = document.getElementById("enlace-ver-noticia");
    const btnCambios = document.getElementById("btn-abrir-cambios");
    const btnAprobar = document.getElementById("btn-aprobar-noticia");

    if (enlaceVer) {
        enlaceVer.href = `../noticia.html?id=${encodeURIComponent(noticia.id)}`;
    }
    if (btnCambios) {
        btnCambios.hidden = !permisosRevision.solicitar_correcciones;
        btnCambios.disabled = false;
    }
    if (btnAprobar) {
        btnAprobar.hidden = !permisosRevision.aprobar_noticias;
        btnAprobar.disabled = false;
    }
}

function mostrarAvisoContenido(texto) {
    const avisoEl = document.getElementById("detalle-estado-contenido");
    if (!avisoEl) {
        return;
    }
    avisoEl.textContent = texto;
    avisoEl.hidden = false;
}

function renderizarHistorialEditorial(revisiones) {
    const bloque = document.getElementById("bloque-historial-revision");
    const lista = document.getElementById("lista-historial-revision");
    if (!bloque || !lista) {
        return;
    }

    lista.textContent = "";
    const etiquetasAccion = {
        aprobada: "Aprobada",
        cambios_solicitados: "Cambios solicitados"
    };

    revisiones.forEach((rev) => {
        const li = document.createElement("li");
        li.className = "item-historial-revision";

        const cab = document.createElement("div");
        cab.className = "item-historial-cabecera";

        const accion = document.createElement("span");
        accion.className = rev.accion === "cambios_solicitados"
            ? "badge-historial-cambios"
            : "badge-historial-aprobada";
        accion.textContent = etiquetasAccion[rev.accion] || rev.accion;

        const meta = document.createElement("span");
        meta.className = "item-historial-meta";
        const fecha = (rev.fecha_creacion || "").slice(0, 16);
        meta.textContent = `${rev.editor || "Editor"} · ${fecha}`;

        cab.appendChild(accion);
        cab.appendChild(meta);

        const obs = document.createElement("p");
        obs.className = "item-historial-obs";
        obs.textContent = rev.observaciones || "";

        li.appendChild(cab);
        li.appendChild(obs);
        lista.appendChild(li);
    });

    bloque.hidden = false;
}

function renderizarHtmlEditorialSeguro(htmlBruto, destino) {
    destino.textContent = "";
    if (!htmlBruto || typeof htmlBruto !== "string") {
        return;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlBruto, "text/html");
    const etiquetasPermitidas = new Set([
        "P", "BR", "STRONG", "B", "EM", "I", "U", "S", "STRIKE",
        "SUB", "SUP", "UL", "OL", "LI", "H1", "H2", "H3", "H4", "H5", "H6",
        "BLOCKQUOTE", "HR", "CODE", "PRE", "A", "IMG", "FIGURE", "FIGCAPTION"
    ]);

    function clonarSeguro(nodoOrigen) {
        if (nodoOrigen.nodeType === Node.TEXT_NODE) {
            return document.createTextNode(nodoOrigen.nodeValue || "");
        }
        if (nodoOrigen.nodeType !== Node.ELEMENT_NODE) {
            return null;
        }

        const tag = nodoOrigen.tagName.toUpperCase();
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "IFRAME" || tag === "OBJECT" || tag === "EMBED" || tag === "FORM" || tag === "SVG") {
            return null;
        }

        if (!etiquetasPermitidas.has(tag)) {
            const fragmento = document.createDocumentFragment();
            nodoOrigen.childNodes.forEach((hijo) => {
                const limpio = clonarSeguro(hijo);
                if (limpio) fragmento.appendChild(limpio);
            });
            return fragmento;
        }

        const el = document.createElement(tag.toLowerCase());

        if (tag === "A") {
            const href = (nodoOrigen.getAttribute("href") || "").trim();
            if (/^https?:\/\//i.test(href) || href.startsWith("/")) {
                el.setAttribute("href", href);
                el.setAttribute("target", "_blank");
                el.setAttribute("rel", "noopener noreferrer");
            }
        } else if (tag === "IMG") {
            const src = (nodoOrigen.getAttribute("src") || "").trim();
            if (/^(\.\.\/)?uploads\//i.test(src) || /^https?:\/\//i.test(src)) {
                el.setAttribute("src", src.startsWith("uploads/") ? `../${src}` : src);
                el.setAttribute("alt", (nodoOrigen.getAttribute("alt") || "").trim());
                el.loading = "lazy";
            } else {
                return null;
            }
        }

        nodoOrigen.childNodes.forEach((hijo) => {
            const limpio = clonarSeguro(hijo);
            if (limpio) {
                el.appendChild(limpio);
            }
        });

        return el;
    }

    doc.body.childNodes.forEach((nodo) => {
        const limpio = clonarSeguro(nodo);
        if (limpio) {
            destino.appendChild(limpio);
        }
    });
}

function establecerBotonesDecisionDeshabilitados(deshabilitado) {
    const btnAprobar = document.getElementById("btn-aprobar-noticia");
    const btnCambios = document.getElementById("btn-abrir-cambios");
    const btnEnviar = document.getElementById("btn-enviar-cambios");
    if (btnAprobar) btnAprobar.disabled = deshabilitado;
    if (btnCambios) btnCambios.disabled = deshabilitado;
    if (btnEnviar) btnEnviar.disabled = deshabilitado;
}

async function aprobarNoticiaActual() {
    if (!noticiaSeleccionadaActual || enviandoDecisionEditorial) {
        return;
    }

    const { id, titulo } = noticiaSeleccionadaActual;
    const confirmado = window.confirm(`¿Deseas aprobar y publicar la noticia "${titulo}"?`);
    if (!confirmado) {
        return;
    }

    const form = new FormData();
    form.append("csrf_token", csrfTokenRevision);
    form.append("accion", "aprobar");
    form.append("noticia_id", String(id));

    enviandoDecisionEditorial = true;
    establecerBotonesDecisionDeshabilitados(true);

    try {
        const respuesta = await fetch("../php/revision.php", {
            method: "POST",
            body: form,
            credentials: "same-origin"
        });
        const datos = await respuesta.json();

        if (respuesta.ok && datos.exito) {
            mostrarMensajeRevision(datos.mensaje || "Noticia aprobada y publicada.", false);
            noticiaSeleccionadaId = 0;
            cerrarFormularioCambios();
            await cargarPendientes();
            return;
        }

        mostrarMensajeRevision(datos.mensaje || "No se pudo aprobar la noticia.", true);
        if (respuesta.status === 409) {
            await cargarPendientes();
        }
    } catch {
        mostrarMensajeRevision("Error de comunicación con el servidor.", true);
    } finally {
        enviandoDecisionEditorial = false;
        establecerBotonesDecisionDeshabilitados(false);
    }
}

function abrirFormularioCambiosActual() {
    if (!noticiaSeleccionadaActual || !permisosRevision.solicitar_correcciones) {
        return;
    }
    const panel = document.getElementById("panel-solicitar-cambios");
    document.getElementById("cambios-noticia-id").value = String(noticiaSeleccionadaActual.id);
    document.getElementById("cambios-noticia-titulo").textContent = `Noticia: ${noticiaSeleccionadaActual.titulo}`;
    document.getElementById("campo-observaciones").value = "";
    panel.hidden = false;
    document.getElementById("campo-observaciones")?.focus();
}

function cerrarFormularioCambios() {
    const panel = document.getElementById("panel-solicitar-cambios");
    const obs = document.getElementById("campo-observaciones");
    const idEl = document.getElementById("cambios-noticia-id");
    if (obs) obs.value = "";
    if (idEl) idEl.value = "0";
    if (panel) panel.hidden = true;
}

function inicializarCentroRevision() {
    document.getElementById("btn-reintentar-revision")?.addEventListener("click", cargarPendientes);
    document.getElementById("btn-aprobar-noticia")?.addEventListener("click", aprobarNoticiaActual);
    document.getElementById("btn-abrir-cambios")?.addEventListener("click", abrirFormularioCambiosActual);
    document.getElementById("cancelar-cambios")?.addEventListener("click", cerrarFormularioCambios);

    document.getElementById("formulario-cambios")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (enviandoDecisionEditorial) {
            return;
        }

        const noticiaId = document.getElementById("cambios-noticia-id").value;
        const observaciones = document.getElementById("campo-observaciones").value.trim();

        if (!observaciones) {
            mostrarMensajeRevision("Las observaciones son obligatorias para solicitar cambios.", true);
            document.getElementById("campo-observaciones")?.focus();
            return;
        }

        const form = new FormData();
        form.append("csrf_token", csrfTokenRevision);
        form.append("accion", "solicitar_cambios");
        form.append("noticia_id", noticiaId);
        form.append("observaciones", observaciones);

        enviandoDecisionEditorial = true;
        establecerBotonesDecisionDeshabilitados(true);

        try {
            const respuesta = await fetch("../php/revision.php", {
                method: "POST",
                body: form,
                credentials: "same-origin"
            });
            const datos = await respuesta.json();

            if (respuesta.ok && datos.exito) {
                mostrarMensajeRevision(datos.mensaje || "Cambios solicitados correctamente.", false);
                noticiaSeleccionadaId = 0;
                cerrarFormularioCambios();
                await cargarPendientes();
                return;
            }

            mostrarMensajeRevision(datos.mensaje || "No se pudieron enviar las observaciones.", true);
            if (respuesta.status === 409) {
                await cargarPendientes();
            }
        } catch {
            mostrarMensajeRevision("Error de comunicación con el servidor.", true);
        } finally {
            enviandoDecisionEditorial = false;
            establecerBotonesDecisionDeshabilitados(false);
        }
    });
}

function mostrarMensajeRevision(texto, esError) {
    const alerta = document.getElementById("mensaje-revision");
    if (!alerta) {
        return;
    }
    alerta.textContent = texto;
    alerta.className = esError ? "alerta-admin alerta-admin-error" : "alerta-admin alerta-admin-exito";
    alerta.hidden = false;
}

function inicializarSidebarMovilRevision() {
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

function inicializarSalirRevision() {
    const boton = document.getElementById("boton-salir");
    if (!boton) {
        return;
    }
    boton.addEventListener("click", async () => {
        const form = new FormData();
        form.append("csrf_token", csrfTokenRevision);
        await fetch("../php/cerrar_sesion.php", {
            method: "POST",
            body: form,
            credentials: "same-origin"
        });
        window.location.href = "../acceso.html";
    });
}
