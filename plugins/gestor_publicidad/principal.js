/**
 * Complemento Gestor de Publicidad (público)
 * Muestra hasta 3 anuncios activos en #zona-portada-inferior con composición comercial limpia.
 */

function esEnlacePublicidadSeguro(url) {
    if (typeof url !== "string" || !url.trim()) {
        return false;
    }
    try {
        const parsed = new URL(url.trim(), window.location.origin);
        return (parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.hostname !== "";
    } catch {
        return false;
    }
}

async function obtenerPublicidadPublica() {
    try {
        return await fetch("php/publicidad.php?modo=publico");
    } catch {
        // Respaldo ante bloqueadores de cliente sobre /php/publicidad.php
        return await fetch("php/complementos.php?canal=patrocinios&modo=publico");
    }
}

function asignarImagenPublicaConRespaldo(img, rutaImagen, idAnuncio, onFalloTotal) {
    const urlRespaldo = `php/complementos.php?canal=patrocinios&modo=imagen&id=${encodeURIComponent(idAnuncio)}`;
    let intentoRespaldo = false;

    img.onerror = () => {
        if (!intentoRespaldo) {
            intentoRespaldo = true;
            img.src = urlRespaldo;
            return;
        }
        img.onerror = null;
        if (typeof onFalloTotal === "function") {
            onFalloTotal();
        }
    };

    img.src = rutaImagen;
}

function crearIconoEnlaceExterno() {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("class", "publicidad-cta-icono");
    svg.setAttribute("aria-hidden", "true");

    const box = document.createElementNS(ns, "path");
    box.setAttribute("d", "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6");

    const arrow1 = document.createElementNS(ns, "polyline");
    arrow1.setAttribute("points", "15 3 21 3 21 9");

    const arrow2 = document.createElementNS(ns, "line");
    arrow2.setAttribute("x1", "10");
    arrow2.setAttribute("y1", "14");
    arrow2.setAttribute("x2", "21");
    arrow2.setAttribute("y2", "3");

    svg.appendChild(box);
    svg.appendChild(arrow1);
    svg.appendChild(arrow2);
    return svg;
}

function construirTextoCtaPublicidad(titulo) {
    const limpio = typeof titulo === "string" ? titulo.trim() : "";
    if (limpio !== "" && limpio.length <= 22) {
        return `Visitar ${limpio}`;
    }
    return "Visitar sitio";
}

export async function iniciar(contenedor) {
    const zona = contenedor || document.getElementById("zona-portada-inferior");
    if (!zona) {
        return;
    }

    if (zona.querySelector(".publicidad-bloque")) {
        return;
    }

    try {
        const respuesta = await obtenerPublicidadPublica();
        if (!respuesta.ok) {
            return;
        }

        const datos = await respuesta.json();
        if (!datos.ok || !Array.isArray(datos.anuncios) || datos.anuncios.length === 0) {
            return;
        }

        const listaAnuncios = datos.anuncios.slice(0, 3);

        const bloque = document.createElement("section");
        bloque.className = "publicidad-bloque publicidad-showcase";
        bloque.setAttribute("aria-label", "Publicidad");

        // A. Identificación publicitaria discreta y única
        const cabecera = document.createElement("div");
        cabecera.className = "publicidad-cabecera";

        const etiqueta = document.createElement("span");
        etiqueta.className = "publicidad-etiqueta";
        etiqueta.textContent = "Publicidad";

        cabecera.appendChild(etiqueta);
        bloque.appendChild(cabecera);

        const rejilla = document.createElement("div");
        rejilla.className = "publicidad-rejilla";

        listaAnuncios.forEach((anuncio) => {
            const tituloTexto = typeof anuncio.titulo === "string" ? anuncio.titulo.trim() : "";
            const descTexto = typeof anuncio.descripcion === "string" ? anuncio.descripcion.trim() : "";
            const rutaImagen = typeof anuncio.imagen === "string" ? anuncio.imagen.trim() : "";
            const tieneEnlace = esEnlacePublicidadSeguro(anuncio.enlace);

            const tarjeta = document.createElement("article");
            tarjeta.className = "publicidad-tarjeta";

            // B. Imagen o identidad visual protagonista sin recortes ni deformaciones
            if (rutaImagen !== "") {
                const marco = document.createElement("div");
                marco.className = "publicidad-marco-imagen";

                const imagen = document.createElement("img");
                imagen.className = "publicidad-imagen";
                imagen.alt = tituloTexto !== "" ? `Anuncio de ${tituloTexto}` : "Anuncio publicitario";
                imagen.loading = "lazy";
                asignarImagenPublicaConRespaldo(imagen, rutaImagen, anuncio.id, () => {
                    marco.remove();
                    tarjeta.classList.add("publicidad-tarjeta--textual");
                });

                marco.appendChild(imagen);
                tarjeta.appendChild(marco);
            } else {
                tarjeta.classList.add("publicidad-tarjeta--textual");
            }

            // C. Información comercial y acción única de visita
            const cuerpo = document.createElement("div");
            cuerpo.className = "publicidad-cuerpo";

            const info = document.createElement("div");
            info.className = "publicidad-info";

            const titulo = document.createElement("h3");
            titulo.className = "publicidad-titulo";
            titulo.textContent = tituloTexto;
            info.appendChild(titulo);

            if (descTexto !== "") {
                const desc = document.createElement("p");
                desc.className = "publicidad-desc";
                desc.textContent = descTexto;
                info.appendChild(desc);
            }

            cuerpo.appendChild(info);

            if (tieneEnlace) {
                const cta = document.createElement("a");
                cta.className = "publicidad-cta-btn";
                cta.href = anuncio.enlace.trim();
                cta.target = "_blank";
                cta.rel = "noopener noreferrer";

                const lbl = document.createElement("span");
                lbl.textContent = construirTextoCtaPublicidad(tituloTexto);
                cta.appendChild(lbl);
                cta.appendChild(crearIconoEnlaceExterno());

                cuerpo.appendChild(cta);
            }

            tarjeta.appendChild(cuerpo);
            rejilla.appendChild(tarjeta);
        });

        bloque.appendChild(rejilla);
        zona.appendChild(bloque);
    } catch {
        // Si falla la carga, se mantiene limpio el espacio inferior sin mensajes permanentes.
    }
}
