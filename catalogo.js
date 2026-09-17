// ==========================================
// LÓGICA DE CATÁLOGO (Global y por Cliente)
// Un concepto con id_cliente = NULL es global (visible para todos).
// Un concepto con id_cliente = X es exclusivo del cliente X.
// ==========================================

// Áreas (oficios): se administran desde aquí en vez de insertarlas directo
// en la base de datos, para que se puedan ir agregando según se necesiten.
let areasCache = [];
let idAreaEditando = null;

async function cargarAreas() {
    const { data: areas, error } = await clienteSupabase.from('areas').select('*').order('id', { ascending: true });
    if (error) { mostrarToast("Error al cargar áreas: " + error.message, 'error'); return; }

    areasCache = areas;
    mapaAreas = {};
    areas.forEach(a => mapaAreas[a.id] = a.nombre);

    llenarMenuDesplegable('selArea', areas, 'Todas las áreas...');
    llenarMenuDesplegable('catArea', areas, 'Seleccione Área...');
    llenarMenuDesplegable('filtroAreaCatalogo', areas, 'Todas las Áreas...');
    llenarMenuDesplegable('modalConceptoArea', areas, 'Seleccione Área...');

    const tablaAreas = document.getElementById('tablaAreas');
    if (tablaAreas) {
        const filas = areas.map(a => `
            <tr>
                <td>${escaparTexto(a.nombre)}</td>
                <td>
                    <button class="btn-edit" onclick="abrirEdicionArea(${a.id})" title="Editar área">✏️</button>
                    <button class="btn-danger" onclick="borrarArea(${a.id})" title="Borrar área">🗑️</button>
                </td>
            </tr>`);
        tablaAreas.innerHTML = filas.join('');
    }
}

async function guardarNuevaArea(boton) {
    const nombre = normalizarTexto(document.getElementById('areaNombre').value);
    if (!nombre) { mostrarToast("Escribe el nombre del área.", 'error'); return; }

    await conBotonCargando(boton, 'Guardando...', async () => {
        const { error } = await clienteSupabase.from('areas').insert([{ nombre }]);
        if (error) { mostrarToast("Error al guardar el área: " + error.message, 'error'); return; }

        document.getElementById('areaNombre').value = '';
        mostrarToast("¡Área agregada con éxito!");
        await cargarAreas();
    });
}

function abrirEdicionArea(id) {
    const area = areasCache.find(a => a.id === id);
    if (!area) return;

    idAreaEditando = id;
    document.getElementById('modalAreaNombre').value = area.nombre;
    document.getElementById('modalEditarArea').classList.remove('oculto');
}

function cerrarModalArea() {
    idAreaEditando = null;
    document.getElementById('modalEditarArea').classList.add('oculto');
}

async function confirmarEdicionArea() {
    const nombre = normalizarTexto(document.getElementById('modalAreaNombre').value);
    if (!nombre) { mostrarToast("Escribe el nombre del área.", 'error'); return; }

    const { error } = await clienteSupabase.from('areas').update({ nombre }).eq('id', idAreaEditando);
    if (error) { mostrarToast("Error al editar el área: " + error.message, 'error'); return; }

    cerrarModalArea();
    mostrarToast("Área actualizada con éxito");
    await cargarAreas();
    await cargarTablaCatalogo();
    await renderizarListaConceptos();
}

async function borrarArea(id) {
    const confirmado = await confirmarAccion("¿Borrar esta área? Solo se puede borrar si no tiene conceptos guardados en ella.");
    if (!confirmado) return;

    const { error } = await clienteSupabase.from('areas').delete().eq('id', id);
    if (error) { mostrarToast("No se pudo borrar: primero quita o mueve los conceptos que tiene esta área.", 'error'); return; }

    mostrarToast("Área borrada");
    await cargarAreas();
}

