/**
 * NewsCMS - Script administrativo del complemento Gestor de Publicidad
 */

let csrfTokenPublicidad = "";

document.addEventListener("DOMContentLoaded", () => {
    iniciarPublicidadAdmin();
});

async function iniciarPublicidadAdmin() {
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

        csrfTokenPublicidad = datos.csrf_token || "";
        mostrarCabeceraPublicidad(datos.usuario);
        renderizarSidebarPublicidad(datos.modulos_permitidos || ["Dashboard"]);
        inicializarSidebarMovilPublicidad();
        inicializarSalirPublicidad();
        inicializarVistaPreviaAnuncio();
        inicializarFormularioPublicidad();

        document.getElementById("contenedor-admin").hidden = false;
        await cargarAnuncios();
    } catch {
        window.location.href = "../acceso.html";
    }
}

function mostrarCabeceraPublicidad(usuario) {
    document.getElementById("nombre-usuario").textContent = usuario.nombre || "";
    document.getElementById("rol-usuario").textContent = usuario.rol || "";
    document.getElementById("rol-sidebar").textContent = usuario.rol || "";
}

function renderizarSidebarPublicidad(modulos) {
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

async function peticionGetPublicidad(modo) {
    const opciones = { credentials: "same-origin" };
    try {
        return await fetch(`../php/publicidad.php?modo=${encodeURIComponent(modo)}`, opciones);
    } catch {
        // Respaldo si el navegador o una extension bloquea /php/publicidad.php
        return await fetch(`../php/complementos.php?canal=patrocinios&modo=${encodeURIComponent(modo)}`, opciones);
    }
}

async function enviarOperacionPublicidad(formData) {
    const opciones = {
        method: "POST",
        body: formData,
        credentials: "same-origin"
    };
    try {
        return await fetch("../php/publicidad.php", opciones);
    } catch {
        // Respaldo si el navegador o una extension bloquea /php/publicidad.php
        formData.set("canal", "patrocinios");
        return await fetch("../php/complementos.php?canal=patrocinios", opciones);
    }
}

function esUrlHttpValida(valor) {
    try {
        const parsed = new URL(valor);
        return (parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.hostname !== "";
    } catch {
        return false;
    }
}

function mostrarEstadoCargandoPublicidad(contenedor) {
    if (!contenedor) {
        return;
    }
    contenedor.textContent = "";
    const p = document.createElement("p");
    p.className = "cargando-publicidad";
    p.textContent = "Cargando anuncios...";
    contenedor.appendChild(p);
}

function mostrarEstadoErrorPublicidad(contenedor, totalEl, activosEl, detalle) {
    if (totalEl) {
        totalEl.textContent = "—";
    }
    if (activosEl) {
        activosEl.textContent = "—";
    }
    if (contenedor) {
        contenedor.textContent = "";
        const caja = document.createElement("div");
        caja.className = "estado-error-publicidad";

        const titulo = document.createElement("h3");
        titulo.className = "titulo-error-publicidad";
        titulo.textContent = "No se pudieron cargar los anuncios";

        const texto = document.createElement("p");
        texto.className = "texto-error-publicidad";
        texto.textContent = detalle;

        const btnReintentar = document.createElement("button");
        btnReintentar.type = "button";
        btnReintentar.className = "boton-secundario-admin";
        btnReintentar.textContent = "Reintentar";
        btnReintentar.addEventListener("click", cargarAnuncios);

        caja.appendChild(titulo);
        caja.appendChild(texto);
        caja.appendChild(btnReintentar);
        contenedor.appendChild(caja);
    }
    mostrarMensajePublicidad(detalle, true);
}

async function cargarAnuncios() {
    const contenedor = document.getElementById("cuerpo-tabla-publicidad");
    const totalEl = document.getElementById("total-anuncios");
    const activosEl = document.getElementById("contador-activos-publicidad");

    mostrarEstadoCargandoPublicidad(contenedor);

    try {
        const respuesta = await peticionGetPublicidad("admin_lista");
        let datos = null;
        try {
            datos = await respuesta.json();
        } catch {
            datos = null;
        }

        if (!respuesta.ok || !datos || datos.ok !== true || !Array.isArray(datos.anuncios)) {
            const detalle = (datos && datos.mensaje)
                ? datos.mensaje
                : `No se pudieron cargar los anuncios (HTTP ${respuesta.status}).`;
            mostrarEstadoErrorPublicidad(contenedor, totalEl, activosEl, detalle);
            return;
        }

        const anuncios = datos.anuncios;
        const activos = anuncios.filter((item) => Number(item.visible) === 1).length;

        const alerta = document.getElementById("mensaje-publicidad");
        if (alerta && alerta.classList.contains("alerta-admin-error")) {
            alerta.textContent = "";
            alerta.hidden = true;
        }

        if (totalEl) {
            totalEl.textContent = `${anuncios.length} ${anuncios.length === 1 ? "anuncio" : "anuncios"}`;
        }
        if (activosEl) {
            activosEl.textContent = `${activos} ${activos === 1 ? "activo" : "activos"}`;
        }

        contenedor.textContent = "";
        if (anuncios.length === 0) {
            contenedor.appendChild(construirEstadoVacioPublicidad());
            return;
        }

        anuncios.forEach((item) => {
            contenedor.appendChild(construirFilaAnuncio(item));
        });
    } catch {
        mostrarEstadoErrorPublicidad(
            contenedor,
            totalEl,
            activosEl,
            "No se pudieron cargar los anuncios. Verifica la conexión con el servidor."
        );
    }
}

function construirEstadoVacioPublicidad() {
    const caja = document.createElement("div");
    caja.className = "estado-vacio-publicidad";

    const etiqueta = document.createElement("span");
    etiqueta.className = "etiqueta-vacio-publicidad";
    etiqueta.textContent = "Sin campañas registradas";

    const titulo = document.createElement("h3");
    titulo.className = "titulo-vacio-publicidad";
    titulo.textContent = "Todavía no hay anuncios registrados.";

    const texto = document.createElement("p");
    texto.className = "texto-vacio-publicidad";
    texto.textContent = "Crea anuncios de texto o con banner (JPG, PNG o WEBP) para mostrarlos en el bloque inferior de la portada pública (máximo 3 visibles).";

    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "boton-primario-admin";
    boton.textContent = "+ Nuevo anuncio";
    boton.addEventListener("click", abrirNuevoAnuncio);

    caja.appendChild(etiqueta);
    caja.appendChild(titulo);
    caja.appendChild(texto);
    caja.appendChild(boton);
    return caja;
}

function construirMarcadorSoloTextoAdmin(marco) {
    marco.textContent = "";
    marco.classList.remove("marco-error-imagen");
    marco.classList.add("marco-solo-texto");
    const chip = document.createElement("span");
    chip.className = "badge-solo-texto-admin";
    chip.textContent = "Solo texto";
    marco.appendChild(chip);
}

function construirMarcadorErrorImagenAdmin(marco) {
    marco.textContent = "";
    marco.classList.remove("marco-solo-texto");
    marco.classList.add("marco-error-imagen");
    const chip = document.createElement("span");
    chip.className = "badge-error-imagen-admin";
    chip.textContent = "Imagen no disponible";
    marco.appendChild(chip);
}

function asignarImagenConRespaldoAdmin(img, rutaImagen, idAnuncio, onFalloTotal) {
    const urlRespaldo = `../php/complementos.php?canal=patrocinios&modo=imagen&id=${encodeURIComponent(idAnuncio)}`;
    let intentoRespaldo = false;

    img.onerror = () => {
        if (!intentoRespaldo) {
            intentoRespaldo = true;
            img.src = urlRespaldo;
            return;
        }
        img.onerror = null;
        if (typeof onFalloTotal === "function") {
            onFalloTotal();
        }
    };

    img.src = `../${rutaImagen}`;
}

function construirFilaAnuncio(item) {
    const esVisible = Number(item.visible) === 1;
    const rutaImagen = typeof item.imagen === "string" ? item.imagen.trim() : "";

    const fila = document.createElement("article");
    fila.className = esVisible ? "item-anuncio-admin" : "item-anuncio-admin item-inactivo";
    if (!rutaImagen) {
        fila.classList.add("item-solo-texto");
    }

    const marco = document.createElement("div");
    marco.className = "marco-miniatura-publicidad";

    if (rutaImagen !== "") {
        const img = document.createElement("img");
        img.alt = item.titulo || "Banner publicitario";
        img.className = "miniatura-publicidad";
        img.loading = "lazy";
        asignarImagenConRespaldoAdmin(img, rutaImagen, item.id, () => construirMarcadorErrorImagenAdmin(marco));
        marco.appendChild(img);
    } else {
        construirMarcadorSoloTextoAdmin(marco);
    }

    const cuerpo = document.createElement("div");
    cuerpo.className = "cuerpo-item-publicidad";

    const cabecera = document.createElement("div");
    cabecera.className = "cabecera-item-publicidad";

    const titulo = document.createElement("h3");
    titulo.className = "titulo-item-publicidad";
    titulo.textContent = item.titulo || "";

    const badge = document.createElement("span");
    badge.className = esVisible
        ? "badge-estado-publicidad estado-visible"
        : "badge-estado-publicidad estado-inactivo";
    badge.textContent = esVisible ? "Visible" : "Inactivo";

    cabecera.appendChild(titulo);
    cabecera.appendChild(badge);
    cuerpo.appendChild(cabecera);

    if (item.descripcion) {
        const desc = document.createElement("p");
        desc.className = "descripcion-item-publicidad";
        desc.textContent = item.descripcion;
        cuerpo.appendChild(desc);
    }

    const meta = document.createElement("div");
    meta.className = "metadatos-item-publicidad";

    const ubicacion = document.createElement("span");
    ubicacion.className = "meta-ubicacion-publicidad";
    ubicacion.textContent = "Portada inferior · Máx. 3 activos";

    const enlace = document.createElement("a");
    enlace.href = item.enlace;
    enlace.target = "_blank";
    enlace.rel = "noopener noreferrer";
    enlace.className = "enlace-destino-publicidad";
    enlace.textContent = item.enlace;

    meta.appendChild(ubicacion);
    meta.appendChild(enlace);
    cuerpo.appendChild(meta);

    const acciones = document.createElement("div");
    acciones.className = "acciones-item-publicidad";

    const btnEditar = document.createElement("button");
    btnEditar.type = "button";
    btnEditar.className = "btn-accion-publicidad btn-editar-publicidad";
    btnEditar.textContent = "Editar";
    btnEditar.addEventListener("click", () => abrirEdicionAnuncio(item));

    const btnVis = document.createElement("button");
    btnVis.type = "button";
    btnVis.className = esVisible
        ? "btn-accion-publicidad btn-desactivar-publicidad"
        : "btn-accion-publicidad btn-activar-publicidad";
    btnVis.textContent = esVisible ? "Desactivar" : "Activar";
    btnVis.addEventListener("click", () => cambiarVisibilidadAnuncio(item.id, esVisible ? 0 : 1, fila));

    const btnElim = document.createElement("button");
    btnElim.type = "button";
    btnElim.className = "btn-accion-publicidad btn-eliminar-publicidad";
    btnElim.textContent = "Eliminar";
    btnElim.addEventListener("click", () => eliminarAnuncioItem(item, fila));

    acciones.appendChild(btnEditar);
    acciones.appendChild(btnVis);
    acciones.appendChild(btnElim);

    fila.appendChild(marco);
    fila.appendChild(cuerpo);
    fila.appendChild(acciones);
    return fila;
}

function establecerEstadoBotonesFila(fila, deshabilitado) {
    if (!fila) {
        return;
    }
    fila.querySelectorAll("button").forEach((btn) => {
        btn.disabled = deshabilitado;
    });
}

function inicializarVistaPreviaAnuncio() {
    const input = document.getElementById("anuncio-imagen");
    const cont = document.getElementById("contenedor-previa-anuncio");
    const img = document.getElementById("imagen-previa-anuncio");
    const nombreArchivo = document.getElementById("nombre-archivo-anuncio");

    input?.addEventListener("change", () => {
        const archivo = input.files && input.files[0];
        if (!archivo) {
            if (nombreArchivo) {
                nombreArchivo.textContent = "Ningún archivo seleccionado";
            }
            return;
        }
        if (nombreArchivo) {
            nombreArchivo.textContent = archivo.name;
        }
        const lector = new FileReader();
        lector.onload = (e) => {
            img.src = e.target.result;
            cont.hidden = false;
        };
        lector.readAsDataURL(archivo);
    });
}

function abrirModalPublicidad() {
    const modal = document.getElementById("panel-formulario-publicidad");
    ocultarMensajeModalPublicidad();
    if (modal) {
        modal.hidden = false;
    }
    document.getElementById("anuncio-titulo")?.focus();
}

function cerrarModalPublicidad() {
    const modal = document.getElementById("panel-formulario-publicidad");
    ocultarMensajeModalPublicidad();
    if (modal) {
        modal.hidden = true;
    }
}

function abrirNuevoAnuncio() {
    const formulario = document.getElementById("formulario-publicidad");
    formulario?.reset();
    document.getElementById("anuncio-id").value = "0";
    document.getElementById("contenedor-previa-anuncio").hidden = true;
    document.getElementById("imagen-previa-anuncio").src = "";
    const nombreArchivo = document.getElementById("nombre-archivo-anuncio");
    if (nombreArchivo) {
        nombreArchivo.textContent = "Ningún archivo seleccionado";
    }
    document.getElementById("titulo-form-publicidad").textContent = "Nuevo anuncio";
    abrirModalPublicidad();
}

function inicializarFormularioPublicidad() {
    const btnNuevo = document.getElementById("btn-nuevo-anuncio");
    const btnCancelar = document.getElementById("btn-cancelar-publicidad");
    const btnCerrar = document.getElementById("btn-cerrar-modal-publicidad");
    const modal = document.getElementById("panel-formulario-publicidad");
    const formulario = document.getElementById("formulario-publicidad");
    const btnGuardar = document.getElementById("btn-guardar-publicidad");

    btnNuevo?.addEventListener("click", abrirNuevoAnuncio);
    btnCancelar?.addEventListener("click", cerrarModalPublicidad);
    btnCerrar?.addEventListener("click", cerrarModalPublicidad);

    modal?.addEventListener("click", (e) => {
        if (e.target === modal) {
            cerrarModalPublicidad();
        }
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modal && !modal.hidden) {
            cerrarModalPublicidad();
        }
    });

    formulario?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = Number(document.getElementById("anuncio-id").value || 0);
        const titulo = document.getElementById("anuncio-titulo").value.trim();
        const enlace = document.getElementById("anuncio-enlace").value.trim();

        if (!titulo || !enlace) {
            mostrarMensajeModalPublicidad("El título y la URL de destino son obligatorios.");
            return;
        }

        if (!esUrlHttpValida(enlace)) {
            mostrarMensajeModalPublicidad("Ingresa una URL de destino válida (HTTP o HTTPS).");
            return;
        }

        const form = new FormData(formulario);
        form.append("csrf_token", csrfTokenPublicidad);
        form.append("accion", id > 0 ? "editar" : "crear");

        if (btnGuardar) {
            btnGuardar.disabled = true;
            btnGuardar.textContent = "Guardando...";
        }

        try {
            const respuesta = await enviarOperacionPublicidad(form);
            const resultado = await respuesta.json();

            if (respuesta.ok && resultado.ok) {
                mostrarMensajePublicidad(resultado.mensaje || "Anuncio guardado.", false);
                cerrarModalPublicidad();
                await cargarAnuncios();
                return;
            }

            mostrarMensajeModalPublicidad(resultado.mensaje || "No se pudo guardar el anuncio.");
        } catch {
            mostrarMensajeModalPublicidad("Error de comunicación con el servidor.");
        } finally {
            if (btnGuardar) {
                btnGuardar.disabled = false;
                btnGuardar.textContent = "Guardar anuncio";
            }
        }
    });
}

