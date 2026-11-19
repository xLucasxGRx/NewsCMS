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

        const etiqueta = document.createElement("span");
        etiqueta.className = "ticker-etiqueta";
        etiqueta.textContent = "ÚLTIMA HORA";

        const pista = document.createElement("div");
        pista.className = "ticker-pista";

        const lista = document.createElement("div");
        lista.className = "ticker-elementos";

        titulares.forEach((n, indice) => {
            if (indice > 0) {
                const sep = document.createElement("span");
                sep.className = "ticker-separador";
                sep.textContent = "•";
                lista.appendChild(sep);
            }

            const enlace = document.createElement("a");
            enlace.href = `noticia.html?id=${encodeURIComponent(n.id)}`;
            enlace.className = "ticker-enlace";
            enlace.textContent = n.titulo;
            lista.appendChild(enlace);
        });

        pista.appendChild(lista);
        interior.appendChild(etiqueta);
        interior.appendChild(pista);
        barra.appendChild(interior);
        contenedor.appendChild(barra);
    } catch {
        // Si falla, el cintillo básico original permanece visible
    }
}
