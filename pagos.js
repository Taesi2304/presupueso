// ==========================================================
// PAGOS DE PRESUPUESTOS (anticipos/abonos reales, sí se guardan)
// Y GASTOS GENERALES DEL NEGOCIO (nómina, sueldos, materiales, etc.)
// ==========================================================
let pagosCache = [];
let gastosCache = [];
let presupuestosParaPagoCache = [];
let idPagoVinculando = null;

async function cargarPresupuestosParaPago() {
    const { data: presupuestos, error } = await clienteSupabase
        .from('presupuestos')
        .select('id, fecha, total, id_cliente, clientes(nombre)')
        .order('fecha', { ascending: false });

    if (error) { mostrarToast("Error al cargar presupuestos: " + error.message, 'error'); return; }

    presupuestosParaPagoCache = presupuestos;

    const selectCliente = document.getElementById('pagoCliente');
    const clientes = (typeof clientesCache !== 'undefined') ? clientesCache : [];
    const opciones = clientes.map(c => `<option value="${c.id}">${escaparTexto(c.nombre)}</option>`);
    selectCliente.innerHTML = '<option value="">Seleccione...</option>' + opciones.join('');

    actualizarPresupuestosDelCliente();
    poblarSelectGastoPresupuesto();
}

function poblarSelectGastoPresupuesto() {
    const select = document.getElementById('gastoPresupuesto');
    const opciones = presupuestosParaPagoCache.map(p => {
        const nombreCliente = p.clientes ? p.clientes.nombre : 'Sin nombre';
        return `<option value="${p.id}">${escaparTexto(nombreCliente)} - ${escaparTexto(p.fecha)} - $${Number(p.total).toFixed(2)}</option>`;
    });
    select.innerHTML = '<option value="">— Gasto general del negocio —</option>' + opciones.join('');
}

function actualizarPresupuestosDelCliente() {
    const idCliente = parseInt(document.getElementById('pagoCliente').value);
    const select = document.getElementById('pagoPresupuesto');

    const delCliente = idCliente ? presupuestosParaPagoCache.filter(p => p.id_cliente === idCliente) : [];
    const opciones = delCliente.map(p => `<option value="${p.id}">${escaparTexto(p.fecha)} - $${Number(p.total).toFixed(2)}</option>`);
    select.innerHTML = '<option value="">— Sin presupuesto todavía (anticipo general) —</option>' + opciones.join('');
}

async function guardarPago(boton) {
    const idCliente = parseInt(document.getElementById('pagoCliente').value);
    const idPresupuestoRaw = document.getElementById('pagoPresupuesto').value;
    const idPresupuesto = idPresupuestoRaw ? parseInt(idPresupuestoRaw) : null;
    const fecha = document.getElementById('pagoFecha').value;
    const concepto = document.getElementById('pagoConcepto').value;
    const monto = parseFloat(document.getElementById('pagoMonto').value);

    if (!idCliente || !fecha || isNaN(monto) || monto <= 0) {
        mostrarToast("Selecciona un cliente, fecha y un monto válido.", 'error');
        return;
    }

    await conBotonCargando(boton, 'Guardando...', async () => {
        const { error } = await clienteSupabase.from('pagos_presupuesto').insert([
            { id_cliente: idCliente, id_presupuesto: idPresupuesto, fecha, concepto, monto }
        ]);

        if (error) { mostrarToast("Error al guardar el pago: " + error.message, 'error'); return; }

        document.getElementById('pagoMonto').value = '';
        mostrarToast("¡Pago registrado con éxito!");
        await cargarPagosPresupuesto();
    });
}

