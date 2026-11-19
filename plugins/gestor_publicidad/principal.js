/**
 * Complemento: Gestor de Publicidad
 * Consulta php/publicidad.php?modo=publico y muestra hasta 3 anuncios habilitados.
 */

export async function iniciar(contenedor) {
    try {
        const respuesta = await fetch("php/publicidad.php?modo=publico");
        if (!respuesta.ok) {
            return;
        }

        const datos = await respuesta.json();
        const anuncios = datos.anuncios || [];

        if (!datos.ok || !datos.activo || anuncios.length === 0) {
            return;
        }

        const seccion = document.createElement("section");
        seccion.className = "publicidad-bloque";
        seccion.setAttribute("aria-label", "Espacio publicitario");

        const cabecera = document.createElement("div");
        cabecera.className = "publicidad-cabecera";

        const etiqueta = document.createElement("span");
        etiqueta.className = "publicidad-etiqueta";
        etiqueta.textContent = "Publicidad";
        cabecera.appendChild(etiqueta);

        const rejilla = document.createElement("div");
        rejilla.className = "publicidad-rejilla";

        anuncios.forEach((item) => {
            const tarjeta = document.createElement("article");
            tarjeta.className = "publicidad-tarjeta";

            const enlace = document.createElement("a");
            enlace.href = item.enlace;
            enlace.target = "_blank";
            enlace.rel = "noopener noreferrer";
            enlace.className = "publicidad-enlace";

            const img = document.createElement("img");
            img.src = item.imagen;
            img.alt = item.titulo;
            img.className = "publicidad-imagen";

            const cuerpo = document.createElement("div");
            cuerpo.className = "publicidad-cuerpo";

            const titulo = document.createElement("h3");
            titulo.className = "publicidad-titulo";
            titulo.textContent = item.titulo;
            cuerpo.appendChild(titulo);

            if (item.descripcion) {
                const desc = document.createElement("p");
                desc.className = "publicidad-desc";
                desc.textContent = item.descripcion;
                cuerpo.appendChild(desc);
            }

            enlace.appendChild(img);
            enlace.appendChild(cuerpo);
            tarjeta.appendChild(enlace);
            rejilla.appendChild(tarjeta);
        });

        seccion.appendChild(cabecera);
        seccion.appendChild(rejilla);
        contenedor.appendChild(seccion);
    } catch {
        // Si falla, no interrumpe el portal
    }
}
