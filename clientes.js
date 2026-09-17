// ==========================================
// LÓGICA DE CLIENTES
// ==========================================
async function cargarClientes() {
    const { data: clientes, error } = await clienteSupabase.from('clientes').select('*').order('nombre');
    if (error) return;

    mapaClientes = {};
    clientes.forEach(c => mapaClientes[c.id] = c.nombre);

    const tbody = document.getElementById('tablaClientes');
    tbody.innerHTML = '';
    const select = document.getElementById('selClientePresupuesto');
    select.innerHTML = '<option value="">-- Seleccionar Cliente --</option>';

    clientes.forEach(c => {
        tbody.innerHTML += `
            <tr>
                <td>${escaparTexto(c.nombre)}</td>
                <td>${escaparTexto(c.telefono) || '-'}</td>
                <td>${escaparTexto(c.direccion) || '-'}</td>
                <td><button class="btn-danger" onclick="borrarCliente(${c.id})">🗑️</button></td>
            </tr>`;
        select.innerHTML += `<option value="${c.id}">${escaparTexto(c.nombre)}</option>`;
    });

    llenarMenuDesplegable('catCliente', clientes, '🌍 Catálogo Global (todos)');
    llenarFiltroClienteCatalogo(clientes);
}

async function guardarCliente() {
    const nombre = document.getElementById('cliNombre').value;
    const tel = document.getElementById('cliTelefono').value;
    const dir = document.getElementById('cliDireccion').value;

    if (!nombre) return alert("El nombre es obligatorio");

    const { error } = await clienteSupabase.from('clientes').insert([{ nombre, telefono: tel, direccion: dir }]);

    if (error) {
        alert("Error al guardar cliente: " + error.message);
        return;
    }

    document.getElementById('cliNombre').value = '';
    document.getElementById('cliTelefono').value = '';
    document.getElementById('cliDireccion').value = '';
    cargarClientes();
}

async function borrarCliente(id) {
    if (confirm("¿Borrar cliente? Se perderá su historial y sus conceptos de precio exclusivos.")) {
        await clienteSupabase.from('clientes').delete().eq('id', id);
        cargarClientes();
    }
}
