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

    try {
        const respuesta = await fetch("../php/temas.php?modo=admin_lista", {
            credentials: "same-origin"
        });
        if (!respuesta.ok) {
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

        cuerpo.textContent = "";
        if (temas.length === 0) {
            const tr = document.createElement("tr");
            const td = document.createElement("td");
            td.colSpan = 5;
            td.className = "fila-vacia";
            td.textContent = "Aún no hay temas instalados. Se está usando el diseño original.";
            tr.appendChild(td);
            cuerpo.appendChild(tr);
            return;
        }

        temas.forEach((item) => {
            const tr = document.createElement("tr");
            const estaActivo = Number(item.activo) === 1;

            const tdNombre = document.createElement("td");
            tdNombre.textContent = item.nombre;

            const tdDesc = document.createElement("td");
            tdDesc.textContent = item.descripcion || "—";

            const tdVersion = document.createElement("td");
            tdVersion.textContent = item.version;

            const tdEstado = document.createElement("td");
            const badge = document.createElement("span");
            badge.className = estaActivo ? "estado-badge estado-publicada" : "estado-badge estado-borrador";
            badge.textContent = estaActivo ? "Activo" : "Inactivo";
            tdEstado.appendChild(badge);

            const tdAcciones = document.createElement("td");
            tdAcciones.className = "celda-acciones";

            if (!estaActivo) {
                const btnActivar = document.createElement("button");
                btnActivar.type = "button";
                btnActivar.className = "enlace-accion";
                btnActivar.textContent = "Activar";
                btnActivar.addEventListener("click", () => activarTema(item.id));
                tdAcciones.appendChild(btnActivar);
            } else {
                const textoActivo = document.createElement("span");
                textoActivo.className = "texto-suave-form";
                textoActivo.textContent = "En uso";
                tdAcciones.appendChild(textoActivo);
            }

            tr.appendChild(tdNombre);
            tr.appendChild(tdDesc);
            tr.appendChild(tdVersion);
            tr.appendChild(tdEstado);
            tr.appendChild(tdAcciones);
            cuerpo.appendChild(tr);
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
