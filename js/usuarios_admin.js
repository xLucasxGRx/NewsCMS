/**
 * NewsCMS - Script de administración de usuarios internos (admin/usuarios.html)
 */

let csrfTokenUsuarios = "";

document.addEventListener("DOMContentLoaded", () => {
    iniciarUsuariosAdmin();
});

async function iniciarUsuariosAdmin() {
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

        csrfTokenUsuarios = datos.csrf_token || "";
        mostrarCabeceraUsuarios(datos.usuario);
        renderizarSidebarUsuarios(datos.modulos_permitidos || ["Dashboard"]);
        inicializarSidebarMovilUsuarios();
        inicializarSalirUsuarios();
        inicializarFiltrosUsuarios();
        inicializarFormulariosUsuarios();

        document.getElementById("contenedor-admin").hidden = false;
        await cargarTablaUsuarios();
    } catch {
        window.location.href = "../acceso.html";
    }
}

function mostrarCabeceraUsuarios(usuario) {
    document.getElementById("nombre-usuario").textContent = usuario.nombre || "";
    document.getElementById("rol-usuario").textContent = usuario.rol || "";
    document.getElementById("rol-sidebar").textContent = usuario.rol || "";
}

function renderizarSidebarUsuarios(modulos) {
    const lista = document.getElementById("lista-modulos");
    if (!lista) {
        return;
    }
    lista.textContent = "";

    modulos.forEach((modulo) => {
        const li = document.createElement("li");
        const enlace = document.createElement("a");
        enlace.className = modulo === "Usuarios" ? "boton-modulo activo" : "boton-modulo";
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
        } else {
            enlace.href = `index.html?modulo=${encodeURIComponent(modulo)}`;
        }

        li.appendChild(enlace);
        lista.appendChild(li);
    });
}

function inicializarFiltrosUsuarios() {
    document.getElementById("filtro-busqueda-usuario")?.addEventListener("input", () => cargarTablaUsuarios());
    document.getElementById("filtro-rol-usuario")?.addEventListener("change", () => cargarTablaUsuarios());
    document.getElementById("filtro-estado-usuario")?.addEventListener("change", () => cargarTablaUsuarios());
}

async function cargarTablaUsuarios() {
    const q = (document.getElementById("filtro-busqueda-usuario")?.value || "").trim();
    const rol = document.getElementById("filtro-rol-usuario")?.value || "";
    const estado = document.getElementById("filtro-estado-usuario")?.value || "";
    const cuerpo = document.getElementById("cuerpo-tabla-usuarios");
    const totalEl = document.getElementById("total-usuarios");

    const params = new URLSearchParams({ accion: "listar" });
    if (q) {
        params.set("q", q);
    }
    if (rol) {
        params.set("rol", rol);
    }
    if (estado) {
        params.set("estado", estado);
    }

    try {
        const respuesta = await fetch(`../php/usuarios.php?${params.toString()}`, {
            credentials: "same-origin"
        });
        if (!respuesta.ok) {
            return;
        }

        const datos = await respuesta.json();
        const usuarios = datos.usuarios || [];

        if (totalEl) {
            totalEl.textContent = `${usuarios.length} usuarios`;
        }

        cuerpo.textContent = "";
        if (usuarios.length === 0) {
            const tr = document.createElement("tr");
            const td = document.createElement("td");
            td.colSpan = 7;
            td.className = "fila-vacia";
            td.textContent = "No hay usuarios que coincidan con la búsqueda.";
            tr.appendChild(td);
            cuerpo.appendChild(tr);
            return;
        }

        usuarios.forEach((u) => {
            const tr = document.createElement("tr");

            const tdNombre = document.createElement("td");
            tdNombre.textContent = u.nombre;

            const tdUsuario = document.createElement("td");
            tdUsuario.textContent = u.usuario;

            const tdCorreo = document.createElement("td");
            tdCorreo.textContent = u.correo;

            const tdRol = document.createElement("td");
            const badgeRol = document.createElement("span");
            badgeRol.className = "rol-usuario";
            badgeRol.textContent = u.rol;
            tdRol.appendChild(badgeRol);

            const estaActivo = u.estado === "activo";
            const tdEstado = document.createElement("td");
            const badgeEstado = document.createElement("span");
            badgeEstado.className = estaActivo ? "estado-badge estado-publicada" : "estado-badge estado-borrador";
            badgeEstado.textContent = estaActivo ? "Activo" : "Inactivo";
            tdEstado.appendChild(badgeEstado);

            const tdFecha = document.createElement("td");
            tdFecha.textContent = (u.fecha_creacion || "").slice(0, 10) || "-";

            const tdAcciones = document.createElement("td");
            tdAcciones.className = "celda-acciones";

            const btnEditar = document.createElement("button");
            btnEditar.type = "button";
            btnEditar.className = "enlace-accion";
            btnEditar.textContent = "Editar";
            btnEditar.addEventListener("click", () => abrirEdicionUsuario(u));
            tdAcciones.appendChild(btnEditar);

            if (!u.es_actual) {
                const btnEstado = document.createElement("button");
                btnEstado.type = "button";
                btnEstado.className = estaActivo ? "enlace-accion enlace-eliminar" : "enlace-accion enlace-ver";
                btnEstado.textContent = estaActivo ? "Desactivar" : "Activar";
                btnEstado.addEventListener("click", () => cambiarEstadoCuenta(u));
                tdAcciones.appendChild(btnEstado);
            }

            const btnReset = document.createElement("button");
            btnReset.type = "button";
            btnReset.className = "enlace-accion enlace-cambios";
            btnReset.textContent = "Restablecer contraseña";
            btnReset.addEventListener("click", () => abrirResetContrasena(u));
            tdAcciones.appendChild(btnReset);

            tr.appendChild(tdNombre);
            tr.appendChild(tdUsuario);
            tr.appendChild(tdCorreo);
            tr.appendChild(tdRol);
            tr.appendChild(tdEstado);
            tr.appendChild(tdFecha);
            tr.appendChild(tdAcciones);
            cuerpo.appendChild(tr);
        });
    } catch {
        mostrarMensajeUsuarios("No se pudo cargar la lista de usuarios.", true);
    }
}

