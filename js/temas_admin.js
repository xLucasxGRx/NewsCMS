/**
 * NewsCMS - Script de administración de temas visuales ZIP (admin/temas.html)
 */

let csrfTokenTemas = "";

document.addEventListener("DOMContentLoaded", () => {
    iniciarTemasAdmin();
});

async function iniciarTemasAdmin() {
    try {
        const respuesta = await fetch("../php/comprobar_sesion.php", {
            credentials: "same-origin"
        });
        if (!respuesta.ok) {
            window.location.href = "../acceso.html";
            return;
        }

        const datos = await respuesta.json();
        if (!datos.autenticado || !datos.usuario) {
            window.location.href = "../acceso.html";
            return;
        }

        if (datos.usuario.rol !== "administrador") {
            window.location.href = "index.html";
            return;
        }

        csrfTokenTemas = datos.csrf_token || "";
        mostrarCabeceraTemas(datos.usuario);
        renderizarSidebarTemas(datos.modulos_permitidos || ["Dashboard"]);
        inicializarSidebarMovilTemas();
        inicializarSalirTemas();
        inicializarFormularioTemas();

        document.getElementById("contenedor-admin").hidden = false;
        await cargarTemasInstalados();
    } catch {
        window.location.href = "../acceso.html";
    }
}

function mostrarCabeceraTemas(usuario) {
    document.getElementById("nombre-usuario").textContent = usuario.nombre || "";
    document.getElementById("rol-usuario").textContent = usuario.rol || "";
    document.getElementById("rol-sidebar").textContent = usuario.rol || "";
}

function renderizarSidebarTemas(modulos) {
    const lista = document.getElementById("lista-modulos");
    if (!lista) {
        return;
    }
    lista.textContent = "";

    modulos.forEach((modulo) => {
        const li = document.createElement("li");
        const enlace = document.createElement("a");
        enlace.className = modulo === "Temas" ? "boton-modulo activo" : "boton-modulo";
        enlace.textContent = modulo;

        if (modulo === "Noticias") {
            enlace.href = "noticias.html";
        } else if (modulo === "Categorías") {
            enlace.href = "categorias.html";
        } else if (modulo === "Etiquetas") {
            enlace.href = "etiquetas.html";
        } else if (modulo === "Revisión editorial") {
            enlace.href = "revision.html";
        } else if (modulo === "Usuarios") {
            enlace.href = "usuarios.html";
        } else if (modulo === "Complementos") {
            enlace.href = "complementos.html";
        } else if (modulo === "Temas") {
            enlace.href = "temas.html";
        } else if (modulo === "Configuración") {
            enlace.href = "configuracion.html";
        } else {
            enlace.href = `index.html?modulo=${encodeURIComponent(modulo)}`;
        }

        li.appendChild(enlace);
        lista.appendChild(li);
    });
}

