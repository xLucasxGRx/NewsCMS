/**
 * NewsCMS - Script de la vista previa del panel administrativo
 * Controla el menú lateral responsive y el cambio visual entre módulos.
 */

document.addEventListener("DOMContentLoaded", () => {
    inicializarSidebarMovil();
    inicializarModulos();
});

/**
 * Muestra u oculta la barra lateral en pantallas pequeñas.
 */
function inicializarSidebarMovil() {
    const botonSidebar = document.getElementById("boton-sidebar");
    const barraLateral = document.getElementById("barra-lateral");

    if (!botonSidebar || !barraLateral) {
        return;
    }

    botonSidebar.addEventListener("click", () => {
        const abierta = barraLateral.classList.toggle("abierta");
        botonSidebar.setAttribute("aria-expanded", abierta ? "true" : "false");
    });
}

/**
 * Cambia la vista entre el Dashboard y los módulos preparados en vista previa.
 */
function inicializarModulos() {
    const botones = document.querySelectorAll(".boton-modulo");
    const tituloModulo = document.getElementById("titulo-modulo");
    const vistaDashboard = document.getElementById("vista-dashboard");
    const vistaModuloVacio = document.getElementById("vista-modulo-vacio");
    const nombreModuloDetalle = document.getElementById("nombre-modulo-detalle");
    const descripcionModuloDetalle = document.getElementById("descripcion-modulo-detalle");
    const barraLateral = document.getElementById("barra-lateral");
    const botonSidebar = document.getElementById("boton-sidebar");

    const descripciones = {
        "Noticias": "Módulo visual para crear, editar, programar y publicar noticias del portal.",
        "Categorías": "Módulo visual para organizar las secciones principales del periódico digital.",
        "Etiquetas": "Módulo visual para clasificar artículos mediante palabras clave.",
        "Revisión editorial": "Módulo visual para aprobar o devolver borradores antes de su publicación.",
        "Usuarios": "Módulo visual para administrar cuentas, editores y permisos de acceso.",
        "Complementos": "Módulo visual para activar o desactivar extensiones del sistema.",
        "Temas": "Módulo visual para seleccionar la apariencia gráfica del portal público.",
        "Configuración": "Módulo visual para ajustar el nombre del sitio, idioma y parámetros generales."
    };

    if (!botones.length) {
        return;
    }

    botones.forEach((boton) => {
        boton.addEventListener("click", () => {
            const modulo = boton.getAttribute("data-modulo") || "Dashboard";

            botones.forEach((item) => item.classList.remove("activo"));
            boton.classList.add("activo");

            if (tituloModulo) {
                tituloModulo.textContent = modulo;
            }

            if (modulo === "Dashboard") {
                vistaDashboard.classList.remove("oculto");
                vistaModuloVacio.classList.add("oculto");
            } else {
                vistaDashboard.classList.add("oculto");
                vistaModuloVacio.classList.remove("oculto");
                if (nombreModuloDetalle) {
                    nombreModuloDetalle.textContent = modulo;
                }
                if (descripcionModuloDetalle) {
                    descripcionModuloDetalle.textContent =
                        descripciones[modulo] || "Módulo en preparación para próximas fases.";
                }
            }

            if (barraLateral && barraLateral.classList.contains("abierta")) {
                barraLateral.classList.remove("abierta");
                if (botonSidebar) {
                    botonSidebar.setAttribute("aria-expanded", "false");
                }
            }
        });
    });
}
