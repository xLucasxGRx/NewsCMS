/**
 * NewsCMS - Script del formulario de creación y edición de noticias
 * Integra TinyMCE 8 Community local como editor enriquecido WYSIWYG.
 */

let csrfTokenEditor = "";
let rolUsuarioEditor = "";
let permisosUsuarioEditor = {};
let estadoNoticiaActual = "nueva";
let estadoActualizacionActual = null;
let tinyMceListo = false;
let tinyMceErrorCarga = false;
let envioEnCurso = false;
let secuenciaCargaNoticia = 0;
let controladorCargaNoticia = null;
let temporizadorMensajeEditor = null;

let catalogoEtiquetasEditor = [];
const etiquetasSeleccionadasIds = new Set();
let selectorEtiquetasInicializado = false;
let creandoEtiquetaRapida = false;
let temporizadorMensajeEtiquetaRapida = null;

document.addEventListener("DOMContentLoaded", () => {
    iniciarEditorNoticia();
});

async function iniciarEditorNoticia() {
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

        csrfTokenEditor = datos.csrf_token || "";
        rolUsuarioEditor = datos.usuario.rol || "";
        const permisos = datos.permisos || {};
        permisosUsuarioEditor = permisos;
        document.getElementById("csrf-token").value = csrfTokenEditor;

        const params = new URLSearchParams(window.location.search);
        const idNoticia = Number(params.get("id") || 0);
        if (idNoticia <= 0 && datos.permisos && !permisos.crear_noticias) {
            window.location.href = "noticias.html";
            return;
        }

        mostrarUsuarioEditor(datos.usuario);
        renderizarSidebarEditor(datos.modulos_permitidos || ["Dashboard"]);
        configurarPermisosVisuales(permisos);
        actualizarFlujoBotonesEditor("nueva", null);
        inicializarSidebarMovilEditor();
        inicializarSalirEditor();
        inicializarVistaPreviaImagen();
        inicializarBotonesGuardado();
        inicializarSelectorEtiquetasEditor();

        document.getElementById("contenedor-admin").hidden = false;

        await cargarCatalogos();
        await inicializarEditorTinyMce();

        if (idNoticia > 0) {
            await cargarNoticiaExistente(idNoticia);
        }
    } catch {
        window.location.href = "../acceso.html";
    }
}

function mostrarUsuarioEditor(usuario) {
    document.getElementById("nombre-usuario").textContent = usuario.nombre || "";
    document.getElementById("rol-usuario").textContent = usuario.rol || "";
    document.getElementById("rol-sidebar").textContent = usuario.rol || "";
}

