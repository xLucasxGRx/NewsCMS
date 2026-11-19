/**
 * NewsCMS - Script del formulario de creación y edición de noticias
 * Integra TinyMCE 8 Community local como editor enriquecido WYSIWYG.
 */

let csrfTokenEditor = "";
let rolUsuarioEditor = "";
let tinyMceListo = false;
let tinyMceErrorCarga = false;
let envioEnCurso = false;

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
        inicializarSidebarMovilEditor();
        inicializarSalirEditor();
        inicializarVistaPreviaImagen();
        inicializarBotonesGuardado();

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
    const btnPublicar = document.getElementById("btn-publicar");
    const opcionesEditoriales = document.getElementById("opciones-editoriales");
    const btnRevision = document.querySelector('.acciones-formulario button[data-accion="pendiente_revision"]');
    const puedePublicar = Boolean(permisos && permisos.publicar_noticias);
    const puedeEnviarRevision = Boolean(permisos && permisos.enviar_revision);

    if (btnPublicar) {
        btnPublicar.hidden = !puedePublicar;
    }
    if (opcionesEditoriales) {
        opcionesEditoriales.hidden = !puedePublicar;
    }
    if (btnRevision) {
        btnRevision.hidden = !puedeEnviarRevision;
    }
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

    contenedorEtiquetas.textContent = "";
    if (etiquetas.length === 0) {
        const aviso = document.createElement("p");
        aviso.className = "texto-suave-form";
        aviso.textContent = "Aún no hay etiquetas registradas en el sistema.";
        contenedorEtiquetas.appendChild(aviso);
        return;
    }

    etiquetas.forEach((etiq) => {
        const label = document.createElement("label");
        label.className = "casilla-admin";

        const check = document.createElement("input");
        check.type = "checkbox";
        check.name = "etiquetas[]";
        check.value = String(etiq.id);

        const span = document.createElement("span");
        span.textContent = etiq.nombre;

        label.appendChild(check);
        label.appendChild(span);
        contenedorEtiquetas.appendChild(label);
    });
}

async function cargarNoticiaExistente(id) {
    const respuesta = await fetch(`../php/noticias.php?modo=admin_obtener&id=${encodeURIComponent(id)}`, {
        credentials: "same-origin"
    });

    const datos = await respuesta.json();
    if (!respuesta.ok || !datos.ok) {
        mostrarMensajeEditor(datos.mensaje || "No se puede editar esta noticia.", true);
        return;
    }

    const n = datos.noticia;
    document.getElementById("titulo-pagina-editor").textContent = "Editar noticia";
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
    }

    const idsEtiquetas = n.etiquetas_ids || [];
    document.querySelectorAll('input[name="etiquetas[]"]').forEach((check) => {
        check.checked = idsEtiquetas.includes(Number(check.value));
    });

    await cargarObservacionesNoticia(id);
}

async function cargarObservacionesNoticia(id) {
    const caja = document.getElementById("caja-observaciones-editor");
    const texto = document.getElementById("texto-observaciones-editor");
    if (!caja || !texto) {
        return;
    }

    try {
        const respuesta = await fetch(`../php/revision.php?accion=historial&noticia_id=${encodeURIComponent(id)}`, {
            credentials: "same-origin"
        });
        if (!respuesta.ok) {
            return;
        }
        const datos = await respuesta.json();
        const revisiones = datos.revisiones || [];
        if (revisiones.length > 0 && revisiones[0].observaciones) {
            texto.textContent = `${revisiones[0].observaciones} (${revisiones[0].editor})`;
            caja.hidden = false;
        }
    } catch {
        // Sin observaciones adicionales
    }
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
            height: 380,
            min_height: 300,
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
        };
        lector.readAsDataURL(archivo);
    });
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
    try {
        const respuesta = await fetch("../php/noticias.php", {
            method: "POST",
            body: datosFormulario,
            credentials: "same-origin"
        });

        const resultado = await respuesta.json();
        if (respuesta.ok && resultado.ok) {
            document.getElementById("noticia-id").value = String(resultado.id);
            mostrarMensajeEditor(resultado.mensaje || "Noticia guardada.", false);
            return;
        }

        mostrarMensajeEditor(resultado.mensaje || "No se pudo guardar la noticia.", true);
    } catch {
        mostrarMensajeEditor("Error de comunicación con el servidor.", true);
    } finally {
        envioEnCurso = false;
    }
}

function mostrarMensajeEditor(texto, esError) {
    const alerta = document.getElementById("mensaje-editor");
    if (!alerta) {
        return;
    }
    alerta.textContent = texto;
    alerta.className = esError ? "alerta-admin alerta-admin-error" : "alerta-admin alerta-admin-exito";
    alerta.hidden = false;
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
