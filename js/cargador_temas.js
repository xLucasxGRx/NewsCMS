/**
 * NewsCMS - Cargador dinámico del tema visual activo en el portal público.
 */

(function cargarTemaActivo() {
    fetch("php/temas.php?modo=activo")
        .then((respuesta) => (respuesta.ok ? respuesta.json() : null))
        .then((datos) => {
            const enlacePrevio = document.getElementById("tema-activo-css");

            if (!datos || !datos.ok || !datos.activo || !datos.ruta_css) {
                if (enlacePrevio) {
                    enlacePrevio.remove();
                }
                return;
            }

            if (!/^temas\/[a-z][a-z0-9_]{1,50}\/[a-zA-Z0-9._-]+\.css$/.test(datos.ruta_css)) {
                return;
            }

            if (enlacePrevio) {
                enlacePrevio.href = datos.ruta_css;
                return;
            }

            const enlace = document.createElement("link");
            enlace.id = "tema-activo-css";
            enlace.rel = "stylesheet";
            enlace.href = datos.ruta_css;
            document.head.appendChild(enlace);
        })
        .catch(() => {
            // Si falla la consulta, se mantiene css/estilos.css original
        });
})();