function renderizarSidebarEditor(modulos) {
    const lista = document.getElementById("lista-modulos");
    if (!lista) {
        return;
    }
    lista.textContent = "";

    modulos.forEach((modulo) => {
        const li = document.createElement("li");
        const enlace = document.createElement("a");
        enlace.className = modulo === "Noticias" ? "boton-modulo activo" : "boton-modulo";
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

function configurarPermisosVisuales(permisos) {
    const opcionesEditoriales = document.getElementById("opciones-editoriales");
    const btnRevision = document.getElementById("btn-revision");
    const btnCrearEtiqueta = document.getElementById("btn-abrir-crear-etiqueta");
    const panelCrearEtiqueta = document.getElementById("panel-crear-etiqueta-rapida");
    const puedePublicar = Boolean(permisos && permisos.publicar_noticias);
    const puedeEnviarRevision = Boolean(permisos && permisos.enviar_revision);
    const puedeGestionarEtiquetas = Boolean(permisos && permisos.gestionar_etiquetas);

    if (opcionesEditoriales) {
        opcionesEditoriales.hidden = !puedePublicar;
    }
    if (btnRevision) {
        btnRevision.hidden = !puedeEnviarRevision;
    }
    if (btnCrearEtiqueta) {
        btnCrearEtiqueta.hidden = !puedeGestionarEtiquetas;
    }
    if (panelCrearEtiqueta && !puedeGestionarEtiquetas) {
        panelCrearEtiqueta.hidden = true;
    }
}

function normalizarNombreVisibleEtiqueta(texto) {
    return String(texto || "").trim().replace(/\s+/g, " ");
}

function normalizarClaveEtiqueta(texto) {
    const limpio = normalizarNombreVisibleEtiqueta(texto);
    if (!limpio) {
        return "";
    }
    return limpio
        .normalize("NFKD")
        .replace(/\p{M}+/gu, "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}

function ordenarCatalogoEtiquetasEditor() {
    catalogoEtiquetasEditor.sort((a, b) =>
        (a.nombre || "").localeCompare(b.nombre || "", "es", { sensitivity: "base" })
    );
}

function buscarEtiquetaEquivalenteLocal(nombre) {
    const clave = normalizarClaveEtiqueta(nombre);
    if (!clave) {
        return null;
    }
    return catalogoEtiquetasEditor.find((item) => item.clave === clave) || null;
}

function agregarOActualizarEtiquetaCatalogo(etiq) {
    const id = Number(etiq && etiq.id);
    const nombre = normalizarNombreVisibleEtiqueta(etiq && etiq.nombre);
    if (!id || !nombre) {
        return null;
    }
    const clave = (etiq && etiq.clave_normalizada) || normalizarClaveEtiqueta(nombre);
    const existente = catalogoEtiquetasEditor.find((x) => x.id === id);
    if (existente) {
        existente.nombre = nombre;
        existente.clave = clave;
        ordenarCatalogoEtiquetasEditor();
        return existente;
    }
    const registro = { id, nombre, clave };
    catalogoEtiquetasEditor.push(registro);
    ordenarCatalogoEtiquetasEditor();
    return registro;
}

async function cargarCatalogos() {
    const selectCat = document.getElementById("categoria-id");
    const contenedorEtiquetas = document.getElementById("contenedor-etiquetas");

    const respuesta = await fetch("../php/catalogos.php", {
        credentials: "same-origin"
    });
    if (!respuesta.ok) {
        return;
    }

    const datos = await respuesta.json();
    const categorias = datos.categorias || [];
    const etiquetas = datos.etiquetas || [];

    categorias.forEach((cat) => {
        const opcion = document.createElement("option");
        opcion.value = String(cat.id);
        opcion.textContent = cat.nombre;
        selectCat.appendChild(opcion);
    });

    catalogoEtiquetasEditor = [];
    etiquetas.forEach((etiq) => {
        agregarOActualizarEtiquetaCatalogo(etiq);
    });

    if (contenedorEtiquetas && catalogoEtiquetasEditor.length === 0) {
        contenedorEtiquetas.textContent = "";
        const aviso = document.createElement("p");
        aviso.className = "texto-suave-form";
        aviso.textContent = "Aún no hay etiquetas registradas en el sistema.";
        contenedorEtiquetas.appendChild(aviso);
    }

    sincronizarVistaEtiquetasEditor();
}

function inicializarSelectorEtiquetasEditor() {
    if (selectorEtiquetasInicializado) {
        return;
    }
    selectorEtiquetasInicializado = true;

    const inputBuscar = document.getElementById("buscar-etiqueta-noticia");
    const btnLimpiar = document.getElementById("btn-limpiar-busqueda-etiqueta-editor");
    const btnAbrirCrear = document.getElementById("btn-abrir-crear-etiqueta");
    const inputNueva = document.getElementById("nueva-etiqueta-nombre");
    const btnConfirmarCrear = document.getElementById("btn-confirmar-crear-etiqueta");
    const btnCancelarCrear = document.getElementById("btn-cancelar-crear-etiqueta");

    inputBuscar?.addEventListener("input", () => {
        if (btnLimpiar) {
            btnLimpiar.hidden = inputBuscar.value.trim() === "";
        }
        renderizarListaEtiquetasEditor();
    });

    inputBuscar?.addEventListener("search", () => {
        if (btnLimpiar) {
            btnLimpiar.hidden = inputBuscar.value.trim() === "";
        }
        renderizarListaEtiquetasEditor();
    });

    btnLimpiar?.addEventListener("click", () => {
        if (inputBuscar) {
            inputBuscar.value = "";
            inputBuscar.focus();
        }
        btnLimpiar.hidden = true;
        renderizarListaEtiquetasEditor();
    });

    btnAbrirCrear?.addEventListener("click", abrirPanelCrearEtiquetaRapida);
    btnCancelarCrear?.addEventListener("click", cerrarPanelCrearEtiquetaRapida);
    btnConfirmarCrear?.addEventListener("click", crearEtiquetaRapida);

    inputNueva?.addEventListener("input", () => {
        ocultarFeedbackNuevaEtiqueta();
    });

    inputNueva?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            crearEtiquetaRapida();
        } else if (e.key === "Escape") {
            e.preventDefault();
            cerrarPanelCrearEtiquetaRapida();
        }
    });
}

function sincronizarVistaEtiquetasEditor() {
    sincronizarInputsOcultosEtiquetas();
    renderizarChipsEtiquetasSeleccionadas();
    renderizarListaEtiquetasEditor();
}

function sincronizarInputsOcultosEtiquetas() {
    const contenedor = document.getElementById("inputs-etiquetas-ocultos");
    if (!contenedor) {
        return;
    }
    contenedor.textContent = "";

    Array.from(etiquetasSeleccionadasIds)
        .filter((id) => Number.isInteger(id) && id > 0)
        .sort((a, b) => a - b)
        .forEach((id) => {
            const input = document.createElement("input");
            input.type = "hidden";
            input.name = "etiquetas[]";
            input.value = String(id);
            contenedor.appendChild(input);
        });
}

function renderizarChipsEtiquetasSeleccionadas() {
    const lista = document.getElementById("lista-etiquetas-seleccionadas");
    const contador = document.getElementById("contador-etiquetas-seleccionadas");
    if (!lista) {
        return;
    }

    const seleccionadas = Array.from(etiquetasSeleccionadasIds)
        .map((id) => catalogoEtiquetasEditor.find((item) => item.id === id))
        .filter(Boolean)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));

    if (contador) {
        contador.textContent = String(seleccionadas.length);
    }

    lista.textContent = "";
    if (seleccionadas.length === 0) {
        const vacio = document.createElement("span");
        vacio.className = "sin-etiquetas-seleccionadas";
        vacio.textContent = "Ninguna etiqueta seleccionada.";
        lista.appendChild(vacio);
        return;
    }

    seleccionadas.forEach((etiq) => {
        const chip = document.createElement("span");
        chip.className = "chip-etiqueta-seleccionada";

        const texto = document.createElement("span");
        texto.className = "chip-etiqueta-nombre";
        texto.textContent = etiq.nombre;

        const btnQuitar = document.createElement("button");
        btnQuitar.type = "button";
        btnQuitar.className = "chip-etiqueta-quitar";
        btnQuitar.setAttribute("aria-label", `Quitar etiqueta ${etiq.nombre}`);
        btnQuitar.title = `Quitar ${etiq.nombre}`;
        btnQuitar.textContent = "×";
        btnQuitar.addEventListener("click", () => {
            etiquetasSeleccionadasIds.delete(etiq.id);
            sincronizarVistaEtiquetasEditor();
        });

        chip.appendChild(texto);
        chip.appendChild(btnQuitar);
        lista.appendChild(chip);
    });
}

