/**
 * NewsCMS - Script compartido para administrar Categorías y Etiquetas
 */

let csrfTokenCatalogo = "";
let tipoCatalogo = "categorias";

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

async function cargarListaCatalogo() {
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
        const registros = tipoCatalogo === "etiquetas"
            ? (datos.etiquetas || [])
            : (datos.categorias || []);

        if (totalEl) {
            const total = registros.length;
            if (tipoCatalogo === "etiquetas") {
                totalEl.textContent = total === 1 ? "1 etiqueta" : `${total} etiquetas`;
            } else {
                totalEl.textContent = total === 1 ? "1 categoría" : `${total} categorías`;
            }
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
            tdNombre.className = tipoCatalogo === "etiquetas" ? "celda-etiq-nombre" : "celda-cat-nombre";
            tdNombre.setAttribute("data-etiqueta", tipoCatalogo === "etiquetas" ? "Etiqueta" : "Nombre");
            const spanNombre = document.createElement("span");
            spanNombre.className = tipoCatalogo === "etiquetas" ? "chip-etiqueta-catalogo" : "nombre-categoria-catalogo";
            spanNombre.textContent = item.nombre;
            tdNombre.appendChild(spanNombre);
            tr.appendChild(tdNombre);

            if (tipoCatalogo === "categorias") {
                const tdDesc = document.createElement("td");
                tdDesc.className = "celda-cat-desc";
                tdDesc.setAttribute("data-etiqueta", "Descripción");
                const spanDesc = document.createElement("span");
                spanDesc.className = "descripcion-categoria-catalogo";
                spanDesc.textContent = item.descripcion || "—";
                tdDesc.appendChild(spanDesc);
                tr.appendChild(tdDesc);
            }

            const totalAsociadas = Number(item.total_noticias || 0);
            const tdTotal = document.createElement("td");
            tdTotal.className = "celda-catalogo-total";
            tdTotal.setAttribute("data-etiqueta", tipoCatalogo === "etiquetas" ? "Noticias relacionadas" : "Noticias");
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

function inicializarFormularioCatalogo() {
    const btnNuevo = document.getElementById("btn-nuevo-catalogo");
    const btnCancelar = document.getElementById("btn-cancelar-catalogo");
    const formulario = document.getElementById("formulario-catalogo");

    btnNuevo?.addEventListener("click", () => {
        restablecerFormularioCatalogo(true);
    });

    btnCancelar?.addEventListener("click", () => {
        restablecerFormularioCatalogo(false);
    });

    formulario?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = Number(document.getElementById("catalogo-id").value || 0);
        const nombre = document.getElementById("catalogo-nombre").value.trim();
        const descEl = document.getElementById("catalogo-descripcion");
        const descripcion = descEl ? descEl.value.trim() : "";

        if (!nombre) {
            mostrarMensajeCatalogo("El nombre es obligatorio.", true);
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

        try {
            const respuesta = await fetch("../php/catalogos.php", {
                method: "POST",
                body: form,
                credentials: "same-origin"
            });
            const resultado = await respuesta.json();

            if (respuesta.ok && resultado.ok) {
                mostrarMensajeCatalogo(resultado.mensaje || "Guardado correctamente.", false);
                restablecerFormularioCatalogo(false);
                await cargarListaCatalogo();
                return;
            }

            mostrarMensajeCatalogo(resultado.mensaje || "No se pudo guardar.", true);
        } catch {
            mostrarMensajeCatalogo("Error de comunicación con el servidor.", true);
        }
    });
}

function restablecerFormularioCatalogo(enfocar) {
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
        titulo.textContent = tipoCatalogo === "etiquetas" ? "Nueva etiqueta" : "Nueva categoría";
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
        titulo.textContent = tipoCatalogo === "etiquetas" ? "Editar etiqueta" : "Editar categoría";
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
            if (Number(document.getElementById("catalogo-id")?.value || 0) === Number(item.id)) {
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
    td.colSpan = tipoCatalogo === "etiquetas" ? 3 : 4;
    td.className = "fila-vacia";

    const caja = document.createElement("div");
    caja.className = "estado-vacio-catalogo";

    const titulo = document.createElement("strong");
    titulo.className = "titulo-estado-vacio";
    titulo.textContent = tipoCatalogo === "etiquetas"
        ? "Aún no hay etiquetas registradas."
        : "Aún no hay categorías registradas.";

    const nota = document.createElement("p");
    nota.className = "descripcion-estado-vacio";
    nota.textContent = tipoCatalogo === "etiquetas"
        ? "Escribe un nombre en el campo superior y pulsa Guardar para crear la primera etiqueta."
        : "Completa el formulario lateral para registrar la primera categoría editorial.";

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
