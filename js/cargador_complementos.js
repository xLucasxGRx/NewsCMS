/**
 * NewsCMS - Cargador genérico de complementos activos en el portal público.
 */

document.addEventListener("DOMContentLoaded", () => {
    cargarComplementosActivos();
});

async function cargarComplementosActivos() {
    try {
        const respuesta = await fetch("php/complementos.php?modo=activos");
        if (!respuesta.ok) {
            return;
        }

        const datos = await respuesta.json();
        const complementos = datos.complementos || [];

        for (const plugin of complementos) {
            await inicializarComplemento(plugin);
        }
    } catch {
        // Si falla la carga, el portal continúa funcionando normalmente
    }
}

async function inicializarComplemento(plugin) {
    const idValido = /^[a-z][a-z0-9_]{1,50}$/.test(plugin.identificador || "");
    const jsValido = /^[a-zA-Z0-9._-]+\.js$/.test(plugin.archivo_js || "");
    const zonaValida = /^[a-z][a-z0-9_]{1,50}$/.test(plugin.zona || "");

    if (!idValido || !jsValido || !zonaValida) {
        return;
    }

    const contenedorZona = document.querySelector(`[data-zona="${plugin.zona}"]`);
    if (!contenedorZona) {
        return;
    }

    if (plugin.archivo_css && /^[a-zA-Z0-9._-]+\.css$/.test(plugin.archivo_css)) {
        const enlaceCss = document.createElement("link");
        enlaceCss.rel = "stylesheet";
        enlaceCss.href = `plugins/${plugin.identificador}/${plugin.archivo_css}`;
        document.head.appendChild(enlaceCss);
    }

    try {
        const modulo = await import(`../plugins/${plugin.identificador}/${plugin.archivo_js}`);
        if (typeof modulo.iniciar === "function") {
            modulo.iniciar(contenedorZona);
        }
    } catch {
        // No interrumpir el resto del portal si un complemento falla
    }
}
