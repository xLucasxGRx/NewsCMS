/**
 * NewsCMS - Script administrativo del complemento Newsletter
 */

let csrfTokenNewsletter = "";
let correoDisponibleServidor = false;

document.addEventListener("DOMContentLoaded", () => {
    iniciarNewsletterAdmin();
});

async function iniciarNewsletterAdmin() {
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

        csrfTokenNewsletter = datos.csrf_token || "";
        mostrarCabeceraNewsletter(datos.usuario);
        renderizarSidebarNewsletter(datos.modulos_permitidos || ["Dashboard"]);
        inicializarSidebarMovilNewsletter();
        inicializarSalirNewsletter();
        inicializarFormularioBoletin();

        document.getElementById("contenedor-admin").hidden = false;
        await cargarDatosNewsletter();
    } catch {
        window.location.href = "../acceso.html";
    }
}

function mostrarCabeceraNewsletter(usuario) {
    document.getElementById("nombre-usuario").textContent = usuario.nombre || "";
    document.getElementById("rol-usuario").textContent = usuario.rol || "";
    document.getElementById("rol-sidebar").textContent = usuario.rol || "";
}

function renderizarSidebarNewsletter(modulos) {
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

async function cargarDatosNewsletter() {
    try {
        const respuesta = await fetch("../php/newsletter.php?modo=admin_datos", {
            credentials: "same-origin"
        });
        if (!respuesta.ok) {
            return;
        }

        const datos = await respuesta.json();
        document.getElementById("stat-total-suscriptores").textContent = String(datos.total_suscriptores || 0);
        document.getElementById("stat-suscriptores-activos").textContent = String(datos.suscriptores_activos || 0);

        correoDisponibleServidor = Boolean(datos.correo_disponible);
        const bannerCorreo = document.getElementById("estado-correo-servidor");
        const btnEnviar = document.getElementById("btn-enviar-boletin");
        const btnPrueba = document.getElementById("btn-enviar-prueba");
        const infoCorreo = datos.estado_correo || {};

        if (correoDisponibleServidor) {
            const remitenteTxt = infoCorreo.remitente ? ` (${infoCorreo.remitente})` : "";
            bannerCorreo.textContent = `Gmail SMTP listo${remitenteTxt}.`;
            bannerCorreo.className = "estado-smtp-newsletter smtp-disponible";
            if (btnEnviar) {
                btnEnviar.disabled = false;
            }
            if (btnPrueba) {
                btnPrueba.disabled = false;
            }
        } else {
            bannerCorreo.textContent = infoCorreo.mensaje || "Envío de boletines no disponible: falta configurar Gmail SMTP.";
            bannerCorreo.className = "estado-smtp-newsletter smtp-pendiente";
            if (btnEnviar) {
                btnEnviar.disabled = true;
            }
            if (btnPrueba) {
                btnPrueba.disabled = true;
            }
        }

        renderizarBoletines(datos.boletines || []);
        renderizarSuscriptores(datos.suscriptores || []);
    } catch {
        mostrarMensajeNewsletter("No se pudieron cargar los datos del newsletter.", true);
    }
}

function renderizarBoletines(boletines) {
    const cuerpo = document.getElementById("cuerpo-tabla-boletines");
    const totalEl = document.getElementById("total-boletines");

    if (totalEl) {
        totalEl.textContent = boletines.length === 1 ? "1 boletín" : `${boletines.length} boletines`;
    }

    cuerpo.textContent = "";
    if (boletines.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 4;
        td.className = "fila-vacia";
        td.textContent = "Aún no hay boletines guardados.";
        tr.appendChild(td);
        cuerpo.appendChild(tr);
        return;
    }

    boletines.forEach((b) => {
        const tr = document.createElement("tr");

        const tdAsunto = document.createElement("td");
        tdAsunto.dataset.etiqueta = "Asunto";
        const spanAsunto = document.createElement("strong");
        spanAsunto.className = "asunto-boletin-fila";
        spanAsunto.textContent = b.asunto;
        tdAsunto.appendChild(spanAsunto);

        const tdEstado = document.createElement("td");
        tdEstado.dataset.etiqueta = "Estado";
        const badge = document.createElement("span");
        badge.className = b.estado === "enviado" ? "estado-badge estado-publicada" : "estado-badge estado-borrador";
        badge.textContent = b.estado === "enviado" ? "Enviado" : "Borrador";
        tdEstado.appendChild(badge);

        const tdFecha = document.createElement("td");
        tdFecha.dataset.etiqueta = "Fecha";
        tdFecha.textContent = (b.fecha_envio || b.fecha_creacion || "").slice(0, 10) || "-";

        const tdAcciones = document.createElement("td");
        tdAcciones.dataset.etiqueta = "Acciones";
        tdAcciones.className = "celda-acciones celda-acciones-newsletter";
        if (b.estado === "borrador") {
            const btnEditar = document.createElement("button");
            btnEditar.type = "button";
            btnEditar.className = "enlace-accion";
            btnEditar.textContent = "Editar";
            btnEditar.addEventListener("click", () => abrirEdicionBoletin(b));
            tdAcciones.appendChild(btnEditar);
        } else {
            const spanCerrado = document.createElement("span");
            spanCerrado.className = "nota-boletin-enviado";
            spanCerrado.textContent = "Enviado";
            tdAcciones.appendChild(spanCerrado);
        }

        tr.appendChild(tdAsunto);
        tr.appendChild(tdEstado);
        tr.appendChild(tdFecha);
        tr.appendChild(tdAcciones);
        cuerpo.appendChild(tr);
    });
}

function renderizarSuscriptores(suscriptores) {
    const cuerpo = document.getElementById("cuerpo-tabla-suscriptores");
    cuerpo.textContent = "";

    if (suscriptores.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 3;
        td.className = "fila-vacia";
        td.textContent = "Aún no hay suscriptores registrados.";
        tr.appendChild(td);
        cuerpo.appendChild(tr);
        return;
    }

    suscriptores.forEach((s) => {
        const tr = document.createElement("tr");

        const tdCorreo = document.createElement("td");
        tdCorreo.dataset.etiqueta = "Correo";
        tdCorreo.className = "celda-correo-suscriptor";
        tdCorreo.textContent = s.correo;

        const tdEstado = document.createElement("td");
        tdEstado.dataset.etiqueta = "Estado";
        const badge = document.createElement("span");
        badge.className = s.estado === "activo" ? "estado-badge estado-publicada" : "estado-badge estado-borrador";
        badge.textContent = s.estado === "activo" ? "Activo" : "Inactivo";
        tdEstado.appendChild(badge);

        const tdFecha = document.createElement("td");
        tdFecha.dataset.etiqueta = "Registro";
        tdFecha.textContent = (s.fecha_registro || "").slice(0, 10) || "-";

        tr.appendChild(tdCorreo);
        tr.appendChild(tdEstado);
        tr.appendChild(tdFecha);
        cuerpo.appendChild(tr);
    });
}

function inicializarFormularioBoletin() {
    const btnNuevo = document.getElementById("btn-nuevo-boletin");
    const btnCancelar = document.getElementById("btn-cancelar-boletin");
    const btnPrevia = document.getElementById("btn-vista-previa-boletin");
    const btnEnviar = document.getElementById("btn-enviar-boletin");
    const btnPrueba = document.getElementById("btn-enviar-prueba");
    const formulario = document.getElementById("formulario-boletin");

    btnNuevo?.addEventListener("click", () => {
        document.getElementById("boletin-id").value = "0";
        document.getElementById("boletin-asunto").value = "";
        document.getElementById("boletin-contenido").value = "";
        document.getElementById("vista-previa-boletin").hidden = true;
        document.getElementById("titulo-form-boletin").textContent = "Nuevo boletín";
        document.getElementById("panel-formulario-boletin").hidden = false;
    });

    btnCancelar?.addEventListener("click", () => {
        document.getElementById("panel-formulario-boletin").hidden = true;
    });

    btnPrevia?.addEventListener("click", () => {
        const asunto = document.getElementById("boletin-asunto").value.trim();
        const contenido = document.getElementById("boletin-contenido").value.trim();
        const cajaPrevia = document.getElementById("vista-previa-boletin");
        const elAsunto = document.getElementById("previa-asunto");
        const elCuerpo = document.getElementById("previa-cuerpo");

        elAsunto.textContent = asunto || "(Sin asunto)";
        elCuerpo.textContent = "";

        const lineas = contenido.split(/\r?\n/);
        lineas.forEach((linea) => {
            if (linea.trim() !== "") {
                const p = document.createElement("p");
                p.textContent = linea;
                elCuerpo.appendChild(p);
            }
        });

        cajaPrevia.hidden = false;
    });

    formulario?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = document.getElementById("boletin-id").value;
        const asunto = document.getElementById("boletin-asunto").value.trim();
        const contenido = document.getElementById("boletin-contenido").value.trim();

        if (!asunto || !contenido) {
            mostrarMensajeNewsletter("El asunto y el contenido son obligatorios.", true);
            return;
        }

        const form = new FormData();
        form.append("csrf_token", csrfTokenNewsletter);
        form.append("accion", "guardar_boletin");
        form.append("id", id);
        form.append("asunto", asunto);
        form.append("contenido", contenido);

        try {
            const respuesta = await fetch("../php/newsletter.php", {
                method: "POST",
                body: form,
                credentials: "same-origin"
            });
            const resultado = await respuesta.json();

            if (respuesta.ok && resultado.ok) {
                document.getElementById("boletin-id").value = String(resultado.id || id);
                mostrarMensajeNewsletter(resultado.mensaje || "Borrador guardado.", false);
                await cargarDatosNewsletter();
                return;
            }

            mostrarMensajeNewsletter(resultado.mensaje || "No se pudo guardar el boletín.", true);
        } catch {
            mostrarMensajeNewsletter("Error de comunicación con el servidor.", true);
        }
    });

    btnPrueba?.addEventListener("click", async () => {
        if (!correoDisponibleServidor) {
            mostrarMensajeNewsletter("No disponible: falta configurar Gmail SMTP en el servidor.", true);
            return;
        }

        const correoInput = document.getElementById("correo-prueba-newsletter");
        const correoPrueba = correoInput ? correoInput.value.trim() : "";
        const asunto = document.getElementById("boletin-asunto").value.trim();
        const contenido = document.getElementById("boletin-contenido").value.trim();

        if (!correoPrueba) {
            mostrarMensajeNewsletter("Ingresa una dirección de correo para enviar la prueba.", true);
            correoInput?.focus();
            return;
        }

        if (!asunto || !contenido) {
            mostrarMensajeNewsletter("El asunto y el contenido son obligatorios para enviar la prueba.", true);
            return;
        }

        const form = new FormData();
        form.append("csrf_token", csrfTokenNewsletter);
        form.append("accion", "enviar_prueba");
        form.append("correo_prueba", correoPrueba);
        form.append("asunto", asunto);
        form.append("contenido", contenido);

        btnPrueba.disabled = true;
        btnPrueba.textContent = "Enviando prueba...";

        try {
            const respuesta = await fetch("../php/newsletter.php", {
                method: "POST",
                body: form,
                credentials: "same-origin"
            });
            const resultado = await respuesta.json();
            mostrarMensajeNewsletter(resultado.mensaje || "Prueba procesada.", !respuesta.ok || !resultado.ok);
        } catch {
            mostrarMensajeNewsletter("Error de comunicación con el servidor al enviar la prueba.", true);
        } finally {
            btnPrueba.disabled = !correoDisponibleServidor;
            btnPrueba.textContent = "Enviar correo de prueba";
        }
    });

    btnEnviar?.addEventListener("click", async () => {
        if (!correoDisponibleServidor) {
            mostrarMensajeNewsletter("No disponible: falta configurar un servicio de correo.", true);
            return;
        }

        const id = Number(document.getElementById("boletin-id").value || 0);
        if (id <= 0) {
            mostrarMensajeNewsletter("Guarda primero el borrador del boletín antes de enviarlo.", true);
            return;
        }

        const confirmado = window.confirm(
            "¿Enviar este boletín de forma individual a los suscriptores activos? Esta acción marcará el boletín como enviado."
        );
        if (!confirmado) {
            return;
        }

        const form = new FormData();
        form.append("csrf_token", csrfTokenNewsletter);
        form.append("accion", "enviar_boletin");
        form.append("id", String(id));

        btnEnviar.disabled = true;
        btnEnviar.textContent = "Enviando boletín...";

        try {
            const respuesta = await fetch("../php/newsletter.php", {
                method: "POST",
                body: form,
                credentials: "same-origin"
            });
            const resultado = await respuesta.json();
            mostrarMensajeNewsletter(resultado.mensaje || "Operación completada.", !respuesta.ok || !resultado.ok);
            await cargarDatosNewsletter();
            if (respuesta.ok && resultado.ok) {
                document.getElementById("panel-formulario-boletin").hidden = true;
            }
        } catch {
            mostrarMensajeNewsletter("Error de comunicación con el servidor.", true);
        } finally {
            btnEnviar.disabled = !correoDisponibleServidor;
            btnEnviar.textContent = "Enviar boletín a suscriptores";
        }
    });
}

