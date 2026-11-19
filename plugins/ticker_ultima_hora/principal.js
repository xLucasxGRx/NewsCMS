/**
 * Complemento: Ticker de Última Hora
 * Sustituye el cintillo básico cuando existen noticias publicadas con es_ultima_hora = 1.
 */

export async function iniciar(contenedor) {
    try {
        const respuesta = await fetch("php/noticias.php?modo=publico");
        if (!respuesta.ok) {
            return;
        }

        const datos = await respuesta.json();
        const titulares = datos.ultimas_hora || [];

        if (!datos.ok || titulares.length === 0) {
            return;
        }

        // Ocultar el cintillo básico para evitar duplicarlo
        const cintilloBasico = document.querySelector(".franja-ultima-hora");
        if (cintilloBasico) {
            cintilloBasico.hidden = true;
        }

        const barra = document.createElement("section");
        barra.className = "ticker-ultima-hora";
        barra.setAttribute("aria-label", "Última hora");

        const interior = document.createElement("div");
        interior.className = "contenedor ticker-interior";

        const marco = document.createElement("div");
        marco.className = "ticker-cintillo";

        const etiqueta = document.createElement("span");
        etiqueta.className = "ticker-etiqueta";
        etiqueta.textContent = "ÚLTIMA HORA";

        const pista = document.createElement("div");
        pista.className = "ticker-pista";

        const lista = document.createElement("div");
        lista.className = "ticker-elementos";

        const crearGrupoTitulares = (esCopia) => {
            const grupo = document.createElement("div");
            grupo.className = esCopia ? "ticker-grupo ticker-copia" : "ticker-grupo";
            if (esCopia) {
                grupo.setAttribute("aria-hidden", "true");
            }

            titulares.forEach((n) => {
                const enlace = document.createElement("a");
                enlace.href = `noticia.html?id=${encodeURIComponent(n.id)}`;
                enlace.className = "ticker-enlace";
                enlace.textContent = n.titulo;
                if (esCopia) {
                    enlace.tabIndex = -1;
                }
                grupo.appendChild(enlace);

                const sep = document.createElement("span");
                sep.className = "ticker-separador";
                sep.setAttribute("aria-hidden", "true");
                sep.textContent = "•";
                grupo.appendChild(sep);
            });

            return grupo;
        };

        const grupoPrincipal = crearGrupoTitulares(false);
        const grupoCopia = crearGrupoTitulares(true);

        lista.appendChild(grupoPrincipal);
        lista.appendChild(grupoCopia);
        pista.appendChild(lista);
        marco.appendChild(etiqueta);
        marco.appendChild(pista);
        interior.appendChild(marco);
        barra.appendChild(interior);
        contenedor.appendChild(barra);

        const ajustarRitmoTicker = () => {
            const anchoPista = pista.clientWidth;
            if (anchoPista <= 0) {
                return;
            }
            grupoPrincipal.style.minWidth = `${anchoPista}px`;
            grupoCopia.style.minWidth = `${anchoPista}px`;

            const distancia = Math.max(grupoPrincipal.scrollWidth, anchoPista);
            const duracionSegundos = Math.max(16, Math.min(48, Math.round(distancia / 55)));
            lista.style.setProperty("--ticker-duracion", `${duracionSegundos}s`);
        };

        requestAnimationFrame(ajustarRitmoTicker);
        window.addEventListener("resize", ajustarRitmoTicker, { passive: true });
    } catch {
        // Si falla, el cintillo básico original permanece visible
    }
}
