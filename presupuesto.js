// ==========================================
// LÓGICA DE PRESUPUESTO E HISTORIAL
// ==========================================

// Lista con buscador + checkboxes para agregar varios conceptos de un jalón
// (reemplaza el flujo anterior de "un concepto a la vez").
async function renderizarListaConceptos() {
    const idArea = parseInt(document.getElementById('selArea').value) || null;
    const idClienteRaw = document.getElementById('selClientePresupuesto').value;

    let query = clienteSupabase.from('conceptos').select('*').order('id_area', { ascending: true }).order('orden', { ascending: true });
    if (idArea) query = query.eq('id_area', idArea);

    if (idClienteRaw) {
        query = query.or(`id_cliente.is.null,id_cliente.eq.${parseInt(idClienteRaw)}`);
    } else {
        query = query.is('id_cliente', null);
    }

    const { data: conceptos, error } = await query;
    const tbody = document.getElementById('listaConceptosPresupuesto');
    if (error) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;">Error al cargar conceptos.</td></tr>'; return; }

    const origen = document.getElementById('filtroOrigenConceptoPresupuesto').value;
    let filtrados = conceptos;
    if (origen === 'global') {
        filtrados = filtrados.filter(c => !c.id_cliente);
    } else if (origen === 'cliente') {
        if (!idClienteRaw) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;">Selecciona un cliente arriba para ver sus conceptos exclusivos.</td></tr>';
            return;
        }
        filtrados = filtrados.filter(c => !!c.id_cliente);
    }

    const texto = document.getElementById('buscarConceptoPresupuesto').value.trim().toLowerCase();
    if (texto) filtrados = filtrados.filter(c => c.concepto.toLowerCase().includes(texto));

    if (filtrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;">No se encontraron conceptos.</td></tr>';
        return;
    }

    const filas = filtrados.map(c => {
        const nombreArea = mapaAreas[c.id_area] || '';
        const etiquetaOrigen = c.id_cliente
            ? '<span class="badge-origen badge-cliente">📌 Cliente</span>'
            : '<span class="badge-origen badge-global">🌍 Global</span>';
        return `
            <tr data-id="${c.id}">
                <td><input type="checkbox" class="chk-concepto"></td>
                <td>
                    <strong class="texto-concepto">${escaparTexto(c.concepto)}</strong> ${etiquetaOrigen}
                    <br><span style="font-size:0.8em; color:#888;">${escaparTexto(nombreArea)}</span>
                </td>
                <td class="texto-unidad">${escaparTexto(c.unidad)}</td>
                <td><input type="number" class="input-precio-concepto" value="${c.precio_total}" step="0.1" min="0" style="width:90px"></td>
                <td><input type="number" class="input-cantidad-concepto" value="1" min="0.1" step="0.1" style="width:70px"></td>
            </tr>`;
    });
    tbody.innerHTML = filas.join('');
}

function agregarSeleccionadosAlPresupuesto() {
    const filas = document.querySelectorAll('#listaConceptosPresupuesto tr[data-id]');
    let agregados = 0;

    filas.forEach(fila => {
        const chk = fila.querySelector('.chk-concepto');
        if (!chk.checked) return;

        const concepto = fila.querySelector('.texto-concepto').textContent;
        const unidad = fila.querySelector('.texto-unidad').textContent;
        const precioUnitario = parseFloat(fila.querySelector('.input-precio-concepto').value);
        const cantidad = parseFloat(fila.querySelector('.input-cantidad-concepto').value);

        if (isNaN(precioUnitario) || precioUnitario < 0 || isNaN(cantidad) || cantidad <= 0) return;

        presupuestoActual.push({
            id: siguienteIdFilaPresupuesto++,
            concepto,
            unidad,
            cantidad,
            precioUnitario,
            importe: cantidad * precioUnitario
        });
        chk.checked = false;
        agregados++;
    });

    if (agregados === 0) {
        mostrarToast("Marca al menos un concepto con cantidad y precio válidos.", 'error');
        return;
    }

    actualizarTabla();
    mostrarToast(`${agregados} concepto(s) agregado(s) al presupuesto.`);
}

function eliminarFila(id) {
    presupuestoActual = presupuestoActual.filter(item => item.id !== id);
    actualizarTabla();
}

function calcularTotales() {
    const subtotal = presupuestoActual.reduce((s, item) => s + item.importe, 0);

    const incluyeHerramienta = document.getElementById('checkDesgaste').checked && subtotal > 0;
    const herramienta = incluyeHerramienta ? subtotal * 0.05 : 0;

    const baseConHerramienta = subtotal + herramienta;
    const porcentajeIVA = parseFloat(document.getElementById('porcentajeIVA').value) || 0;
    const iva = (porcentajeIVA > 0 && baseConHerramienta > 0) ? baseConHerramienta * (porcentajeIVA / 100) : 0;

    const total = baseConHerramienta + iva;

    const porcentajeAnticipo = parseFloat(document.getElementById('porcentajeAnticipo').value) || 0;
    const anticipo = (porcentajeAnticipo > 0 && total > 0) ? total * (porcentajeAnticipo / 100) : 0;
    const saldoPendiente = anticipo > 0 ? total - anticipo : 0;

    return { subtotal, herramienta, porcentajeIVA, iva, total, porcentajeAnticipo, anticipo, saldoPendiente };
}

