/**
 * NewsCMS - Script del formulario de creación y edición de noticias
 * Incluye editor enriquecido nativo con Selection/Range APIs.
 */

let csrfTokenEditor = "";
let rolUsuarioEditor = "";

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
        document.getElementById("csrf-token").value = csrfTokenEditor;

        mostrarUsuarioEditor(datos.usuario);
        renderizarSidebarEditor(datos.modulos_permitidos || ["Dashboard"]);
        configurarPermisosVisuales(rolUsuarioEditor);
        inicializarSidebarMovilEditor();
        inicializarSalirEditor();
        inicializarEditorEnriquecido();
        inicializarVistaPreviaImagen();
        inicializarBotonesGuardado();

        await cargarCatalogos();

        const params = new URLSearchParams(window.location.search);
        const idNoticia = Number(params.get("id") || 0);
        if (idNoticia > 0) {
            await cargarNoticiaExistente(idNoticia);
        }

        document.getElementById("contenedor-admin").hidden = false;
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

function configurarPermisosVisuales(rol) {
    const btnPublicar = document.getElementById("btn-publicar");
    const opcionesEditoriales = document.getElementById("opciones-editoriales");
    const puedePublicar = rol === "administrador" || rol === "editor";

    if (btnPublicar) {
        btnPublicar.hidden = !puedePublicar;
    }
    if (opcionesEditoriales) {
        opcionesEditoriales.hidden = !puedePublicar;
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

    const editor = document.getElementById("editor-contenido");
    editor.innerHTML = n.contenido || "<p></p>";

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
 * Inicializa la barra de herramientas del editor contenteditable con APIs nativas.
 */
function inicializarEditorEnriquecido() {
    const editor = document.getElementById("editor-contenido");
    const botones = document.querySelectorAll(".boton-editor");

    botones.forEach((boton) => {
        boton.addEventListener("click", () => {
            const formato = boton.getAttribute("data-formato");
            editor.focus();
            aplicarFormatoNativo(editor, formato);
        });
    });
}

function aplicarFormatoNativo(editor, formato) {
    const seleccion = window.getSelection();
    if (!seleccion || seleccion.rangeCount === 0) {
        return;
    }

    const rango = seleccion.getRangeAt(0);
    if (!editor.contains(rango.commonAncestorContainer)) {
        return;
    }

    if (formato === "strong" || formato === "em") {
        const elemento = document.createElement(formato);
        if (rango.collapsed) {
            elemento.textContent = formato === "strong" ? "texto en negrita" : "texto en cursiva";
            rango.insertNode(elemento);
        } else {
            elemento.appendChild(rango.extractContents());
            rango.insertNode(elemento);
        }
        seleccion.removeAllRanges();
        const nuevoRango = document.createRange();
        nuevoRango.selectNodeContents(elemento);
        seleccion.addRange(nuevoRango);
        return;
    }

    if (formato === "p" || formato === "h2" || formato === "h3") {
        const bloque = document.createElement(formato);
        if (rango.collapsed) {
            bloque.textContent = formato === "p" ? "Nuevo párrafo" : "Subtítulo";
            editor.appendChild(bloque);
        } else {
            bloque.appendChild(rango.extractContents());
            rango.insertNode(bloque);
        }
        return;
    }

    if (formato === "ul" || formato === "ol") {
        const lista = document.createElement(formato);
        const item = document.createElement("li");
        if (rango.collapsed) {
            item.textContent = "Elemento de lista";
        } else {
            item.appendChild(rango.extractContents());
        }
        lista.appendChild(item);
        rango.insertNode(lista);
        return;
    }

    if (formato === "a") {
        const url = window.prompt("Ingresa la dirección del enlace (https://...):", "https://");
        if (!url || !/^https?:\/\//i.test(url.trim())) {
            return;
        }
        const enlace = document.createElement("a");
        enlace.href = url.trim();
        enlace.rel = "noopener noreferrer";
        if (rango.collapsed) {
            enlace.textContent = url.trim();
        } else {
            enlace.appendChild(rango.extractContents());
        }
        rango.insertNode(enlace);
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
    const formulario = document.getElementById("formulario-noticia");
    const editor = document.getElementById("editor-contenido");
    const datosFormulario = new FormData(formulario);

    datosFormulario.set("contenido", editor.innerHTML);
    datosFormulario.set("accion", accion);

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
