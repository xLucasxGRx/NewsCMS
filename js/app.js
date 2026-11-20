/**
 * NewsCMS - Script principal del portal público
 * Gestiona fecha actual, estado de sesión, noticias publicadas, menú móvil y buscador.
 */

document.addEventListener("DOMContentLoaded", () => {
    mostrarFechaActual();
    actualizarAnioPie();
    cargarNoticiasPortada();
    inicializarMenuMovil();
    inicializarNavegacionSecciones();
    inicializarBuscador();
    inicializarCierreAviso();
});

function mostrarFechaActual() {
    const elementoFecha = document.getElementById("fecha-actual");
    if (!elementoFecha) {
        return;
    }

    const texto = new Intl.DateTimeFormat("es-ES", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
    }).format(new Date());

    elementoFecha.textContent = texto.charAt(0).toUpperCase() + texto.slice(1);
}

function actualizarAnioPie() {
    const elementoAnio = document.getElementById("anio-actual");
    if (elementoAnio) {
        elementoAnio.textContent = String(new Date().getFullYear());
    }
}

async function cargarNoticiasPortada() {
    try {
        const respuesta = await fetch("php/noticias.php?modo=publico");
        if (!respuesta.ok) {
            return;
        }

        const datos = await respuesta.json();
        if (!datos.ok) {
            return;
        }

        renderizarUltimaHora(datos.ultimas_hora || []);
        renderizarNoticiaPrincipal(datos.principal || null);
        renderizarUltimasNoticias(datos.ultimas || []);
        renderizarDestacadas(datos.destacadas || []);
        renderizarPorCategoria(datos.por_categoria || []);
    } catch {
        // Conservar estados vacíos discretos si no hay conexión
    }
}

function renderizarUltimaHora(lista) {
    const contenedor = document.getElementById("texto-ultima-hora");
    if (!contenedor || lista.length === 0) {
        return;
    }

    contenedor.textContent = "";
    lista.forEach((n, indice) => {
        if (indice > 0) {
            contenedor.appendChild(document.createTextNode("  |  "));
        }
        const enlace = document.createElement("a");
        enlace.href = `noticia.html?id=${encodeURIComponent(n.id)}`;
        enlace.className = "enlace-ultima-hora";
        enlace.textContent = n.titulo;
        contenedor.appendChild(enlace);
    });
}

function renderizarNoticiaPrincipal(noticia) {
    const contenedor = document.getElementById("contenedor-noticia-principal");
    if (!contenedor || !noticia) {
        return;
    }

    contenedor.textContent = "";
    const articulo = document.createElement("article");
    articulo.className = "tarjeta-noticia tarjeta-principal";

    if (noticia.imagen) {
        const img = document.createElement("img");
        img.src = noticia.imagen;
        img.alt = noticia.titulo;
        img.className = "imagen-principal-noticia";
        articulo.appendChild(img);
    }

    const cuerpo = document.createElement("div");
    cuerpo.className = "cuerpo-tarjeta-noticia";

    const cat = document.createElement("span");
    cat.className = "marcador-categoria";
    cat.textContent = noticia.categoria;

    const h2 = document.createElement("h2");
    h2.className = "titulo-principal-noticia";
    const enlace = document.createElement("a");
    enlace.href = `noticia.html?id=${encodeURIComponent(noticia.id)}`;
    enlace.textContent = noticia.titulo;
    h2.appendChild(enlace);

    cuerpo.appendChild(cat);
    cuerpo.appendChild(h2);

    if (noticia.resumen) {
        const resumen = document.createElement("p");
        resumen.className = "resumen-tarjeta-noticia";
        resumen.textContent = noticia.resumen;
        cuerpo.appendChild(resumen);
    }

    const meta = document.createElement("p");
    meta.className = "meta-noticia";
    const fecha = noticia.fecha_publicacion ? noticia.fecha_publicacion.slice(0, 10) : "";
    meta.textContent = `${noticia.autor}${fecha ? " · " + fecha : ""}`;
    cuerpo.appendChild(meta);

    articulo.appendChild(cuerpo);
    contenedor.appendChild(articulo);
}

