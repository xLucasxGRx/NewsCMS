/**
 * NewsCMS - Script de administración de listado de noticias (admin/noticias.html)
 */

let csrfTokenNoticias = "";
let paginaActualNoticias = 1;
const POR_PAGINA_NOTICIAS = 10;
let totalPaginasNoticias = 0;
let secuenciaConsultaNoticias = 0;
let temporizadorFiltroNoticias = null;
let controladorConsultaNoticias = null;

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
            const resumen = document.getElementById("resumen-contadores-noticias");
            if (resumen) {
                resumen.hidden = true;
            }
            const paginacion = document.getElementById("paginacion-noticias");
            if (paginacion) {
                paginacion.hidden = true;
            }
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
        const filtroAutor = document.getElementById("filtro-autor");
        const filtroEstado = document.getElementById("filtro-estado");
        const btnAnterior = document.getElementById("btn-noticias-anterior");
        const btnSiguiente = document.getElementById("btn-noticias-siguiente");

        const recargarInmediatoDesdePagina1 = () => {
            if (temporizadorFiltroNoticias) {
                clearTimeout(temporizadorFiltroNoticias);
                temporizadorFiltroNoticias = null;
            }
            paginaActualNoticias = 1;
            cargarNoticiasAdmin();
        };

        const programarRecargaFiltros = () => {
            if (temporizadorFiltroNoticias) {
                clearTimeout(temporizadorFiltroNoticias);
            }
            paginaActualNoticias = 1;
            temporizadorFiltroNoticias = setTimeout(() => {
                temporizadorFiltroNoticias = null;
                cargarNoticiasAdmin();
            }, 240);
        };

        if (filtroBusqueda) {
            filtroBusqueda.addEventListener("input", programarRecargaFiltros);
            filtroBusqueda.addEventListener("search", recargarInmediatoDesdePagina1);
        }
        if (filtroAutor) {
            filtroAutor.addEventListener("input", programarRecargaFiltros);
            filtroAutor.addEventListener("search", recargarInmediatoDesdePagina1);
        }
        if (filtroEstado) {
            filtroEstado.addEventListener("change", recargarInmediatoDesdePagina1);
        }

        if (btnAnterior) {
            btnAnterior.addEventListener("click", () => {
                if (paginaActualNoticias > 1) {
                    paginaActualNoticias--;
                    cargarNoticiasAdmin();
                }
            });
        }
        if (btnSiguiente) {
            btnSiguiente.addEventListener("click", () => {
                if (paginaActualNoticias < totalPaginasNoticias) {
                    paginaActualNoticias++;
                    cargarNoticiasAdmin();
                }
            });
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

function actualizarContadoresNoticias(contadores) {
    const mapa = contadores || {};
    const claves = [
        "total",
        "publicada",
        "borrador",
        "pendiente_revision",
        "cambios_solicitados",
        "archivada"
    ];
    claves.forEach((clave) => {
        const el = document.getElementById(`cnt-noticias-${clave}`);
        if (el) {
            el.textContent = String(Number(mapa[clave] ?? 0));
        }
    });

    const pillCambios = document.getElementById("pill-noticias-cambios_solicitados");
    if (pillCambios) {
        pillCambios.hidden = Number(mapa.cambios_solicitados ?? 0) <= 0;
    }
}

function construirVentanaPaginas(paginaActual, totalPaginas) {
    if (totalPaginas <= 1) {
        return totalPaginas === 1 ? [1] : [];
    }
    const seleccionadas = new Set([1, totalPaginas]);
    for (let i = paginaActual - 1; i <= paginaActual + 1; i++) {
        if (i >= 1 && i <= totalPaginas) {
            seleccionadas.add(i);
        }
    }
    const ordenadas = Array.from(seleccionadas).sort((a, b) => a - b);
    const salida = [];
    ordenadas.forEach((num, idx) => {
        if (idx > 0 && num - ordenadas[idx - 1] > 1) {
            salida.push("...");
        }
        salida.push(num);
    });
    return salida;
}

function actualizarPaginacionNoticias(totalFiltrado, pagina, porPagina, totalPaginas) {
    const bloque = document.getElementById("paginacion-noticias");
    const infoEl = document.getElementById("info-paginacion-noticias");
    const detalleEl = document.getElementById("detalle-pagina-noticias");
    const numerosEl = document.getElementById("numeros-paginacion-noticias");
    const btnAnt = document.getElementById("btn-noticias-anterior");
    const btnSig = document.getElementById("btn-noticias-siguiente");

    if (!bloque) {
        return;
    }

    if (totalFiltrado <= 0 || totalPaginas <= 0) {
        bloque.hidden = true;
        if (numerosEl) {
            numerosEl.textContent = "";
        }
        return;
    }

    bloque.hidden = false;
    const inicio = (pagina - 1) * porPagina + 1;
    const fin = Math.min(pagina * porPagina, totalFiltrado);
    const palabraNoticia = totalFiltrado === 1 ? "noticia" : "noticias";

    if (infoEl) {
        infoEl.textContent = `Mostrando ${inicio}\u2013${fin} de ${totalFiltrado} ${palabraNoticia}`;
    }
    if (detalleEl) {
        detalleEl.textContent = `Página ${pagina} de ${totalPaginas}`;
    }
    if (btnAnt) {
        btnAnt.disabled = pagina <= 1;
    }
    if (btnSig) {
        btnSig.disabled = pagina >= totalPaginas;
    }

    if (numerosEl) {
        numerosEl.textContent = "";
        const items = construirVentanaPaginas(pagina, totalPaginas);
        items.forEach((item) => {
            if (item === "...") {
                const span = document.createElement("span");
                span.className = "elipsis-paginacion-noticias";
                span.setAttribute("aria-hidden", "true");
                span.textContent = "...";
                numerosEl.appendChild(span);
                return;
            }
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = item === pagina ? "btn-pagina-noticias activa" : "btn-pagina-noticias";
            btn.textContent = String(item);
            btn.setAttribute("aria-label", `Ir a la página ${item}`);
            if (item === pagina) {
                btn.setAttribute("aria-current", "page");
                btn.disabled = true;
            } else {
                btn.addEventListener("click", () => {
                    paginaActualNoticias = item;
                    cargarNoticiasAdmin();
                });
            }
            numerosEl.appendChild(btn);
        });
    }
}

function renderizarEstadoCargandoNoticias(cuerpo) {
    if (!cuerpo) {
        return;
    }
    cuerpo.textContent = "";
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.className = "fila-vacia";
    td.textContent = "Cargando noticias...";
    tr.appendChild(td);
    cuerpo.appendChild(tr);
}

function renderizarEstadoErrorNoticias(cuerpo, detalle) {
    if (!cuerpo) {
        return;
    }
    cuerpo.textContent = "";
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.className = "fila-vacia";

    const caja = document.createElement("div");
    caja.className = "estado-vacio-noticias";

    const titulo = document.createElement("strong");
    titulo.className = "titulo-estado-vacio";
    titulo.textContent = "No se pudieron cargar las noticias";

    const descripcion = document.createElement("p");
    descripcion.className = "descripcion-estado-vacio";
    descripcion.textContent = detalle || "Ocurrió un problema al consultar el servidor.";

    const btnReintentar = document.createElement("button");
    btnReintentar.type = "button";
    btnReintentar.className = "boton-secundario-admin boton-limpiar-filtros";
    btnReintentar.textContent = "Reintentar";
    btnReintentar.addEventListener("click", () => cargarNoticiasAdmin());

    caja.appendChild(titulo);
    caja.appendChild(descripcion);
    caja.appendChild(btnReintentar);
    td.appendChild(caja);
    tr.appendChild(td);
    cuerpo.appendChild(tr);

    const pag = document.getElementById("paginacion-noticias");
    if (pag) {
        pag.hidden = true;
    }
}

async function cargarNoticiasAdmin() {
    const q = (document.getElementById("filtro-busqueda")?.value || "").trim();
    const autor = (document.getElementById("filtro-autor")?.value || "").trim();
    const estado = document.getElementById("filtro-estado")?.value || "";
    const cuerpo = document.getElementById("cuerpo-tabla-noticias");
    const totalEl = document.getElementById("total-registros");

    const miSecuencia = ++secuenciaConsultaNoticias;
    if (controladorConsultaNoticias) {
        controladorConsultaNoticias.abort();
    }
    controladorConsultaNoticias = typeof AbortController !== "undefined" ? new AbortController() : null;

    renderizarEstadoCargandoNoticias(cuerpo);

    const params = new URLSearchParams({
        modo: "admin_lista",
        pagina: String(paginaActualNoticias),
        por_pagina: String(POR_PAGINA_NOTICIAS)
    });
    if (q) {
        params.set("q", q);
    }
    if (autor) {
        params.set("autor", autor);
    }
    if (estado) {
        params.set("estado", estado);
    }

    try {
        const respuesta = await fetch(`../php/noticias.php?${params.toString()}`, {
            credentials: "same-origin",
            signal: controladorConsultaNoticias ? controladorConsultaNoticias.signal : undefined
        });

        let datos = null;
        try {
            datos = await respuesta.json();
        } catch {
            datos = null;
        }

        if (miSecuencia !== secuenciaConsultaNoticias) {
            return;
        }

        if (!respuesta.ok || !datos || datos.ok !== true || !Array.isArray(datos.noticias)) {
            const msgError = (datos && datos.mensaje) ? datos.mensaje : `Error HTTP ${respuesta.status} al cargar noticias.`;
            renderizarEstadoErrorNoticias(cuerpo, msgError);
            return;
        }

        const noticias = datos.noticias;
        const contadores = datos.contadores || {};
        const totalFiltrado = Number(datos.total ?? noticias.length);
        const totalGlobal = Number(contadores.total ?? totalFiltrado);
        const porPagina = Number(datos.por_pagina ?? POR_PAGINA_NOTICIAS);
        totalPaginasNoticias = Number(datos.total_paginas ?? 0);
        paginaActualNoticias = Number(datos.pagina ?? 1);

        actualizarContadoresNoticias(contadores);

        const hayFiltros = q !== "" || autor !== "" || estado !== "";
        if (totalEl) {
            if (hayFiltros) {
                const palabra = totalGlobal === 1 ? "noticia" : "noticias";
                totalEl.textContent = `${totalFiltrado} de ${totalGlobal} ${palabra}`;
            } else {
                totalEl.textContent = totalFiltrado === 1 ? "1 noticia" : `${totalFiltrado} noticias`;
            }
        }

        cuerpo.textContent = "";
        actualizarPaginacionNoticias(totalFiltrado, paginaActualNoticias, porPagina, totalPaginasNoticias);

        if (noticias.length === 0) {
            renderizarEstadoVacioNoticias(cuerpo, hayFiltros);
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
            tdTitulo.className = "celda-titulo-noticias";
            tdTitulo.setAttribute("data-etiqueta", "Título");
            const spanTitulo = document.createElement("span");
            spanTitulo.className = "titulo-noticia-lista";
            spanTitulo.textContent = n.titulo;
            tdTitulo.appendChild(spanTitulo);

            if (n.estado === "cambios_solicitados" && n.ultima_observacion) {
                const obs = document.createElement("p");
                obs.className = "observacion-editorial observacion-compacta";
                obs.textContent = `Observación: ${n.ultima_observacion}`;
                tdTitulo.appendChild(obs);
            }

            const tdCategoria = document.createElement("td");
            tdCategoria.setAttribute("data-etiqueta", "Categoría");
            const chipCat = document.createElement("span");
            chipCat.className = "chip-categoria-noticias";
            chipCat.textContent = n.categoria;
            tdCategoria.appendChild(chipCat);

            const tdAutor = document.createElement("td");
            tdAutor.className = "celda-autor-noticias";
            tdAutor.setAttribute("data-etiqueta", "Autor");
            tdAutor.textContent = n.autor;

            const tdEstado = document.createElement("td");
            tdEstado.className = "celda-estado-noticias";
            tdEstado.setAttribute("data-etiqueta", "Estado");
            const insignia = document.createElement("span");
            insignia.className = `estado-badge estado-${n.estado}`;
            insignia.textContent = etiquetasEstado[n.estado] || n.estado;
            tdEstado.appendChild(insignia);

            const tdFecha = document.createElement("td");
            tdFecha.className = "celda-fecha-noticias";
            tdFecha.setAttribute("data-etiqueta", "Fecha");
            const fechaBase = n.fecha_publicacion || n.fecha_creacion || "";
            tdFecha.textContent = fechaBase ? fechaBase.slice(0, 10) : "-";

            const tdAcciones = document.createElement("td");
            tdAcciones.className = "celda-acciones celda-acciones-noticias";
            tdAcciones.setAttribute("data-etiqueta", "Acciones");

            if (n.puede_editar) {
                const btnEditar = document.createElement("a");
                btnEditar.href = `editar_noticia.html?id=${encodeURIComponent(n.id)}`;
                btnEditar.className = "enlace-accion boton-accion-tabla";
                btnEditar.appendChild(crearIconoAccionSvg("editar"));
                const lblEditar = document.createElement("span");
                lblEditar.textContent = "Editar";
                btnEditar.appendChild(lblEditar);
                tdAcciones.appendChild(btnEditar);
            }

            const btnVer = document.createElement("a");
            btnVer.href = `../noticia.html?id=${encodeURIComponent(n.id)}`;
            btnVer.className = "enlace-accion enlace-ver boton-accion-tabla";
            btnVer.appendChild(crearIconoAccionSvg("ver"));
            const lblVer = document.createElement("span");
            lblVer.textContent = "Ver";
            btnVer.appendChild(lblVer);
            tdAcciones.appendChild(btnVer);

            if (n.estado === "publicada" && n.puede_retirar) {
                const btnRetirar = document.createElement("button");
                btnRetirar.type = "button";
                btnRetirar.className = "enlace-accion enlace-retirar boton-accion-tabla";
                btnRetirar.appendChild(crearIconoAccionSvg("retirar"));
                const lblRetirar = document.createElement("span");
                lblRetirar.textContent = "Retirar publicación";
                btnRetirar.appendChild(lblRetirar);
                btnRetirar.addEventListener("click", () => {
                    cambiarEstadoPublicacion(n.id, n.titulo, "retirar_publicacion");
                });
                tdAcciones.appendChild(btnRetirar);
            } else if (n.estado === "archivada" && n.puede_restaurar) {
                const btnRestaurar = document.createElement("button");
                btnRestaurar.type = "button";
                btnRestaurar.className = "enlace-accion enlace-restaurar boton-accion-tabla";
                btnRestaurar.appendChild(crearIconoAccionSvg("restaurar"));
                const lblRestaurar = document.createElement("span");
                lblRestaurar.textContent = "Restaurar publicación";
                btnRestaurar.appendChild(lblRestaurar);
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
    } catch (error) {
        if (error && error.name === "AbortError") {
            return;
        }
        if (miSecuencia === secuenciaConsultaNoticias) {
            renderizarEstadoErrorNoticias(cuerpo, "No se pudo conectar con el servidor para cargar las noticias.");
        }
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

function renderizarEstadoVacioNoticias(cuerpo, hayFiltrosActivos) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.className = "fila-vacia";

    const caja = document.createElement("div");
    caja.className = "estado-vacio-noticias";

    const titulo = document.createElement("strong");
    titulo.className = "titulo-estado-vacio";
    titulo.textContent = hayFiltrosActivos
        ? "No se encontraron noticias con los filtros seleccionados"
        : "No hay noticias registradas";

    const descripcion = document.createElement("p");
    descripcion.className = "descripcion-estado-vacio";
    descripcion.textContent = hayFiltrosActivos
        ? "Prueba ajustando el título, el autor o el estado seleccionado."
        : "Todavía no hay publicaciones disponibles para mostrar en tu listado.";

    caja.appendChild(titulo);
    caja.appendChild(descripcion);

    if (hayFiltrosActivos) {
        const btnLimpiar = document.createElement("button");
        btnLimpiar.type = "button";
        btnLimpiar.className = "boton-secundario-admin boton-limpiar-filtros";
        btnLimpiar.textContent = "Limpiar filtros";
        btnLimpiar.addEventListener("click", () => {
            const busq = document.getElementById("filtro-busqueda");
            const aut = document.getElementById("filtro-autor");
            const est = document.getElementById("filtro-estado");
            if (busq) busq.value = "";
            if (aut) aut.value = "";
            if (est) est.value = "";
            paginaActualNoticias = 1;
            cargarNoticiasAdmin();
        });
        caja.appendChild(btnLimpiar);
    }

    td.appendChild(caja);
    tr.appendChild(td);
    cuerpo.appendChild(tr);
}

function crearIconoAccionSvg(tipo) {
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

    const agregarTrazo = (tag, attrs) => {
        const el = document.createElementNS(ns, tag);
        Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
        svg.appendChild(el);
    };

    if (tipo === "editar") {
        agregarTrazo("path", { d: "M12 20h9" });
        agregarTrazo("path", { d: "M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" });
    } else if (tipo === "ver") {
        agregarTrazo("path", { d: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" });
        agregarTrazo("circle", { cx: "12", cy: "12", r: "3" });
    } else if (tipo === "retirar") {
        agregarTrazo("rect", { x: "3", y: "4", width: "18", height: "4", rx: "1" });
        agregarTrazo("path", { d: "M4 8h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" });
        agregarTrazo("path", { d: "M10 13h4" });
    } else if (tipo === "restaurar") {
        agregarTrazo("path", { d: "M3 12a9 9 0 1 0 3-6.7L3 8" });
        agregarTrazo("path", { d: "M3 3v5h5" });
    }

    return svg;
}
