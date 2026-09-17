// ==========================================
// CONEXIÓN A SUPABASE Y ESTADO COMPARTIDO
// Este archivo debe cargarse PRIMERO: define clienteSupabase
// y las variables/utilidades que usan los demás archivos.
// ==========================================
const SUPABASE_URL = 'https://wjnsfxpmndbkyytlynjk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqbnNmeHBtbmRia3l5dGx5bmprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2MjQ1NTksImV4cCI6MjA5MTIwMDU1OX0.lUreFgivwsa3hG3rHNObschcuXa2nQPR3fMhAOzkqqA';
const clienteSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Variables temporales compartidas entre archivos
let presupuestoActual = [];
let siguienteIdFilaPresupuesto = 1;
let idConceptoEditando = null;
let idClienteEditando = null;
let mapaAreas = {};
let mapaClientes = {};

// ==========================================
// UTILIDADES ANTI-XSS
// Todo texto que venga de la base de datos (nombres, direcciones, etc.)
// debe pasar por aquí antes de insertarse con innerHTML.
// ==========================================
function escaparTexto(valor) {
    if (valor === null || valor === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(valor);
    return div.innerHTML;
}

function escaparAtributo(valor) {
    if (valor === null || valor === undefined) return '';
    return String(valor)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// ==========================================
// UI COMPARTIDA: toasts, confirmaciones y botones "cargando"
// Reemplazan alert()/confirm() nativos por componentes con el
// estilo propio de la plataforma (ver modales en index.html).
// ==========================================
function mostrarToast(mensaje, tipo = 'exito') {
    let contenedor = document.getElementById('toastContainer');
    if (!contenedor) {
        contenedor = document.createElement('div');
        contenedor.id = 'toastContainer';
        document.body.appendChild(contenedor);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.textContent = mensaje;
    contenedor.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

let _resolverConfirmacion = null;
function confirmarAccion(mensaje) {
    document.getElementById('modalConfirmarMensaje').textContent = mensaje;
    document.getElementById('modalConfirmar').classList.remove('oculto');
    return new Promise(resolve => { _resolverConfirmacion = resolve; });
}

function responderConfirmacion(resultado) {
    document.getElementById('modalConfirmar').classList.add('oculto');
    if (_resolverConfirmacion) {
        _resolverConfirmacion(resultado);
        _resolverConfirmacion = null;
    }
}

// Para que conceptos, áreas y clientes se vean siempre parejos sin importar
// cómo los escriba quien los captura (mayúsculas, minúsculas o mezclado).
function normalizarTexto(valor) {
    return String(valor || '').trim().replace(/\s+/g, ' ').toUpperCase();
}

function descargarCSV(nombreArchivo, encabezado, filas) {
    const escaparCelda = valor => `"${String(valor).replace(/"/g, '""')}"`;
    const lineas = [encabezado, ...filas].map(fila => fila.map(escaparCelda).join(','));
    const contenido = lineas.join('\r\n');

    const blob = new Blob(['﻿' + contenido], { type: 'text/csv;charset=utf-8;' });
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(blob);
    enlace.download = nombreArchivo;
    enlace.click();
    URL.revokeObjectURL(enlace.href);
}

async function conBotonCargando(boton, textoCargando, fn) {
    const textoOriginal = boton.innerHTML;
    boton.disabled = true;
    boton.innerHTML = textoCargando;
    try {
        return await fn();
    } finally {
        boton.disabled = false;
        boton.innerHTML = textoOriginal;
    }
}