function renderizarUltimasNoticias(lista) {
    const contenedor = document.getElementById("contenedor-ultimas-noticias");
    const pie = document.getElementById("pie-ultimas-noticias");
    const recientes = Array.isArray(lista) ? lista.slice(0, 4) : [];

    if (!contenedor) {
        return;
    }

    if (recientes.length === 0) {
        if (pie) {
            pie.hidden = true;
        }
        return;
    }

    contenedor.className = "lista-ultimas-publicas";
    contenedor.textContent = "";

    recientes.forEach((n) => {
        const item = document.createElement("article");
        item.className = "item-ultima-noticia";

        const filaMeta = document.createElement("div");
        filaMeta.className = "fila-meta-ultima";

        const cat = document.createElement("span");
        cat.className = "marcador-categoria marcador-categoria-ultima";
        cat.textContent = n.categoria || "";
        filaMeta.appendChild(cat);

        const fecha = n.fecha_publicacion ? n.fecha_publicacion.slice(0, 10) : "";
        const textoFecha = fecha || n.autor || "";
        if (textoFecha) {
            const fechaEl = document.createElement("time");
            fechaEl.className = "fecha-ultima-noticia";
            if (fecha) {
                fechaEl.setAttribute("datetime", fecha);
            }
            fechaEl.textContent = textoFecha;
            filaMeta.appendChild(fechaEl);
        }

        const h3 = document.createElement("h3");
        h3.className = "titulo-ultima-noticia";
        const enlace = document.createElement("a");
        enlace.href = `noticia.html?id=${encodeURIComponent(n.id)}`;
        enlace.title = n.titulo || "";
        enlace.textContent = n.titulo || "";
        h3.appendChild(enlace);

        item.appendChild(filaMeta);
        item.appendChild(h3);
        contenedor.appendChild(item);
    });

    if (pie) {
        pie.hidden = false;
    }
}

function renderizarDestacadas(lista) {
    const contenedor = document.getElementById("contenedor-destacadas");
    if (!contenedor || lista.length === 0) {
        return;
    }

    contenedor.textContent = "";
    lista.forEach((n) => {
        const tarjeta = document.createElement("article");
        tarjeta.className = "tarjeta-noticia";

        if (n.imagen) {
            const img = document.createElement("img");
            img.src = n.imagen;
            img.alt = n.titulo;
            img.className = "imagen-tarjeta-noticia";
            tarjeta.appendChild(img);
        }

        const cuerpo = document.createElement("div");
        cuerpo.className = "cuerpo-tarjeta-noticia";

        const cat = document.createElement("span");
        cat.className = "marcador-categoria";
        cat.textContent = n.categoria;

        const h3 = document.createElement("h3");
        h3.className = "titulo-tarjeta-noticia";
        const enlace = document.createElement("a");
        enlace.href = `noticia.html?id=${encodeURIComponent(n.id)}`;
        enlace.textContent = n.titulo;
        h3.appendChild(enlace);

        cuerpo.appendChild(cat);
        cuerpo.appendChild(h3);

        if (n.resumen) {
            const p = document.createElement("p");
            p.className = "resumen-tarjeta-noticia";
            p.textContent = n.resumen;
            cuerpo.appendChild(p);
        }

        tarjeta.appendChild(cuerpo);
        contenedor.appendChild(tarjeta);
    });
}

function renderizarPorCategoria(noticias) {
    const tarjetas = document.querySelectorAll(".tarjeta-seccion");
    if (!tarjetas.length) {
        return;
    }

    const lista = Array.isArray(noticias) ? noticias : [];

    tarjetas.forEach((tarjeta) => {
        const catNombre = tarjeta.getAttribute("data-categoria") || "";
        const slugFallback = tarjeta.getAttribute("data-slug") || catNombre;
        const coincidencias = lista.filter((n) => n.categoria === catNombre).slice(0, 2);
        const principalCat = coincidencias[0] || null;
        const slugCategoria = (principalCat && principalCat.categoria_slug) || slugFallback;

        tarjeta.textContent = "";

        // Zona A: Imagen protagonista de la categoría
        if (principalCat && principalCat.imagen) {
            const enlaceImg = document.createElement("a");
            enlaceImg.href = `noticia.html?id=${encodeURIComponent(principalCat.id)}`;
            enlaceImg.className = "miniatura-seccion-enlace";
            enlaceImg.setAttribute("aria-label", `Leer noticia destacada de ${catNombre}: ${principalCat.titulo}`);

            const img = document.createElement("img");
            img.src = principalCat.imagen;
            img.alt = principalCat.titulo || catNombre;
            img.loading = "lazy";
            img.className = "miniatura-seccion-img";

            enlaceImg.appendChild(img);
            tarjeta.appendChild(enlaceImg);
        }

        const cuerpo = document.createElement("div");
        cuerpo.className = "cuerpo-tarjeta-seccion";

        // Zona B: Identidad protagonista de la categoría + acción Ver sección en la misma zona
        const cabeceraCat = document.createElement("div");
        cabeceraCat.className = "cabecera-tarjeta-seccion";

        const identidadCat = document.createElement("div");
        identidadCat.className = "identidad-categoria-tarjeta";

        const etiquetaZona = document.createElement("span");
        etiquetaZona.className = "etiqueta-seccion-tarjeta";
        etiquetaZona.textContent = "Sección";

        const h3 = document.createElement("h3");
        h3.className = "nombre-categoria-seccion";
        h3.textContent = catNombre;

        identidadCat.appendChild(etiquetaZona);
        identidadCat.appendChild(h3);

        const verMas = document.createElement("a");
        verMas.href = `noticias.html?categoria=${encodeURIComponent(slugCategoria)}`;
        verMas.className = "enlace-ver-categoria";
        verMas.textContent = "Ver sección →";
        verMas.setAttribute("aria-label", `Ver todas las noticias de ${catNombre}`);

        cabeceraCat.appendChild(identidadCat);
        cabeceraCat.appendChild(verMas);
        cuerpo.appendChild(cabeceraCat);

        // Zona C: Titulares secundarios relacionados (hasta 2 artículos existentes)
        const listaTitulares = document.createElement("div");
        listaTitulares.className = "estado-tarjeta lista-titulares-seccion";

        if (coincidencias.length === 0) {
            const vacio = document.createElement("p");
            vacio.className = "sin-noticias-seccion";
            vacio.textContent = "Sin publicaciones recientes en esta sección.";
            listaTitulares.appendChild(vacio);
        } else {
            coincidencias.forEach((item, idx) => {
                const enlace = document.createElement("a");
                enlace.href = `noticia.html?id=${encodeURIComponent(item.id)}`;
                enlace.className = idx === 0
                    ? "enlace-categoria-noticia titular-primario-seccion"
                    : "enlace-categoria-noticia titular-secundario-seccion";
                enlace.title = item.titulo || "";
                enlace.textContent = item.titulo || "";
                listaTitulares.appendChild(enlace);
            });
        }

        cuerpo.appendChild(listaTitulares);
        tarjeta.appendChild(cuerpo);
    });
}

