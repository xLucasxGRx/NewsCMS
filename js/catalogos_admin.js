/**
 * NewsCMS - Script compartido para administrar Categorías y Etiquetas
 */

let csrfTokenCatalogo = "";
let tipoCatalogo = "categorias";

// Estado exclusivo de Etiquetas (paginado y búsqueda en servidor)
let paginaActualEtiquetas = 1;
const POR_PAGINA_ETIQUETAS = 16;
let totalPaginasEtiquetas = 0;
let secuenciaEtiquetas = 0;
let temporizadorBusquedaEtiqueta = null;
let controladorBusquedaEtiqueta = null;
let envioCatalogoEnCurso = false;

document.addEventListener("DOMContentLoaded", () => {
    tipoCatalogo = document.body.getAttribute("data-catalogo") || "categorias";
    iniciarCatalogosAdmin();
});

async function iniciarCatalogosAdmin() {
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

        const permisos = datos.permisos || {};
        const permisoRequerido = tipoCatalogo === "etiquetas" ? "gestionar_etiquetas" : "gestionar_categorias";
        if (!permisos[permisoRequerido]) {
            window.location.href = "index.html";
            return;
        }

        csrfTokenCatalogo = datos.csrf_token || "";
        mostrarCabeceraCatalogo(datos.usuario);
        renderizarSidebarCatalogo(datos.modulos_permitidos || ["Dashboard"]);
        inicializarSidebarMovilCatalogo();
        inicializarSalirCatalogo();
        inicializarFormularioCatalogo();

        if (tipoCatalogo === "etiquetas") {
            inicializarControlesEtiquetas();
        }

        document.getElementById("contenedor-admin").hidden = false;
        await cargarListaCatalogo();
    } catch {
        window.location.href = "../acceso.html";
    }
}

function mostrarCabeceraCatalogo(usuario) {
    document.getElementById("nombre-usuario").textContent = usuario.nombre || "";
    document.getElementById("rol-usuario").textContent = usuario.rol || "";
    document.getElementById("rol-sidebar").textContent = usuario.rol || "";
}

