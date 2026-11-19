export function iniciar(contenedor) {
    const caja = document.createElement("aside");
    caja.className = "aviso-complemento-demo";
    caja.setAttribute("role", "note");

    const texto = document.createElement("p");
    texto.textContent = "Este mensaje pertenece a un complemento instalado desde NewsCMS";

    caja.appendChild(texto);
    contenedor.appendChild(caja);
}