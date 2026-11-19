/**
 * Complemento Gestor de Publicidad (publico)
 * Carga hasta 3 anuncios activos en #zona-portada-inferior mediante la firma modular iniciar(contenedor).
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

        const bloque = document.createElement("section");
        bloque.className = "publicidad-bloque";
        bloque.setAttribute("aria-label", "Publicidad");

        const cabecera = document.createElement("div");
        cabecera.className = "publicidad-cabecera";

        const etiqueta = document.createElement("span");
        etiqueta.className = "publicidad-etiqueta";
        etiqueta.textContent = "Publicidad";

        const nota = document.createElement("span");
        nota.className = "publicidad-nota-editorial";
        nota.textContent = "Espacio patrocinado";

        cabecera.appendChild(etiqueta);
        cabecera.appendChild(nota);
        bloque.appendChild(cabecera);

        const rejilla = document.createElement("div");
        rejilla.className = "publicidad-rejilla";

        datos.anuncios.forEach((anuncio) => {
            const tarjeta = document.createElement("article");
            tarjeta.className = "publicidad-tarjeta";

            const rutaImagen = typeof anuncio.imagen === "string" ? anuncio.imagen.trim() : "";
            const tieneEnlace = esEnlacePublicidadSeguro(anuncio.enlace);

            const contenedorTarjeta = document.createElement(tieneEnlace ? "a" : "div");
            contenedorTarjeta.className = "publicidad-enlace";
            if (tieneEnlace) {
                contenedorTarjeta.href = anuncio.enlace.trim();
                contenedorTarjeta.target = "_blank";
                contenedorTarjeta.rel = "noopener noreferrer";
            }

            if (rutaImagen !== "") {
                const marco = document.createElement("div");
                marco.className = "publicidad-marco-imagen";

                const imagen = document.createElement("img");
                imagen.className = "publicidad-imagen";
                imagen.alt = anuncio.titulo || "Anuncio publicitario";
                imagen.loading = "lazy";
                asignarImagenPublicaConRespaldo(imagen, rutaImagen, anuncio.id, () => {
                    marco.remove();
                    tarjeta.classList.add("publicidad-tarjeta--textual");
                });

                marco.appendChild(imagen);
                contenedorTarjeta.appendChild(marco);
            } else {
                tarjeta.classList.add("publicidad-tarjeta--textual");
            }

            const cuerpo = document.createElement("div");
            cuerpo.className = "publicidad-cuerpo";

            const superior = document.createElement("div");
            superior.className = "publicidad-cuerpo-superior";

            const titulo = document.createElement("h3");
            titulo.className = "publicidad-titulo";
            titulo.textContent = anuncio.titulo || "";
            superior.appendChild(titulo);

            if (anuncio.descripcion) {
                const desc = document.createElement("p");
                desc.className = "publicidad-desc";
                desc.textContent = anuncio.descripcion;
                superior.appendChild(desc);
            }

            cuerpo.appendChild(superior);

            if (tieneEnlace) {
                const cta = document.createElement("span");
                cta.className = "publicidad-cta";
                cta.textContent = "Visitar sitio \u2192";
                cuerpo.appendChild(cta);
            }

            contenedorTarjeta.appendChild(cuerpo);
            tarjeta.appendChild(contenedorTarjeta);
            rejilla.appendChild(tarjeta);
        });

        bloque.appendChild(rejilla);
        zona.appendChild(bloque);
    } catch {
        // Si falla la carga, se mantiene limpio el espacio inferior sin mensajes permanentes.
    }
}
