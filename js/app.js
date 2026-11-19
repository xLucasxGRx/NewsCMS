/**
 * NewsCMS - Script principal del portal público
 * Gestiona fecha actual, menú móvil, categorías y avisos visuales.
 */

document.addEventListener("DOMContentLoaded", () => {
    mostrarFechaActual();
    inicializarMenuMovil();
    inicializarNavegacionSecciones();
    inicializarBuscador();
    inicializarBotonLogin();
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
 * Muestra un aviso informativo al pulsar el botón de inicio de sesión.
 */
function inicializarBotonLogin() {
    const botonLogin = document.getElementById("boton-login");
    if (!botonLogin) {
        return;
    }

    botonLogin.addEventListener("click", () => {
        mostrarAviso("El inicio de sesión se habilitará en una fase posterior. Puedes revisar el diseño en Panel Admin (Vista previa).");
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
