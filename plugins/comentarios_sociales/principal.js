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

    const titulo = document.createElement("h2");
    titulo.id = "titulo-comentarios-noticia";
    titulo.className = "comentarios-titulo";
    titulo.textContent = "Comentarios";
    seccion.appendChild(titulo);

    const sesion = datos.sesion_social || {};
    const zonaAcceso = document.createElement("div");
    zonaAcceso.className = "comentarios-acceso";

    if (sesion.autenticado) {
        const cabeceraUsuario = document.createElement("div");
        cabeceraUsuario.className = "comentarios-usuario-bar";

        const saludo = document.createElement("span");
        saludo.textContent = `Conectado como ${sesion.nombre || "Visitante"}`;

        const btnSalir = document.createElement("button");
        btnSalir.type = "button";
        btnSalir.className = "comentarios-btn-salir";
        btnSalir.textContent = "Cerrar sesión";
        btnSalir.addEventListener("click", async () => {
            const form = new FormData();
            form.append("csrf_token", sesion.csrf_token || "");
            await fetch("php/google_salir.php", {
                method: "POST",
                body: form,
                credentials: "same-origin"
            });
            window.location.reload();
        });

        cabeceraUsuario.appendChild(saludo);
        cabeceraUsuario.appendChild(btnSalir);
        zonaAcceso.appendChild(cabeceraUsuario);

        const formulario = document.createElement("form");
        formulario.className = "comentarios-formulario";
        formulario.noValidate = true;

        const textarea = document.createElement("textarea");
        textarea.rows = 3;
        textarea.maxLength = 1000;
        textarea.placeholder = "Escribe tu comentario (máximo 1000 caracteres)...";
        textarea.className = "comentarios-textarea";
        textarea.required = true;

        const btnEnviar = document.createElement("button");
        btnEnviar.type = "submit";
        btnEnviar.className = "comentarios-btn-publicar";
        btnEnviar.textContent = "Publicar comentario";

        const avisoForm = document.createElement("p");
        avisoForm.className = "comentarios-aviso";
        avisoForm.hidden = true;

        formulario.addEventListener("submit", async (e) => {
            e.preventDefault();
            const texto = textarea.value.trim();
            if (!texto) {
                mostrarAvisoComentario(avisoForm, "Escribe un comentario antes de enviar.", true);
                return;
            }

            btnEnviar.disabled = true;
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
                    mostrarAvisoComentario(avisoForm, res.mensaje || "Tu comentario se envió y está pendiente de aprobación.", false);
                } else {
                    mostrarAvisoComentario(avisoForm, res.mensaje || "No se pudo enviar el comentario.", true);
                }
            } catch {
                mostrarAvisoComentario(avisoForm, "Error de comunicación con el servidor.", true);
            } finally {
                btnEnviar.disabled = false;
            }
        });

        formulario.appendChild(textarea);
        formulario.appendChild(btnEnviar);
        formulario.appendChild(avisoForm);
        zonaAcceso.appendChild(formulario);
    } else {
        const textoLogin = document.createElement("p");
        textoLogin.className = "comentarios-texto-login";
        textoLogin.textContent = "Inicia sesión con Google para comentar";
        zonaAcceso.appendChild(textoLogin);

        if (datos.google_configurado) {
            const btnGoogle = document.createElement("a");
            btnGoogle.href = `php/google_iniciar.php?noticia_id=${encodeURIComponent(noticiaId)}`;
            btnGoogle.className = "comentarios-btn-google";
            btnGoogle.textContent = "Continuar con Google";
            zonaAcceso.appendChild(btnGoogle);
        } else {
            const btnDisabled = document.createElement("button");
            btnDisabled.type = "button";
            btnDisabled.className = "comentarios-btn-google";
            btnDisabled.disabled = true;
            btnDisabled.textContent = "Continuar con Google";

            const notaConfig = document.createElement("p");
            notaConfig.className = "comentarios-nota-config";
            notaConfig.textContent = "Inicio de sesión con Google pendiente de configuración por el administrador.";

            zonaAcceso.appendChild(btnDisabled);
            zonaAcceso.appendChild(notaConfig);
        }
    }

    seccion.appendChild(zonaAcceso);

    // Mostrar propios comentarios pendientes o rechazados al visitante autenticado
    const misComentarios = datos.mis_comentarios || [];
    if (misComentarios.length > 0) {
        const cajaPropios = document.createElement("div");
        cajaPropios.className = "comentarios-propios";
        const sub = document.createElement("h3");
        sub.textContent = "Tus comentarios enviados";
        cajaPropios.appendChild(sub);

        misComentarios.forEach((mc) => {
            const item = document.createElement("article");
            item.className = "comentario-item comentario-propio";
            const meta = document.createElement("p");
            meta.className = "comentario-meta";
            meta.textContent = `Estado: ${mc.estado} · ${(mc.fecha_creacion || "").slice(0, 10)}`;
            const cuerpo = document.createElement("p");
            cuerpo.textContent = mc.contenido;
            item.appendChild(meta);
            item.appendChild(cuerpo);
            cajaPropios.appendChild(item);
        });
        seccion.appendChild(cajaPropios);
    }

    // Lista pública de comentarios aprobados
    const aprobados = datos.comentarios || [];
    const lista = document.createElement("div");
    lista.className = "comentarios-lista";

    if (aprobados.length === 0) {
        const vacio = document.createElement("p");
        vacio.className = "comentarios-vacio";
        vacio.textContent = "Todavía no hay comentarios. Sé el primero en participar";
        lista.appendChild(vacio);
    } else {
        aprobados.forEach((c) => {
            const card = document.createElement("article");
            card.className = "comentario-item";

            const meta = document.createElement("p");
            meta.className = "comentario-meta";
            meta.textContent = `${c.autor} · ${(c.fecha_creacion || "").slice(0, 10)}`;

            const cuerpo = document.createElement("p");
            cuerpo.className = "comentario-texto";
            cuerpo.textContent = c.contenido;

            card.appendChild(meta);
            card.appendChild(cuerpo);
            lista.appendChild(card);
        });
    }

    seccion.appendChild(lista);
    contenedor.appendChild(seccion);
}

function mostrarAvisoComentario(el, texto, esError) {
    el.textContent = texto;
    el.className = esError ? "comentarios-aviso comentarios-aviso-error" : "comentarios-aviso comentarios-aviso-exito";
    el.hidden = false;
}