function llenarFiltroClienteCatalogo(clientes) {
    const select = document.getElementById('filtroClienteCatalogo');
    const valorActual = select.value;
    const opciones = clientes.map(c => `<option value="${c.id}">${escaparTexto(c.nombre)}</option>`);
    select.innerHTML = '<option value="">Todos (Global + Clientes)</option><option value="global">🌍 Solo Catálogo Global</option>' + opciones.join('');
    select.value = valorActual;
}

async function guardarNuevoConcepto(boton) {
    const idArea = parseInt(document.getElementById('catArea').value);
    const nombre = normalizarTexto(document.getElementById('catNombre').value);
    const unidad = document.getElementById('catUnidad').value;
    const precio = parseFloat(document.getElementById('catPrecio').value);
    const idClienteRaw = document.getElementById('catCliente').value;
    const idCliente = idClienteRaw ? parseInt(idClienteRaw) : null;

    if (!idArea || !nombre || isNaN(precio)) {
        mostrarToast("Completa todos los campos para guardar el concepto.", 'error');
        return;
    }

    await conBotonCargando(boton, 'Guardando...', async () => {
        const { data: conceptosArea } = await clienteSupabase.from('conceptos').select('orden').eq('id_area', idArea);
        let maxOrden = 0;
        if (conceptosArea) {
            conceptosArea.forEach(c => { if (c.orden > maxOrden) maxOrden = c.orden; });
        }

        const { error } = await clienteSupabase.from('conceptos').insert([
            { id_area: idArea, concepto: nombre, unidad: unidad, precio_total: precio, orden: maxOrden + 1, id_cliente: idCliente }
        ]);

        if (error) { mostrarToast("Error al guardar: " + error.message, 'error'); return; }

        mostrarToast("¡Concepto guardado en la nube con éxito!");
        document.getElementById('catNombre').value = '';
        document.getElementById('catPrecio').value = '';

        document.getElementById('filtroAreaCatalogo').value = idArea;
        await cargarTablaCatalogo();
        await renderizarListaConceptos();
    });
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
    await renderizarListaConceptos();
}

