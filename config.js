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
let conceptoTemporal = null;
let idConceptoEditando = null;
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