function renderizarListaEtiquetasEditor() {
    const contenedor = document.getElementById("contenedor-etiquetas");
    if (!contenedor) {
        return;
    }

    contenedor.textContent = "";
    if (catalogoEtiquetasEditor.length === 0) {
        const aviso = document.createElement("p");
        aviso.className = "texto-suave-form";
        aviso.textContent = "Aún no hay etiquetas registradas en el sistema.";
        contenedor.appendChild(aviso);
        return;
    }

    const consulta = (document.getElementById("buscar-etiqueta-noticia")?.value || "").trim();
    const claveConsulta = normalizarClaveEtiqueta(consulta);

    const filtradas = claveConsulta === ""
        ? catalogoEtiquetasEditor
        : catalogoEtiquetasEditor.filter((item) => item.clave.includes(claveConsulta));

    if (filtradas.length === 0) {
        const sinResultados = document.createElement("div");
        sinResultados.className = "estado-vacio-etiquetas-editor";

        const msg = document.createElement("p");
        msg.className = "texto-suave-form";
        msg.textContent = `No se encontraron etiquetas para "${consulta}".`;
        sinResultados.appendChild(msg);
        contenedor.appendChild(sinResultados);
        return;
    }

    filtradas.forEach((etiq) => {
        const seleccionada = etiquetasSeleccionadasIds.has(etiq.id);
        const label = document.createElement("label");
        label.className = seleccionada
            ? "casilla-admin opcion-etiqueta-compacta seleccionada"
            : "casilla-admin opcion-etiqueta-compacta";

        const check = document.createElement("input");
        check.type = "checkbox";
        check.className = "check-etiqueta-selector";
        check.value = String(etiq.id);
        check.checked = seleccionada;
        check.addEventListener("change", () => {
            if (check.checked) {
                etiquetasSeleccionadasIds.add(etiq.id);
            } else {
                etiquetasSeleccionadasIds.delete(etiq.id);
            }
            sincronizarVistaEtiquetasEditor();
        });

        const span = document.createElement("span");
        span.className = "nombre-etiqueta-opcion";
        span.textContent = etiq.nombre;

        label.appendChild(check);
        label.appendChild(span);
        contenedor.appendChild(label);
    });
}

function abrirPanelCrearEtiquetaRapida() {
    if (!permisosUsuarioEditor || !permisosUsuarioEditor.gestionar_etiquetas) {
        return;
    }
    const panel = document.getElementById("panel-crear-etiqueta-rapida");
    const inputNueva = document.getElementById("nueva-etiqueta-nombre");
    const inputBuscar = document.getElementById("buscar-etiqueta-noticia");
    if (!panel || !inputNueva) {
        return;
    }
    ocultarFeedbackNuevaEtiqueta();
    const sugerencia = normalizarNombreVisibleEtiqueta(inputBuscar?.value || "");
    inputNueva.value = sugerencia && !buscarEtiquetaEquivalenteLocal(sugerencia) ? sugerencia : "";
    panel.hidden = false;
    inputNueva.focus();
}

function cerrarPanelCrearEtiquetaRapida() {
    const panel = document.getElementById("panel-crear-etiqueta-rapida");
    const inputNueva = document.getElementById("nueva-etiqueta-nombre");
    ocultarFeedbackNuevaEtiqueta();
    if (inputNueva) {
        inputNueva.value = "";
    }
    if (panel) {
        panel.hidden = true;
    }
}

function ocultarFeedbackNuevaEtiqueta() {
    const box = document.getElementById("feedback-nueva-etiqueta");
    const txt = document.getElementById("texto-feedback-nueva-etiqueta");
    const btnUsar = document.getElementById("btn-usar-etiqueta-existente");
    if (box) box.hidden = true;
    if (txt) txt.textContent = "";
    if (btnUsar) {
        btnUsar.hidden = true;
        btnUsar.textContent = "";
        btnUsar.onclick = null;
    }
}

