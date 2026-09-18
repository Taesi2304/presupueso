// ==========================================
// INICIO, CARGA DE DATOS MAESTROS Y NAVEGACIÓN
// ==========================================
async function inicializarDatos() {
    await cargarAreas();

    document.getElementById('fechaPresupuesto').valueAsDate = new Date();
    document.getElementById('pagoFecha').valueAsDate = new Date();
    document.getElementById('gastoFecha').valueAsDate = new Date();

    await cargarClientes();
    await cargarHistorial();
    await cargarTablaCatalogo();
    await renderizarListaConceptos();
    await cargarPresupuestosParaPago();
    await cargarPagosPresupuesto();
    await cargarGastos();
}

function llenarMenuDesplegable(selectId, items, textoDefault) {
    const select = document.getElementById(selectId);
    const opciones = items.map(i => `<option value="${i.id}">${escaparTexto(i.nombre)}</option>`);
    select.innerHTML = `<option value="">${textoDefault}</option>` + opciones.join('');
}

function cambiarPestana(pestana, boton) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('tab-' + pestana).classList.add('active');
    const btnActivo = boton || document.querySelector(`.tab-btn[data-pestana="${pestana}"]`);
    if (btnActivo) btnActivo.classList.add('active');
}

// Evita perder un presupuesto a medio llenar si se cambia de pestaña por accidente.
async function irAPestana(pestana, boton) {
    const enPresupuestoConCambios = document.getElementById('tab-presupuesto').classList.contains('active')
        && pestana !== 'presupuesto'
        && presupuestoActual.length > 0;

    if (enPresupuestoConCambios) {
        const confirmado = await confirmarAccion("Tienes conceptos sin guardar en el presupuesto actual. Si cambias de pestaña se van a perder. ¿Quieres continuar?");
        if (!confirmado) return;
    }

    cambiarPestana(pestana, boton);
}

// Evita cerrar o recargar la pestaña del navegador con un presupuesto sin guardar.
window.addEventListener('beforeunload', function (evento) {
    if (presupuestoActual.length > 0) {
        evento.preventDefault();
        evento.returnValue = '';
    }
});

// ¡Esta es la única línea que debe ejecutar el navegador al abrir la página!
window.onload = verificarSesion;
