// ==========================================
// LÓGICA DE CLIENTES
// ==========================================
let clientesCache = [];

async function cargarClientes() {
    const { data: clientes, error } = await clienteSupabase.from('clientes').select('*').order('nombre');
    if (error) return;

    clientesCache = clientes;
    mapaClientes = {};
    clientes.forEach(c => mapaClientes[c.id] = c.nombre);

    const tbody = document.getElementById('tablaClientes');
    const select = document.getElementById('selClientePresupuesto');

    const filas = clientes.map(c => `
        <tr>
            <td>${escaparTexto(c.nombre)}</td>
            <td>${escaparTexto(c.telefono) || '-'}</td>
            <td>${escaparTexto(c.direccion) || '-'}</td>
            <td>
                <button class="btn-edit" onclick="abrirEdicionCliente(${c.id})" title="Editar cliente">✏️</button>
                <button class="btn-danger" onclick="borrarCliente(${c.id})" title="Borrar cliente">🗑️</button>
            </td>
        </tr>`);
    tbody.innerHTML = filas.join('');

    const opciones = clientes.map(c => `<option value="${c.id}">${escaparTexto(c.nombre)}</option>`);
    select.innerHTML = '<option value="">-- Seleccionar Cliente --</option>' + opciones.join('');

    llenarMenuDesplegable('catCliente', clientes, '🌍 Catálogo Global (todos)');
    llenarFiltroClienteCatalogo(clientes);
}

async function guardarCliente(boton) {
    const nombre = document.getElementById('cliNombre').value;
    const tel = document.getElementById('cliTelefono').value;
    const dir = document.getElementById('cliDireccion').value;

    if (!nombre) return mostrarToast("El nombre es obligatorio", 'error');

    await conBotonCargando(boton, 'Guardando...', async () => {
        const { error } = await clienteSupabase.from('clientes').insert([{ nombre, telefono: tel, direccion: dir }]);

        if (error) {
            mostrarToast("Error al guardar cliente: " + error.message, 'error');
            return;
        }

        document.getElementById('cliNombre').value = '';
        document.getElementById('cliTelefono').value = '';
        document.getElementById('cliDireccion').value = '';
        mostrarToast("Cliente guardado con éxito");
        await cargarClientes();
    });
}

function abrirEdicionCliente(id) {
    const cliente = clientesCache.find(c => c.id === id);
    if (!cliente) return;

    idClienteEditando = id;
    document.getElementById('modalClienteNombre').value = cliente.nombre;
    document.getElementById('modalClienteTelefono').value = cliente.telefono || '';
    document.getElementById('modalClienteDireccion').value = cliente.direccion || '';
    document.getElementById('modalEditarCliente').classList.remove('oculto');
}

function cerrarModalCliente() {
    idClienteEditando = null;
    document.getElementById('modalEditarCliente').classList.add('oculto');
}

async function confirmarEdicionCliente() {
    const nombre = document.getElementById('modalClienteNombre').value;
    if (!nombre) return mostrarToast("El nombre es obligatorio", 'error');

    const { error } = await clienteSupabase.from('clientes').update({
        nombre,
        telefono: document.getElementById('modalClienteTelefono').value,
        direccion: document.getElementById('modalClienteDireccion').value
    }).eq('id', idClienteEditando);

    if (error) { mostrarToast("Error al editar cliente: " + error.message, 'error'); return; }

    cerrarModalCliente();
    mostrarToast("Cliente actualizado con éxito");
    await cargarClientes();
}

async function borrarCliente(id) {
    const confirmado = await confirmarAccion("¿Borrar cliente? Se perderá su historial y sus conceptos de precio exclusivos.");
    if (confirmado) {
        await clienteSupabase.from('clientes').delete().eq('id', id);
        mostrarToast("Cliente borrado");
        cargarClientes();
    }
}
