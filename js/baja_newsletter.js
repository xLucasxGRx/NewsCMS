/**
 * NewsCMS - Script público para cancelar la suscripción mediante POST y token.
 */

document.addEventListener("DOMContentLoaded", () => {
    const token = new URLSearchParams(window.location.search).get("token") || "";
    const btnConfirmar = document.getElementById("btn-confirmar-baja");
    const alerta = document.getElementById("alerta-baja");
    const acciones = document.getElementById("acciones-baja");

    if (!token) {
        mostrarResultadoBaja(alerta, "No se proporcionó un enlace de cancelación válido.", true);
        if (acciones) {
            acciones.hidden = true;
        }
        return;
    }

    btnConfirmar?.addEventListener("click", async () => {
        btnConfirmar.disabled = true;
        btnConfirmar.textContent = "Procesando...";

        const form = new FormData();
        form.append("accion", "baja");
        form.append("token", token);

        try {
            const respuesta = await fetch("php/newsletter.php", {
                method: "POST",
                body: form
            });
            const datos = await respuesta.json();

            if (respuesta.ok && datos.ok) {
                mostrarResultadoBaja(alerta, datos.mensaje || "Suscripción cancelada.", false);
                if (acciones) {
                    acciones.hidden = true;
                }
                return;
            }

            mostrarResultadoBaja(alerta, datos.mensaje || "No se pudo cancelar la suscripción.", true);
        } catch {
            mostrarResultadoBaja(alerta, "Error de comunicación con el servidor.", true);
        } finally {
            btnConfirmar.disabled = false;
            btnConfirmar.textContent = "Confirmar cancelación";
        }
    });
});

function mostrarResultadoBaja(alerta, texto, esError) {
    if (!alerta) {
        return;
    }
    alerta.textContent = texto;
    alerta.style.backgroundColor = esError ? "#fee2e2" : "#dcfce7";
    alerta.style.color = esError ? "#991b1b" : "#166534";
    alerta.style.borderColor = esError ? "#fecaca" : "#bbf7d0";
    alerta.hidden = false;
}