function inicializarFormulariosUsuarios() {
    const btnNuevo = document.getElementById("btn-nuevo-usuario");
    const btnCancelarUsuario = document.getElementById("btn-cancelar-usuario");
    const btnCancelarReset = document.getElementById("btn-cancelar-reset");
    const formUsuario = document.getElementById("formulario-usuario");
    const formReset = document.getElementById("formulario-reset-contrasena");

    btnNuevo?.addEventListener("click", () => {
        document.getElementById("panel-reset-contrasena").hidden = true;
        document.getElementById("usuario-id").value = "0";
        document.getElementById("usuario-nombre").value = "";
        document.getElementById("usuario-login").value = "";
        document.getElementById("usuario-correo").value = "";
        document.getElementById("usuario-contrasena").value = "";
        document.getElementById("usuario-confirmar").value = "";
        document.getElementById("usuario-rol").value = "redactor";
        document.getElementById("usuario-estado").value = "activo";
        document.getElementById("bloque-contrasena-crear").hidden = false;
        document.getElementById("titulo-form-usuario").textContent = "Nuevo usuario";
        document.getElementById("panel-formulario-usuario").hidden = false;
    });

    btnCancelarUsuario?.addEventListener("click", () => {
        document.getElementById("panel-formulario-usuario").hidden = true;
    });

    btnCancelarReset?.addEventListener("click", () => {
        document.getElementById("panel-reset-contrasena").hidden = true;
    });

    formUsuario?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = Number(document.getElementById("usuario-id").value || 0);
        const nombre = document.getElementById("usuario-nombre").value.trim();
        const usuario = document.getElementById("usuario-login").value.trim();
        const correo = document.getElementById("usuario-correo").value.trim();
        const rol = document.getElementById("usuario-rol").value;
        const estado = document.getElementById("usuario-estado").value;

        if (!nombre || !usuario || !correo) {
            mostrarMensajeUsuarios("Nombre, usuario y correo electrónico son obligatorios.", true);
            return;
        }

        const form = new FormData();
        form.append("csrf_token", csrfTokenUsuarios);
        form.append("accion", id > 0 ? "editar" : "crear");
        form.append("nombre", nombre);
        form.append("usuario", usuario);
        form.append("correo", correo);
        form.append("rol", rol);
        form.append("estado", estado);

        if (id > 0) {
            form.append("id", String(id));
        } else {
            const contrasena = document.getElementById("usuario-contrasena").value;
            const confirmar = document.getElementById("usuario-confirmar").value;
            if (contrasena.length < 10) {
                mostrarMensajeUsuarios("La contraseña inicial debe tener al menos 10 caracteres.", true);
                return;
            }
            if (contrasena !== confirmar) {
                mostrarMensajeUsuarios("Las contraseñas no coinciden.", true);
                return;
            }
            form.append("contrasena", contrasena);
            form.append("confirmar_contrasena", confirmar);
        }

        try {
            const respuesta = await fetch("../php/usuarios.php", {
                method: "POST",
                body: form,
                credentials: "same-origin"
            });
            const resultado = await respuesta.json();

            if (respuesta.ok && resultado.ok) {
                mostrarMensajeUsuarios(resultado.mensaje || "Usuario guardado.", false);
                document.getElementById("panel-formulario-usuario").hidden = true;
                formUsuario.reset();
                await cargarTablaUsuarios();
                return;
            }

            mostrarMensajeUsuarios(resultado.mensaje || "No se pudo guardar el usuario.", true);
        } catch {
            mostrarMensajeUsuarios("Error de comunicación con el servidor.", true);
        }
    });

    formReset?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = Number(document.getElementById("reset-usuario-id").value || 0);
        const nueva = document.getElementById("reset-nueva").value;
        const confirmar = document.getElementById("reset-confirmar").value;

        if (nueva.length < 10) {
            mostrarMensajeUsuarios("La nueva contraseña debe tener al menos 10 caracteres.", true);
            return;
        }
        if (nueva !== confirmar) {
            mostrarMensajeUsuarios("Las contraseñas no coinciden.", true);
            return;
        }

        const form = new FormData();
        form.append("csrf_token", csrfTokenUsuarios);
        form.append("accion", "restablecer_contrasena");
        form.append("id", String(id));
        form.append("nueva_contrasena", nueva);
        form.append("confirmar_contrasena", confirmar);

        try {
            const respuesta = await fetch("../php/usuarios.php", {
                method: "POST",
                body: form,
                credentials: "same-origin"
            });
            const resultado = await respuesta.json();

            if (respuesta.ok && resultado.ok) {
                mostrarMensajeUsuarios(resultado.mensaje || "Contraseña actualizada.", false);
                document.getElementById("panel-reset-contrasena").hidden = true;
                formReset.reset();
                return;
            }

            mostrarMensajeUsuarios(resultado.mensaje || "No se pudo restablecer la contraseña.", true);
        } catch {
            mostrarMensajeUsuarios("Error de comunicación con el servidor.", true);
        }
    });
}

