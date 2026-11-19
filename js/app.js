/**
 * NewsCMS - Script principal del portal público
 * Gestiona fecha actual, estado de sesión, noticias publicadas, menú móvil y buscador.
 */

document.addEventListener("DOMContentLoaded", () => {
    mostrarFechaActual();
    actualizarAnioPie();
    comprobarEstadoSesion();
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

async function comprobarEstadoSesion() {
    const enlaceAcceso = document.getElementById("enlace-acceso");
    if (!enlaceAcceso) {
        return;
    }

    try {
        const respuesta = await fetch("php/comprobar_sesion.php", {
            credentials: "same-origin"
        });
        if (!respuesta.ok) {
            return;
        }

        const datos = await respuesta.json();
        if (datos.autenticado) {
            enlaceAcceso.textContent = "Ir al panel";
            enlaceAcceso.setAttribute("href", "admin/index.html");
            enlaceAcceso.hidden = false;
        } else {
            enlaceAcceso.textContent = "Acceso editorial";
            enlaceAcceso.setAttribute("href", "acceso.html");
            enlaceAcceso.hidden = false;
        }
    } catch {
        // Mantener enlace predeterminado
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
    if (!contenedor || lista.length === 0) {
        return;
    }

    contenedor.className = "lista-ultimas-publicas";
    contenedor.textContent = "";

    lista.forEach((n) => {
        const item = document.createElement("article");
        item.className = "item-ultima-noticia";

        const cat = document.createElement("span");
        cat.className = "marcador-categoria";
        cat.textContent = n.categoria;

        const h3 = document.createElement("h3");
        const enlace = document.createElement("a");
        enlace.href = `noticia.html?id=${encodeURIComponent(n.id)}`;
        enlace.textContent = n.titulo;
        h3.appendChild(enlace);

        const meta = document.createElement("p");
        meta.className = "meta-noticia";
        const fecha = n.fecha_publicacion ? n.fecha_publicacion.slice(0, 10) : "";
        meta.textContent = fecha || n.autor;

        item.appendChild(cat);
        item.appendChild(h3);
        item.appendChild(meta);
        contenedor.appendChild(item);
    });
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
    if (noticias.length === 0) {
        return;
    }

    const tarjetas = document.querySelectorAll(".tarjeta-seccion");
    tarjetas.forEach((tarjeta) => {
        const catNombre = tarjeta.getAttribute("data-categoria");
        const coincidencias = noticias.filter((n) => n.categoria === catNombre).slice(0, 2);
        if (coincidencias.length === 0) {
            return;
        }

        const principalCat = coincidencias[0];
        tarjeta.textContent = "";

        if (principalCat.imagen) {
            const enlaceImg = document.createElement("a");
            enlaceImg.href = `noticia.html?id=${encodeURIComponent(principalCat.id)}`;
            enlaceImg.className = "miniatura-seccion-enlace";
            const img = document.createElement("img");
            img.src = principalCat.imagen;
            img.alt = principalCat.titulo;
            img.className = "miniatura-seccion-img";
            enlaceImg.appendChild(img);
            tarjeta.appendChild(enlaceImg);
        }

        const cuerpo = document.createElement("div");
        cuerpo.className = "cuerpo-tarjeta-seccion";

        const cabeceraCat = document.createElement("div");
        cabeceraCat.className = "cabecera-tarjeta-seccion";

        const h3 = document.createElement("h3");
        h3.textContent = catNombre;
        cabeceraCat.appendChild(h3);

        const verMas = document.createElement("a");
        verMas.href = `noticias.html?categoria=${encodeURIComponent(principalCat.categoria_slug || catNombre)}`;
        verMas.className = "enlace-ver-categoria";
        verMas.textContent = "Ver sección →";
        cabeceraCat.appendChild(verMas);

        cuerpo.appendChild(cabeceraCat);

        const listaTitulares = document.createElement("div");
        listaTitulares.className = "estado-tarjeta lista-titulares-seccion";

        coincidencias.forEach((item, idx) => {
            const enlace = document.createElement("a");
            enlace.href = `noticia.html?id=${encodeURIComponent(item.id)}`;
            enlace.className = idx === 0 ? "enlace-categoria-noticia titular-primario-seccion" : "enlace-categoria-noticia titular-secundario-seccion";
            enlace.textContent = item.titulo;
            listaTitulares.appendChild(enlace);
        });

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
                tituloSeccion.textContent = seccion;
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
