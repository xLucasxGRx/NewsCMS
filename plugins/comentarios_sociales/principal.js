/**
 * Complemento: Comentarios con Inicio de Sesión Social
 * Muestra comentarios aprobados y permite comentar tras autenticarse con Google.
 */

export async function iniciar(contenedor) {
    const noticiaId = Number(new URLSearchParams(window.location.search).get("id") || 0);
    if (noticiaId <= 0) {
        return;
    }

    try {
        const resp = await fetch(`php/comentarios.php?modo=publico&noticia_id=${encodeURIComponent(noticiaId)}`, {
            credentials: "same-origin"
        });
        if (!resp.ok) {
            return;
        }

        const datos = await resp.json();
        if (!datos.ok || !datos.activo) {
            return;
        }

        renderizarBloqueComentarios(contenedor, noticiaId, datos);
    } catch {
        // Si falla la carga, la noticia sigue siendo legible
    }
}

function renderizarBloqueComentarios(contenedor, noticiaId, datos) {
    contenedor.textContent = "";

    const seccion = document.createElement("section");
    seccion.className = "comentarios-bloque";
    seccion.setAttribute("aria-labelledby", "titulo-comentarios-noticia");

    // A. Encabezado editorial
    const cabecera = document.createElement("header");
    cabecera.className = "comentarios-cabecera";

    const eyebrow = document.createElement("span");
    eyebrow.className = "comentarios-eyebrow";
    eyebrow.textContent = "PARTICIPACIÓN";

    const titulo = document.createElement("h2");
    titulo.id = "titulo-comentarios-noticia";
    titulo.className = "comentarios-titulo";
    titulo.textContent = "La conversación";

    const descripcion = document.createElement("p");
    descripcion.className = "comentarios-descripcion";
    descripcion.textContent = "Opiniones de los lectores sobre esta noticia.";

    cabecera.appendChild(eyebrow);
    cabecera.appendChild(titulo);
    cabecera.appendChild(descripcion);
    seccion.appendChild(cabecera);

    // B. Participación del lector (invitado Google o usuario autenticado)
    const sesion = datos.sesion_social || {};
    const zonaAcceso = document.createElement("div");
    zonaAcceso.className = "comentarios-acceso";

    if (sesion.autenticado) {
        const nombreUsuario = sesion.nombre || "Visitante";

        const cabeceraUsuario = document.createElement("div");
        cabeceraUsuario.className = "comentarios-usuario-bar";

        const identidad = document.createElement("div");
        identidad.className = "comentarios-usuario-identidad";

        const avatarUsuario = document.createElement("span");
        avatarUsuario.className = "comentario-avatar-iniciales avatar-sesion";
        avatarUsuario.setAttribute("aria-hidden", "true");
        avatarUsuario.textContent = obtenerInicialesAutor(nombreUsuario);

        const saludoGrupo = document.createElement("div");
        saludoGrupo.className = "comentarios-saludo-grupo";

        const estadoSesion = document.createElement("span");
        estadoSesion.className = "comentarios-estado-sesion";
        estadoSesion.textContent = "Sesión iniciada con Google";

        const nombreEl = document.createElement("strong");
        nombreEl.className = "comentarios-nombre-sesion";
        nombreEl.textContent = nombreUsuario;

        saludoGrupo.appendChild(nombreEl);
        saludoGrupo.appendChild(estadoSesion);

        identidad.appendChild(avatarUsuario);
        identidad.appendChild(saludoGrupo);

        const btnSalir = document.createElement("button");
        btnSalir.type = "button";
        btnSalir.className = "comentarios-btn-salir";
        btnSalir.textContent = "Cerrar sesión";
        btnSalir.addEventListener("click", async () => {
            btnSalir.disabled = true;
            const form = new FormData();
            form.append("csrf_token", sesion.csrf_token || "");
            await fetch("php/google_salir.php", {
                method: "POST",
                body: form,
                credentials: "same-origin"
            });
            window.location.reload();
        });

        cabeceraUsuario.appendChild(identidad);
        cabeceraUsuario.appendChild(btnSalir);
        zonaAcceso.appendChild(cabeceraUsuario);

        const formulario = document.createElement("form");
        formulario.className = "comentarios-formulario";
        formulario.noValidate = true;

        const etiqueta = document.createElement("label");
        etiqueta.className = "comentarios-etiqueta-campo";
        etiqueta.htmlFor = "campo-nuevo-comentario";
        etiqueta.textContent = "Escribe tu opinión";

        const textarea = document.createElement("textarea");
        textarea.id = "campo-nuevo-comentario";
        textarea.rows = 3;
        textarea.maxLength = 1000;
        textarea.placeholder = "Comparte tu comentario con respeto (máximo 1000 caracteres)...";
        textarea.className = "comentarios-textarea";
        textarea.required = true;

        const pieFormulario = document.createElement("div");
        pieFormulario.className = "comentarios-form-pie";

        const notaModeracion = document.createElement("span");
        notaModeracion.className = "comentarios-nota-moderacion";
        notaModeracion.textContent = "Tu comentario quedará pendiente de aprobación editorial.";

        const btnEnviar = document.createElement("button");
        btnEnviar.type = "submit";
        btnEnviar.className = "comentarios-btn-publicar";
        btnEnviar.textContent = "Enviar comentario";

        pieFormulario.appendChild(notaModeracion);
        pieFormulario.appendChild(btnEnviar);

        const avisoForm = document.createElement("p");
        avisoForm.className = "comentarios-aviso";
        avisoForm.setAttribute("role", "status");
        avisoForm.hidden = true;

        formulario.addEventListener("submit", async (e) => {
            e.preventDefault();
            avisoForm.hidden = true;
            const texto = textarea.value.trim();
            if (!texto) {
                mostrarAvisoComentario(avisoForm, "Escribe un comentario antes de enviar.", true);
                textarea.focus();
                return;
            }

            btnEnviar.disabled = true;
            btnEnviar.textContent = "Enviando...";
            const form = new FormData();
            form.append("accion", "crear");
            form.append("noticia_id", String(noticiaId));
            form.append("contenido", texto);
            form.append("csrf_token", sesion.csrf_token || "");

            try {
                const r = await fetch("php/comentarios.php", {
                    method: "POST",
                    body: form,
                    credentials: "same-origin"
                });
                const res = await r.json();
                if (r.ok && res.ok) {
                    textarea.value = "";
                    mostrarAvisoComentario(
                        avisoForm,
                        res.mensaje || "Tu comentario se envió y está pendiente de aprobación.",
                        false
                    );
                } else {
                    mostrarAvisoComentario(avisoForm, res.mensaje || "No se pudo enviar el comentario.", true);
                }
            } catch {
                mostrarAvisoComentario(avisoForm, "Error de comunicación con el servidor.", true);
            } finally {
                btnEnviar.disabled = false;
                btnEnviar.textContent = "Enviar comentario";
            }
        });

        formulario.appendChild(etiqueta);
        formulario.appendChild(textarea);
        formulario.appendChild(pieFormulario);
        formulario.appendChild(avisoForm);
        zonaAcceso.appendChild(formulario);
    } else {
        const accesoContenido = document.createElement("div");
        accesoContenido.className = "comentarios-acceso-invitado";

        const textoGrupo = document.createElement("div");
        textoGrupo.className = "comentarios-acceso-textos";

        const textoLogin = document.createElement("h3");
        textoLogin.className = "comentarios-texto-login";
        textoLogin.textContent = "Participa en la conversación";

        const subLogin = document.createElement("p");
        subLogin.className = "comentarios-subtexto-login";
        subLogin.textContent = "Inicia sesión con tu cuenta de Google para compartir tu opinión en esta noticia.";

        textoGrupo.appendChild(textoLogin);
        textoGrupo.appendChild(subLogin);
        accesoContenido.appendChild(textoGrupo);

        if (datos.google_configurado) {
            const btnGoogle = document.createElement("a");
            btnGoogle.href = `php/google_iniciar.php?noticia_id=${encodeURIComponent(noticiaId)}`;
            btnGoogle.className = "comentarios-btn-google";
            btnGoogle.appendChild(crearSvgLogoGoogle());
            const spanTxt = document.createElement("span");
            spanTxt.textContent = "Continuar con Google";
            btnGoogle.appendChild(spanTxt);
            accesoContenido.appendChild(btnGoogle);
        } else {
            const bloqueDeshab = document.createElement("div");
            bloqueDeshab.className = "comentarios-google-pendiente";

            const btnDisabled = document.createElement("button");
            btnDisabled.type = "button";
            btnDisabled.className = "comentarios-btn-google";
            btnDisabled.disabled = true;
            btnDisabled.appendChild(crearSvgLogoGoogle());
            const spanTxt = document.createElement("span");
            spanTxt.textContent = "Continuar con Google";
            btnDisabled.appendChild(spanTxt);

            const notaConfig = document.createElement("p");
            notaConfig.className = "comentarios-nota-config";
            notaConfig.textContent = "Inicio de sesión con Google pendiente de configuración por el administrador.";

            bloqueDeshab.appendChild(btnDisabled);
            bloqueDeshab.appendChild(notaConfig);
            accesoContenido.appendChild(bloqueDeshab);
        }

        zonaAcceso.appendChild(accesoContenido);
    }

    seccion.appendChild(zonaAcceso);

    // Comentarios propios pendientes o rechazados del visitante autenticado
    const misComentarios = datos.mis_comentarios || [];
    if (misComentarios.length > 0) {
        const cajaPropios = document.createElement("div");
        cajaPropios.className = "comentarios-propios";

        const sub = document.createElement("h3");
        sub.className = "comentarios-subtitulo";
        sub.textContent = "Tus comentarios en revisión";
        cajaPropios.appendChild(sub);

        const etiquetasPropios = {
            pendiente: "Pendiente de aprobación",
            rechazado: "No aprobado"
        };

        misComentarios.forEach((mc) => {
            const item = document.createElement("article");
            item.className = "comentario-propio";

            const cabeceraItem = document.createElement("div");
            cabeceraItem.className = "comentario-cabecera-item";

            const estadoPill = document.createElement("span");
            estadoPill.className = `comentario-estado-propio estado-${mc.estado || "pendiente"}`;
            estadoPill.textContent = etiquetasPropios[mc.estado] || mc.estado;

            const fecha = document.createElement("time");
            fecha.className = "comentario-fecha";
            fecha.textContent = formatearFechaComentarioPublica(mc.fecha_creacion);

            cabeceraItem.appendChild(estadoPill);
            if (fecha.textContent !== "-") {
                cabeceraItem.appendChild(fecha);
            }

            const cuerpo = document.createElement("p");
            cuerpo.className = "comentario-texto";
            cuerpo.textContent = mc.contenido;

            item.appendChild(cabeceraItem);
            item.appendChild(cuerpo);
            cajaPropios.appendChild(item);
        });
        seccion.appendChild(cajaPropios);
    }

    // C. Encabezado de opiniones publicadas
    const aprobados = datos.comentarios || [];
    const cabeceraOpiniones = document.createElement("div");
    cabeceraOpiniones.className = "comentarios-opiniones-cabecera";

    const tituloOpiniones = document.createElement("h3");
    tituloOpiniones.className = "comentarios-opiniones-titulo";
    tituloOpiniones.textContent = "OPINIONES PUBLICADAS";

    const contadorOpiniones = document.createElement("span");
    contadorOpiniones.className = "comentarios-contador-pill";
    contadorOpiniones.textContent = String(aprobados.length);
    contadorOpiniones.setAttribute(
        "aria-label",
        aprobados.length === 1 ? "1 opinión publicada" : `${aprobados.length} opiniones publicadas`
    );

    cabeceraOpiniones.appendChild(tituloOpiniones);
    cabeceraOpiniones.appendChild(contadorOpiniones);
    seccion.appendChild(cabeceraOpiniones);

    // D. Listado de comentarios aprobados
    const lista = document.createElement("div");
    lista.className = "comentarios-lista";

    if (aprobados.length === 0) {
        const cajaVacia = document.createElement("div");
        cajaVacia.className = "comentarios-vacio-caja";

        const vacio = document.createElement("p");
        vacio.className = "comentarios-vacio";
        vacio.textContent = "Todavía no hay opiniones publicadas sobre esta noticia.";

        cajaVacia.appendChild(vacio);
        lista.appendChild(cajaVacia);
    } else {
        aprobados.forEach((c) => {
            const nombreAutor = String(c.autor || "Lector").trim() || "Lector";

            const card = document.createElement("article");
            card.className = "comentario-item";

            const cabeceraCom = document.createElement("div");
            cabeceraCom.className = "comentario-item-cabecera";

            const bloqueAutor = document.createElement("div");
            bloqueAutor.className = "comentario-autor-bloque";

            const avatar = document.createElement("span");
            avatar.className = "comentario-avatar-iniciales";
            avatar.setAttribute("aria-hidden", "true");
            avatar.textContent = obtenerInicialesAutor(nombreAutor);

            const datosAutor = document.createElement("div");
            datosAutor.className = "comentario-autor-datos";

            const autor = document.createElement("strong");
            autor.className = "comentario-autor";
            autor.textContent = nombreAutor;

            const fecha = document.createElement("span");
            fecha.className = "comentario-fecha";
            fecha.textContent = formatearFechaComentarioPublica(c.fecha_creacion);

            datosAutor.appendChild(autor);
            if (fecha.textContent !== "-") {
                datosAutor.appendChild(fecha);
            }

            bloqueAutor.appendChild(avatar);
            bloqueAutor.appendChild(datosAutor);
            cabeceraCom.appendChild(bloqueAutor);

            const cuerpoWrap = document.createElement("div");
            cuerpoWrap.className = "comentario-item-cuerpo";

            const cuerpo = document.createElement("p");
            cuerpo.className = "comentario-texto";
            cuerpo.textContent = c.contenido;
            cuerpoWrap.appendChild(cuerpo);

            card.appendChild(cabeceraCom);
            card.appendChild(cuerpoWrap);
            lista.appendChild(card);
        });
    }

    seccion.appendChild(lista);
    contenedor.appendChild(seccion);
}