function mostrarFeedbackEtiquetaDuplicada(etiquetaExistente, textoMensaje) {
    const box = document.getElementById("feedback-nueva-etiqueta");
    const txt = document.getElementById("texto-feedback-nueva-etiqueta");
    const btnUsar = document.getElementById("btn-usar-etiqueta-existente");
    if (!box || !txt) {
        return;
    }
    txt.textContent = textoMensaje || "Esta etiqueta ya existe";
    box.className = "feedback-nueva-etiqueta es-advertencia";
    box.hidden = false;

    if (btnUsar && etiquetaExistente && etiquetaExistente.id) {
        btnUsar.textContent = `Usar "${etiquetaExistente.nombre}"`;
        btnUsar.hidden = false;
        btnUsar.onclick = () => {
            const normalizada = agregarOActualizarEtiquetaCatalogo(etiquetaExistente);
            if (normalizada) {
                etiquetasSeleccionadasIds.add(normalizada.id);
                sincronizarVistaEtiquetasEditor();
                cerrarPanelCrearEtiquetaRapida();
                mostrarMensajeEtiquetaRapida(`Etiqueta "${normalizada.nombre}" seleccionada.`, false);
            }
        };
    }
}

function mostrarErrorNuevaEtiqueta(texto) {
    const box = document.getElementById("feedback-nueva-etiqueta");
    const txt = document.getElementById("texto-feedback-nueva-etiqueta");
    const btnUsar = document.getElementById("btn-usar-etiqueta-existente");
    if (!box || !txt) {
        return;
    }
    if (btnUsar) {
        btnUsar.hidden = true;
        btnUsar.onclick = null;
    }
    txt.textContent = texto;
    box.className = "feedback-nueva-etiqueta es-error";
    box.hidden = false;
}

function mostrarMensajeEtiquetaRapida(texto, esError) {
    const caja = document.getElementById("mensaje-etiqueta-rapida");
    if (!caja) {
        return;
    }
    if (temporizadorMensajeEtiquetaRapida) {
        clearTimeout(temporizadorMensajeEtiquetaRapida);
        temporizadorMensajeEtiquetaRapida = null;
    }
    if (!texto) {
        caja.textContent = "";
        caja.hidden = true;
        return;
    }
    caja.textContent = texto;
    caja.className = esError ? "alerta-etiqueta-rapida es-error" : "alerta-etiqueta-rapida es-exito";
    caja.hidden = false;
    if (!esError) {
        temporizadorMensajeEtiquetaRapida = setTimeout(() => {
            caja.hidden = true;
            caja.textContent = "";
            temporizadorMensajeEtiquetaRapida = null;
        }, 4200);
    }
}

async function crearEtiquetaRapida() {
    if (creandoEtiquetaRapida) {
        return;
    }
    if (!permisosUsuarioEditor || !permisosUsuarioEditor.gestionar_etiquetas) {
        mostrarErrorNuevaEtiqueta("No tienes permisos para crear etiquetas nuevas.");
        return;
    }

    const inputNueva = document.getElementById("nueva-etiqueta-nombre");
    const btnConfirmar = document.getElementById("btn-confirmar-crear-etiqueta");
    const btnCancelar = document.getElementById("btn-cancelar-crear-etiqueta");
    const nombre = normalizarNombreVisibleEtiqueta(inputNueva?.value || "");

    if (!nombre) {
        mostrarErrorNuevaEtiqueta("Escribe el nombre de la etiqueta.");
        inputNueva?.focus();
        return;
    }

    if (nombre.length > 80) {
        mostrarErrorNuevaEtiqueta("El nombre no puede superar los 80 caracteres.");
        inputNueva?.focus();
        return;
    }

    const coincidenciaLocal = buscarEtiquetaEquivalenteLocal(nombre);
    if (coincidenciaLocal) {
        mostrarFeedbackEtiquetaDuplicada(
            coincidenciaLocal,
            `Esta etiqueta ya existe como "${coincidenciaLocal.nombre}".`
        );
        inputNueva?.focus();
        return;
    }

    const form = new FormData();
    form.append("csrf_token", csrfTokenEditor);
    form.append("accion", "crear_etiqueta");
    form.append("nombre", nombre);

    creandoEtiquetaRapida = true;
    if (btnConfirmar) {
        btnConfirmar.disabled = true;
        btnConfirmar.textContent = "Creando...";
    }
    if (btnCancelar) {
        btnCancelar.disabled = true;
    }

    try {
        const respuesta = await fetch("../php/catalogos.php", {
            method: "POST",
            body: form,
            credentials: "same-origin"
        });
        const resultado = await respuesta.json();

        if (respuesta.ok && resultado.ok && Number(resultado.id) > 0) {
            const creada = resultado.etiqueta || {
                id: Number(resultado.id),
                nombre
            };
            const registro = agregarOActualizarEtiquetaCatalogo(creada);
            if (registro) {
                etiquetasSeleccionadasIds.add(registro.id);
                sincronizarVistaEtiquetasEditor();
            }
            cerrarPanelCrearEtiquetaRapida();
            mostrarMensajeEtiquetaRapida(`Etiqueta "${nombre}" creada y seleccionada.`, false);
            return;
        }

        if (respuesta.status === 409 && resultado.etiqueta_existente) {
            const registroExistente = agregarOActualizarEtiquetaCatalogo(resultado.etiqueta_existente);
            sincronizarVistaEtiquetasEditor();
            mostrarFeedbackEtiquetaDuplicada(
                registroExistente || resultado.etiqueta_existente,
                resultado.mensaje || "Esta etiqueta ya existe."
            );
            inputNueva?.focus();
            return;
        }

        mostrarErrorNuevaEtiqueta(resultado.mensaje || "No se pudo crear la etiqueta.");
        inputNueva?.focus();
    } catch {
        mostrarErrorNuevaEtiqueta("Error de comunicación con el servidor.");
    } finally {
        creandoEtiquetaRapida = false;
        if (btnConfirmar) {
            btnConfirmar.disabled = false;
            btnConfirmar.textContent = "Crear etiqueta";
        }
        if (btnCancelar) {
            btnCancelar.disabled = false;
        }
    }
}

