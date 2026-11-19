/**
 * Complemento: Newsletter
 * Muestra el formulario de suscripción al final de la portada y lo envía por fetch().
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

        const seccion = document.createElement("section");
        seccion.className = "newsletter-bloque";
        seccion.setAttribute("aria-labelledby", "titulo-newsletter-portal");

        const cabecera = document.createElement("div");
        cabecera.className = "newsletter-cabecera";

        const eyebrow = document.createElement("span");
        eyebrow.className = "newsletter-eyebrow";
        eyebrow.textContent = "Boletín";

        const titulo = document.createElement("h2");
        titulo.id = "titulo-newsletter-portal";
        titulo.className = "newsletter-titulo";
        titulo.textContent = "Mantente informado";

        const subtitulo = document.createElement("p");
        subtitulo.className = "newsletter-subtitulo";
        subtitulo.textContent = "Recibe novedades y noticias de NewsCMS directamente en tu correo.";

        cabecera.appendChild(eyebrow);
        cabecera.appendChild(titulo);
        cabecera.appendChild(subtitulo);

        const formulario = document.createElement("form");
        formulario.className = "newsletter-formulario";
        formulario.noValidate = true;

        const labelCorreo = document.createElement("label");
        labelCorreo.className = "newsletter-label";
        labelCorreo.htmlFor = "newsletter-correo-publico";
        labelCorreo.textContent = "Correo electrónico";

        const filaCorreo = document.createElement("div");
        filaCorreo.className = "newsletter-fila";

        const inputCorreo = document.createElement("input");
        inputCorreo.id = "newsletter-correo-publico";
        inputCorreo.type = "email";
        inputCorreo.name = "correo";
        inputCorreo.className = "newsletter-input";
        inputCorreo.placeholder = "tu-correo@ejemplo.com";
        inputCorreo.autocomplete = "email";
        inputCorreo.required = true;

        const boton = document.createElement("button");
        boton.type = "submit";
        boton.className = "newsletter-boton";
        boton.textContent = "Suscribirme";

        filaCorreo.appendChild(inputCorreo);
        filaCorreo.appendChild(boton);

        const etiquetaConsentimiento = document.createElement("label");
        etiquetaConsentimiento.className = "newsletter-consentimiento";

        const checkConsentimiento = document.createElement("input");
        checkConsentimiento.type = "checkbox";
        checkConsentimiento.checked = false;

        const textoConsentimiento = document.createElement("span");
        textoConsentimiento.textContent = "Acepto recibir boletines informativos de NewsCMS.";

        etiquetaConsentimiento.appendChild(checkConsentimiento);
        etiquetaConsentimiento.appendChild(textoConsentimiento);

        const mensaje = document.createElement("p");
        mensaje.className = "newsletter-mensaje";
        mensaje.setAttribute("role", "status");
        mensaje.hidden = true;

        formulario.addEventListener("submit", async (e) => {
            e.preventDefault();
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
                boton.disabled = false;
                boton.textContent = "Suscribirme";
            }
        });

        formulario.appendChild(labelCorreo);
        formulario.appendChild(filaCorreo);
        formulario.appendChild(etiquetaConsentimiento);
        formulario.appendChild(mensaje);

        seccion.appendChild(cabecera);
        seccion.appendChild(formulario);
        contenedor.appendChild(seccion);
    } catch {
        // No interrumpir el portal si falla
    }
}

function mostrarEstado(el, texto, esError) {
    el.textContent = texto;
    el.className = esError ? "newsletter-mensaje newsletter-error" : "newsletter-mensaje newsletter-exito";
    el.hidden = false;
}