function abrirEdicionAnuncio(item) {
    document.getElementById("anuncio-id").value = String(item.id);
    document.getElementById("anuncio-titulo").value = item.titulo || "";
    document.getElementById("anuncio-descripcion").value = item.descripcion || "";
    document.getElementById("anuncio-enlace").value = item.enlace || "";
    document.getElementById("anuncio-visible").value = String(Number(item.visible) === 1 ? 1 : 0);
    document.getElementById("anuncio-imagen").value = "";

    const nombreArchivo = document.getElementById("nombre-archivo-anuncio");
    const contPrevia = document.getElementById("contenedor-previa-anuncio");
    const imgPrevia = document.getElementById("imagen-previa-anuncio");
    const rutaImagen = typeof item.imagen === "string" ? item.imagen.trim() : "";

    if (rutaImagen !== "") {
        asignarImagenConRespaldoAdmin(imgPrevia, rutaImagen, item.id, () => {
            contPrevia.hidden = true;
            if (nombreArchivo) {
                nombreArchivo.textContent = "Archivo registrado no disponible. Puedes subir uno nuevo.";
            }
        });
        contPrevia.hidden = false;
        if (nombreArchivo) {
            nombreArchivo.textContent = "Imagen actual conservada (opcional reemplazar)";
        }
    } else {
        imgPrevia.onerror = null;
        imgPrevia.src = "";
        contPrevia.hidden = true;
        if (nombreArchivo) {
            nombreArchivo.textContent = "Sin imagen (anuncio textual). Opcional subir una.";
        }
    }

    document.getElementById("titulo-form-publicidad").textContent = "Editar anuncio";
    abrirModalPublicidad();
}

