// ==========================================
// INICIO, CARGA DE DATOS MAESTROS Y NAVEGACIÓN
// ==========================================
async function inicializarDatos() {
    const { data: areas, error } = await clienteSupabase.from('areas').select('*').order('id', { ascending: true });
    if (error) { mostrarToast("Error de conexión: " + error.message, 'error'); return; }

    mapaAreas = {};
    areas.forEach(a => mapaAreas[a.id] = a.nombre);

    llenarMenuDesplegable('selArea', areas, 'Seleccione Área...');
    llenarMenuDesplegable('catArea', areas, 'Seleccione Área...');
    llenarMenuDesplegable('filtroAreaCatalogo', areas, 'Todas las Áreas...');
    llenarMenuDesplegable('modalConceptoArea', areas, 'Seleccione Área...');

    document.getElementById('fechaPresupuesto').valueAsDate = new Date();

    await cargarClientes();
    await cargarHistorial();
    await cargarTablaCatalogo();
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
    boton.classList.add('active');
}

// ¡Esta es la única línea que debe ejecutar el navegador al abrir la página!
window.onload = verificarSesion;