async function cargarNoticiaExistente(id) {
    const miSecuencia = ++secuenciaCargaNoticia;
    if (controladorCargaNoticia) {
        controladorCargaNoticia.abort();
    }
    controladorCargaNoticia = typeof AbortController !== "undefined" ? new AbortController() : null;

    mostrarMensajeEditor("", false);
    mostrarAvisoFlujoEditor("", false, false);
    renderizarObservacionesVigentesEditor("nueva", null, null);

    try {
        const respuesta = await fetch(`../php/noticias.php?modo=admin_obtener&id=${encodeURIComponent(id)}`, {
            credentials: "same-origin",
            signal: controladorCargaNoticia ? controladorCargaNoticia.signal : undefined
        });

        const datos = await respuesta.json();
        if (miSecuencia !== secuenciaCargaNoticia) {
            return;
        }
        if (!respuesta.ok || !datos.ok) {
            mostrarMensajeEditor(datos.mensaje || "No se puede editar esta noticia.", true);
            return;
        }

        const n = datos.noticia;
        const act = n.actualizacion_activa || null;
        estadoNoticiaActual = n.estado || "borrador";
        estadoActualizacionActual = act ? act.estado : null;

        document.getElementById("titulo-pagina-editor").textContent = "Editar noticia";
        const subtituloEditor = document.getElementById("subtitulo-pagina-editor");
        if (subtituloEditor) {
            subtituloEditor.textContent = n.estado === "publicada"
                ? "Propón actualizaciones sin alterar la noticia publicada hasta su aprobación editorial"
                : "Modifica el artículo y guarda avances o envíalo a Revisión Editorial";
        }
        actualizarInsigniaEstadoEditor(estadoNoticiaActual, estadoActualizacionActual);
        actualizarFlujoBotonesEditor(estadoNoticiaActual, estadoActualizacionActual);
        document.getElementById("noticia-id").value = String(n.id);
        document.getElementById("titulo").value = n.titulo || "";
        document.getElementById("resumen").value = n.resumen || "";
        document.getElementById("categoria-id").value = String(n.categoria_id || "");

        const instanciaTiny = obtenerInstanciaTinyMce();
        if (!tinyMceListo || !instanciaTiny) {
            deshabilitarBotonesGuardado(true);
            mostrarMensajeEditor("No se pudo cargar el contenido porque TinyMCE no está inicializado.", true);
            return;
        }

        instanciaTiny.setContent(n.contenido || "<p></p>");
        if (instanciaTiny.undoManager) {
            instanciaTiny.undoManager.clear();
        }

        document.getElementById("es-destacada").checked = Number(n.es_destacada) === 1;
        document.getElementById("es-ultima-hora").checked = Number(n.es_ultima_hora) === 1;

        if (n.imagen) {
            const img = document.getElementById("imagen-previa");
            const cont = document.getElementById("contenedor-vista-previa");
            img.src = `../${n.imagen}`;
            cont.hidden = false;
            actualizarEstadoVisualImagen(true);
        } else {
            actualizarEstadoVisualImagen(false);
        }

        etiquetasSeleccionadasIds.clear();
        (n.etiquetas_ids || []).forEach((idEt) => {
            const num = Number(idEt);
            if (num > 0) {
                etiquetasSeleccionadasIds.add(num);
            }
        });
        sincronizarVistaEtiquetasEditor();

        renderizarObservacionesVigentesEditor(
            estadoNoticiaActual,
            estadoActualizacionActual,
            n.observacion_vigente || null
        );
    } catch (error) {
        if (error && error.name === "AbortError") {
            return;
        }
        if (miSecuencia === secuenciaCargaNoticia) {
            mostrarMensajeEditor("No se pudo obtener la información vigente de la noticia.", true);
        }
    }
}

/**
 * Muestra observaciones únicamente cuando existe una solicitud de correcciones vigente sin resolver.
 * Nunca muestra aprobaciones anteriores como si fueran advertencias activas.
 */
