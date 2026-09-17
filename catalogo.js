// ==========================================
// LÓGICA DE CATÁLOGO (Global y por Cliente)
// Un concepto con id_cliente = NULL es global (visible para todos).
// Un concepto con id_cliente = X es exclusivo del cliente X.
// ==========================================
function llenarFiltroClienteCatalogo(clientes) {
    const select = document.getElementById('filtroClienteCatalogo');
    const valorActual = select.value;
    select.innerHTML = '<option value="">Todos (Global + Clientes)</option><option value="global">🌍 Solo Catálogo Global</option>';
    clientes.forEach(c => select.innerHTML += `<option value="${c.id}">${escaparTexto(c.nombre)}</option>`);
    select.value = valorActual;
}

async function guardarNuevoConcepto() {
    const idArea = parseInt(document.getElementById('catArea').value);
    const nombre = document.getElementById('catNombre').value;
    const unidad = document.getElementById('catUnidad').value;
    const precio = parseFloat(document.getElementById('catPrecio').value);
    const idClienteRaw = document.getElementById('catCliente').value;
    const idCliente = idClienteRaw ? parseInt(idClienteRaw) : null;

    if (!idArea || !nombre || isNaN(precio)) {
        alert("Completa todos los campos para guardar el concepto.");
        return;
    }

    const { data: conceptosArea } = await clienteSupabase.from('conceptos').select('orden').eq('id_area', idArea);
    let maxOrden = 0;
    if (conceptosArea) {
        conceptosArea.forEach(c => { if (c.orden > maxOrden) maxOrden = c.orden; });
    }

    const { error } = await clienteSupabase.from('conceptos').insert([
        { id_area: idArea, concepto: nombre, unidad: unidad, precio_total: precio, orden: maxOrden + 1, id_cliente: idCliente }
    ]);

    if (error) { alert("Error al guardar: " + error.message); return; }

    alert("¡Concepto guardado en la nube con éxito!");
    document.getElementById('catNombre').value = '';
    document.getElementById('catPrecio').value = '';

    document.getElementById('filtroAreaCatalogo').value = idArea;
    await cargarTablaCatalogo();

    if (document.getElementById('selArea').value == idArea) {
        await cargarConceptos('selArea', 'selConcepto');
    }
}

async function moverConcepto(idConcepto, direccion) {
    const { data: conceptoActual } = await clienteSupabase.from('conceptos').select('*').eq('id', idConcepto).single();
    const { data: todosArea } = await clienteSupabase.from('conceptos').select('*').eq('id_area', conceptoActual.id_area).order('orden', { ascending: true });

    const index = todosArea.findIndex(c => c.id === idConcepto);

    if (direccion === 'arriba' && index > 0) {
        const conceptoAnterior = todosArea[index - 1];
        await clienteSupabase.from('conceptos').update({ orden: conceptoAnterior.orden }).eq('id', conceptoActual.id);
        await clienteSupabase.from('conceptos').update({ orden: conceptoActual.orden }).eq('id', conceptoAnterior.id);
    }
    else if (direccion === 'abajo' && index < todosArea.length - 1) {
        const conceptoSiguiente = todosArea[index + 1];
        await clienteSupabase.from('conceptos').update({ orden: conceptoSiguiente.orden }).eq('id', conceptoActual.id);
        await clienteSupabase.from('conceptos').update({ orden: conceptoActual.orden }).eq('id', conceptoSiguiente.id);
    }

    await cargarTablaCatalogo();
    if (document.getElementById('selArea').value == conceptoActual.id_area) {
        await cargarConceptos('selArea', 'selConcepto');
    }
}

