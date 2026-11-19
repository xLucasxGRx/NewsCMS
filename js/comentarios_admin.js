/**
 * NewsCMS - Script de moderación administrativa de comentarios (admin/comentarios.html)
 */

let csrfTokenComentarios = "";
let paginaActualComentarios = 1;
const POR_PAGINA_COMENTARIOS = 10;
let cargandoComentarios = false;

document.addEventListener("DOMContentLoaded", () => {
    iniciarComentariosAdmin();
});

async function iniciarComentariosAdmin() {
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

        csrfTokenComentarios = datos.csrf_token || "";
        mostrarCabeceraComentarios(datos.usuario);
        renderizarSidebarComentarios(datos.modulos_permitidos || ["Dashboard"]);
        inicializarSidebarMovilComentarios();
        inicializarSalirComentarios();

        document.getElementById("filtro-estado-comentarios")?.addEventListener("change", () => {
            paginaActualComentarios = 1;
            cargarComentariosAdmin();
        });

        document.getElementById("btn-comentarios-anterior")?.addEventListener("click", () => {
            if (!cargandoComentarios && paginaActualComentarios > 1) {
                paginaActualComentarios--;
                cargarComentariosAdmin();
            }
        });

        document.getElementById("btn-comentarios-siguiente")?.addEventListener("click", () => {
            if (!cargandoComentarios) {
                paginaActualComentarios++;
                cargarComentariosAdmin();
            }
        });

        document.getElementById("contenedor-admin").hidden = false;
        await cargarComentariosAdmin();
    } catch {
        window.location.href = "../acceso.html";
    }
}

function mostrarCabeceraComentarios(usuario) {
    document.getElementById("nombre-usuario").textContent = usuario.nombre || "";
    document.getElementById("rol-usuario").textContent = usuario.rol || "";
    document.getElementById("rol-sidebar").textContent = usuario.rol || "";
}

