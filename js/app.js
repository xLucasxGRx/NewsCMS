/**
 * NewsCMS - Script principal del portal público
 * Gestiona fecha actual, estado de sesión, menú móvil, categorías y buscador.
 */

document.addEventListener("DOMContentLoaded", () => {
    mostrarFechaActual();
    actualizarAnioPie();
    comprobarEstadoSesion();
    inicializarMenuMovil();
    inicializarNavegacionSecciones();
    inicializarBuscador();
    inicializarCierreAviso();
});

/**
 * Muestra la fecha actual en español en la barra superior.
 */
function mostrarFechaActual() {
    const elementoFecha = document.getElementById("fecha-actual");
    if (!elementoFecha) {
        return;
    }

    const hoy = new Date();
    const formato = new Intl.DateTimeFormat("es-ES", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
    });

    const texto = formato.format(hoy);
    elementoFecha.textContent = texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Actualiza el año en el pie de página.
 */
function actualizarAnioPie() {
    const elementoAnio = document.getElementById("anio-actual");
    if (elementoAnio) {
        elementoAnio.textContent = String(new Date().getFullYear());
    }
}

/**
 * Consulta si existe una sesión activa para ajustar el botón de acceso.
 */
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
        } else {
            enlaceAcceso.textContent = "Iniciar sesión";
            enlaceAcceso.setAttribute("href", "acceso.html");
        }
    } catch {
        // Si falla la comprobación, se mantiene el enlace predeterminado a acceso.html
    }
}

/**
 * Abre o cierra el menú de categorías en dispositivos móviles.
 */
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

/**
 * Resalta la categoría seleccionada en el menú y en la rejilla de secciones.
 */
function inicializarNavegacionSecciones() {
    const enlaces = document.querySelectorAll(".enlace-nav");
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

/**
 * Maneja el envío del buscador visual sin simular resultados falsos.
 */
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

        mostrarAviso(`Búsqueda visual para "${consulta}": aún no hay noticias registradas en el sistema.`);
    });
}

/**
 * Muestra un mensaje en el banner discreto del portal.
 */
function mostrarAviso(mensaje) {
    const aviso = document.getElementById("aviso-portal");
    const texto = document.getElementById("texto-aviso");

    if (!aviso || !texto) {
        return;
    }

    texto.textContent = mensaje;
    aviso.classList.remove("oculto");
}

/**
 * Permite cerrar el banner de aviso del portal.
 */
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
