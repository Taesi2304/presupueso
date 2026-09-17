// ==========================================
// LÓGICA DE PRESUPUESTO E HISTORIAL
// ==========================================
async function cargarConceptos(origenId, destinoId) {
    const idArea = parseInt(document.getElementById(origenId).value);
    const select = document.getElementById(destinoId);
    select.innerHTML = '<option value="">Seleccione Concepto...</option>';
    limpiarInputsPresupuesto();

    if (!idArea) return;

    // Trae los conceptos globales y, si hay un cliente seleccionado,
    // también los conceptos exclusivos de ese cliente.
    const idClienteRaw = document.getElementById('selClientePresupuesto').value;
    let query = clienteSupabase.from('conceptos').select('*').eq('id_area', idArea).order('orden', { ascending: true });

    if (idClienteRaw) {
        query = query.or(`id_cliente.is.null,id_cliente.eq.${parseInt(idClienteRaw)}`);
    } else {
        query = query.is('id_cliente', null);
    }

    const { data: conceptos, error } = await query;
    if (error) return;

    if (!idClienteRaw) {
        conceptos.forEach(c => select.innerHTML += `<option value="${c.id}">${escaparTexto(c.concepto)}</option>`);
        return;
    }

    // Con un cliente seleccionado, se agrupa visualmente para distinguir
    // qué conceptos son exclusivos de él y cuáles vienen del catálogo global.
    const delCliente = conceptos.filter(c => c.id_cliente);
    const globales = conceptos.filter(c => !c.id_cliente);

    if (delCliente.length > 0) {
        const opciones = delCliente.map(c => `<option value="${c.id}">${escaparTexto(c.concepto)}</option>`).join('');
        select.innerHTML += `<optgroup label="📌 Exclusivos de este cliente">${opciones}</optgroup>`;
    }
    if (globales.length > 0) {
        const opciones = globales.map(c => `<option value="${c.id}">${escaparTexto(c.concepto)}</option>`).join('');
        select.innerHTML += `<optgroup label="🌍 Catálogo Global">${opciones}</optgroup>`;
    }
}

async function prepararConcepto() {
    const idCon = parseInt(document.getElementById('selConcepto').value);
    if (!idCon) { limpiarInputsPresupuesto(); return; }

    const { data, error } = await clienteSupabase.from('conceptos').select('*').eq('id', idCon).single();
    if (error || !data) return;

    conceptoTemporal = data;
    document.getElementById('txtUnidad').value = conceptoTemporal.unidad;
    document.getElementById('txtPrecio').value = conceptoTemporal.precio_total;
    document.getElementById('txtCantidad').focus();
}

function limpiarInputsPresupuesto() {
    conceptoTemporal = null;
    document.getElementById('txtUnidad').value = 'm2';
    document.getElementById('txtPrecio').value = '';
    document.getElementById('txtCantidad').value = '';
}

function agregarAlPresupuesto() {
    const conceptoSelect = document.getElementById('selConcepto');
    const textoConcepto = conceptoSelect.options[conceptoSelect.selectedIndex].text;
    const unidad = document.getElementById('txtUnidad').value;
    const precioUnitario = parseFloat(document.getElementById('txtPrecio').value);
    const cantidad = parseFloat(document.getElementById('txtCantidad').value);

    if (!conceptoTemporal || isNaN(cantidad) || isNaN(precioUnitario) || cantidad <= 0) {
        alert("Asegúrate de seleccionar un concepto y poner cantidad y precio válidos.");
        return;
    }

    presupuestoActual.push({
        id: Date.now(),
        concepto: textoConcepto,
        unidad: unidad,
        cantidad: cantidad,
        precioUnitario: precioUnitario,
        importe: cantidad * precioUnitario
    });

    limpiarInputsPresupuesto();
    document.getElementById('selConcepto').value = '';
    actualizarTabla();
}

function eliminarFila(id) {
    presupuestoActual = presupuestoActual.filter(item => item.id !== id);
    actualizarTabla();
}

function calcularTotales() {
    const subtotal = presupuestoActual.reduce((s, item) => s + item.importe, 0);
    const incluyeHerramienta = document.getElementById('checkDesgaste').checked && subtotal > 0;
    const herramienta = incluyeHerramienta ? subtotal * 0.05 : 0;
    return { subtotal, herramienta, total: subtotal + herramienta };
}