async function cargarTemasInstalados() {
    const cuerpo = document.getElementById("cuerpo-tabla-temas");
    const estadoActual = document.getElementById("estado-tema-actual");
    const detalleEstado = document.getElementById("detalle-estado-tema");
    const botonOriginal = document.getElementById("btn-usar-original");
    const totalTemas = document.getElementById("total-temas");

    try {
        const respuesta = await fetch("../php/temas.php?modo=admin_lista", {
            credentials: "same-origin"
        });
        if (!respuesta.ok) {
            mostrarMensajeTemas("No se pudo cargar la lista de temas.", true);
            return;
        }

        const datos = await respuesta.json();
        const temas = datos.temas || [];
        const activo = temas.find((t) => Number(t.activo) === 1);

        if (estadoActual) {
            estadoActual.textContent = activo
                ? `Tema activo: ${activo.nombre}`
                : "Diseño original activo";
        }
        if (detalleEstado) {
            detalleEstado.textContent = activo
                ? `Versión v${activo.version} aplicada actualmente al portal público.`
                : "Se está utilizando la apariencia predeterminada de NewsCMS.";
        }
        if (botonOriginal) {
            botonOriginal.disabled = !activo;
        }
        if (totalTemas) {
            totalTemas.textContent = temas.length === 1 ? "1 instalado" : `${temas.length} instalados`;
        }

        cuerpo.textContent = "";
        if (temas.length === 0) {
            renderizarEstadoVacioTemas(cuerpo);
            return;
        }

        temas.forEach((item) => {
            const estaActivo = Number(item.activo) === 1;

            const tarjeta = document.createElement("article");
            tarjeta.className = estaActivo
                ? "tarjeta-tema tema-activo"
                : "tarjeta-tema tema-inactiva";

            // Zona superior: representación decorativa neutra de maquetación visual
            tarjeta.appendChild(crearPreviewDecorativaTema(estaActivo));

            // Zona central: nombre, versión, estado y descripción
            const cuerpoTarjeta = document.createElement("div");
            cuerpoTarjeta.className = "tema-cuerpo";

            const cabeceraInfo = document.createElement("div");
            cabeceraInfo.className = "tema-cabecera-info";

            const titulo = document.createElement("h3");
            titulo.className = "tema-nombre";
            titulo.textContent = item.nombre;

            const filaMeta = document.createElement("div");
            filaMeta.className = "tema-meta";

            const version = document.createElement("span");
            version.className = "tema-version";
            version.textContent = `v${item.version}`;

            const badge = document.createElement("span");
            badge.className = estaActivo
                ? "estado-tema-badge estado-tema-activo"
                : "estado-tema-badge estado-tema-inactivo";
            badge.textContent = estaActivo ? "Tema activo" : "Inactivo";

            filaMeta.appendChild(version);
            filaMeta.appendChild(badge);
            cabeceraInfo.appendChild(titulo);
            cabeceraInfo.appendChild(filaMeta);

            const descripcion = document.createElement("p");
            descripcion.className = "tema-descripcion";
            descripcion.textContent = item.descripcion || "Sin descripción disponible.";

            cuerpoTarjeta.appendChild(cabeceraInfo);
            cuerpoTarjeta.appendChild(descripcion);

            // Zona inferior: acciones reales del tema
            const pie = document.createElement("div");
            pie.className = "tema-pie";

            if (!estaActivo) {
                const btnActivar = document.createElement("button");
                btnActivar.type = "button";
                btnActivar.className = "boton-primario-admin boton-activar-tema";
                btnActivar.textContent = "Activar tema";
                btnActivar.addEventListener("click", () => activarTema(item.id));
                pie.appendChild(btnActivar);
            } else {
                const indicadorUso = document.createElement("span");
                indicadorUso.className = "indicador-en-uso-tema";
                indicadorUso.appendChild(crearIconoCheckTema());
                const lblUso = document.createElement("span");
                lblUso.textContent = "En uso actualmente";
                indicadorUso.appendChild(lblUso);
                pie.appendChild(indicadorUso);
            }

            tarjeta.appendChild(cuerpoTarjeta);
            tarjeta.appendChild(pie);
            cuerpo.appendChild(tarjeta);
        });
    } catch {
        mostrarMensajeTemas("No se pudo cargar la lista de temas.", true);
    }
}

function inicializarFormularioTemas() {
    const formulario = document.getElementById("formulario-instalar-tema");
    const botonInstalar = document.getElementById("btn-instalar-tema");
    const botonOriginal = document.getElementById("btn-usar-original");

    formulario?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const input = document.getElementById("archivo-tema-zip");
        const archivo = input.files && input.files[0];

        if (!archivo) {
            mostrarMensajeTemas("Selecciona un archivo ZIP de tema.", true);
            return;
        }

        botonInstalar.disabled = true;
        botonInstalar.textContent = "Instalando...";

        const form = new FormData();
        form.append("csrf_token", csrfTokenTemas);
        form.append("accion", "instalar");
        form.append("archivo_zip", archivo);

        try {
            const respuesta = await fetch("../php/temas.php", {
                method: "POST",
                body: form,
                credentials: "same-origin"
            });
            const resultado = await respuesta.json();

            if (respuesta.ok && resultado.ok) {
                mostrarMensajeTemas(resultado.mensaje || "Tema instalado.", false);
                formulario.reset();
                await cargarTemasInstalados();
                return;
            }

            mostrarMensajeTemas(resultado.mensaje || "No se pudo instalar el tema.", true);
        } catch {
            mostrarMensajeTemas("Error de comunicación con el servidor.", true);
        } finally {
            botonInstalar.disabled = false;
            botonInstalar.textContent = "Instalar tema";
        }
    });

    botonOriginal?.addEventListener("click", async () => {
        const form = new FormData();
        form.append("csrf_token", csrfTokenTemas);
        form.append("accion", "usar_original");

        try {
            const respuesta = await fetch("../php/temas.php", {
                method: "POST",
                body: form,
                credentials: "same-origin"
            });
            const resultado = await respuesta.json();
            if (respuesta.ok && resultado.ok) {
                mostrarMensajeTemas(resultado.mensaje || "Diseño original restaurado.", false);
                await cargarTemasInstalados();
            }
        } catch {
            mostrarMensajeTemas("Error al restaurar el diseño original.", true);
        }
    });
}

