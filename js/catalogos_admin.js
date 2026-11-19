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

        const rol = datos.usuario.rol || "";
        if (rol !== "administrador" && rol !== "editor") {
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
            return;
        }

        const datos = await respuesta.json();
        const registros = tipoCatalogo === "etiquetas"
            ? (datos.etiquetas || [])
            : (datos.categorias || []);

        if (totalEl) {
            totalEl.textContent = `${registros.length} registros`;
        }

        cuerpo.textContent = "";
        if (registros.length === 0) {
            const tr = document.createElement("tr");
            const td = document.createElement("td");
            td.colSpan = tipoCatalogo === "etiquetas" ? 3 : 4;
            td.className = "fila-vacia";
            td.textContent = tipoCatalogo === "etiquetas"
                ? "Aún no hay etiquetas registradas."
                : "Aún no hay categorías registradas.";
            tr.appendChild(td);
            cuerpo.appendChild(tr);
            return;
        }

        registros.forEach((item) => {
            const tr = document.createElement("tr");

            const tdNombre = document.createElement("td");
            tdNombre.textContent = item.nombre;
            tr.appendChild(tdNombre);

            if (tipoCatalogo === "categorias") {
                const tdDesc = document.createElement("td");
                tdDesc.textContent = item.descripcion || "—";
                tr.appendChild(tdDesc);
            }

            const totalAsociadas = Number(item.total_noticias || 0);
            const tdTotal = document.createElement("td");
            tdTotal.textContent = String(totalAsociadas);
            tr.appendChild(tdTotal);

            const tdAcciones = document.createElement("td");
            tdAcciones.className = "celda-acciones";

            const btnEditar = document.createElement("button");
            btnEditar.type = "button";
            btnEditar.className = "enlace-accion";
            btnEditar.textContent = "Editar";
            btnEditar.addEventListener("click", () => abrirFormularioEdicion(item));
            tdAcciones.appendChild(btnEditar);

            if (totalAsociadas === 0) {
                const btnEliminar = document.createElement("button");
                btnEliminar.type = "button";
                btnEliminar.className = "enlace-accion enlace-eliminar";
                btnEliminar.textContent = "Eliminar";
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
        document.getElementById("catalogo-id").value = "0";
        document.getElementById("catalogo-nombre").value = "";
        const desc = document.getElementById("catalogo-descripcion");
        if (desc) {
            desc.value = "";
        }
        document.getElementById("titulo-form-catalogo").textContent =
            tipoCatalogo === "etiquetas" ? "Nueva etiqueta" : "Nueva categoría";
        document.getElementById("panel-formulario-catalogo").hidden = false;
    });

    btnCancelar?.addEventListener("click", () => {
        document.getElementById("panel-formulario-catalogo").hidden = true;
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
                document.getElementById("panel-formulario-catalogo").hidden = true;
                await cargarListaCatalogo();
                return;
            }

            mostrarMensajeCatalogo(resultado.mensaje || "No se pudo guardar.", true);
        } catch {
            mostrarMensajeCatalogo("Error de comunicación con el servidor.", true);
        }
    });
}

function abrirFormularioEdicion(item) {
    document.getElementById("catalogo-id").value = String(item.id);
    document.getElementById("catalogo-nombre").value = item.nombre || "";
    const desc = document.getElementById("catalogo-descripcion");
    if (desc) {
        desc.value = item.descripcion || "";
    }
    document.getElementById("titulo-form-catalogo").textContent =
        tipoCatalogo === "etiquetas" ? "Editar etiqueta" : "Editar categoría";
    document.getElementById("panel-formulario-catalogo").hidden = false;
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
