/**
 * NewsCMS - Script de administración de listado de noticias (admin/noticias.html)
 */

let csrfTokenNoticias = "";

document.addEventListener("DOMContentLoaded", () => {
    iniciarListadoNoticias();
});

async function iniciarListadoNoticias() {
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

        csrfTokenNoticias = datos.csrf_token || "";
        mostrarDatosCabecera(datos.usuario);
        renderizarSidebarNoticias(datos.modulos_permitidos || ["Dashboard"]);
        inicializarSidebarMovilNoticias();
        inicializarSalirNoticias();

        const contenedor = document.getElementById("contenedor-admin");
        if (contenedor) {
            contenedor.hidden = false;
        }

        const filtroBusqueda = document.getElementById("filtro-busqueda");
        const filtroEstado = document.getElementById("filtro-estado");

        if (filtroBusqueda) {
            filtroBusqueda.addEventListener("input", () => cargarNoticiasAdmin());
        }
        if (filtroEstado) {
            filtroEstado.addEventListener("change", () => cargarNoticiasAdmin());
        }

        await cargarNoticiasAdmin();
    } catch {
        window.location.href = "../acceso.html";
    }
}

function mostrarDatosCabecera(usuario) {
    document.getElementById("nombre-usuario").textContent = usuario.nombre || "";
    document.getElementById("rol-usuario").textContent = usuario.rol || "";
    document.getElementById("rol-sidebar").textContent = usuario.rol || "";
}

function renderizarSidebarNoticias(modulos) {
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
        } else {
            enlace.href = `index.html?modulo=${encodeURIComponent(modulo)}`;
        }
        li.appendChild(enlace);
        lista.appendChild(li);
    });
}

async function cargarNoticiasAdmin() {
    const q = (document.getElementById("filtro-busqueda")?.value || "").trim();
    const estado = document.getElementById("filtro-estado")?.value || "";
    const cuerpo = document.getElementById("cuerpo-tabla-noticias");
    const totalEl = document.getElementById("total-registros");

    const params = new URLSearchParams({ modo: "admin_lista" });
    if (q) {
        params.set("q", q);
    }
    if (estado) {
        params.set("estado", estado);
    }

    try {
        const respuesta = await fetch(`../php/noticias.php?${params.toString()}`, {
            credentials: "same-origin"
        });
        if (!respuesta.ok) {
            return;
        }

        const datos = await respuesta.json();
        const noticias = datos.noticias || [];
        cuerpo.textContent = "";

        if (totalEl) {
            totalEl.textContent = `${noticias.length} registros`;
        }

        if (noticias.length === 0) {
            const tr = document.createElement("tr");
            const td = document.createElement("td");
            td.colSpan = 6;
            td.className = "fila-vacia";
            td.textContent = "No hay noticias que coincidan con la búsqueda.";
            tr.appendChild(td);
            cuerpo.appendChild(tr);
            return;
        }

        const etiquetasEstado = {
            borrador: "Borrador",
            pendiente_revision: "Pendiente de revisión",
            cambios_solicitados: "Cambios solicitados",
            publicada: "Publicada",
            archivada: "Archivada"
        };

        noticias.forEach((n) => {
            const tr = document.createElement("tr");

            const tdTitulo = document.createElement("td");
            const spanTitulo = document.createElement("span");
            spanTitulo.textContent = n.titulo;
            tdTitulo.appendChild(spanTitulo);

            if (n.estado === "cambios_solicitados" && n.ultima_observacion) {
                const obs = document.createElement("p");
                obs.className = "observacion-editorial";
                obs.textContent = `Observación del editor: ${n.ultima_observacion}`;
                tdTitulo.appendChild(obs);
            }

            const tdCategoria = document.createElement("td");
            tdCategoria.textContent = n.categoria;

            const tdAutor = document.createElement("td");
            tdAutor.textContent = n.autor;

            const tdEstado = document.createElement("td");
            const insignia = document.createElement("span");
            insignia.className = `estado-badge estado-${n.estado}`;
            insignia.textContent = etiquetasEstado[n.estado] || n.estado;
            tdEstado.appendChild(insignia);

            const tdFecha = document.createElement("td");
            const fechaBase = n.fecha_publicacion || n.fecha_creacion || "";
            tdFecha.textContent = fechaBase ? fechaBase.slice(0, 10) : "-";

            const tdAcciones = document.createElement("td");
            tdAcciones.className = "celda-acciones";

            if (n.puede_editar) {
                const btnEditar = document.createElement("a");
                btnEditar.href = `editar_noticia.html?id=${encodeURIComponent(n.id)}`;
                btnEditar.className = "enlace-accion";
                btnEditar.textContent = "Editar";
                tdAcciones.appendChild(btnEditar);
            }

            const btnVer = document.createElement("a");
            btnVer.href = `../noticia.html?id=${encodeURIComponent(n.id)}`;
            btnVer.className = "enlace-accion enlace-ver";
            btnVer.textContent = "Ver";
            tdAcciones.appendChild(btnVer);

            tr.appendChild(tdTitulo);
            tr.appendChild(tdCategoria);
            tr.appendChild(tdAutor);
            tr.appendChild(tdEstado);
            tr.appendChild(tdFecha);
            tr.appendChild(tdAcciones);
            cuerpo.appendChild(tr);
        });
    } catch {
        // Sin acción adicional si falla la red
    }
}

function inicializarSidebarMovilNoticias() {
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

function inicializarSalirNoticias() {
    const boton = document.getElementById("boton-salir");
    if (!boton) {
        return;
    }
    boton.addEventListener("click", async () => {
        const form = new FormData();
        form.append("csrf_token", csrfTokenNoticias);
        await fetch("../php/cerrar_sesion.php", {
            method: "POST",
            body: form,
            credentials: "same-origin"
        });
        window.location.href = "../acceso.html";
    });
}