async function activarTema(id) {
    const form = new FormData();
    form.append("csrf_token", csrfTokenTemas);
    form.append("accion", "activar");
    form.append("id", String(id));

    try {
        const respuesta = await fetch("../php/temas.php", {
            method: "POST",
            body: form,
            credentials: "same-origin"
        });
        const resultado = await respuesta.json();
        if (respuesta.ok && resultado.ok) {
            mostrarMensajeTemas(resultado.mensaje || "Tema activado.", false);
            await cargarTemasInstalados();
            return;
        }
        mostrarMensajeTemas(resultado.mensaje || "No se pudo activar el tema.", true);
    } catch {
        mostrarMensajeTemas("Error de comunicación con el servidor.", true);
    }
}

function mostrarMensajeTemas(texto, esError) {
    const alerta = document.getElementById("mensaje-temas");
    if (!alerta) {
        return;
    }
    alerta.textContent = texto;
    alerta.className = esError ? "alerta-admin alerta-admin-error" : "alerta-admin alerta-admin-exito";
    alerta.hidden = false;
}

function inicializarSidebarMovilTemas() {
    const boton = document.getElementById("boton-sidebar");
    const barra = document.getElementById("barra-lateral");
    if (!boton || !barra) {
        return;
    }
    boton.addEventListener("click", () => {
        const abierta = barra.classList.toggle("abierta");
        boton.setAttribute("aria-expanded", abierta ? "true" : "false");
    });
}

function inicializarSalirTemas() {
    const boton = document.getElementById("boton-salir");
    if (!boton) {
        return;
    }
    boton.addEventListener("click", async () => {
        const form = new FormData();
        form.append("csrf_token", csrfTokenTemas);
        await fetch("../php/cerrar_sesion.php", {
            method: "POST",
            body: form,
            credentials: "same-origin"
        });
        window.location.href = "../acceso.html";
    });
}

function renderizarEstadoVacioTemas(contenedor) {
    const caja = document.createElement("div");
    caja.className = "estado-vacio-temas";

    const titulo = document.createElement("strong");
    titulo.className = "titulo-estado-vacio";
    titulo.textContent = "Aún no hay temas instalados. Se está usando el diseño original.";

    const nota = document.createElement("p");
    nota.className = "descripcion-estado-vacio";
    nota.textContent = "Puedes subir un paquete ZIP en la sección inferior para agregar nuevas apariencias visuales.";

    caja.appendChild(titulo);
    caja.appendChild(nota);
    contenedor.appendChild(caja);
}

function crearPreviewDecorativaTema(estaActivo) {
    const preview = document.createElement("div");
    preview.className = estaActivo
        ? "tema-preview-decorativa preview-tema-activa"
        : "tema-preview-decorativa";
    preview.setAttribute("aria-hidden", "true");

    const marco = document.createElement("div");
    marco.className = "esquema-maqueta-tema";

    const barra = document.createElement("div");
    barra.className = "esquema-barra";

    const cuerpo = document.createElement("div");
    cuerpo.className = "esquema-cuerpo";

    const principal = document.createElement("div");
    principal.className = "esquema-bloque-principal";

    const lateral = document.createElement("div");
    lateral.className = "esquema-bloque-lateral";

    cuerpo.appendChild(principal);
    cuerpo.appendChild(lateral);
    marco.appendChild(barra);
    marco.appendChild(cuerpo);
    preview.appendChild(marco);
    return preview;
}

function crearIconoCheckTema() {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2.2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("class", "icono-accion-tabla");
    svg.setAttribute("aria-hidden", "true");

    const circulo = document.createElementNS(ns, "circle");
    circulo.setAttribute("cx", "12");
    circulo.setAttribute("cy", "12");
    circulo.setAttribute("r", "9");
    svg.appendChild(circulo);

    const check = document.createElementNS(ns, "path");
    check.setAttribute("d", "m8.5 12.5 2.5 2.5 4.5-5");
    svg.appendChild(check);
    return svg;
}
