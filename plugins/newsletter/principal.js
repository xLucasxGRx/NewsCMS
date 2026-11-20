/**
 * Complemento: Newsletter
 * Muestra el bloque editorial de suscripción al final de la portada y lo envía por fetch().
 */

export async function iniciar(contenedor) {
    try {
        const estadoResp = await fetch("php/newsletter.php?modo=estado_publico");
        if (!estadoResp.ok) {
            return;
        }
        const estadoDatos = await estadoResp.json();
        if (!estadoDatos.ok || !estadoDatos.activo) {
            return;
        }

        let envioEnCurso = false;

        const seccion = document.createElement("section");
        seccion.className = "newsletter-bloque newsletter-editorial-card";
        seccion.setAttribute("aria-labelledby", "titulo-newsletter-portal");

        // Zona superior: presentación editorial en azul marino de NewsCMS
        const cabecera = document.createElement("div");
        cabecera.className = "newsletter-cabecera";

        const cabeceraSuperior = document.createElement("div");
        cabeceraSuperior.className = "newsletter-cabecera-top";

        const icono = crearIconoCorreoNewsletter();

        const eyebrow = document.createElement("span");
        eyebrow.className = "newsletter-eyebrow";
        eyebrow.textContent = "El boletín de NewsCMS";

        cabeceraSuperior.appendChild(icono);
        cabeceraSuperior.appendChild(eyebrow);

        const titulo = document.createElement("h2");
        titulo.id = "titulo-newsletter-portal";
        titulo.className = "newsletter-titulo";
        titulo.textContent = "Las noticias también llegan a tu correo.";

        const subtitulo = document.createElement("p");
        subtitulo.className = "newsletter-subtitulo";
        subtitulo.textContent = "Recibe las novedades de NewsCMS y mantente informado.";

        cabecera.appendChild(cabeceraSuperior);
        cabecera.appendChild(titulo);
        cabecera.appendChild(subtitulo);

        // Zona inferior: formulario claro y compacto de suscripción
        const cuerpoForm = document.createElement("div");
        cuerpoForm.className = "newsletter-cuerpo-form";

        const formulario = document.createElement("form");
        formulario.className = "newsletter-formulario";
        formulario.noValidate = true;

        const campoGrupo = document.createElement("div");
        campoGrupo.className = "newsletter-campo-grupo";

        const labelCorreo = document.createElement("label");
        labelCorreo.className = "newsletter-label";
        labelCorreo.htmlFor = "newsletter-correo-publico";
        labelCorreo.textContent = "Correo electrónico";

        const inputCorreo = document.createElement("input");
        inputCorreo.id = "newsletter-correo-publico";
        inputCorreo.type = "email";
        inputCorreo.name = "correo";
        inputCorreo.className = "newsletter-input";
        inputCorreo.placeholder = "tucorreo@ejemplo.com";
        inputCorreo.autocomplete = "email";
        inputCorreo.required = true;

        campoGrupo.appendChild(labelCorreo);
        campoGrupo.appendChild(inputCorreo);

        const etiquetaConsentimiento = document.createElement("label");
        etiquetaConsentimiento.className = "newsletter-consentimiento";

        const checkConsentimiento = document.createElement("input");
        checkConsentimiento.type = "checkbox";
        checkConsentimiento.checked = false;

        const textoConsentimiento = document.createElement("span");
        textoConsentimiento.textContent = "Acepto recibir boletines informativos de NewsCMS.";

        etiquetaConsentimiento.appendChild(checkConsentimiento);
        etiquetaConsentimiento.appendChild(textoConsentimiento);

        const boton = document.createElement("button");
        boton.type = "submit";
        boton.className = "newsletter-boton";
        boton.textContent = "Quiero suscribirme";

        const mensaje = document.createElement("p");
        mensaje.className = "newsletter-mensaje";
        mensaje.setAttribute("role", "status");
        mensaje.setAttribute("aria-live", "polite");
        mensaje.hidden = true;

        const notaBaja = document.createElement("p");
        notaBaja.className = "newsletter-nota-baja";
        notaBaja.textContent = "Puedes cancelar tu suscripción desde los boletines que recibas.";

        formulario.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (envioEnCurso) {
                return;
            }
            mensaje.hidden = true;

            const correo = inputCorreo.value.trim();
            if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
                mostrarEstado(mensaje, "Ingresa un correo electrónico válido.", true);
                inputCorreo.focus();
                return;
            }

            if (!checkConsentimiento.checked) {
                mostrarEstado(mensaje, "Debes marcar la casilla de consentimiento para suscribirte.", true);
                checkConsentimiento.focus();
                return;
            }

            envioEnCurso = true;
            boton.disabled = true;
            boton.textContent = "Enviando...";

            const form = new FormData();
            form.append("accion", "suscribir");
            form.append("correo", correo);
            form.append("consentimiento", "1");

            try {
                const resp = await fetch("php/newsletter.php", {
                    method: "POST",
                    body: form,
                    credentials: "same-origin"
                });
                const res = await resp.json();

                if (resp.ok && res.ok) {
                    mostrarEstado(mensaje, res.mensaje || "Suscripción registrada.", false);
                    formulario.reset();
                } else {
                    mostrarEstado(mensaje, res.mensaje || "No se pudo completar la suscripción.", true);
                }
            } catch {
                mostrarEstado(mensaje, "Error de comunicación con el servidor.", true);
            } finally {
                envioEnCurso = false;
                boton.disabled = false;
                boton.textContent = "Quiero suscribirme";
            }
        });

        formulario.appendChild(campoGrupo);
        formulario.appendChild(etiquetaConsentimiento);
        formulario.appendChild(boton);
        formulario.appendChild(mensaje);
        formulario.appendChild(notaBaja);

        cuerpoForm.appendChild(formulario);
        seccion.appendChild(cabecera);
        seccion.appendChild(cuerpoForm);
        contenedor.appendChild(seccion);
    } catch {
        // No interrumpir el portal si falla
    }
}

function crearIconoCorreoNewsletter() {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.9");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("class", "newsletter-icono-correo");
    svg.setAttribute("aria-hidden", "true");

    const rect = document.createElementNS(ns, "rect");
    rect.setAttribute("x", "3");
    rect.setAttribute("y", "5");
    rect.setAttribute("width", "18");
    rect.setAttribute("height", "14");
    rect.setAttribute("rx", "2");

    const trazo = document.createElementNS(ns, "path");
    trazo.setAttribute("d", "m3 7 9 6 9-6");

    svg.appendChild(rect);
    svg.appendChild(trazo);
    return svg;
}

function mostrarEstado(el, texto, esError) {
    el.textContent = texto;
    el.setAttribute("role", esError ? "alert" : "status");
    el.className = esError ? "newsletter-mensaje newsletter-error" : "newsletter-mensaje newsletter-exito";
    el.hidden = false;
}