function mostrarDireccionCliente() {
    const idCliente = parseInt(document.getElementById('selClientePresupuesto').value);
    const info = document.getElementById('direccionClienteInfo');
    const cliente = (typeof clientesCache !== 'undefined') ? clientesCache.find(c => c.id === idCliente) : null;

    info.textContent = (cliente && cliente.direccion) ? `📍 Dirección: ${cliente.direccion}` : '';
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

    const { herramienta, porcentajeIVA, iva, total, porcentajeAnticipo, anticipo, saldoPendiente } = calcularTotales();

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

    if (iva > 0) {
        filas.push(`
            <tr class="fila-herramienta">
                <td>IVA (${porcentajeIVA}%)</td>
                <td>lote</td>
                <td>1</td>
                <td>$${iva.toFixed(2)}</td>
                <td>$${iva.toFixed(2)}</td>
                <td class="no-print">Auto</td>
            </tr>
        `);
    }

    tbody.innerHTML = filas.join('');
    document.getElementById('lblTotal').innerText = total.toFixed(2);

    const lineaAnticipo = document.getElementById('lineaAnticipo');
    const lineaSaldo = document.getElementById('lineaSaldo');
    if (anticipo > 0) {
        lineaAnticipo.textContent = `Anticipo (${porcentajeAnticipo}%): $${anticipo.toFixed(2)}`;
        lineaSaldo.textContent = `Saldo Pendiente: $${saldoPendiente.toFixed(2)}`;
        lineaAnticipo.classList.remove('oculto');
        lineaSaldo.classList.remove('oculto');
    } else {
        lineaAnticipo.classList.add('oculto');
        lineaSaldo.classList.add('oculto');
    }
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

    const { subtotal, herramienta, porcentajeIVA, iva, total } = calcularTotales();

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

        if (iva > 0) {
            filasDetalle.push({
                concepto: `IVA (${porcentajeIVA}%)`,
                unidad: 'lote',
                cantidad: 1,
                precio_unitario: iva,
                importe: iva,
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

function cargarImagenComoDataURL(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            canvas.getContext('2d').drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = url;
    });
}

async function descargarPDF(boton) {
    if (presupuestoActual.length === 0) {
        mostrarToast("Agrega conceptos antes de descargar el PDF.", 'error');
        return;
    }

    await conBotonCargando(boton, 'Generando...', async () => {
        const select = document.getElementById('selClientePresupuesto');
        const nombreCliente = select.options[select.selectedIndex]?.text || 'Sin cliente';
        const idCliente = parseInt(select.value);
        const cliente = (typeof clientesCache !== 'undefined') ? clientesCache.find(c => c.id === idCliente) : null;
        const fecha = document.getElementById('fechaPresupuesto').value;
        const { herramienta, porcentajeIVA, iva, total, porcentajeAnticipo, anticipo, saldoPendiente } = calcularTotales();

        const doc = new jspdf.jsPDF();

        try {
            const logoDataUrl = await cargarImagenComoDataURL('logo.png');
            doc.addImage(logoDataUrl, 'PNG', 14, 10, 22, 22);
        } catch (e) { /* si no carga el logo, seguimos sin él */ }

        doc.setFontSize(16);
        doc.text('Presupuesto de Obra', 42, 18);
        doc.setFontSize(11);
        doc.text('Cresencio Gallegos Vega', 42, 25);
        doc.text('Tel: 868 297 1177 (Contacto solo por WhatsApp)', 42, 31);

        let y = 44;
        doc.setFontSize(11);
        doc.text(`Cliente: ${nombreCliente}`, 14, y); y += 7;
        if (cliente && cliente.direccion) { doc.text(`Dirección: ${cliente.direccion}`, 14, y); y += 7; }
        doc.text(`Fecha: ${fecha}`, 14, y); y += 6;

        const filas = presupuestoActual.map(item => [
            item.concepto, item.unidad, String(item.cantidad), `$${item.precioUnitario.toFixed(2)}`, `$${item.importe.toFixed(2)}`
        ]);
        if (herramienta > 0) {
            filas.push(['Cargo por Herramienta Menor (5% de M.O.)', 'lote', '1', `$${herramienta.toFixed(2)}`, `$${herramienta.toFixed(2)}`]);
        }
        if (iva > 0) {
            filas.push([`IVA (${porcentajeIVA}%)`, 'lote', '1', `$${iva.toFixed(2)}`, `$${iva.toFixed(2)}`]);
        }

        doc.autoTable({
            startY: y + 4,
            head: [['Concepto', 'Unidad', 'Cant.', 'Precio Unit.', 'Importe']],
            body: filas
        });

        let finalY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : y + 4) + 10;
        doc.setFontSize(13);
        doc.text(`TOTAL: $${total.toFixed(2)}`, 14, finalY);

        if (anticipo > 0) {
            finalY += 7;
            doc.setFontSize(11);
            doc.text(`Anticipo (${porcentajeAnticipo}%): $${anticipo.toFixed(2)}`, 14, finalY);
            finalY += 6;
            doc.text(`Saldo Pendiente: $${saldoPendiente.toFixed(2)}`, 14, finalY);
        }

        doc.save(`presupuesto_${nombreCliente}_${fecha}.pdf`);
    });
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

    const { data: pagos } = await clienteSupabase.from('pagos_presupuesto').select('monto').eq('id_presupuesto', idPresupuesto);
    const cobrado = (pagos || []).reduce((s, p) => s + Number(p.monto), 0);
    const presupuesto = historialCache.find(p => p.id === idPresupuesto);
    const totalPresupuesto = presupuesto ? Number(presupuesto.total) : 0;
    const pendiente = totalPresupuesto - cobrado;

    document.getElementById('resumenPagosDetalle').textContent =
        `Cobrado: $${cobrado.toFixed(2)} — Pendiente: $${pendiente.toFixed(2)}`;

    document.getElementById('modalDetalleHistorial').classList.remove('oculto');
}

function cerrarModalDetalle() {
    document.getElementById('modalDetalleHistorial').classList.add('oculto');
}
