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
        const opciones = conceptos.map(c => `<option value="${c.id}">${escaparTexto(c.concepto)}</option>`);
        select.innerHTML += opciones.join('');
        return;
    }

    // Con un cliente seleccionado, se agrupa visualmente para distinguir
    // qué conceptos son exclusivos de él y cuáles vienen del catálogo global.
    const delCliente = conceptos.filter(c => c.id_cliente);
    const globales = conceptos.filter(c => !c.id_cliente);
    let extra = '';

    if (delCliente.length > 0) {
        const opciones = delCliente.map(c => `<option value="${c.id}">${escaparTexto(c.concepto)}</option>`).join('');
        extra += `<optgroup label="📌 Exclusivos de este cliente">${opciones}</optgroup>`;
    }
    if (globales.length > 0) {
        const opciones = globales.map(c => `<option value="${c.id}">${escaparTexto(c.concepto)}</option>`).join('');
        extra += `<optgroup label="🌍 Catálogo Global">${opciones}</optgroup>`;
    }
    select.innerHTML += extra;
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
        mostrarToast("Asegúrate de seleccionar un concepto y poner cantidad y precio válidos.", 'error');
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

    const filas = presupuestoActual.map(item => `
        <tr>
            <td>${escaparTexto(item.concepto)}</td>
            <td>${escaparTexto(item.unidad)}</td>
            <td>${item.cantidad}</td>
            <td>$${item.precioUnitario.toFixed(2)}</td>
            <td>$${item.importe.toFixed(2)}</td>
            <td class="no-print"><button class="btn-danger" onclick="eliminarFila(${item.id})">X</button></td>
        </tr>
    `);

    const { herramienta, total } = calcularTotales();

    if (herramienta > 0) {
        filas.push(`
            <tr class="fila-herramienta">
                <td>Cargo por Herramienta Menor (5% de M.O.)</td>
                <td>lote</td>
                <td>1</td>
                <td>$${herramienta.toFixed(2)}</td>
                <td>$${herramienta.toFixed(2)}</td>
                <td class="no-print">Auto</td>
            </tr>
        `);
    }

    tbody.innerHTML = filas.join('');
    document.getElementById('lblTotal').innerText = total.toFixed(2);
}

// ==========================================
// GUARDADO E HISTORIAL
// ==========================================
async function guardarEImprimir(boton) {
    const idCliente = document.getElementById('selClientePresupuesto').value;
    const fecha = document.getElementById('fechaPresupuesto').value;

    if (!idCliente || presupuestoActual.length === 0) {
        return mostrarToast("Selecciona un cliente y agrega conceptos antes de guardar.", 'error');
    }

    const { subtotal, herramienta, total } = calcularTotales();

    await conBotonCargando(boton, 'Guardando...', async () => {
        const filasDetalle = presupuestoActual.map((item, index) => ({
            concepto: item.concepto,
            unidad: item.unidad,
            cantidad: item.cantidad,
            precio_unitario: item.precioUnitario,
            importe: item.importe,
            orden: index
        }));

        if (herramienta > 0) {
            filasDetalle.push({
                concepto: 'Cargo por Herramienta Menor (5% de M.O.)',
                unidad: 'lote',
                cantidad: 1,
                precio_unitario: herramienta,
                importe: herramienta,
                orden: filasDetalle.length
            });
        }

        const { error } = await clienteSupabase.rpc('crear_presupuesto_con_detalle', {
            p_id_cliente: idCliente,
            p_fecha: fecha,
            p_total: total,
            p_subtotal: subtotal,
            p_detalle: filasDetalle
        });

        if (error) {
            mostrarToast("Error al guardar en el historial: " + error.message, 'error');
            return;
        }

        mostrarToast("¡Presupuesto guardado en el historial!");
        cargarHistorial();
        window.print();
    });
}