function renderizarSidebarComentarios(modulos) {
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

async function cargarComentariosAdmin() {
    if (cargandoComentarios) {
        return;
    }

    const bandeja = document.getElementById("cuerpo-tabla-comentarios");
    const totalEl = document.getElementById("total-comentarios");
    const filtroEl = document.getElementById("filtro-estado-comentarios");
    const estado = filtroEl ? filtroEl.value : "";

    const params = new URLSearchParams({
        modo: "admin_lista",
        pagina: String(paginaActualComentarios),
        por_pagina: String(POR_PAGINA_COMENTARIOS)
    });
    if (estado) {
        params.set("estado", estado);
    }

    cargandoComentarios = true;
    actualizarBotonesPaginacion(true, 1, 1);

    try {
        const respuesta = await fetch(`../php/comentarios.php?${params.toString()}`, {
            credentials: "same-origin"
        });
        if (!respuesta.ok) {
            throw new Error("Error HTTP");
        }

        const datos = await respuesta.json();
        const lista = datos.comentarios || [];
        const contadores = datos.contadores || {};
        const paginacion = datos.paginacion || {};

        const paginaReal = Number(paginacion.pagina || 1);
        const totalPaginas = Number(paginacion.total_paginas || 1);
        const totalFiltrado = Number(paginacion.total ?? lista.length);
        paginaActualComentarios = paginaReal;

        actualizarContadoresComentarios(contadores);
        actualizarPaginacionComentarios(paginaReal, totalPaginas, totalFiltrado);

        if (totalEl) {
            totalEl.textContent = totalFiltrado === 1 ? "1 comentario" : `${totalFiltrado} comentarios`;
        }

        bandeja.textContent = "";
        if (lista.length === 0) {
            const mensajesVacios = {
                pendiente: "No hay comentarios pendientes de revisión en este momento.",
                aprobado: "No hay comentarios aprobados registrados.",
                rechazado: "No hay comentarios rechazados registrados."
            };
            const vacio = document.createElement("div");
            vacio.className = "estado-vacio-comentarios";
            const p = document.createElement("p");
            p.textContent = mensajesVacios[estado] || "No hay comentarios registrados todavía.";
            vacio.appendChild(p);

            if (estado === "pendiente" && filtroEl) {
                const btnVerTodos = document.createElement("button");
                btnVerTodos.type = "button";
                btnVerTodos.className = "boton-secundario-admin btn-ver-todos-vacio";
                btnVerTodos.textContent = "Ver todos los comentarios";
                btnVerTodos.addEventListener("click", () => {
                    filtroEl.value = "";
                    paginaActualComentarios = 1;
                    cargarComentariosAdmin();
                });
                vacio.appendChild(btnVerTodos);
            }

            bandeja.appendChild(vacio);
            return;
        }

        const clasesEstado = {
            pendiente: "estado-pendiente_revision",
            aprobado: "estado-publicada",
            rechazado: "estado-cambios_solicitados"
        };

        const etiquetasEstado = {
            pendiente: "Pendiente",
            aprobado: "Aprobado",
            rechazado: "Rechazado"
        };

        lista.forEach((item) => {
            const esPendiente = item.estado === "pendiente";

            const articulo = document.createElement("article");
            articulo.className = esPendiente
                ? "item-moderacion-comentario item-moderacion-pendiente"
                : "item-moderacion-comentario";

            // A. Encabezado: Autor, fecha y estado actual
            const encabezado = document.createElement("div");
            encabezado.className = "comentario-mod-cabecera";

            const grupoAutor = document.createElement("div");
            grupoAutor.className = "comentario-mod-autor-grupo";

            const autorEl = document.createElement("strong");
            autorEl.className = "comentario-mod-autor";
            autorEl.textContent = item.autor || "Lector";

            const fechaEl = document.createElement("span");
            fechaEl.className = "comentario-mod-fecha";
            fechaEl.textContent = formatearFechaComentario(item.fecha_creacion);

            grupoAutor.appendChild(autorEl);
            grupoAutor.appendChild(fechaEl);

            const badge = document.createElement("span");
            badge.className = `estado-badge comentario-mod-estado ${clasesEstado[item.estado] || "estado-borrador"}`;
            badge.textContent = etiquetasEstado[item.estado] || item.estado;

            encabezado.appendChild(grupoAutor);
            encabezado.appendChild(badge);

            // B. Noticia relacionada
            const filaNoticia = document.createElement("div");
            filaNoticia.className = "comentario-mod-noticia";

            const etiquetaNoticia = document.createElement("span");
            etiquetaNoticia.className = "comentario-mod-etiqueta-noticia";
            etiquetaNoticia.textContent = "En la noticia:";
            filaNoticia.appendChild(etiquetaNoticia);

            if (item.noticia_id) {
                const enlaceNoticia = document.createElement("a");
                enlaceNoticia.href = `../noticia.html?id=${encodeURIComponent(item.noticia_id)}`;
                enlaceNoticia.target = "_blank";
                enlaceNoticia.rel = "noopener noreferrer";
                enlaceNoticia.className = "comentario-mod-enlace-noticia";
                enlaceNoticia.textContent = item.noticia || `Noticia #${item.noticia_id}`;
                filaNoticia.appendChild(enlaceNoticia);
            } else {
                const textoNoticia = document.createElement("span");
                textoNoticia.className = "comentario-mod-texto-noticia";
                textoNoticia.textContent = item.noticia || "-";
                filaNoticia.appendChild(textoNoticia);
            }

            // C. Contenido del comentario (siempre textContent seguro)
            const cuerpo = document.createElement("div");
            cuerpo.className = "comentario-mod-cuerpo";
            const texto = document.createElement("p");
            texto.className = "comentario-mod-texto";
            texto.textContent = item.contenido;
            cuerpo.appendChild(texto);

            // D. Acciones de moderación existentes
            const barraAcciones = document.createElement("div");
            barraAcciones.className = "comentario-mod-acciones";

            if (item.estado !== "aprobado") {
                const btnAprobar = document.createElement("button");
                btnAprobar.type = "button";
                btnAprobar.className = "enlace-accion btn-moderar-aprobar";
                btnAprobar.textContent = "Aprobar";
                btnAprobar.addEventListener("click", () => moderarComentario(item.id, "aprobar", articulo));
                barraAcciones.appendChild(btnAprobar);
            }

            if (item.estado !== "rechazado") {
                const btnRechazar = document.createElement("button");
                btnRechazar.type = "button";
                btnRechazar.className = "enlace-accion enlace-cambios";
                btnRechazar.textContent = "Rechazar";
                btnRechazar.addEventListener("click", () => moderarComentario(item.id, "rechazar", articulo));
                barraAcciones.appendChild(btnRechazar);
            }

            const btnEliminar = document.createElement("button");
            btnEliminar.type = "button";
            btnEliminar.className = "enlace-accion enlace-eliminar";
            btnEliminar.textContent = "Eliminar";
            btnEliminar.addEventListener("click", () => {
                if (window.confirm("¿Deseas eliminar este comentario?")) {
                    moderarComentario(item.id, "eliminar", articulo);
                }
            });
            barraAcciones.appendChild(btnEliminar);

            articulo.appendChild(encabezado);
            articulo.appendChild(filaNoticia);
            articulo.appendChild(cuerpo);
            articulo.appendChild(barraAcciones);
            bandeja.appendChild(articulo);
        });
    } catch {
        bandeja.textContent = "";
        const errBox = document.createElement("div");
        errBox.className = "estado-vacio-comentarios";
        const p = document.createElement("p");
        p.textContent = "No se pudieron cargar los comentarios en este momento.";
        errBox.appendChild(p);
        bandeja.appendChild(errBox);
        actualizarPaginacionComentarios(1, 1, 0);
        mostrarMensajeComentarios("No se pudieron cargar los comentarios.", true);
    } finally {
        cargandoComentarios = false;
        actualizarBotonesPaginacion(false, paginaActualComentarios, Number(document.getElementById("paginacion-comentarios")?.dataset.totalPaginas || 1));
    }
}

function actualizarContadoresComentarios(contadores) {
    const elPend = document.getElementById("cnt-comentarios-pendiente");
    const elAprob = document.getElementById("cnt-comentarios-aprobado");
    const elRech = document.getElementById("cnt-comentarios-rechazado");

    if (elPend) {
        elPend.textContent = String(Number(contadores.pendiente || 0));
    }
    if (elAprob) {
        elAprob.textContent = String(Number(contadores.aprobado || 0));
    }
    if (elRech) {
        elRech.textContent = String(Number(contadores.rechazado || 0));
    }
}

function actualizarPaginacionComentarios(pagina, totalPaginas, totalRegistros) {
    const nav = document.getElementById("paginacion-comentarios");
    const info = document.getElementById("info-paginacion-comentarios");
    if (!nav || !info) {
        return;
    }

    nav.dataset.totalPaginas = String(totalPaginas);
    info.textContent = `Página ${pagina} de ${totalPaginas}`;
    nav.hidden = totalRegistros === 0 && totalPaginas <= 1;
    actualizarBotonesPaginacion(false, pagina, totalPaginas);
}

function actualizarBotonesPaginacion(deshabilitarTodo, pagina, totalPaginas) {
    const btnAnt = document.getElementById("btn-comentarios-anterior");
    const btnSig = document.getElementById("btn-comentarios-siguiente");
    if (btnAnt) {
        btnAnt.disabled = deshabilitarTodo || pagina <= 1;
    }
    if (btnSig) {
        btnSig.disabled = deshabilitarTodo || pagina >= totalPaginas;
    }
}

function formatearFechaComentario(valor) {
    const crudo = String(valor || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(crudo)) {
        return "-";
    }
    const [anio, mes, dia] = crudo.split("-");
    return `${dia}/${mes}/${anio}`;
}

async function moderarComentario(id, accion, contenedorFila) {
    const botones = contenedorFila ? Array.from(contenedorFila.querySelectorAll("button")) : [];
    botones.forEach((b) => {
        b.disabled = true;
    });

    const form = new FormData();
    form.append("csrf_token", csrfTokenComentarios);
    form.append("accion", accion);
    form.append("id", String(id));

    try {
        const respuesta = await fetch("../php/comentarios.php", {
            method: "POST",
            body: form,
            credentials: "same-origin"
        });
        const resultado = await respuesta.json();

        if (respuesta.ok && resultado.ok) {
            mostrarMensajeComentarios(resultado.mensaje || "Acción completada.", false);
            await cargarComentariosAdmin();
            return;
        }

        mostrarMensajeComentarios(resultado.mensaje || "No se pudo completar la acción.", true);
    } catch {
        mostrarMensajeComentarios("Error de comunicación con el servidor.", true);
    } finally {
        botones.forEach((b) => {
            b.disabled = false;
        });
    }
}

function mostrarMensajeComentarios(texto, esError) {
    const alerta = document.getElementById("mensaje-comentarios");
    if (!alerta) {
        return;
    }
    alerta.textContent = texto;
    alerta.className = esError ? "alerta-admin alerta-admin-error" : "alerta-admin alerta-admin-exito";
    alerta.hidden = false;
}

function inicializarSidebarMovilComentarios() {
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

function inicializarSalirComentarios() {
    const boton = document.getElementById("boton-salir");
    if (!boton) {
        return;
    }
    boton.addEventListener("click", async () => {
        const form = new FormData();
        form.append("csrf_token", csrfTokenComentarios);
        await fetch("../php/cerrar_sesion.php", {
            method: "POST",
            body: form,
            credentials: "same-origin"
        });
        window.location.href = "../acceso.html";
    });
}