function inicializarMenuMovil() {
    const botonMenu = document.getElementById("boton-menu");
    const menuPrincipal = document.getElementById("menu-principal");

    if (!botonMenu || !menuPrincipal) {
        return;
    }

    botonMenu.addEventListener("click", () => {
        const abierto = menuPrincipal.classList.toggle("menu-abierto");
        botonMenu.setAttribute("aria-expanded", abierto ? "true" : "false");
    });
}

function inicializarNavegacionSecciones() {
    const enlaces = document.querySelectorAll(".enlace-nav[data-seccion]");
    const tarjetas = document.querySelectorAll(".tarjeta-seccion");
    const tituloSeccion = document.getElementById("nombre-seccion-activa");
    const menuPrincipal = document.getElementById("menu-principal");
    const botonMenu = document.getElementById("boton-menu");

    if (!enlaces.length) {
        return;
    }

    enlaces.forEach((enlace) => {
        enlace.addEventListener("click", () => {
            const seccion = enlace.getAttribute("data-seccion") || "Inicio";

            enlaces.forEach((item) => item.classList.remove("activo"));
            enlace.classList.add("activo");

            if (tituloSeccion) {
                if (seccion === "Inicio") {
                    tituloSeccion.textContent = "";
                    tituloSeccion.hidden = true;
                } else {
                    tituloSeccion.textContent = `· ${seccion}`;
                    tituloSeccion.hidden = false;
                }
            }

            tarjetas.forEach((tarjeta) => {
                const categoria = tarjeta.getAttribute("data-categoria");
                tarjeta.classList.toggle("resaltada", categoria === seccion);
            });

            if (menuPrincipal && menuPrincipal.classList.contains("menu-abierto")) {
                menuPrincipal.classList.remove("menu-abierto");
                if (botonMenu) {
                    botonMenu.setAttribute("aria-expanded", "false");
                }
            }
        });
    });
}

function inicializarBuscador() {
    const formulario = document.getElementById("formulario-busqueda");
    const campo = document.getElementById("campo-busqueda");

    if (!formulario || !campo) {
        return;
    }

    formulario.addEventListener("submit", (evento) => {
        evento.preventDefault();
        const consulta = campo.value.trim();

        if (!consulta) {
            mostrarAviso("Escribe una palabra clave para realizar una búsqueda.");
            return;
        }

        window.location.href = `noticias.html?q=${encodeURIComponent(consulta)}`;
    });
}

function mostrarAviso(mensaje) {
    const aviso = document.getElementById("aviso-portal");
    const texto = document.getElementById("texto-aviso");

    if (!aviso || !texto) {
        return;
    }

    texto.textContent = mensaje;
    aviso.classList.remove("oculto");
}

function inicializarCierreAviso() {
    const botonCerrar = document.getElementById("cerrar-aviso");
    const aviso = document.getElementById("aviso-portal");

    if (!botonCerrar || !aviso) {
        return;
    }

    botonCerrar.addEventListener("click", () => {
        aviso.classList.add("oculto");
    });
}