function renderizarObservacionesVigentesEditor(estado, estadoActualizacion, obsVigente) {
    const caja = document.getElementById("caja-observaciones-editor");
    const texto = document.getElementById("texto-observaciones-editor");
    if (!caja || !texto) {
        return;
    }

    caja.hidden = true;
    texto.textContent = "";

    const requiereCorreccion = estado === "cambios_solicitados"
        || (estado === "publicada" && estadoActualizacion === "cambios_solicitados");

    if (!requiereCorreccion || !obsVigente || !obsVigente.observaciones) {
        return;
    }

    texto.textContent = obsVigente.editor
        ? `${obsVigente.observaciones} (${obsVigente.editor})`
        : obsVigente.observaciones;
    caja.hidden = false;
}

/**
 * Devuelve la instancia activa de TinyMCE para el cuerpo de la noticia.
 */
function obtenerInstanciaTinyMce() {
    if (typeof window.tinymce === "undefined") {
        return null;
    }
    return window.tinymce.get("editor-contenido") || null;
}

/**
 * Deshabilita o habilita los botones de guardado si el editor no está listo.
 */
function deshabilitarBotonesGuardado(deshabilitar) {
    document.querySelectorAll(".acciones-formulario button[data-accion]").forEach((boton) => {
        boton.disabled = deshabilitar;
    });
}

/**
 * Inicializa TinyMCE 8 Community local configurado para coincidir con el sanitizador PHP.
 */
async function inicializarEditorTinyMce() {
    if (typeof window.tinymce === "undefined") {
        tinyMceErrorCarga = true;
        tinyMceListo = false;
        deshabilitarBotonesGuardado(true);
        mostrarMensajeEditor(
            "No se pudo cargar el editor TinyMCE local. Recarga la página antes de intentar guardar.",
            true
        );
        return;
    }

    try {
        const editores = await window.tinymce.init({
            selector: "#editor-contenido",
            license_key: "gpl",
            language: "es",
            language_url: "../vendor/tinymce/js/tinymce/langs/es.js",
            plugins: "lists link autolink",
            menubar: false,
            statusbar: false,
            branding: false,
            promotion: false,
            height: 460,
            min_height: 360,
            width: "100%",
            resize: true,
            toolbar_mode: "wrap",
            toolbar: "undo redo | blocks | bold italic | bullist numlist | link unlink | removeformat",
            block_formats: "Párrafo=p; Encabezado 2=h2; Encabezado 3=h3",
            valid_elements: "p,br,strong/b,em/i,h2,h3,ul,ol,li,a[href|rel]",
            formats: {
                bold: { inline: "strong" },
                italic: { inline: "em" }
            },
            link_assume_external_targets: "https",
            link_default_target: "_blank",
            allow_unsafe_link_target: false,
            convert_urls: false,
            content_style:
                "body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.65; color: #0f172a; margin: 0.85rem; } h2, h3 { margin: 0.75rem 0 0.4rem; color: #0f172a; } p { margin: 0 0 0.75rem; } ul, ol { margin: 0 0 0.75rem 1.4rem; } a { color: #1d4ed8; }"
        });

        if (!editores || editores.length === 0) {
            throw new Error("Sin instancias inicializadas");
        }

        tinyMceListo = true;
        tinyMceErrorCarga = false;
    } catch {
        tinyMceErrorCarga = true;
        tinyMceListo = false;
        deshabilitarBotonesGuardado(true);
        mostrarMensajeEditor(
            "Ocurrió un error al inicializar TinyMCE. Se bloqueó el guardado para proteger el contenido.",
            true
        );
    }
}

function inicializarVistaPreviaImagen() {
    const input = document.getElementById("imagen");
    const cont = document.getElementById("contenedor-vista-previa");
    const img = document.getElementById("imagen-previa");

    if (!input) {
        return;
    }

    input.addEventListener("change", () => {
        const archivo = input.files && input.files[0];
        if (!archivo) {
            return;
        }
        const lector = new FileReader();
        lector.onload = (e) => {
            img.src = e.target.result;
            cont.hidden = false;
            actualizarEstadoVisualImagen(true);
        };
        lector.readAsDataURL(archivo);
    });
}

function actualizarEstadoVisualImagen(tieneImagen) {
    const aviso = document.getElementById("aviso-sin-imagen");
    if (aviso) {
        aviso.hidden = Boolean(tieneImagen);
    }
}

function actualizarInsigniaEstadoEditor(estado, estadoActualizacion) {
    const badge = document.getElementById("badge-estado-editor");
    if (!badge) {
        return;
    }
    const etiquetas = {
        nueva: "Nueva noticia",
        borrador: "Borrador",
        pendiente_revision: "Pendiente de revisión",
        cambios_solicitados: "Cambios solicitados",
        publicada: "Publicada",
        archivada: "Archivada"
    };

    if (estado === "publicada" && estadoActualizacion) {
        const sufijos = {
            borrador: "Publicada · Borrador de actualización",
            pendiente_revision: "Publicada · Actualización pendiente",
            cambios_solicitados: "Publicada · Correcciones solicitadas sobre actualización"
        };
        badge.className = estadoActualizacion === "pendiente_revision"
            ? "estado-badge estado-pendiente_revision"
            : (estadoActualizacion === "cambios_solicitados"
                ? "estado-badge estado-cambios_solicitados"
                : "estado-badge estado-publicada");
        badge.textContent = sufijos[estadoActualizacion] || "Publicada";
        return;
    }

    badge.className = `estado-badge estado-${estado === "nueva" ? "borrador" : (estado || "borrador")}`;
    badge.textContent = etiquetas[estado] || "Nueva noticia";
}