async function cargarPagosPresupuesto() {
    let query = clienteSupabase.from('pagos_presupuesto')
        .select('*, clientes(nombre), presupuestos(total)')
        .order('fecha', { ascending: false });

    const desde = document.getElementById('fechaDesdePagos').value;
    const hasta = document.getElementById('fechaHastaPagos').value;
    if (desde) query = query.gte('fecha', desde);
    if (hasta) query = query.lte('fecha', hasta);

    const { data: pagos, error } = await query;
    if (error) { mostrarToast("Error al cargar pagos: " + error.message, 'error'); return; }

    pagosCache = pagos;

    // El saldo pendiente de cada presupuesto se calcula con TODOS sus pagos,
    // sin importar el filtro de fechas aplicado a la lista visible.
    const { data: todosPagos } = await clienteSupabase.from('pagos_presupuesto').select('id_presupuesto, monto');
    const totalPagadoPorPresupuesto = {};
    (todosPagos || []).forEach(p => {
        if (!p.id_presupuesto) return;
        totalPagadoPorPresupuesto[p.id_presupuesto] = (totalPagadoPorPresupuesto[p.id_presupuesto] || 0) + Number(p.monto);
    });

    const tbody = document.getElementById('tablaPagos');
    const filas = pagos.map(p => {
        const nombreCliente = p.clientes ? p.clientes.nombre : 'Sin nombre';

        if (!p.id_presupuesto) {
            return `
                <tr>
                    <td data-label="Cliente">${escaparTexto(nombreCliente)}</td>
                    <td data-label="¿De qué presupuesto?">Todavía de ninguno</td>
                    <td data-label="Fecha Pago">${escaparTexto(p.fecha)}</td>
                    <td data-label="Concepto">${escaparTexto(p.concepto)}</td>
                    <td data-label="Monto">$${Number(p.monto).toFixed(2)}</td>
                    <td data-label="Falta por Cobrar">Aún no tiene presupuesto ligado</td>
                    <td data-label="Acción">
                        <button class="btn-edit" onclick="abrirModalVincularPago(${p.id}, ${p.id_cliente})" title="Vincular a un presupuesto">🔗 Ligar a un presupuesto</button>
                        <button class="btn-danger" onclick="borrarPago(${p.id})" title="Borrar pago">🗑️ Borrar</button>
                    </td>
                </tr>`;
        }

        const totalPresupuesto = p.presupuestos ? Number(p.presupuestos.total) : 0;
        const pagado = totalPagadoPorPresupuesto[p.id_presupuesto] || 0;
        const saldo = totalPresupuesto - pagado;
        return `
            <tr>
                <td data-label="Cliente">${escaparTexto(nombreCliente)}</td>
                <td data-label="¿De qué presupuesto?">$${totalPresupuesto.toFixed(2)}</td>
                <td data-label="Fecha Pago">${escaparTexto(p.fecha)}</td>
                <td data-label="Concepto">${escaparTexto(p.concepto)}</td>
                <td data-label="Monto">$${Number(p.monto).toFixed(2)}</td>
                <td data-label="Falta por Cobrar">${textoSaldo(saldo)}</td>
                <td data-label="Acción"><button class="btn-danger" onclick="borrarPago(${p.id})" title="Borrar pago">🗑️ Borrar</button></td>
            </tr>`;
    });
    tbody.innerHTML = filas.join('');

    actualizarResumenPagos();
}

function abrirModalVincularPago(idPago, idCliente) {
    const delCliente = presupuestosParaPagoCache.filter(p => p.id_cliente === idCliente);

    if (delCliente.length === 0) {
        mostrarToast("Este cliente todavía no tiene ningún presupuesto guardado.", 'error');
        return;
    }

    idPagoVinculando = idPago;
    const select = document.getElementById('modalVincularPresupuesto');
    const opciones = delCliente.map(p => `<option value="${p.id}">${escaparTexto(p.fecha)} - $${Number(p.total).toFixed(2)}</option>`);
    select.innerHTML = '<option value="">Seleccione...</option>' + opciones.join('');
    document.getElementById('modalVincularPago').classList.remove('oculto');
}

function cerrarModalVincularPago() {
    idPagoVinculando = null;
    document.getElementById('modalVincularPago').classList.add('oculto');
}

async function confirmarVincularPago() {
    const idPresupuesto = parseInt(document.getElementById('modalVincularPresupuesto').value);
    if (!idPresupuesto) { mostrarToast("Selecciona un presupuesto.", 'error'); return; }

    const { error } = await clienteSupabase.from('pagos_presupuesto').update({ id_presupuesto: idPresupuesto }).eq('id', idPagoVinculando);
    if (error) { mostrarToast("Error al vincular: " + error.message, 'error'); return; }

    cerrarModalVincularPago();
    mostrarToast("¡Anticipo vinculado con éxito!");
    await cargarPagosPresupuesto();
}

async function borrarPago(id) {
    const confirmado = await confirmarAccion("¿Borrar este pago?");
    if (!confirmado) return;

    await clienteSupabase.from('pagos_presupuesto').delete().eq('id', id);
    mostrarToast("Pago borrado");
    await cargarPagosPresupuesto();
}

function exportarPagosCSV() {
    if (pagosCache.length === 0) { mostrarToast("No hay pagos para exportar", 'error'); return; }

    const encabezado = ['Cliente', 'Fecha Pago', 'Concepto', 'Monto', 'Presupuesto Vinculado'];
    const filas = pagosCache.map(p => [
        p.clientes ? p.clientes.nombre : 'Sin nombre',
        p.fecha,
        p.concepto,
        p.monto,
        p.id_presupuesto ? 'Sí' : 'No'
    ]);
    descargarCSV('pagos.csv', encabezado, filas);
}

