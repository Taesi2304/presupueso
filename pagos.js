// ==========================================================
// PAGOS DE PRESUPUESTOS (anticipos/abonos reales, sí se guardan)
// Y GASTOS GENERALES DEL NEGOCIO (nómina, sueldos, materiales, etc.)
// ==========================================================
let pagosCache = [];
let gastosCache = [];

async function cargarPresupuestosParaPago() {
    const { data: presupuestos, error } = await clienteSupabase
        .from('presupuestos')
        .select('id, fecha, total, clientes(nombre)')
        .order('fecha', { ascending: false });

    if (error) { mostrarToast("Error al cargar presupuestos: " + error.message, 'error'); return; }

    const select = document.getElementById('pagoPresupuesto');
    const opciones = presupuestos.map(p => {
        const nombreCliente = p.clientes ? p.clientes.nombre : 'Sin nombre';
        return `<option value="${p.id}">${escaparTexto(nombreCliente)} - ${escaparTexto(p.fecha)} - $${Number(p.total).toFixed(2)}</option>`;
    });
    select.innerHTML = '<option value="">Seleccione...</option>' + opciones.join('');
}

async function guardarPago(boton) {
    const idPresupuesto = parseInt(document.getElementById('pagoPresupuesto').value);
    const fecha = document.getElementById('pagoFecha').value;
    const concepto = document.getElementById('pagoConcepto').value;
    const monto = parseFloat(document.getElementById('pagoMonto').value);

    if (!idPresupuesto || !fecha || isNaN(monto) || monto <= 0) {
        mostrarToast("Selecciona un presupuesto, fecha y un monto válido.", 'error');
        return;
    }

    await conBotonCargando(boton, 'Guardando...', async () => {
        const { error } = await clienteSupabase.from('pagos_presupuesto').insert([
            { id_presupuesto: idPresupuesto, fecha, concepto, monto }
        ]);

        if (error) { mostrarToast("Error al guardar el pago: " + error.message, 'error'); return; }

        document.getElementById('pagoMonto').value = '';
        mostrarToast("¡Pago registrado con éxito!");
        await cargarPagosPresupuesto();
    });
}

async function cargarPagosPresupuesto() {
    let query = clienteSupabase.from('pagos_presupuesto')
        .select('*, presupuestos(total, clientes(nombre))')
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
        totalPagadoPorPresupuesto[p.id_presupuesto] = (totalPagadoPorPresupuesto[p.id_presupuesto] || 0) + Number(p.monto);
    });

    const tbody = document.getElementById('tablaPagos');
    const filas = pagos.map(p => {
        const totalPresupuesto = p.presupuestos ? Number(p.presupuestos.total) : 0;
        const nombreCliente = p.presupuestos && p.presupuestos.clientes ? p.presupuestos.clientes.nombre : 'Sin nombre';
        const pagado = totalPagadoPorPresupuesto[p.id_presupuesto] || 0;
        const saldo = totalPresupuesto - pagado;
        return `
            <tr>
                <td>${escaparTexto(nombreCliente)}</td>
                <td>$${totalPresupuesto.toFixed(2)}</td>
                <td>${escaparTexto(p.fecha)}</td>
                <td>${escaparTexto(p.concepto)}</td>
                <td>$${Number(p.monto).toFixed(2)}</td>
                <td>$${saldo.toFixed(2)}</td>
                <td><button class="btn-danger" onclick="borrarPago(${p.id})" title="Borrar pago">🗑️</button></td>
            </tr>`;
    });
    tbody.innerHTML = filas.join('');

    actualizarResumenPagos();
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

    const encabezado = ['Cliente', 'Fecha Pago', 'Concepto', 'Monto'];
    const filas = pagosCache.map(p => [
        p.presupuestos && p.presupuestos.clientes ? p.presupuestos.clientes.nombre : 'Sin nombre',
        p.fecha,
        p.concepto,
        p.monto
    ]);
    descargarCSV('pagos.csv', encabezado, filas);
}

async function guardarGasto(boton) {
    const fecha = document.getElementById('gastoFecha').value;
    const categoria = document.getElementById('gastoCategoria').value;
    const concepto = document.getElementById('gastoConcepto').value.trim();
    const monto = parseFloat(document.getElementById('gastoMonto').value);

    if (!fecha || !concepto || isNaN(monto) || monto <= 0) {
        mostrarToast("Completa fecha, concepto y un monto válido.", 'error');
        return;
    }

    await conBotonCargando(boton, 'Guardando...', async () => {
        const { error } = await clienteSupabase.from('gastos').insert([{ fecha, categoria, concepto, monto }]);

        if (error) { mostrarToast("Error al guardar el gasto: " + error.message, 'error'); return; }

        document.getElementById('gastoConcepto').value = '';
        document.getElementById('gastoMonto').value = '';
        mostrarToast("¡Gasto registrado con éxito!");
        await cargarGastos();
    });
}

async function cargarGastos() {
    let query = clienteSupabase.from('gastos').select('*').order('fecha', { ascending: false });

    const desde = document.getElementById('fechaDesdePagos').value;
    const hasta = document.getElementById('fechaHastaPagos').value;
    if (desde) query = query.gte('fecha', desde);
    if (hasta) query = query.lte('fecha', hasta);

    const { data: gastos, error } = await query;
    if (error) { mostrarToast("Error al cargar gastos: " + error.message, 'error'); return; }

    gastosCache = gastos;

    const tbody = document.getElementById('tablaGastos');
    const filas = gastos.map(g => `
        <tr>
            <td>${escaparTexto(g.fecha)}</td>
            <td>${escaparTexto(g.categoria)}</td>
            <td>${escaparTexto(g.concepto)}</td>
            <td>$${Number(g.monto).toFixed(2)}</td>
            <td><button class="btn-danger" onclick="borrarGasto(${g.id})" title="Borrar gasto">🗑️</button></td>
        </tr>`);
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

    const encabezado = ['Fecha', 'Categoría', 'Concepto', 'Monto'];
    const filas = gastosCache.map(g => [g.fecha, g.categoria, g.concepto, g.monto]);
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
