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
        const permisos = datos.permisos || {};
        mostrarDatosCabecera(datos.usuario);
        renderizarSidebarNoticias(datos.modulos_permitidos || ["Dashboard"]);
        inicializarSidebarMovilNoticias();
        inicializarSalirNoticias();

        if (datos.permisos && !permisos.crear_noticias) {
            document.querySelectorAll('a[href="editar_noticia.html"]').forEach((enlace) => {
                enlace.hidden = true;
            });
        }

        const contenedor = document.getElementById("contenedor-admin");
        if (contenedor) {
            contenedor.hidden = false;
        }

        if (datos.permisos && !permisos.consultar_noticias_propias && !permisos.consultar_noticias_ajenas) {
            const cuerpo = document.getElementById("cuerpo-tabla-noticias");
            if (cuerpo) {
                cuerpo.textContent = "";
                const tr = document.createElement("tr");
                const td = document.createElement("td");
                td.colSpan = 6;
                td.className = "fila-vacia";
                td.textContent = "Tu rol actual no tiene permiso para consultar noticias registradas.";
                tr.appendChild(td);
                cuerpo.appendChild(tr);
            }
            return;
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

            if (n.estado === "publicada" && n.puede_retirar) {
                const btnRetirar = document.createElement("button");
                btnRetirar.type = "button";
                btnRetirar.className = "enlace-accion enlace-retirar";
                btnRetirar.textContent = "Retirar publicación";
                btnRetirar.addEventListener("click", () => {
                    cambiarEstadoPublicacion(n.id, n.titulo, "retirar_publicacion");
                });
                tdAcciones.appendChild(btnRetirar);
            } else if (n.estado === "archivada" && n.puede_restaurar) {
                const btnRestaurar = document.createElement("button");
                btnRestaurar.type = "button";
                btnRestaurar.className = "enlace-accion enlace-restaurar";
                btnRestaurar.textContent = "Restaurar publicación";
                btnRestaurar.addEventListener("click", () => {
                    cambiarEstadoPublicacion(n.id, n.titulo, "restaurar_publicacion");
                });
                tdAcciones.appendChild(btnRestaurar);
            }

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

async function cambiarEstadoPublicacion(id, titulo, accion) {
    const esRetiro = accion === "retirar_publicacion";
    const textoConfirmacion = esRetiro
        ? `¿Deseas retirar del portal público la noticia "${titulo}"?\n\nLa noticia se conservará como archivada en el panel administrativo.`
        : `¿Deseas restaurar la publicación "${titulo}" en el portal público?`;

    if (!window.confirm(textoConfirmacion)) {
        return;
    }

    const form = new FormData();
    form.append("csrf_token", csrfTokenNoticias);
    form.append("accion", accion);
    form.append("id", String(id));

    try {
        const respuesta = await fetch("../php/noticias.php", {
            method: "POST",
            body: form,
            credentials: "same-origin"
        });
        const resultado = await respuesta.json();

        if (respuesta.ok && resultado.ok) {
            mostrarMensajeNoticias(resultado.mensaje || "Estado actualizado correctamente.", false);
            await cargarNoticiasAdmin();
            return;
        }

        mostrarMensajeNoticias(resultado.mensaje || "No se pudo cambiar el estado de la publicación.", true);
        if (respuesta.status === 409) {
            await cargarNoticiasAdmin();
        }
    } catch {
        mostrarMensajeNoticias("Error de comunicación con el servidor.", true);
    }
}

function mostrarMensajeNoticias(texto, esError) {
    const alerta = document.getElementById("mensaje-noticias");
    if (!alerta) {
        return;
    }
    alerta.textContent = texto;
    alerta.className = esError ? "alerta-admin alerta-admin-error" : "alerta-admin alerta-admin-exito";
    alerta.hidden = false;
}
