/**
 * Complemento: Nube de Etiquetas
 * Consulta php/catalogos.php?modo=nube_etiquetas y muestra hasta 20 etiquetas activas.
 */

export async function iniciar(contenedor) {
    try {
        const respuesta = await fetch("php/catalogos.php?modo=nube_etiquetas");
        if (!respuesta.ok) {
            return;
        }

        const datos = await respuesta.json();
        const etiquetas = datos.etiquetas || [];

        if (!datos.ok || etiquetas.length === 0) {
            return;
        }

        const conteos = etiquetas.map((e) => Number(e.total_publicadas || 0));
        const max = Math.max(...conteos);
        const min = Math.min(...conteos);

        const seccion = document.createElement("section");
        seccion.className = "nube-etiquetas-bloque";
        seccion.setAttribute("aria-labelledby", "titulo-nube-etiquetas");

        const cabecera = document.createElement("div");
        cabecera.className = "nube-etiquetas-cabecera";

        const eyebrow = document.createElement("span");
        eyebrow.className = "nube-etiquetas-eyebrow";
        eyebrow.textContent = "Etiquetas";

        const titulo = document.createElement("h2");
        titulo.id = "titulo-nube-etiquetas";
        titulo.className = "nube-etiquetas-titulo";
        titulo.textContent = "Temas Populares";

        cabecera.appendChild(eyebrow);
        cabecera.appendChild(titulo);

        const lista = document.createElement("div");
        lista.className = "nube-etiquetas-lista";

        etiquetas.forEach((etiq) => {
            const total = Number(etiq.total_publicadas || 0);
            const nivel = calcularNivel(total, min, max);

            const enlace = document.createElement("a");
            enlace.href = `noticias.html?etiqueta=${encodeURIComponent(etiq.identificador)}`;
            enlace.className = `nube-etiqueta nivel-${nivel}`;
            enlace.setAttribute("aria-label", `${etiq.nombre}, ${total} ${total === 1 ? "publicación" : "publicaciones"}`);

            const nombreEl = document.createElement("span");
            nombreEl.className = "nube-etiqueta-nombre";
            nombreEl.textContent = etiq.nombre;

            const conteoEl = document.createElement("span");
            conteoEl.className = "nube-etiqueta-conteo";
            conteoEl.setAttribute("aria-hidden", "true");
            conteoEl.textContent = String(total);

            enlace.appendChild(nombreEl);
            enlace.appendChild(conteoEl);
            lista.appendChild(enlace);
        });

        seccion.appendChild(cabecera);
        seccion.appendChild(lista);
        contenedor.appendChild(seccion);
    } catch {
        // Si falla la consulta, no se muestra la nube
    }
}

function calcularNivel(valor, min, max) {
    if (max === min) {
        return 2;
    }
    const proporcion = (valor - min) / (max - min);
    return Math.min(4, Math.max(1, Math.round(proporcion * 3) + 1));
}