function renderizarSidebarCatalogo(modulos) {
    const lista = document.getElementById("lista-modulos");
    if (!lista) {
        return;
    }
    lista.textContent = "";

    const moduloActivo = tipoCatalogo === "etiquetas" ? "Etiquetas" : "Categorías";

    modulos.forEach((modulo) => {
        const li = document.createElement("li");
        const enlace = document.createElement("a");
        enlace.className = modulo === moduloActivo ? "boton-modulo activo" : "boton-modulo";
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

function inicializarControlesEtiquetas() {
    const btnNueva = document.getElementById("btn-nueva-etiqueta");
    const btnCerrarModal = document.getElementById("btn-cerrar-modal-etiqueta");
    const modal = document.getElementById("panel-formulario-catalogo");
    const inputBusqueda = document.getElementById("filtro-busqueda-etiqueta");
    const btnLimpiarBusqueda = document.getElementById("btn-limpiar-busqueda-etiqueta");

    const btnPrimera = document.getElementById("btn-etiquetas-primera");
    const btnAnterior = document.getElementById("btn-etiquetas-anterior");
    const btnSiguiente = document.getElementById("btn-etiquetas-siguiente");
    const btnUltima = document.getElementById("btn-etiquetas-ultima");

    btnNueva?.addEventListener("click", abrirModalCrearEtiqueta);
    btnCerrarModal?.addEventListener("click", cerrarModalEtiqueta);

    modal?.addEventListener("click", (e) => {
        if (e.target === modal) {
            cerrarModalEtiqueta();
        }
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modal && !modal.hidden) {
            cerrarModalEtiqueta();
        }
    });

    const ejecutarBusquedaInmediata = () => {
        if (temporizadorBusquedaEtiqueta) {
            clearTimeout(temporizadorBusquedaEtiqueta);
            temporizadorBusquedaEtiqueta = null;
        }
        if (btnLimpiarBusqueda && inputBusqueda) {
            btnLimpiarBusqueda.hidden = inputBusqueda.value.trim() === "";
        }
        paginaActualEtiquetas = 1;
        cargarListaEtiquetasAdmin();
    };

    inputBusqueda?.addEventListener("input", () => {
        if (btnLimpiarBusqueda) {
            btnLimpiarBusqueda.hidden = inputBusqueda.value.trim() === "";
        }
        if (temporizadorBusquedaEtiqueta) {
            clearTimeout(temporizadorBusquedaEtiqueta);
        }
        paginaActualEtiquetas = 1;
        temporizadorBusquedaEtiqueta = setTimeout(() => {
            temporizadorBusquedaEtiqueta = null;
            cargarListaEtiquetasAdmin();
        }, 240);
    });

    inputBusqueda?.addEventListener("search", ejecutarBusquedaInmediata);

    btnLimpiarBusqueda?.addEventListener("click", () => {
        if (inputBusqueda) {
            inputBusqueda.value = "";
            inputBusqueda.focus();
        }
        btnLimpiarBusqueda.hidden = true;
        paginaActualEtiquetas = 1;
        cargarListaEtiquetasAdmin();
    });

    btnPrimera?.addEventListener("click", () => {
        if (paginaActualEtiquetas > 1) {
            paginaActualEtiquetas = 1;
            cargarListaEtiquetasAdmin();
        }
    });
    btnAnterior?.addEventListener("click", () => {
        if (paginaActualEtiquetas > 1) {
            paginaActualEtiquetas--;
            cargarListaEtiquetasAdmin();
        }
    });
    btnSiguiente?.addEventListener("click", () => {
        if (paginaActualEtiquetas < totalPaginasEtiquetas) {
            paginaActualEtiquetas++;
            cargarListaEtiquetasAdmin();
        }
    });
    btnUltima?.addEventListener("click", () => {
        if (totalPaginasEtiquetas > 1 && paginaActualEtiquetas < totalPaginasEtiquetas) {
            paginaActualEtiquetas = totalPaginasEtiquetas;
            cargarListaEtiquetasAdmin();
        }
    });
}

async function cargarListaCatalogo() {
    if (tipoCatalogo === "etiquetas") {
        await cargarListaEtiquetasAdmin();
        return;
    }

    const cuerpo = document.getElementById("cuerpo-tabla-catalogo");
    const totalEl = document.getElementById("total-catalogo");

    try {
        const respuesta = await fetch("../php/catalogos.php", {
            credentials: "same-origin"
        });
        if (!respuesta.ok) {
            mostrarMensajeCatalogo("No se pudieron cargar los registros.", true);
            return;
        }

        const datos = await respuesta.json();
        const registros = datos.categorias || [];

        if (totalEl) {
            const total = registros.length;
            totalEl.textContent = total === 1 ? "1 categoría" : `${total} categorías`;
        }

        cuerpo.textContent = "";
        if (registros.length === 0) {
            renderizarEstadoVacioCatalogo(cuerpo);
            return;
        }

        registros.forEach((item) => {
            const tr = document.createElement("tr");
            tr.dataset.catalogoId = String(item.id);

            const tdNombre = document.createElement("td");
            tdNombre.className = "celda-cat-nombre";
            tdNombre.setAttribute("data-etiqueta", "Nombre");
            const spanNombre = document.createElement("span");
            spanNombre.className = "nombre-categoria-catalogo";
            spanNombre.textContent = item.nombre;
            tdNombre.appendChild(spanNombre);
            tr.appendChild(tdNombre);

            const tdDesc = document.createElement("td");
            tdDesc.className = "celda-cat-desc";
            tdDesc.setAttribute("data-etiqueta", "Descripción");
            const spanDesc = document.createElement("span");
            spanDesc.className = "descripcion-categoria-catalogo";
            spanDesc.textContent = item.descripcion || "—";
            tdDesc.appendChild(spanDesc);
            tr.appendChild(tdDesc);

            const totalAsociadas = Number(item.total_noticias || 0);
            const tdTotal = document.createElement("td");
            tdTotal.className = "celda-catalogo-total";
            tdTotal.setAttribute("data-etiqueta", "Noticias");
            const badgeTotal = document.createElement("span");
            badgeTotal.className = totalAsociadas > 0
                ? "badge-conteo-catalogo con-noticias"
                : "badge-conteo-catalogo";
            badgeTotal.textContent = String(totalAsociadas);
            tdTotal.appendChild(badgeTotal);
            tr.appendChild(tdTotal);

            const tdAcciones = document.createElement("td");
            tdAcciones.className = "celda-acciones celda-acciones-catalogo";
            tdAcciones.setAttribute("data-etiqueta", "Acciones");

            const btnEditar = document.createElement("button");
            btnEditar.type = "button";
            btnEditar.className = "enlace-accion boton-accion-catalogo";
            btnEditar.appendChild(crearIconoCatalogoSvg("editar"));
            const lblEditar = document.createElement("span");
            lblEditar.textContent = "Editar";
            btnEditar.appendChild(lblEditar);
            btnEditar.addEventListener("click", () => abrirFormularioEdicion(item));
            tdAcciones.appendChild(btnEditar);

            if (totalAsociadas === 0) {
                const btnEliminar = document.createElement("button");
                btnEliminar.type = "button";
                btnEliminar.className = "enlace-accion enlace-eliminar boton-accion-catalogo";
                btnEliminar.appendChild(crearIconoCatalogoSvg("eliminar"));
                const lblEliminar = document.createElement("span");
                lblEliminar.textContent = "Eliminar";
                btnEliminar.appendChild(lblEliminar);
                btnEliminar.addEventListener("click", () => eliminarRegistro(item));
                tdAcciones.appendChild(btnEliminar);
            }

            tr.appendChild(tdAcciones);
            cuerpo.appendChild(tr);
        });
    } catch {
        mostrarMensajeCatalogo("No se pudieron cargar los registros.", true);
    }
}

async function cargarListaEtiquetasAdmin() {
    const rejilla = document.getElementById("cuerpo-tabla-catalogo");
    const totalEl = document.getElementById("total-catalogo");
    const resumenEl = document.getElementById("resumen-resultados-etiquetas");
    const q = (document.getElementById("filtro-busqueda-etiqueta")?.value || "").trim();

    const miSecuencia = ++secuenciaEtiquetas;
    if (controladorBusquedaEtiqueta) {
        controladorBusquedaEtiqueta.abort();
    }
    controladorBusquedaEtiqueta = typeof AbortController !== "undefined" ? new AbortController() : null;

    if (rejilla) {
        rejilla.textContent = "";
        const pCarga = document.createElement("p");
        pCarga.className = "cargando-etiquetas";
        pCarga.textContent = "Cargando etiquetas...";
        rejilla.appendChild(pCarga);
    }

    const params = new URLSearchParams({
        modo: "admin_etiquetas",
        pagina: String(paginaActualEtiquetas),
        por_pagina: String(POR_PAGINA_ETIQUETAS)
    });
    if (q !== "") {
        params.set("q", q);
    }

    try {
        const respuesta = await fetch(`../php/catalogos.php?${params.toString()}`, {
            credentials: "same-origin",
            signal: controladorBusquedaEtiqueta ? controladorBusquedaEtiqueta.signal : undefined
        });

        let datos = null;
        try {
            datos = await respuesta.json();
        } catch {
            datos = null;
        }

        if (miSecuencia !== secuenciaEtiquetas) {
            return;
        }

        if (!respuesta.ok || !datos || datos.ok !== true || !Array.isArray(datos.etiquetas)) {
            const msgErr = (datos && datos.mensaje) ? datos.mensaje : "No se pudieron cargar las etiquetas.";
            renderizarEstadoErrorEtiquetas(rejilla, msgErr);
            mostrarMensajeCatalogo(msgErr, true);
            return;
        }

        const etiquetas = datos.etiquetas;
        const totalFiltrado = Number(datos.total ?? etiquetas.length);
        const totalRegistrado = Number(datos.total_registrado ?? totalFiltrado);
        const porPagina = Number(datos.por_pagina ?? POR_PAGINA_ETIQUETAS);
        paginaActualEtiquetas = Number(datos.pagina ?? 1);
        totalPaginasEtiquetas = Number(datos.total_paginas ?? 0);

        if (totalEl) {
            totalEl.textContent = totalRegistrado === 1 ? "1 etiqueta" : `${totalRegistrado} etiquetas`;
        }

        if (resumenEl) {
            resumenEl.textContent = q !== ""
                ? `${totalFiltrado} de ${totalRegistrado} ${totalRegistrado === 1 ? "resultado" : "resultados"}`
                : "Orden alfabético (A–Z)";
        }

        actualizarPaginacionEtiquetas(totalFiltrado, paginaActualEtiquetas, porPagina, totalPaginasEtiquetas);

        if (!rejilla) {
            return;
        }
        rejilla.textContent = "";

        if (etiquetas.length === 0) {
            renderizarEstadoVacioEtiquetas(rejilla, q !== "");
            return;
        }

        etiquetas.forEach((item) => {
            rejilla.appendChild(construirTarjetaEtiqueta(item));
        });
    } catch (error) {
        if (error && error.name === "AbortError") {
            return;
        }
        if (miSecuencia === secuenciaEtiquetas) {
            renderizarEstadoErrorEtiquetas(rejilla, "No se pudo conectar con el servidor.");
            mostrarMensajeCatalogo("No se pudieron cargar las etiquetas.", true);
        }
    }
}

function construirTarjetaEtiqueta(item) {
    const totalNoticias = Number(item.total_noticias || 0);

    const card = document.createElement("article");
    card.className = "item-etiqueta-admin";
    card.dataset.catalogoId = String(item.id);

    const info = document.createElement("div");
    info.className = "info-etiqueta-item";

    const nombre = document.createElement("span");
    nombre.className = "nombre-etiqueta-item";
    nombre.textContent = item.nombre || "";

    const conteo = document.createElement("span");
    conteo.className = totalNoticias > 0
        ? "conteo-etiqueta-item con-noticias"
        : "conteo-etiqueta-item";
    conteo.textContent = totalNoticias === 1
        ? "1 noticia relacionada"
        : `${totalNoticias} noticias relacionadas`;

    info.appendChild(nombre);
    info.appendChild(conteo);

    const acciones = document.createElement("div");
    acciones.className = "acciones-etiqueta-item";

    const btnEditar = document.createElement("button");
    btnEditar.type = "button";
    btnEditar.className = "btn-icono-etiqueta btn-editar-etiqueta";
    btnEditar.title = `Editar etiqueta "${item.nombre}"`;
    btnEditar.setAttribute("aria-label", `Editar etiqueta ${item.nombre}`);
    btnEditar.appendChild(crearIconoCatalogoSvg("editar"));
    btnEditar.addEventListener("click", () => abrirFormularioEdicion(item));
    acciones.appendChild(btnEditar);

    if (totalNoticias === 0) {
        const btnEliminar = document.createElement("button");
        btnEliminar.type = "button";
        btnEliminar.className = "btn-icono-etiqueta btn-eliminar-etiqueta";
        btnEliminar.title = `Eliminar etiqueta "${item.nombre}"`;
        btnEliminar.setAttribute("aria-label", `Eliminar etiqueta ${item.nombre}`);
        btnEliminar.appendChild(crearIconoCatalogoSvg("eliminar"));
        btnEliminar.addEventListener("click", () => eliminarRegistro(item));
        acciones.appendChild(btnEliminar);
    }

    card.appendChild(info);
    card.appendChild(acciones);
    return card;
}

function construirVentanaPaginasEtiquetas(actual, total) {
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

function actualizarPaginacionEtiquetas(totalFiltrado, pagina, porPagina, totalPaginas) {
    const bloque = document.getElementById("paginacion-etiquetas");
    const infoEl = document.getElementById("info-paginacion-etiquetas");
    const detalleEl = document.getElementById("detalle-pagina-etiquetas");
    const controlesEl = document.getElementById("controles-paginacion-etiquetas");
    const numerosEl = document.getElementById("numeros-paginacion-etiquetas");
    const btnPri = document.getElementById("btn-etiquetas-primera");
    const btnAnt = document.getElementById("btn-etiquetas-anterior");
    const btnSig = document.getElementById("btn-etiquetas-siguiente");
    const btnUlt = document.getElementById("btn-etiquetas-ultima");

    if (!bloque) {
        return;
    }

    if (totalFiltrado <= 0 || totalPaginas <= 0) {
        bloque.hidden = true;
        return;
    }

    bloque.hidden = false;
    const inicio = (pagina - 1) * porPagina + 1;
    const fin = Math.min(pagina * porPagina, totalFiltrado);
    const palabra = totalFiltrado === 1 ? "etiqueta" : "etiquetas";

    if (infoEl) {
        infoEl.textContent = `Mostrando ${inicio}\u2013${fin} de ${totalFiltrado} ${palabra}`;
    }
    if (detalleEl) {
        detalleEl.textContent = `Página ${pagina} de ${totalPaginas}`;
    }

    if (controlesEl) {
        controlesEl.hidden = totalPaginas <= 1;
    }

    if (totalPaginas <= 1) {
        if (numerosEl) numerosEl.textContent = "";
        return;
    }

    if (btnPri) btnPri.disabled = pagina <= 1;
    if (btnAnt) btnAnt.disabled = pagina <= 1;
    if (btnSig) btnSig.disabled = pagina >= totalPaginas;
    if (btnUlt) btnUlt.disabled = pagina >= totalPaginas;

    if (numerosEl) {
        numerosEl.textContent = "";
        construirVentanaPaginasEtiquetas(pagina, totalPaginas).forEach((item) => {
            if (item === "...") {
                const span = document.createElement("span");
                span.className = "elipsis-paginacion-etiquetas";
                span.setAttribute("aria-hidden", "true");
                span.textContent = "...";
                numerosEl.appendChild(span);
                return;
            }
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = item === pagina ? "btn-pagina-etiqueta activa" : "btn-pagina-etiqueta";
            btn.textContent = String(item);
            btn.setAttribute("aria-label", `Página ${item}`);
            if (item === pagina) {
                btn.setAttribute("aria-current", "page");
                btn.disabled = true;
            } else {
                btn.addEventListener("click", () => {
                    paginaActualEtiquetas = item;
                    cargarListaEtiquetasAdmin();
                });
            }
            numerosEl.appendChild(btn);
        });
    }
}

function renderizarEstadoVacioEtiquetas(contenedor, hayBusqueda) {
    const caja = document.createElement("div");
    caja.className = "estado-vacio-etiquetas";

    const titulo = document.createElement("strong");
    titulo.className = "titulo-estado-vacio";
    titulo.textContent = hayBusqueda
        ? "No se encontraron etiquetas con esa búsqueda."
        : "Aún no hay etiquetas registradas.";

    const nota = document.createElement("p");
    nota.className = "descripcion-estado-vacio";
    nota.textContent = hayBusqueda
        ? "Prueba con otro término o limpia el buscador para ver todo el catálogo."
        : "Pulsa «+ Nueva etiqueta» para agregar la primera palabra clave del portal.";

    caja.appendChild(titulo);
    caja.appendChild(nota);

    if (hayBusqueda) {
        const btnLimpiar = document.createElement("button");
        btnLimpiar.type = "button";
        btnLimpiar.className = "boton-secundario-admin";
        btnLimpiar.textContent = "Limpiar búsqueda";
        btnLimpiar.addEventListener("click", () => {
            const input = document.getElementById("filtro-busqueda-etiqueta");
            const btnX = document.getElementById("btn-limpiar-busqueda-etiqueta");
            if (input) input.value = "";
            if (btnX) btnX.hidden = true;
            paginaActualEtiquetas = 1;
            cargarListaEtiquetasAdmin();
        });
        caja.appendChild(btnLimpiar);
    } else {
        const btnNueva = document.createElement("button");
        btnNueva.type = "button";
        btnNueva.className = "boton-primario-admin";
        btnNueva.textContent = "+ Nueva etiqueta";
        btnNueva.addEventListener("click", abrirModalCrearEtiqueta);
        caja.appendChild(btnNueva);
    }

    contenedor.appendChild(caja);
}

function renderizarEstadoErrorEtiquetas(contenedor, detalle) {
    if (!contenedor) {
        return;
    }
    contenedor.textContent = "";
    const caja = document.createElement("div");
    caja.className = "estado-vacio-etiquetas";

    const titulo = document.createElement("strong");
    titulo.className = "titulo-estado-vacio";
    titulo.textContent = "Error al cargar etiquetas";

    const desc = document.createElement("p");
    desc.className = "descripcion-estado-vacio";
    desc.textContent = detalle || "Ocurrió un problema inesperado.";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "boton-secundario-admin";
    btn.textContent = "Reintentar";
    btn.addEventListener("click", cargarListaEtiquetasAdmin);

    caja.appendChild(titulo);
    caja.appendChild(desc);
    caja.appendChild(btn);
    contenedor.appendChild(caja);

    const pag = document.getElementById("paginacion-etiquetas");
    if (pag) pag.hidden = true;
}

function ocultarMensajeModalEtiqueta() {
    const alerta = document.getElementById("mensaje-modal-etiqueta");
    if (alerta) {
        alerta.textContent = "";
        alerta.hidden = true;
    }
}

function mostrarMensajeModalEtiqueta(texto) {
    const alerta = document.getElementById("mensaje-modal-etiqueta");
    if (!alerta) {
        mostrarMensajeCatalogo(texto, true);
        return;
    }
    alerta.textContent = texto;
    alerta.className = "alerta-admin alerta-admin-error alerta-modal-etiqueta";
    alerta.hidden = false;
}

function abrirModalCrearEtiqueta() {
    document.getElementById("catalogo-id").value = "0";
    const nombreEl = document.getElementById("catalogo-nombre");
    if (nombreEl) {
        nombreEl.value = "";
    }
    const titulo = document.getElementById("titulo-form-catalogo");
    if (titulo) {
        titulo.textContent = "Crear nueva etiqueta";
    }
    const subtitulo = document.getElementById("subtitulo-modal-etiqueta");
    if (subtitulo) {
        subtitulo.textContent = "Agrega una palabra clave para organizar y relacionar noticias.";
        subtitulo.hidden = false;
    }
    const btnGuardar = document.getElementById("btn-guardar-etiqueta");
    if (btnGuardar) {
        btnGuardar.textContent = "Crear etiqueta";
        btnGuardar.disabled = false;
    }
    ocultarMensajeModalEtiqueta();
    const modal = document.getElementById("panel-formulario-catalogo");
    if (modal) {
        modal.hidden = false;
    }
    nombreEl?.focus();
}

function cerrarModalEtiqueta() {
    const modal = document.getElementById("panel-formulario-catalogo");
    if (modal) {
        modal.hidden = true;
    }
    ocultarMensajeModalEtiqueta();
}

function inicializarFormularioCatalogo() {
    const btnNuevo = document.getElementById("btn-nuevo-catalogo");
    const btnCancelar = document.getElementById("btn-cancelar-catalogo");
    const formulario = document.getElementById("formulario-catalogo");

    btnNuevo?.addEventListener("click", () => {
        if (tipoCatalogo === "etiquetas") {
            abrirModalCrearEtiqueta();
        } else {
            restablecerFormularioCatalogo(true);
        }
    });

    btnCancelar?.addEventListener("click", () => {
        if (tipoCatalogo === "etiquetas") {
            cerrarModalEtiqueta();
        } else {
            restablecerFormularioCatalogo(false);
        }
    });

    formulario?.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (envioCatalogoEnCurso) {
            return;
        }

        const id = Number(document.getElementById("catalogo-id").value || 0);
        const nombreEl = document.getElementById("catalogo-nombre");
        const nombre = (nombreEl?.value || "").trim();
        const descEl = document.getElementById("catalogo-descripcion");
        const descripcion = descEl ? descEl.value.trim() : "";

        if (!nombre) {
            if (tipoCatalogo === "etiquetas") {
                mostrarMensajeModalEtiqueta("El nombre de la etiqueta es obligatorio.");
                nombreEl?.focus();
            } else {
                mostrarMensajeCatalogo("El nombre es obligatorio.", true);
            }
            return;
        }

        const form = new FormData();
        form.append("csrf_token", csrfTokenCatalogo);
        form.append("nombre", nombre);

        if (tipoCatalogo === "categorias") {
            form.append("accion", id > 0 ? "editar_categoria" : "crear_categoria");
            form.append("descripcion", descripcion);
        } else {
            form.append("accion", id > 0 ? "editar_etiqueta" : "crear_etiqueta");
        }

        if (id > 0) {
            form.append("id", String(id));
        }

        const btnSubmit = formulario.querySelector('button[type="submit"]');
        const textoOriginalBtn = btnSubmit ? btnSubmit.textContent : "";
        envioCatalogoEnCurso = true;
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.textContent = "Guardando...";
        }

        try {
            const respuesta = await fetch("../php/catalogos.php", {
                method: "POST",
                body: form,
                credentials: "same-origin"
            });
            const resultado = await respuesta.json();

            if (respuesta.ok && resultado.ok) {
                mostrarMensajeCatalogo(resultado.mensaje || "Guardado correctamente.", false);
                if (tipoCatalogo === "etiquetas") {
                    cerrarModalEtiqueta();
                } else {
                    restablecerFormularioCatalogo(false);
                }
                await cargarListaCatalogo();
                return;
            }

            const errorMsg = resultado.mensaje || "No se pudo guardar.";
            if (tipoCatalogo === "etiquetas") {
                mostrarMensajeModalEtiqueta(errorMsg);
                nombreEl?.focus();
            } else {
                mostrarMensajeCatalogo(errorMsg, true);
            }
        } catch {
            if (tipoCatalogo === "etiquetas") {
                mostrarMensajeModalEtiqueta("Error de comunicación con el servidor.");
            } else {
                mostrarMensajeCatalogo("Error de comunicación con el servidor.", true);
            }
        } finally {
            envioCatalogoEnCurso = false;
            if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.textContent = textoOriginalBtn;
            }
        }
    });
}