async function cargarTablaCatalogo() {
    let query = clienteSupabase.from('conceptos').select('*').order('id_area', { ascending: true }).order('orden', { ascending: true });

    const idFiltroArea = parseInt(document.getElementById('filtroAreaCatalogo').value);
    if (idFiltroArea) { query = query.eq('id_area', idFiltroArea); }

    const filtroCliente = document.getElementById('filtroClienteCatalogo').value;
    if (filtroCliente === 'global') {
        query = query.is('id_cliente', null);
    } else if (filtroCliente) {
        query = query.eq('id_cliente', parseInt(filtroCliente));
    }

    const { data: conceptos, error } = await query;
    if (error) return;

    const tbody = document.getElementById('tablaCatalogo');
    tbody.innerHTML = '';

    conceptos.forEach(c => {
        const nombreArea = mapaAreas[c.id_area] || 'Desconocido';
        const etiquetaCliente = c.id_cliente ? (mapaClientes[c.id_cliente] || 'Cliente eliminado') : '🌍 Global';

        tbody.innerHTML += `
            <tr>
                <td style="font-size: 0.9em; color: #666;">${escaparTexto(nombreArea)}</td>
                <td><strong>${escaparTexto(c.concepto)}</strong></td>
                <td>${escaparTexto(c.unidad)}</td>
                <td>$${c.precio_total.toFixed(2)}</td>
                <td style="font-size: 0.85em;">${escaparTexto(etiquetaCliente)}</td>
                <td style="display:flex; gap: 5px; flex-wrap: wrap;">
                    <button class="btn-edit" style="background:#7f8fa6;" onclick="moverConcepto(${c.id}, 'arriba')" title="Mover Arriba">🔼</button>
                    <button class="btn-edit" style="background:#7f8fa6;" onclick="moverConcepto(${c.id}, 'abajo')" title="Mover Abajo">🔽</button>
                    <button class="btn-edit" data-id="${c.id}" data-nombre="${escaparAtributo(c.concepto)}" data-precio="${c.precio_total}" onclick="editarPrecio(this)">✏️</button>
                    ${c.id_cliente ? `<button class="btn-edit" style="background:#44bd32;" onclick="compartirConceptoGlobal(${c.id})" title="Compartir a Catálogo Global">📤</button>` : ''}
                    <button class="btn-danger" onclick="borrarConcepto(${c.id})">🗑️</button>
                </td>
            </tr>
        `;
    });
}

async function compartirConceptoGlobal(idConcepto) {
    const { data: c, error } = await clienteSupabase.from('conceptos').select('*').eq('id', idConcepto).single();
    if (error || !c) return;

    if (!confirm(`¿Agregar "${c.concepto}" al catálogo global?\nSe creará una copia disponible para todos los clientes; el precio de este cliente no se modifica.`)) return;

    const { data: conceptosGlobales } = await clienteSupabase.from('conceptos').select('orden').eq('id_area', c.id_area).is('id_cliente', null);
    let maxOrden = 0;
    if (conceptosGlobales) conceptosGlobales.forEach(x => { if (x.orden > maxOrden) maxOrden = x.orden; });

    const { error: errorInsert } = await clienteSupabase.from('conceptos').insert([
        { id_area: c.id_area, concepto: c.concepto, unidad: c.unidad, precio_total: c.precio_total, orden: maxOrden + 1, id_cliente: null }
    ]);

    if (errorInsert) { alert("Error al compartir: " + errorInsert.message); return; }
    alert("¡Concepto agregado al catálogo global!");
    await cargarTablaCatalogo();
}

function editarPrecio(boton) {
    idConceptoEditando = parseInt(boton.dataset.id);
    const nombre = boton.dataset.nombre;
    const precioActual = parseFloat(boton.dataset.precio);

    document.getElementById('modalPrecioConcepto').innerText = nombre;
    document.getElementById('modalPrecioInput').value = precioActual;
    document.getElementById('modalEditarPrecio').classList.remove('oculto');
    document.getElementById('modalPrecioInput').focus();
}

function cerrarModalPrecio() {
    idConceptoEditando = null;
    document.getElementById('modalEditarPrecio').classList.add('oculto');
}

async function confirmarEdicionPrecio() {
    const nuevoPrecio = parseFloat(document.getElementById('modalPrecioInput').value);
    if (isNaN(nuevoPrecio) || nuevoPrecio <= 0) {
        alert("Ingresa un precio válido.");
        return;
    }
    await clienteSupabase.from('conceptos').update({ precio_total: nuevoPrecio }).eq('id', idConceptoEditando);
    cerrarModalPrecio();
    await cargarTablaCatalogo();
}

async function borrarConcepto(id) {
    if (confirm("¿Estás seguro de borrar este concepto de la nube?")) {
        await clienteSupabase.from('conceptos').delete().eq('id', id);
        await cargarTablaCatalogo();
    }
}
