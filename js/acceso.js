/**
 * NewsCMS - Script de inicio de sesión
 * Obtiene el token CSRF y envía las credenciales por fetch() a php/iniciar_sesion.php.
 */

document.addEventListener("DOMContentLoaded", () => {
    prepararFormularioAcceso();
});

/**
 * Comprueba si ya hay sesión activa, carga el token CSRF y configura el envío.
 */
async function prepararFormularioAcceso() {
    const formulario = document.getElementById("formulario-acceso");
    const campoCsrf = document.getElementById("csrf-token");
    const botonIngresar = document.getElementById("boton-ingresar");

    try {
        const respuesta = await fetch("php/comprobar_sesion.php", {
            credentials: "same-origin"
        });
        if (respuesta.ok) {
            const datos = await respuesta.json();
            if (datos.autenticado) {
                window.location.href = "admin/index.html";
                return;
            }
            if (campoCsrf && datos.csrf_token) {
                campoCsrf.value = datos.csrf_token;
            }
        }
    } catch {
        mostrarError("No se pudo conectar con el servidor de autenticación.");
    }

    if (!formulario) {
        return;
    }

    formulario.addEventListener("submit", async (evento) => {
        evento.preventDefault();
        ocultarError();

        const identificador = document.getElementById("identificador").value.trim();
        const contrasena = document.getElementById("contrasena").value;

        if (!identificador || !contrasena) {
            mostrarError("Ingresa tu usuario o correo electrónico y tu contraseña.");
            return;
        }

        botonIngresar.disabled = true;
        botonIngresar.textContent = "Verificando...";

        try {
            const datosFormulario = new FormData(formulario);
            const respuesta = await fetch("php/iniciar_sesion.php", {
                method: "POST",
                body: datosFormulario,
                credentials: "same-origin"
            });

            const resultado = await respuesta.json();

            if (respuesta.ok && resultado.ok) {
                window.location.href = resultado.redirigir || "admin/index.html";
                return;
            }

            mostrarError(resultado.mensaje || "No se pudo iniciar sesión.");
        } catch {
            mostrarError("Error de comunicación con el servidor.");
        } finally {
            botonIngresar.disabled = false;
            botonIngresar.textContent = "Ingresar";
        }
    });
}

function mostrarError(mensaje) {
    const alerta = document.getElementById("alerta-acceso");
    if (!alerta) {
        return;
    }
    alerta.textContent = mensaje;
    alerta.hidden = false;
}

function ocultarError() {
    const alerta = document.getElementById("alerta-acceso");
    if (!alerta) {
        return;
    }
    alerta.textContent = "";
    alerta.hidden = true;
}