function restablecerFormularioCatalogo(enfocar) {
    if (tipoCatalogo === "etiquetas") {
        cerrarModalEtiqueta();
        return;
    }

    document.getElementById("catalogo-id").value = "0";
    const nombreEl = document.getElementById("catalogo-nombre");
    if (nombreEl) {
        nombreEl.value = "";
        if (enfocar) {
            nombreEl.focus();
        }
    }
    const desc = document.getElementById("catalogo-descripcion");
    if (desc) {
        desc.value = "";
    }
    const titulo = document.getElementById("titulo-form-catalogo");
    if (titulo) {
        titulo.textContent = "Nueva categoría";
    }
    const btnCancelar = document.getElementById("btn-cancelar-catalogo");
    if (btnCancelar) {
        btnCancelar.hidden = true;
    }
    const panel = document.getElementById("panel-formulario-catalogo");
    if (panel) {
        panel.hidden = false;
        panel.classList.remove("modo-edicion");
    }
    resaltarFilaCatalogo(0);
}

function abrirFormularioEdicion(item) {
    if (tipoCatalogo === "etiquetas") {
        document.getElementById("catalogo-id").value = String(item.id);
        const nombreEl = document.getElementById("catalogo-nombre");
        if (nombreEl) {
            nombreEl.value = item.nombre || "";
        }
        const titulo = document.getElementById("titulo-form-catalogo");
        if (titulo) {
            titulo.textContent = "Editar etiqueta";
        }
        const subtitulo = document.getElementById("subtitulo-modal-etiqueta");
        if (subtitulo) {
            subtitulo.textContent = "Actualiza el nombre de esta palabra clave en todo el catálogo.";
            subtitulo.hidden = false;
        }
        const btnGuardar = document.getElementById("btn-guardar-etiqueta");
        if (btnGuardar) {
            btnGuardar.textContent = "Guardar cambios";
            btnGuardar.disabled = false;
        }
        ocultarMensajeModalEtiqueta();
        const modal = document.getElementById("panel-formulario-catalogo");
        if (modal) {
            modal.hidden = false;
        }
        nombreEl?.focus();
        return;
    }

    document.getElementById("catalogo-id").value = String(item.id);
    const nombreEl = document.getElementById("catalogo-nombre");
    if (nombreEl) {
        nombreEl.value = item.nombre || "";
        nombreEl.focus();
    }
    const desc = document.getElementById("catalogo-descripcion");
    if (desc) {
        desc.value = item.descripcion || "";
    }
    const titulo = document.getElementById("titulo-form-catalogo");
    if (titulo) {
        titulo.textContent = "Editar categoría";
    }
    const btnCancelar = document.getElementById("btn-cancelar-catalogo");
    if (btnCancelar) {
        btnCancelar.hidden = false;
    }
    const panel = document.getElementById("panel-formulario-catalogo");
    if (panel) {
        panel.hidden = false;
        panel.classList.add("modo-edicion");
    }
    resaltarFilaCatalogo(item.id);
}