function obtenerInicialesAutor(nombre) {
    const partes = String(nombre || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    if (partes.length === 0) {
        return "L";
    }
    if (partes.length === 1) {
        return Array.from(partes[0])[0].toUpperCase();
    }
    const primera = Array.from(partes[0])[0] || "";
    const segunda = Array.from(partes[1])[0] || "";
    return (primera + segunda).toUpperCase();
}

function formatearFechaComentarioPublica(valor) {
    const crudo = String(valor || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(crudo)) {
        return "-";
    }
    const [anio, mes, dia] = crudo.split("-");
    return `${dia}/${mes}/${anio}`;
}

function crearSvgLogoGoogle() {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "18");
    svg.setAttribute("height", "18");
    svg.setAttribute("aria-hidden", "true");

    const paths = [
        ["#4285F4", "M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"],
        ["#34A853", "M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"],
        ["#FBBC05", "M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"],
        ["#EA4335", "M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"]
    ];

    paths.forEach(([fill, d]) => {
        const p = document.createElementNS(svgNS, "path");
        p.setAttribute("fill", fill);
        p.setAttribute("d", d);
        svg.appendChild(p);
    });

    return svg;
}

function mostrarAvisoComentario(el, texto, esError) {
    el.textContent = texto;
    el.className = esError ? "comentarios-aviso comentarios-aviso-error" : "comentarios-aviso comentarios-aviso-exito";
    el.hidden = false;
}