function actualizarTabla() {
    const tbody = document.getElementById('tablaPresupuesto');
    tbody.innerHTML = '';

    presupuestoActual.forEach(item => {
        tbody.innerHTML += `
            <tr>
                <td>${escaparTexto(item.concepto)}</td>
                <td>${escaparTexto(item.unidad)}</td>
                <td>${item.cantidad}</td>
                <td>$${item.precioUnitario.toFixed(2)}</td>
                <td>$${item.importe.toFixed(2)}</td>
                <td class="no-print"><button class="btn-danger" onclick="eliminarFila(${item.id})">X</button></td>
            </tr>
        `;
    });

    const { herramienta, total } = calcularTotales();

    if (herramienta > 0) {
        tbody.innerHTML += `
            <tr class="fila-herramienta">
                <td>Cargo por Herramienta Menor (5% de M.O.)</td>
                <td>lote</td>
                <td>1</td>
                <td>$${herramienta.toFixed(2)}</td>
                <td>$${herramienta.toFixed(2)}</td>
                <td class="no-print">Auto</td>
            </tr>
        `;
    }

    document.getElementById('lblTotal').innerText = total.toFixed(2);
}

// ==========================================
// GUARDADO E HISTORIAL
// ==========================================
async function guardarEImprimir() {
    const idCliente = document.getElementById('selClientePresupuesto').value;
    const fecha = document.getElementById('fechaPresupuesto').value;

    if (!idCliente || presupuestoActual.length === 0) {
        return alert("Selecciona un cliente y agrega conceptos antes de guardar.");
    }

    const { subtotal, herramienta, total } = calcularTotales();

    const { data: nuevoPresupuesto, error } = await clienteSupabase
        .from('presupuestos')
        .insert([{ id_cliente: idCliente, fecha: fecha, total: total, subtotal: subtotal }])
        .select()
        .single();

    if (error) {
        alert("Error al guardar en el historial: " + error.message);
        return;
    }

    const filasDetalle = presupuestoActual.map((item, index) => ({
        id_presupuesto: nuevoPresupuesto.id,
        concepto: item.concepto,
        unidad: item.unidad,
        cantidad: item.cantidad,
        precio_unitario: item.precioUnitario,
        importe: item.importe,
        orden: index
    }));

    if (herramienta > 0) {
        filasDetalle.push({
            id_presupuesto: nuevoPresupuesto.id,
            concepto: 'Cargo por Herramienta Menor (5% de M.O.)',
            unidad: 'lote',
            cantidad: 1,
            precio_unitario: herramienta,
            importe: herramienta,
            orden: filasDetalle.length
        });
    }

    const { error: errorDetalle } = await clienteSupabase.from('detalle_presupuesto').insert(filasDetalle);
    if (errorDetalle) {
        alert("El presupuesto se guardó, pero hubo un error guardando el detalle: " + errorDetalle.message);
    }

    alert("¡Presupuesto guardado en el historial!");
    cargarHistorial();
    window.print();
}

async function cargarHistorial() {
    const { data: historial, error } = await clienteSupabase
        .from('presupuestos')
        .select(`id, fecha, total, clientes(nombre)`)
        .order('fecha', { ascending: false });

    if (error) return;

    const tbody = document.getElementById('tablaHistorial');
    tbody.innerHTML = '';
    historial.forEach(p => {
        tbody.innerHTML += `
            <tr>
                <td>${escaparTexto(p.fecha)}</td>
                <td>${escaparTexto(p.clientes ? p.clientes.nombre : 'Sin nombre')}</td>
                <td>$${p.total.toFixed(2)}</td>
                <td>
                    <button class="btn-edit" onclick="verDetallePresupuesto(${p.id})" title="Ver Detalle">👁️</button>
                    <button class="btn-danger" onclick="borrarPresupuesto(${p.id})">🗑️</button>
                </td>
            </tr>`;
    });
}

async function borrarPresupuesto(id) {
    if (confirm("¿Eliminar este registro del historial?")) {
        await clienteSupabase.from('presupuestos').delete().eq('id', id);
        cargarHistorial();
    }
}

async function verDetallePresupuesto(idPresupuesto) {
    const { data: detalle, error } = await clienteSupabase
        .from('detalle_presupuesto')
        .select('*')
        .eq('id_presupuesto', idPresupuesto)
        .order('orden', { ascending: true });

    if (error) { alert("Error al cargar el detalle: " + error.message); return; }

    const tbody = document.getElementById('tablaDetalleHistorial');
    tbody.innerHTML = '';

    if (!detalle || detalle.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">Este presupuesto no tiene detalle guardado (fue creado antes de esta función).</td></tr>';
    } else {
        detalle.forEach(item => {
            tbody.innerHTML += `
                <tr>
                    <td>${escaparTexto(item.concepto)}</td>
                    <td>${escaparTexto(item.unidad)}</td>
                    <td>${item.cantidad}</td>
                    <td>$${Number(item.precio_unitario).toFixed(2)}</td>
                    <td>$${Number(item.importe).toFixed(2)}</td>
                </tr>`;
        });
    }

    document.getElementById('modalDetalleHistorial').classList.remove('oculto');
}

function cerrarModalDetalle() {
    document.getElementById('modalDetalleHistorial').classList.add('oculto');
}