function descargarPDF() {
    if (presupuestoActual.length === 0) {
        mostrarToast("Agrega conceptos antes de descargar el PDF.", 'error');
        return;
    }

    const select = document.getElementById('selClientePresupuesto');
    const nombreCliente = select.options[select.selectedIndex]?.text || 'Sin cliente';
    const fecha = document.getElementById('fechaPresupuesto').value;
    const { herramienta, total } = calcularTotales();

    const doc = new jspdf.jsPDF();
    doc.setFontSize(16);
    doc.text('Presupuesto de Obra', 14, 15);
    doc.setFontSize(11);
    doc.text(`Cliente: ${nombreCliente}`, 14, 25);
    doc.text(`Fecha: ${fecha}`, 14, 32);

    const filas = presupuestoActual.map(item => [
        item.concepto, item.unidad, String(item.cantidad), `$${item.precioUnitario.toFixed(2)}`, `$${item.importe.toFixed(2)}`
    ]);
    if (herramienta > 0) {
        filas.push(['Cargo por Herramienta Menor (5% de M.O.)', 'lote', '1', `$${herramienta.toFixed(2)}`, `$${herramienta.toFixed(2)}`]);
    }

    doc.autoTable({
        startY: 38,
        head: [['Concepto', 'Unidad', 'Cant.', 'Precio Unit.', 'Importe']],
        body: filas
    });

    const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY : 38;
    doc.setFontSize(13);
    doc.text(`TOTAL: $${total.toFixed(2)}`, 14, finalY + 10);

    doc.save(`presupuesto_${nombreCliente}_${fecha}.pdf`);
}

let offsetHistorial = 0;
const TAMANO_PAGINA_HISTORIAL = 20;
let historialCache = [];

async function cargarHistorial(cargarMas = false) {
    if (!cargarMas) { offsetHistorial = 0; historialCache = []; }

    const { data: historial, error } = await clienteSupabase
        .from('presupuestos')
        .select(`id, fecha, total, clientes(nombre)`)
        .order('fecha', { ascending: false })
        .range(offsetHistorial, offsetHistorial + TAMANO_PAGINA_HISTORIAL - 1);

    if (error) return;

    historialCache = cargarMas ? historialCache.concat(historial) : historial;
    offsetHistorial += historial.length;

    const btnCargarMas = document.getElementById('btnCargarMasHistorial');
    btnCargarMas.style.display = historial.length < TAMANO_PAGINA_HISTORIAL ? 'none' : 'inline-block';

    const tbody = document.getElementById('tablaHistorial');
    const filas = historialCache.map(p => `
        <tr>
            <td>${escaparTexto(p.fecha)}</td>
            <td>${escaparTexto(p.clientes ? p.clientes.nombre : 'Sin nombre')}</td>
            <td>$${p.total.toFixed(2)}</td>
            <td>
                <button class="btn-edit" onclick="verDetallePresupuesto(${p.id})" title="Ver Detalle">👁️</button>
                <button class="btn-danger" onclick="borrarPresupuesto(${p.id})" title="Borrar registro">🗑️</button>
            </td>
        </tr>`);
    tbody.innerHTML = filas.join('');
}

function exportarHistorialCSV() {
    if (historialCache.length === 0) { mostrarToast("No hay historial para exportar", 'error'); return; }

    const encabezado = ['Fecha', 'Cliente', 'Total'];
    const filas = historialCache.map(p => [p.fecha, p.clientes ? p.clientes.nombre : 'Sin nombre', p.total]);

    descargarCSV('historial.csv', encabezado, filas);
}

async function borrarPresupuesto(id) {
    const confirmado = await confirmarAccion("¿Eliminar este registro del historial?");
    if (confirmado) {
        await clienteSupabase.from('presupuestos').delete().eq('id', id);
        mostrarToast("Registro eliminado");
        cargarHistorial();
    }
}

async function verDetallePresupuesto(idPresupuesto) {
    const { data: detalle, error } = await clienteSupabase
        .from('detalle_presupuesto')
        .select('*')
        .eq('id_presupuesto', idPresupuesto)
        .order('orden', { ascending: true });

    if (error) { mostrarToast("Error al cargar el detalle: " + error.message, 'error'); return; }

    const tbody = document.getElementById('tablaDetalleHistorial');

    if (!detalle || detalle.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">Este presupuesto no tiene detalle guardado (fue creado antes de esta función).</td></tr>';
    } else {
        const filas = detalle.map(item => `
            <tr>
                <td>${escaparTexto(item.concepto)}</td>
                <td>${escaparTexto(item.unidad)}</td>
                <td>${item.cantidad}</td>
                <td>$${Number(item.precio_unitario).toFixed(2)}</td>
                <td>$${Number(item.importe).toFixed(2)}</td>
            </tr>`);
        tbody.innerHTML = filas.join('');
    }

    document.getElementById('modalDetalleHistorial').classList.remove('oculto');
}

function cerrarModalDetalle() {
    document.getElementById('modalDetalleHistorial').classList.add('oculto');
}