async function eliminarRegistro(item) {
    const etiquetaTipo = tipoCatalogo === "etiquetas" ? "la etiqueta" : "la categoría";
    if (!window.confirm(`¿Deseas eliminar ${etiquetaTipo} "${item.nombre}"?`)) {
        return;
    }

    const form = new FormData();
    form.append("csrf_token", csrfTokenCatalogo);
    form.append("id", String(item.id));
    form.append("accion", tipoCatalogo === "etiquetas" ? "eliminar_etiqueta" : "eliminar_categoria");

    try {
        const respuesta = await fetch("../php/catalogos.php", {
            method: "POST",
            body: form,
            credentials: "same-origin"
        });
        const resultado = await respuesta.json();

        if (respuesta.ok && resultado.ok) {
            mostrarMensajeCatalogo(resultado.mensaje || "Eliminado correctamente.", false);
            if (tipoCatalogo === "categorias" && Number(document.getElementById("catalogo-id")?.value || 0) === Number(item.id)) {
                restablecerFormularioCatalogo(false);
            }
            await cargarListaCatalogo();
            return;
        }

        mostrarMensajeCatalogo(resultado.mensaje || "No se pudo eliminar el registro.", true);
    } catch {
        mostrarMensajeCatalogo("Error de comunicación con el servidor.", true);
    }
}