let catalogoCache = [];

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

    const texto = document.getElementById('buscarCatalogo').value.trim().toLowerCase();
    const conceptosFiltrados = texto
        ? conceptos.filter(c => c.concepto.toLowerCase().includes(texto))
        : conceptos;

    catalogoCache = conceptosFiltrados;

    const tbody = document.getElementById('tablaCatalogo');

    const filas = conceptosFiltrados.map(c => {
        const nombreArea = mapaAreas[c.id_area] || 'Desconocido';
        const etiquetaCliente = c.id_cliente ? (mapaClientes[c.id_cliente] || 'Cliente eliminado') : '🌍 Global';

        return `
            <tr>
                <td style="font-size: 0.9em; color: #666;">${escaparTexto(nombreArea)}</td>
                <td><strong>${escaparTexto(c.concepto)}</strong></td>
                <td>${escaparTexto(c.unidad)}</td>
                <td>$${c.precio_total.toFixed(2)}</td>
                <td style="font-size: 0.85em;">${escaparTexto(etiquetaCliente)}</td>
                <td style="display:flex; gap: 5px; flex-wrap: wrap;">
                    <button class="btn-edit" style="background:#7f8fa6;" onclick="moverConcepto(${c.id}, 'arriba')" title="Mover Arriba">🔼</button>
                    <button class="btn-edit" style="background:#7f8fa6;" onclick="moverConcepto(${c.id}, 'abajo')" title="Mover Abajo">🔽</button>
                    <button class="btn-edit" onclick="abrirEdicionConcepto(${c.id})" title="Editar concepto">✏️</button>
                    ${c.id_cliente ? `<button class="btn-edit" style="background:#44bd32;" onclick="compartirConceptoGlobal(${c.id})" title="Compartir a Catálogo Global">📤</button>` : ''}
                    <button class="btn-danger" onclick="borrarConcepto(${c.id})" title="Borrar concepto">🗑️</button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = filas.join('');
}

function exportarCatalogoCSV() {
    if (catalogoCache.length === 0) { mostrarToast("No hay conceptos para exportar", 'error'); return; }

    const encabezado = ['Area', 'Concepto', 'Unidad', 'Precio', 'Cliente'];
    const filas = catalogoCache.map(c => [
        mapaAreas[c.id_area] || 'Desconocido',
        c.concepto,
        c.unidad,
        c.precio_total,
        c.id_cliente ? (mapaClientes[c.id_cliente] || 'Cliente eliminado') : 'Global'
    ]);

    descargarCSV('catalogo.csv', encabezado, filas);
}

async function compartirConceptoGlobal(idConcepto) {
    const { data: c, error } = await clienteSupabase.from('conceptos').select('*').eq('id', idConcepto).single();
    if (error || !c) return;

    const confirmado = await confirmarAccion(`¿Agregar "${c.concepto}" al catálogo global? Se creará una copia disponible para todos los clientes; el precio de este cliente no se modifica.`);
    if (!confirmado) return;

    const { data: conceptosGlobales } = await clienteSupabase.from('conceptos').select('orden').eq('id_area', c.id_area).is('id_cliente', null);
    let maxOrden = 0;
    if (conceptosGlobales) conceptosGlobales.forEach(x => { if (x.orden > maxOrden) maxOrden = x.orden; });

    const { error: errorInsert } = await clienteSupabase.from('conceptos').insert([
        { id_area: c.id_area, concepto: c.concepto, unidad: c.unidad, precio_total: c.precio_total, orden: maxOrden + 1, id_cliente: null }
    ]);

    if (errorInsert) { mostrarToast("Error al compartir: " + errorInsert.message, 'error'); return; }
    mostrarToast("¡Concepto agregado al catálogo global!");
    await cargarTablaCatalogo();
    await renderizarListaConceptos();
}

function abrirEdicionConcepto(id) {
    const concepto = catalogoCache.find(c => c.id === id);
    if (!concepto) return;

    idConceptoEditando = id;
    document.getElementById('modalConceptoNombre').value = concepto.concepto;
    document.getElementById('modalConceptoArea').value = concepto.id_area;
    document.getElementById('modalConceptoUnidad').value = concepto.unidad;
    document.getElementById('modalConceptoPrecio').value = concepto.precio_total;
    document.getElementById('modalEditarConcepto').classList.remove('oculto');
}

function cerrarModalConcepto() {
    idConceptoEditando = null;
    document.getElementById('modalEditarConcepto').classList.add('oculto');
}

async function confirmarEdicionConcepto() {
    const nombre = normalizarTexto(document.getElementById('modalConceptoNombre').value);
    const idArea = parseInt(document.getElementById('modalConceptoArea').value);
    const unidad = document.getElementById('modalConceptoUnidad').value;
    const precio = parseFloat(document.getElementById('modalConceptoPrecio').value);

    if (!nombre || !idArea || isNaN(precio) || precio <= 0) {
        mostrarToast("Completa nombre, área y un precio válido.", 'error');
        return;
    }

    const { error } = await clienteSupabase.from('conceptos').update({
        concepto: nombre, id_area: idArea, unidad: unidad, precio_total: precio
    }).eq('id', idConceptoEditando);

    if (error) { mostrarToast("Error al editar: " + error.message, 'error'); return; }

    cerrarModalConcepto();
    mostrarToast("Concepto actualizado con éxito");
    await cargarTablaCatalogo();
    await renderizarListaConceptos();
}

async function borrarConcepto(id) {
    const confirmado = await confirmarAccion("¿Estás seguro de borrar este concepto de la nube?");
    if (confirmado) {
        await clienteSupabase.from('conceptos').delete().eq('id', id);
        mostrarToast("Concepto borrado");
        await cargarTablaCatalogo();
        await renderizarListaConceptos();
    }
}