async function guardarGasto(boton) {
    const fecha = document.getElementById('gastoFecha').value;
    const categoria = document.getElementById('gastoCategoria').value;
    const idPresupuestoRaw = document.getElementById('gastoPresupuesto').value;
    const idPresupuesto = idPresupuestoRaw ? parseInt(idPresupuestoRaw) : null;
    const concepto = document.getElementById('gastoConcepto').value.trim();
    const monto = parseFloat(document.getElementById('gastoMonto').value);

    if (!fecha || !concepto || isNaN(monto) || monto <= 0) {
        mostrarToast("Completa fecha, concepto y un monto válido.", 'error');
        return;
    }

    await conBotonCargando(boton, 'Guardando...', async () => {
        const { error } = await clienteSupabase.from('gastos').insert([{ fecha, categoria, id_presupuesto: idPresupuesto, concepto, monto }]);

        if (error) { mostrarToast("Error al guardar el gasto: " + error.message, 'error'); return; }

        document.getElementById('gastoConcepto').value = '';
        document.getElementById('gastoMonto').value = '';
        mostrarToast("¡Gasto registrado con éxito!");
        await cargarGastos();
    });
}

async function cargarGastos() {
    let query = clienteSupabase.from('gastos').select('*, presupuestos(clientes(nombre))').order('fecha', { ascending: false });

    const desde = document.getElementById('fechaDesdePagos').value;
    const hasta = document.getElementById('fechaHastaPagos').value;
    if (desde) query = query.gte('fecha', desde);
    if (hasta) query = query.lte('fecha', hasta);

    const { data: gastos, error } = await query;
    if (error) { mostrarToast("Error al cargar gastos: " + error.message, 'error'); return; }

    gastosCache = gastos;

    const tbody = document.getElementById('tablaGastos');
    const filas = gastos.map(g => {
        const deQuePresupuesto = (g.id_presupuesto && g.presupuestos && g.presupuestos.clientes)
            ? escaparTexto(g.presupuestos.clientes.nombre)
            : 'Gasto general';
        return `
        <tr>
            <td data-label="Fecha">${escaparTexto(g.fecha)}</td>
            <td data-label="Categoría">${escaparTexto(g.categoria)}</td>
            <td data-label="Concepto">${escaparTexto(g.concepto)}</td>
            <td data-label="Monto">$${Number(g.monto).toFixed(2)}</td>
            <td data-label="¿De qué presupuesto?">${deQuePresupuesto}</td>
            <td data-label="Acción"><button class="btn-danger" onclick="borrarGasto(${g.id})" title="Borrar gasto">🗑️ Borrar</button></td>
        </tr>`;
    });
    tbody.innerHTML = filas.join('');

    actualizarResumenPagos();
}

async function borrarGasto(id) {
    const confirmado = await confirmarAccion("¿Borrar este gasto?");
    if (!confirmado) return;

    await clienteSupabase.from('gastos').delete().eq('id', id);
    mostrarToast("Gasto borrado");
    await cargarGastos();
}

function exportarGastosCSV() {
    if (gastosCache.length === 0) { mostrarToast("No hay gastos para exportar", 'error'); return; }

    const encabezado = ['Fecha', 'Categoría', 'Concepto', 'Monto', 'Presupuesto'];
    const filas = gastosCache.map(g => [
        g.fecha,
        g.categoria,
        g.concepto,
        g.monto,
        (g.id_presupuesto && g.presupuestos && g.presupuestos.clientes) ? g.presupuestos.clientes.nombre : 'Gasto general'
    ]);
    descargarCSV('gastos.csv', encabezado, filas);
}

async function aplicarFiltroFechas() {
    await cargarPagosPresupuesto();
    await cargarGastos();
}

function actualizarResumenPagos() {
    const totalCobrado = pagosCache.reduce((s, p) => s + Number(p.monto), 0);
    const totalGastado = gastosCache.reduce((s, g) => s + Number(g.monto), 0);
    const balance = totalCobrado - totalGastado;

    document.getElementById('lblTotalCobrado').textContent = totalCobrado.toFixed(2);
    document.getElementById('lblTotalGastado').textContent = totalGastado.toFixed(2);
    document.getElementById('lblBalance').textContent = balance.toFixed(2);
}
