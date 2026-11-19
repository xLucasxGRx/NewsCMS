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
            mostrarMensajeUsuarios("No se pudo cargar la lista de usuarios.", true);
            return;
        }

        const datos = await respuesta.json();
        const usuarios = datos.usuarios || [];

        if (totalEl) {
            totalEl.textContent = usuarios.length === 1 ? "1 usuario" : `${usuarios.length} usuarios`;
        }

        cuerpo.textContent = "";
        if (usuarios.length === 0) {
            renderizarEstadoVacioUsuarios(cuerpo, q !== "" || rol !== "" || estado !== "");
            return;
        }

        const etiquetasRol = {
            administrador: "Administrador",
            editor: "Editor",
            redactor: "Redactor"
        };

        usuarios.forEach((u) => {
            const tr = document.createElement("tr");
            tr.dataset.usuarioId = String(u.id);

            const tdIdentidad = document.createElement("td");
            tdIdentidad.className = "celda-identidad-usuario";
            tdIdentidad.setAttribute("data-etiqueta", "Usuario");

            const cajaIdentidad = document.createElement("div");
            cajaIdentidad.className = "identidad-usuario-tabla";

            const filaNombre = document.createElement("div");
            filaNombre.className = "fila-nombre-usuario";

            const spanNombre = document.createElement("span");
            spanNombre.className = "nombre-usuario-tabla";
            spanNombre.textContent = u.nombre;
            filaNombre.appendChild(spanNombre);

            if (u.es_actual) {
                const badgeTu = document.createElement("span");
                badgeTu.className = "insignia-tu";
                badgeTu.textContent = "Tú";
                filaNombre.appendChild(badgeTu);
            }

            const spanLogin = document.createElement("span");
            spanLogin.className = "login-usuario-tabla";
            spanLogin.textContent = `@${u.usuario}`;

            cajaIdentidad.appendChild(filaNombre);
            cajaIdentidad.appendChild(spanLogin);
            tdIdentidad.appendChild(cajaIdentidad);

            const tdCorreo = document.createElement("td");
            tdCorreo.className = "celda-correo-usuario";
            tdCorreo.setAttribute("data-etiqueta", "Correo electrónico");
            tdCorreo.textContent = u.correo;

            const tdRol = document.createElement("td");
            tdRol.setAttribute("data-etiqueta", "Rol");
            const badgeRol = document.createElement("span");
            badgeRol.className = `badge-rol-usuario rol-${u.rol}`;
            badgeRol.textContent = etiquetasRol[u.rol] || u.rol;
            tdRol.appendChild(badgeRol);

            const estaActivo = u.estado === "activo";
            const tdEstado = document.createElement("td");
            tdEstado.setAttribute("data-etiqueta", "Estado");
            const badgeEstado = document.createElement("span");
            badgeEstado.className = estaActivo
                ? "estado-cuenta-badge estado-cuenta-activo"
                : "estado-cuenta-badge estado-cuenta-inactivo";
            badgeEstado.textContent = estaActivo ? "Activo" : "Inactivo";
            tdEstado.appendChild(badgeEstado);

            const tdFecha = document.createElement("td");
            tdFecha.className = "celda-fecha-usuario";
            tdFecha.setAttribute("data-etiqueta", "Registro");
            tdFecha.textContent = (u.fecha_creacion || "").slice(0, 10) || "-";

            const tdAcciones = document.createElement("td");
            tdAcciones.className = "celda-acciones celda-acciones-usuario";
            tdAcciones.setAttribute("data-etiqueta", "Acciones");

            const btnEditar = document.createElement("button");
            btnEditar.type = "button";
            btnEditar.className = "enlace-accion boton-accion-usuario";
            btnEditar.appendChild(crearIconoUsuarioSvg("editar"));
            const lblEditar = document.createElement("span");
            lblEditar.textContent = "Editar";
            btnEditar.appendChild(lblEditar);
            btnEditar.addEventListener("click", () => abrirEdicionUsuario(u));
            tdAcciones.appendChild(btnEditar);

            if (!u.es_actual) {
                const btnEstado = document.createElement("button");
                btnEstado.type = "button";
                btnEstado.className = estaActivo
                    ? "enlace-accion boton-accion-usuario boton-desactivar-usuario"
                    : "enlace-accion boton-accion-usuario boton-activar-usuario";
                btnEstado.appendChild(crearIconoUsuarioSvg(estaActivo ? "desactivar" : "activar"));
                const lblEstado = document.createElement("span");
                lblEstado.textContent = estaActivo ? "Desactivar" : "Activar";
                btnEstado.appendChild(lblEstado);
                btnEstado.addEventListener("click", () => cambiarEstadoCuenta(u));
                tdAcciones.appendChild(btnEstado);
            }

            const btnReset = document.createElement("button");
            btnReset.type = "button";
            btnReset.className = "enlace-accion enlace-cambios boton-accion-usuario";
            btnReset.appendChild(crearIconoUsuarioSvg("llave"));
            const lblReset = document.createElement("span");
            lblReset.textContent = "Restablecer contraseña";
            btnReset.appendChild(lblReset);
            btnReset.addEventListener("click", () => abrirResetContrasena(u));
            tdAcciones.appendChild(btnReset);

            tr.appendChild(tdIdentidad);
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
        const subtitulo = document.getElementById("subtitulo-form-usuario");
        if (subtitulo) {
            subtitulo.textContent = "Completa los datos de acceso y asigna un rol editorial.";
        }
        const panel = document.getElementById("panel-formulario-usuario");
        panel.classList.remove("modo-edicion");
        panel.hidden = false;
        resaltarFilaUsuario(0);
        document.getElementById("usuario-nombre")?.focus();
    });

    btnCancelarUsuario?.addEventListener("click", () => {
        const panel = document.getElementById("panel-formulario-usuario");
        panel.classList.remove("modo-edicion");
        panel.hidden = true;
        resaltarFilaUsuario(0);
    });

    btnCancelarReset?.addEventListener("click", () => {
        document.getElementById("panel-reset-contrasena").hidden = true;
        resaltarFilaUsuario(0);
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
                const panel = document.getElementById("panel-formulario-usuario");
                panel.classList.remove("modo-edicion");
                panel.hidden = true;
                resaltarFilaUsuario(0);
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
                resaltarFilaUsuario(0);
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
    const subtitulo = document.getElementById("subtitulo-form-usuario");
    if (subtitulo) {
        subtitulo.textContent = `Editando la cuenta de ${u.nombre} (@${u.usuario}).`;
    }
    const panel = document.getElementById("panel-formulario-usuario");
    panel.classList.add("modo-edicion");
    panel.hidden = false;
    resaltarFilaUsuario(u.id);
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function abrirResetContrasena(u) {
    const panelUsuario = document.getElementById("panel-formulario-usuario");
    panelUsuario.classList.remove("modo-edicion");
    panelUsuario.hidden = true;
    document.getElementById("reset-usuario-id").value = String(u.id);
    document.getElementById("reset-usuario-destino").textContent = `Cuenta objetivo: ${u.nombre} (@${u.usuario})`;
    document.getElementById("reset-nueva").value = "";
    document.getElementById("reset-confirmar").value = "";
    const panelReset = document.getElementById("panel-reset-contrasena");
    panelReset.hidden = false;
    resaltarFilaUsuario(u.id);
    panelReset.scrollIntoView({ behavior: "smooth", block: "start" });
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

function renderizarEstadoVacioUsuarios(cuerpo, hayFiltros) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.className = "fila-vacia";

    const caja = document.createElement("div");
    caja.className = "estado-vacio-usuarios";

    const titulo = document.createElement("strong");
    titulo.className = "titulo-estado-vacio";
    titulo.textContent = hayFiltros
        ? "No hay usuarios que coincidan con la búsqueda."
        : "No hay cuentas de usuarios registradas.";

    const nota = document.createElement("p");
    nota.className = "descripcion-estado-vacio";
    nota.textContent = hayFiltros
        ? "Prueba modificando el texto buscado o los filtros de rol y estado."
        : "Pulsa «+ Nuevo usuario» para registrar una cuenta administrativa.";

    caja.appendChild(titulo);
    caja.appendChild(nota);

    if (hayFiltros) {
        const btnLimpiar = document.createElement("button");
        btnLimpiar.type = "button";
        btnLimpiar.className = "boton-secundario-admin boton-limpiar-filtros";
        btnLimpiar.textContent = "Limpiar filtros";
        btnLimpiar.addEventListener("click", () => {
            const busq = document.getElementById("filtro-busqueda-usuario");
            const rolSel = document.getElementById("filtro-rol-usuario");
            const estSel = document.getElementById("filtro-estado-usuario");
            if (busq) busq.value = "";
            if (rolSel) rolSel.value = "";
            if (estSel) estSel.value = "";
            cargarTablaUsuarios();
        });
        caja.appendChild(btnLimpiar);
    }

    td.appendChild(caja);
    tr.appendChild(td);
    cuerpo.appendChild(tr);
}

function resaltarFilaUsuario(id) {
    const objetivo = String(id || "");
    document.querySelectorAll("#cuerpo-tabla-usuarios tr[data-usuario-id]").forEach((fila) => {
        fila.classList.toggle("fila-usuario-activa", objetivo !== "0" && fila.dataset.usuarioId === objetivo);
    });
}

function crearIconoUsuarioSvg(tipo) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("class", "icono-accion-tabla");
    svg.setAttribute("aria-hidden", "true");

    const agregar = (tag, attrs) => {
        const el = document.createElementNS(ns, tag);
        Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
        svg.appendChild(el);
    };

    if (tipo === "editar") {
        agregar("path", { d: "M12 20h9" });
        agregar("path", { d: "M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" });
    } else if (tipo === "desactivar") {
        agregar("circle", { cx: "12", cy: "12", r: "9" });
        agregar("path", { d: "m4.9 4.9 14.2 14.2" });
    } else if (tipo === "activar") {
        agregar("circle", { cx: "12", cy: "12", r: "9" });
        agregar("path", { d: "m8.5 12.5 2.5 2.5 4.5-5" });
    } else if (tipo === "llave") {
        agregar("circle", { cx: "7.5", cy: "15.5", r: "4.5" });
        agregar("path", { d: "m21 2-9.6 9.6" });
        agregar("path", { d: "m15.5 7.5 3 3L22 7l-3-3" });
    }

    return svg;
}