function abrirEdicionUsuario(u) {
    document.getElementById("panel-reset-contrasena").hidden = true;
    document.getElementById("usuario-id").value = String(u.id);
    document.getElementById("usuario-nombre").value = u.nombre || "";
    document.getElementById("usuario-login").value = u.usuario || "";
    document.getElementById("usuario-correo").value = u.correo || "";
    document.getElementById("usuario-rol").value = u.rol || "redactor";
    document.getElementById("usuario-estado").value = u.estado || "activo";
    document.getElementById("bloque-contrasena-crear").hidden = true;
    document.getElementById("titulo-form-usuario").textContent = "Editar usuario";
    document.getElementById("panel-formulario-usuario").hidden = false;
}

function abrirResetContrasena(u) {
    document.getElementById("panel-formulario-usuario").hidden = true;
    document.getElementById("reset-usuario-id").value = String(u.id);
    document.getElementById("reset-usuario-destino").textContent = `Cuenta: ${u.nombre} (${u.usuario})`;
    document.getElementById("reset-nueva").value = "";
    document.getElementById("reset-confirmar").value = "";
    document.getElementById("panel-reset-contrasena").hidden = false;
}

async function cambiarEstadoCuenta(u) {
    const nuevoEstado = u.estado === "activo" ? "inactivo" : "activo";
    const accionTexto = nuevoEstado === "inactivo" ? "desactivar" : "activar";
    if (!window.confirm(`¿Deseas ${accionTexto} la cuenta de "${u.usuario}"?`)) {
        return;
    }

    const form = new FormData();
    form.append("csrf_token", csrfTokenUsuarios);
    form.append("accion", "cambiar_estado");
    form.append("id", String(u.id));
    form.append("estado", nuevoEstado);

    try {
        const respuesta = await fetch("../php/usuarios.php", {
            method: "POST",
            body: form,
            credentials: "same-origin"
        });
        const resultado = await respuesta.json();

        if (respuesta.ok && resultado.ok) {
            mostrarMensajeUsuarios(resultado.mensaje || "Estado actualizado.", false);
            await cargarTablaUsuarios();
            return;
        }

        mostrarMensajeUsuarios(resultado.mensaje || "No se pudo cambiar el estado.", true);
    } catch {
        mostrarMensajeUsuarios("Error de comunicación con el servidor.", true);
    }
}

function mostrarMensajeUsuarios(texto, esError) {
    const alerta = document.getElementById("mensaje-usuarios");
    if (!alerta) {
        return;
    }
    alerta.textContent = texto;
    alerta.className = esError ? "alerta-admin alerta-admin-error" : "alerta-admin alerta-admin-exito";
    alerta.hidden = false;
}

function inicializarSidebarMovilUsuarios() {
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

function inicializarSalirUsuarios() {
    const boton = document.getElementById("boton-salir");
    if (!boton) {
        return;
    }
    boton.addEventListener("click", async () => {
        const form = new FormData();
        form.append("csrf_token", csrfTokenUsuarios);
        await fetch("../php/cerrar_sesion.php", {
            method: "POST",
            body: form,
            credentials: "same-origin"
        });
        window.location.href = "../acceso.html";
    });
}