function mostrarAvisoFlujoEditor(texto, esBloqueo, mostrarEnlaceRevision) {
    const aviso = document.getElementById("aviso-flujo-editor");
    const spanTxt = document.getElementById("texto-aviso-flujo-editor");
    const enlaceRev = document.getElementById("enlace-ir-revision-editor");
    if (!aviso || !spanTxt) {
        return;
    }
    if (!texto) {
        aviso.hidden = true;
        spanTxt.textContent = "";
        if (enlaceRev) enlaceRev.hidden = true;
        return;
    }
    spanTxt.textContent = texto;
    aviso.className = esBloqueo
        ? "alerta-admin alerta-observacion alerta-flujo-editor"
        : "alerta-admin alerta-flujo-editor";
    if (enlaceRev) {
        enlaceRev.hidden = !(mostrarEnlaceRevision && permisosUsuarioEditor && permisosUsuarioEditor.consultar_revision);
    }
    aviso.hidden = false;
}

function actualizarFlujoBotonesEditor(estado, estadoActualizacion) {
    const btnRevision = document.getElementById("btn-revision");
    const btnBorrador = document.getElementById("btn-borrador");
    const descPanel = document.getElementById("descripcion-panel-publicacion");
    const puedeEnviar = Boolean(permisosUsuarioEditor && permisosUsuarioEditor.enviar_revision);

    if (!btnRevision || !btnBorrador) {
        return;
    }

    btnRevision.disabled = false;
    btnBorrador.disabled = false;
    btnRevision.hidden = !puedeEnviar;
    btnBorrador.hidden = false;

    if (estado === "publicada") {
        if (estadoActualizacion === "pendiente_revision") {
            btnRevision.hidden = true;
            btnBorrador.hidden = true;
            if (descPanel) {
                descPanel.textContent = "Actualización pendiente de aprobación en Revisión Editorial.";
            }
            mostrarAvisoFlujoEditor(
                "Ya existe una actualización pendiente en Revisión Editorial. La versión publicada vigente sigue visible en el portal y se bloquea un nuevo envío hasta que sea evaluada.",
                true,
                true
            );
            return;
        }

        if (estadoActualizacion === "cambios_solicitados") {
            btnRevision.dataset.accion = "enviar_actualizacion";
            btnRevision.textContent = "Reenviar actualización a revisión";
            btnBorrador.dataset.accion = "guardar_correcciones";
            btnBorrador.textContent = "Guardar correcciones";
            if (descPanel) {
                descPanel.textContent = "Corrige la actualización propuesta sin alterar la noticia publicada.";
            }
            mostrarAvisoFlujoEditor(
                "Se solicitaron correcciones sobre la propuesta de actualización. La noticia publicada actual permanece visible sin cambios.",
                false,
                false
            );
            return;
        }

        btnRevision.dataset.accion = "enviar_actualizacion";
        btnRevision.textContent = "Actualizar y enviar a revisión";
        btnBorrador.dataset.accion = "borrador_actualizacion";
        btnBorrador.textContent = "Guardar borrador de actualización";
        if (descPanel) {
            descPanel.textContent = "Los cambios sobre noticias publicadas pasan por Revisión Editorial antes de sustituir la versión visible.";
        }
        mostrarAvisoFlujoEditor(
            estadoActualizacion === "borrador"
                ? "Estás editando un borrador de actualización. La versión publicada en el portal sigue intacta hasta su aprobación."
                : "",
            false,
            false
        );
        return;
    }

    if (estado === "pendiente_revision") {
        btnRevision.hidden = true;
        if (rolUsuarioEditor === "redactor" && !permisosUsuarioEditor.publicar_noticias) {
            btnBorrador.hidden = true;
        } else {
            btnBorrador.dataset.accion = "borrador";
            btnBorrador.textContent = "Devolver a borrador";
        }
        if (descPanel) {
            descPanel.textContent = "Artículo actualmente en cola de Revisión Editorial.";
        }
        mostrarAvisoFlujoEditor(
            "Esta noticia ya fue enviada a Revisión Editorial. No es posible reenviarla hasta que un revisor tome una decisión.",
            true,
            true
        );
        return;
    }

    if (estado === "cambios_solicitados") {
        btnRevision.dataset.accion = "pendiente_revision";
        btnRevision.textContent = "Reenviar a revisión";
        btnBorrador.dataset.accion = "guardar_correcciones";
        btnBorrador.textContent = "Guardar correcciones";
        if (descPanel) {
            descPanel.textContent = "Aplica las observaciones editoriales y reenvía el artículo.";
        }
        mostrarAvisoFlujoEditor("", false, false);
        return;
    }

    if (estado === "archivada") {
        btnRevision.hidden = true;
        btnBorrador.hidden = true;
        if (descPanel) {
            descPanel.textContent = "Noticia archivada; restáurala en Gestión de Noticias para editarla.";
        }
        mostrarAvisoFlujoEditor("Esta noticia se encuentra archivada y no puede editarse en este estado.", true, false);
        return;
    }

    // Nueva noticia o borrador
    btnRevision.dataset.accion = "pendiente_revision";
    btnRevision.textContent = "Enviar a revisión";
    btnBorrador.dataset.accion = "borrador";
    btnBorrador.textContent = "Guardar borrador";
    if (descPanel) {
        descPanel.textContent = "Toda noticia nueva debe enviarse a Revisión Editorial antes de publicarse.";
    }
    mostrarAvisoFlujoEditor("", false, false);
}

