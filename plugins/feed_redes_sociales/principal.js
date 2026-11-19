/**
 * Complemento: Feed de Redes Sociales
 * Consulta php/redes_sociales.php?modo=publico y muestra los enlaces visibles.
 */

export async function iniciar(contenedor) {
    try {
        const respuesta = await fetch("php/redes_sociales.php?modo=publico");
        if (!respuesta.ok) {
            return;
        }

        const datos = await respuesta.json();
        const enlaces = datos.enlaces || [];

        if (!datos.ok || !datos.activo || enlaces.length === 0) {
            return;
        }

        const seccion = document.createElement("section");
        seccion.className = "feed-social-bloque";
        seccion.setAttribute("aria-labelledby", "titulo-feed-social");

        const titulo = document.createElement("h2");
        titulo.id = "titulo-feed-social";
        titulo.className = "feed-social-titulo";
        titulo.textContent = "Síguenos en Redes Sociales";

        const rejilla = document.createElement("div");
        rejilla.className = "feed-social-rejilla";

        const iconos = {
            Facebook: "f",
            Instagram: "IG",
            TikTok: "TT",
            X: "X"
        };

        enlaces.forEach((item) => {
            const tarjeta = document.createElement("article");
            tarjeta.className = "feed-social-tarjeta";

            const cabecera = document.createElement("div");
            cabecera.className = "feed-social-cabecera";

            const icono = document.createElement("span");
            icono.className = `feed-social-icono icono-${String(item.plataforma || "").toLowerCase()}`;
            icono.setAttribute("aria-hidden", "true");
            icono.textContent = iconos[item.plataforma] || "RS";

            const plat = document.createElement("span");
            plat.className = "feed-social-plataforma";
            plat.textContent = item.plataforma;

            cabecera.appendChild(icono);
            cabecera.appendChild(plat);

            const h3 = document.createElement("h3");
            h3.className = "feed-social-nombre";
            h3.textContent = item.titulo;

            tarjeta.appendChild(cabecera);
            tarjeta.appendChild(h3);

            if (item.descripcion) {
                const desc = document.createElement("p");
                desc.className = "feed-social-desc";
                desc.textContent = item.descripcion;
                tarjeta.appendChild(desc);
            }

            const boton = document.createElement("a");
            boton.href = item.url;
            boton.target = "_blank";
            boton.rel = "noopener noreferrer";
            boton.className = "feed-social-enlace";
            boton.textContent = "Ver publicación";

            tarjeta.appendChild(boton);
            rejilla.appendChild(tarjeta);
        });

        seccion.appendChild(titulo);
        seccion.appendChild(rejilla);
        contenedor.appendChild(seccion);
    } catch {
        // Si falla, no interrumpe la portada
    }
}
