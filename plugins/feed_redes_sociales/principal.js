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

        const encabezado = document.createElement("div");
        encabezado.className = "feed-social-encabezado";

        const bloqueTitulo = document.createElement("div");
        bloqueTitulo.className = "feed-social-titulo-grupo";

        const eyebrow = document.createElement("span");
        eyebrow.className = "feed-social-eyebrow";
        eyebrow.textContent = "Canales oficiales";

        const titulo = document.createElement("h2");
        titulo.id = "titulo-feed-social";
        titulo.className = "feed-social-titulo";
        titulo.textContent = "Redes Sociales";

        bloqueTitulo.appendChild(eyebrow);
        bloqueTitulo.appendChild(titulo);

        const resumen = document.createElement("span");
        resumen.className = "feed-social-resumen";
        resumen.textContent = enlaces.length === 1 ? "1 canal activo" : `${enlaces.length} canales activos`;

        encabezado.appendChild(bloqueTitulo);
        encabezado.appendChild(resumen);

        const rejilla = document.createElement("div");
        rejilla.className = "feed-social-rejilla";

        enlaces.forEach((item) => {
            const plataforma = String(item.plataforma || "").trim();
            const platSlug = plataforma.toLowerCase();

            const tarjeta = document.createElement("article");
            tarjeta.className = "feed-social-tarjeta";

            const cabecera = document.createElement("div");
            cabecera.className = "feed-social-cabecera";

            const icono = document.createElement("span");
            icono.className = `feed-social-icono icono-${platSlug}`;
            icono.setAttribute("aria-hidden", "true");
            icono.appendChild(crearSvgPlataformaSocial(plataforma));

            const plat = document.createElement("span");
            plat.className = "feed-social-plataforma";
            plat.textContent = plataforma || "Red social";

            const tipoAcceso = document.createElement("span");
            tipoAcceso.className = "feed-social-tipo";
            tipoAcceso.textContent = "Enlace oficial";

            cabecera.appendChild(icono);
            cabecera.appendChild(plat);
            cabecera.appendChild(tipoAcceso);

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

            const pie = document.createElement("div");
            pie.className = "feed-social-pie";

            const boton = document.createElement("a");
            boton.href = item.url;
            boton.target = "_blank";
            boton.rel = "noopener noreferrer";
            boton.className = "feed-social-enlace";

            const textoEnlace = document.createElement("span");
            textoEnlace.textContent = "Visitar enlace";
            boton.appendChild(textoEnlace);
            boton.appendChild(crearSvgEnlaceExterno());

            pie.appendChild(boton);
            tarjeta.appendChild(pie);
            rejilla.appendChild(tarjeta);
        });

        seccion.appendChild(encabezado);
        seccion.appendChild(rejilla);
        contenedor.appendChild(seccion);
    } catch {
        // Si falla, no interrumpe la portada
    }
}

function crearSvgPlataformaSocial(plataforma) {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "15");
    svg.setAttribute("height", "15");
    svg.setAttribute("fill", "currentColor");
    svg.setAttribute("aria-hidden", "true");

    const path = document.createElementNS(svgNS, "path");
    if (plataforma === "Facebook") {
        path.setAttribute("d", "M13.5 21v-8.2h2.75l.41-3.2H13.5V7.55c0-.93.26-1.56 1.59-1.56h1.7V3.13c-.3-.04-1.31-.13-2.49-.13-2.46 0-4.15 1.5-4.15 4.26V9.6H7.37v3.2h2.78V21h3.35Z");
    } else if (plataforma === "Instagram") {
        path.setAttribute("d", "M7.8 3h8.4A4.8 4.8 0 0 1 21 7.8v8.4a4.8 4.8 0 0 1-4.8 4.8H7.8A4.8 4.8 0 0 1 3 16.2V7.8A4.8 4.8 0 0 1 7.8 3Zm0 1.8A3 3 0 0 0 4.8 7.8v8.4a3 3 0 0 0 3 3h8.4a3 3 0 0 0 3-3V7.8a3 3 0 0 0-3-3H7.8Zm8.95 1.35a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2ZM12 7.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Zm0 1.8a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 0 0 0-5.4Z");
    } else if (plataforma === "TikTok") {
        path.setAttribute("d", "M15.8 3c.35 2.04 1.56 3.45 3.55 3.8v2.68a6.2 6.2 0 0 1-3.55-1.1v5.92a5.5 5.5 0 1 1-4.78-5.45v2.75a2.82 2.82 0 1 0 2.08 2.72V3h2.7Z");
    } else if (plataforma === "X") {
        path.setAttribute("d", "M17.53 3h2.9l-6.34 7.25L21.55 21h-5.84l-4.57-5.98L5.9 21H3l6.78-7.75L2.6 3h5.98l4.13 5.46L17.53 3Zm-1.02 16.2h1.6L7.56 4.71H5.84L16.51 19.2Z");
    } else {
        path.setAttribute("d", "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1 17.93A8.01 8.01 0 0 1 4.07 13H7.5c.2 2.13.86 4.1 1.85 5.65.48.55 1.04 1 1.65 1.28Zm0-2.47C10.17 16.05 9.6 14.58 9.43 13H11v4.46Zm0-6.46H9.43C9.6 9.42 10.17 7.95 11 6.54V11Zm2 6.46V13h1.57c-.17 1.58-.74 3.05-1.57 4.46Zm0-6.46V6.54c.83 1.41 1.4 2.88 1.57 4.46H13Zm2.65 7.65c.99-1.55 1.65-3.52 1.85-5.65h3.43A8.01 8.01 0 0 1 13 19.93c.61-.28 1.17-.73 1.65-1.28Z");
    }

    svg.appendChild(path);
    return svg;
}

function crearSvgEnlaceExterno() {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("width", "12");
    svg.setAttribute("height", "12");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");

    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", "M6 3.5h6.5V10M12.5 3.5L6.5 9.5M10.5 11.5v1a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h1");
    svg.appendChild(path);
    return svg;
}
