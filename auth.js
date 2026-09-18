// ==========================================
// SEGURIDAD Y LOGIN
// ==========================================
async function verificarSesion() {
    const { data: { session } } = await clienteSupabase.auth.getSession();
    document.getElementById('app').style.visibility = 'visible';

    if (session) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'block';
        inicializarDatos();
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('main-app').style.display = 'none';
    }
}

async function iniciarSesion() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorMsg = document.getElementById('loginError');
    errorMsg.style.display = 'none';

    if (!email || !password) {
        errorMsg.innerText = "Ingresa correo y contraseña.";
        errorMsg.style.display = 'block';
        return;
    }

    const { data, error } = await clienteSupabase.auth.signInWithPassword({ email, password });
    if (error) {
        errorMsg.innerText = "Credenciales incorrectas.";
        errorMsg.style.display = 'block';
    } else {
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';
        verificarSesion();
    }
}

function alternarVisibilidadPassword() {
    const passwordInput = document.getElementById('loginPassword');
    const mostrarPassword = document.getElementById('mostrarPassword').checked;
    passwordInput.type = mostrarPassword ? 'text' : 'password';
}

async function cerrarSesion() {
    await clienteSupabase.auth.signOut();
    verificarSesion();
}
