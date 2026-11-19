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

        const titulo = document.createElement("h2");
        titulo.id = "titulo-nube-etiquetas";
        titulo.className = "nube-etiquetas-titulo";
        titulo.textContent = "Temas Populares";

        const lista = document.createElement("div");
        lista.className = "nube-etiquetas-lista";

        etiquetas.forEach((etiq) => {
            const total = Number(etiq.total_publicadas || 0);
            const nivel = calcularNivel(total, min, max);

            const enlace = document.createElement("a");
            enlace.href = `noticias.html?etiqueta=${encodeURIComponent(etiq.identificador)}`;
            enlace.className = `nube-etiqueta nivel-${nivel}`;
            enlace.textContent = `${etiq.nombre} (${total})`;

            lista.appendChild(enlace);
        });

        seccion.appendChild(titulo);
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