function mostrarMensajeCatalogo(texto, esError) {
    const alerta = document.getElementById("mensaje-catalogo");
    if (!alerta) {
        return;
    }
    alerta.textContent = texto;
    alerta.className = esError ? "alerta-admin alerta-admin-error" : "alerta-admin alerta-admin-exito";
    alerta.hidden = false;
}

function inicializarSidebarMovilCatalogo() {
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

function inicializarSalirCatalogo() {
    const boton = document.getElementById("boton-salir");
    if (!boton) {
        return;
    }
    boton.addEventListener("click", async () => {
        const form = new FormData();
        form.append("csrf_token", csrfTokenCatalogo);
        await fetch("../php/cerrar_sesion.php", {
            method: "POST",
            body: form,
            credentials: "same-origin"
        });
        window.location.href = "../acceso.html";
    });
}

function renderizarEstadoVacioCatalogo(cuerpo) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 4;
    td.className = "fila-vacia";

    const caja = document.createElement("div");
    caja.className = "estado-vacio-catalogo";

    const titulo = document.createElement("strong");
    titulo.className = "titulo-estado-vacio";
    titulo.textContent = "Aún no hay categorías registradas.";

    const nota = document.createElement("p");
    nota.className = "descripcion-estado-vacio";
    nota.textContent = "Completa el formulario lateral para registrar la primera categoría editorial.";

    caja.appendChild(titulo);
    caja.appendChild(nota);
    td.appendChild(caja);
    tr.appendChild(td);
    cuerpo.appendChild(tr);
}

function resaltarFilaCatalogo(id) {
    const objetivo = String(id || "");
    document.querySelectorAll("#cuerpo-tabla-catalogo tr[data-catalogo-id]").forEach((fila) => {
        fila.classList.toggle("fila-catalogo-activa", objetivo !== "0" && fila.dataset.catalogoId === objetivo);
    });
}

function crearIconoCatalogoSvg(tipo) {
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

    if (tipo === "editar") {
        agregar("path", { d: "M12 20h9" });
        agregar("path", { d: "M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" });
    } else if (tipo === "eliminar") {
        agregar("path", { d: "M3 6h18" });
        agregar("path", { d: "M8 6V4h8v2" });
        agregar("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" });
    }

    return svg;
}