async function cambiarVisibilidadAnuncio(id, visible, fila) {
    const form = new FormData();
    form.append("csrf_token", csrfTokenPublicidad);
    form.append("accion", "cambiar_visibilidad");
    form.append("id", String(id));
    form.append("visible", String(visible));

    establecerEstadoBotonesFila(fila, true);
    try {
        const respuesta = await enviarOperacionPublicidad(form);
        const resultado = await respuesta.json();
        if (respuesta.ok && resultado.ok) {
            mostrarMensajePublicidad(resultado.mensaje || "Visibilidad actualizada.", false);
            await cargarAnuncios();
        } else {
            mostrarMensajePublicidad(resultado.mensaje || "No se pudo actualizar el estado.", true);
        }
    } catch {
        mostrarMensajePublicidad("Error al actualizar el estado.", true);
    } finally {
        establecerEstadoBotonesFila(fila, false);
    }
}

async function eliminarAnuncioItem(item, fila) {
    if (!window.confirm(`¿Deseas eliminar el anuncio "${item.titulo}"?`)) {
        return;
    }

    const form = new FormData();
    form.append("csrf_token", csrfTokenPublicidad);
    form.append("accion", "eliminar");
    form.append("id", String(item.id));

    establecerEstadoBotonesFila(fila, true);
    try {
        const respuesta = await enviarOperacionPublicidad(form);
        const resultado = await respuesta.json();
        if (respuesta.ok && resultado.ok) {
            mostrarMensajePublicidad(resultado.mensaje || "Anuncio eliminado.", false);
            await cargarAnuncios();
        } else {
            mostrarMensajePublicidad(resultado.mensaje || "No se pudo eliminar el anuncio.", true);
        }
    } catch {
        mostrarMensajePublicidad("Error al eliminar el anuncio.", true);
    } finally {
        establecerEstadoBotonesFila(fila, false);
    }
}