function inicializarBotonesGuardado() {
    const botones = document.querySelectorAll(".acciones-formulario button[data-accion]");
    botones.forEach((boton) => {
        boton.addEventListener("click", () => {
            const accion = boton.getAttribute("data-accion");
            enviarFormularioNoticia(accion);
        });
    });
}

async function enviarFormularioNoticia(accion) {
    if (envioEnCurso) {
        return;
    }

    const instanciaTiny = obtenerInstanciaTinyMce();
    if (tinyMceErrorCarga || !tinyMceListo || !instanciaTiny) {
        mostrarMensajeEditor(
            "TinyMCE no está disponible. No se realizó el guardado para evitar pérdida de contenido.",
            true
        );
        return;
    }

    const textoPlano = instanciaTiny.getContent({ format: "text" }).replace(/\u00a0/g, " ").trim();
    if (!textoPlano) {
        mostrarMensajeEditor("El contenido de la noticia es obligatorio.", true);
        instanciaTiny.focus();
        return;
    }

    const contenidoHtml = instanciaTiny.getContent();
    instanciaTiny.save();

    const formulario = document.getElementById("formulario-noticia");
    const datosFormulario = new FormData(formulario);
    datosFormulario.set("contenido", contenidoHtml);
    datosFormulario.set("accion", accion);

    envioEnCurso = true;
    deshabilitarBotonesGuardado(true);
    try {
        const respuesta = await fetch("../php/noticias.php", {
            method: "POST",
            body: datosFormulario,
            credentials: "same-origin"
        });

        const resultado = await respuesta.json();
        if (respuesta.ok && resultado.ok) {
            const nuevoId = Number(resultado.id || 0);
            document.getElementById("noticia-id").value = String(nuevoId);
            estadoNoticiaActual = resultado.estado || estadoNoticiaActual;
            estadoActualizacionActual = resultado.estado_actualizacion !== undefined
                ? resultado.estado_actualizacion
                : null;

            actualizarInsigniaEstadoEditor(estadoNoticiaActual, estadoActualizacionActual);
            actualizarFlujoBotonesEditor(estadoNoticiaActual, estadoActualizacionActual);
            renderizarObservacionesVigentesEditor(
                estadoNoticiaActual,
                estadoActualizacionActual,
                resultado.observacion_vigente || null
            );

            if (nuevoId > 0 && !new URLSearchParams(window.location.search).get("id")) {
                window.history.replaceState(null, "", `editar_noticia.html?id=${encodeURIComponent(nuevoId)}`);
            }

            const mensajeTemporal = estadoActualizacionActual === "pendiente_revision"
                ? "Actualización enviada correctamente a Revisión Editorial."
                : (resultado.mensaje || "Cambios guardados correctamente.");
            mostrarMensajeEditor(mensajeTemporal, false);
            return;
        }

        mostrarMensajeEditor(resultado.mensaje || "No se pudo guardar la noticia.", true);
    } catch {
        mostrarMensajeEditor("Error de comunicación con el servidor.", true);
    } finally {
        envioEnCurso = false;
        deshabilitarBotonesGuardado(false);
    }
}

function mostrarMensajeEditor(texto, esError) {
    const alerta = document.getElementById("mensaje-editor");
    if (!alerta) {
        return;
    }

    if (temporizadorMensajeEditor) {
        clearTimeout(temporizadorMensajeEditor);
        temporizadorMensajeEditor = null;
    }

    if (!texto) {
        alerta.textContent = "";
        alerta.hidden = true;
        return;
    }

    alerta.textContent = texto;
    alerta.className = esError ? "alerta-admin alerta-admin-error" : "alerta-admin alerta-admin-exito";
    alerta.hidden = false;

    if (!esError) {
        temporizadorMensajeEditor = setTimeout(() => {
            alerta.hidden = true;
            alerta.textContent = "";
            temporizadorMensajeEditor = null;
        }, 5500);
    }
}

function inicializarSidebarMovilEditor() {
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

function inicializarSalirEditor() {
    const boton = document.getElementById("boton-salir");
    if (!boton) {
        return;
    }
    boton.addEventListener("click", async () => {
        const form = new FormData();
        form.append("csrf_token", csrfTokenEditor);
        await fetch("../php/cerrar_sesion.php", {
            method: "POST",
            body: form,
            credentials: "same-origin"
        });
        window.location.href = "../acceso.html";
    });
}