function abrirEdicionBoletin(b) {
    document.getElementById("boletin-id").value = String(b.id);
    document.getElementById("boletin-asunto").value = b.asunto || "";
    document.getElementById("boletin-contenido").value = b.contenido || "";
    document.getElementById("vista-previa-boletin").hidden = true;
    document.getElementById("titulo-form-boletin").textContent = "Editar borrador de boletín";
    document.getElementById("panel-formulario-boletin").hidden = false;
}

function mostrarMensajeNewsletter(texto, esError) {
    const alerta = document.getElementById("mensaje-newsletter");
    if (!alerta) {
        return;
    }
    alerta.textContent = texto;
    alerta.className = esError ? "alerta-admin alerta-admin-error" : "alerta-admin alerta-admin-exito";
    alerta.hidden = false;
}

function inicializarSidebarMovilNewsletter() {
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

function inicializarSalirNewsletter() {
    const boton = document.getElementById("boton-salir");
    if (!boton) {
        return;
    }
    boton.addEventListener("click", async () => {
        const form = new FormData();
        form.append("csrf_token", csrfTokenNewsletter);
        await fetch("../php/cerrar_sesion.php", {
            method: "POST",
            body: form,
            credentials: "same-origin"
        });
        window.location.href = "../acceso.html";
    });
}