function mostrarMensajePublicidad(texto, esError) {
    const alerta = document.getElementById("mensaje-publicidad");
    if (!alerta) {
        return;
    }
    alerta.textContent = texto;
    alerta.className = esError ? "alerta-admin alerta-admin-error" : "alerta-admin alerta-admin-exito";
    alerta.hidden = false;
}

function mostrarMensajeModalPublicidad(texto) {
    const alerta = document.getElementById("mensaje-modal-publicidad");
    if (!alerta) {
        mostrarMensajePublicidad(texto, true);
        return;
    }
    alerta.textContent = texto;
    alerta.className = "alerta-admin alerta-admin-error alerta-modal-publicidad";
    alerta.hidden = false;
}

function ocultarMensajeModalPublicidad() {
    const alerta = document.getElementById("mensaje-modal-publicidad");
    if (alerta) {
        alerta.textContent = "";
        alerta.hidden = true;
    }
}

function inicializarSidebarMovilPublicidad() {
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

function inicializarSalirPublicidad() {
    const boton = document.getElementById("boton-salir");
    if (!boton) {
        return;
    }
    boton.addEventListener("click", async () => {
        const form = new FormData();
        form.append("csrf_token", csrfTokenPublicidad);
        await fetch("../php/cerrar_sesion.php", {
            method: "POST",
            body: form,
            credentials: "same-origin"
        });
        window.location.href = "../acceso.html";
    });
}
