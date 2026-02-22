// ═══════════════ CONFIG ═══════════════
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000'
    : '';

// ═══════════════ TAB SWITCHING ═══════════════
const tabs = document.querySelectorAll('.auth-tab');
const forms = document.querySelectorAll('.auth-form');

function switchTab(tabName) {
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
    forms.forEach(f => f.classList.toggle('active', f.dataset.form === tabName));
    // Clear errors
    document.querySelectorAll('.form-error').forEach(e => {
        e.classList.remove('visible');
        e.textContent = '';
    });
}

tabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

document.getElementById('switchToLogin').addEventListener('click', (e) => {
    e.preventDefault();
    switchTab('login');
});
document.getElementById('switchToRegister').addEventListener('click', (e) => {
    e.preventDefault();
    switchTab('register');
});

// ═══════════════ ERROR DISPLAY ═══════════════
function showError(elementId, message) {
    const el = document.getElementById(elementId);
    el.textContent = message;
    el.classList.add('visible');
}

function clearErrors() {
    document.querySelectorAll('.form-error').forEach(e => {
        e.classList.remove('visible');
        e.textContent = '';
    });
}

// ═══════════════ SUCCESS → REDIRECT TO DASHBOARD ═══════════════
function showSuccess(user, isRegister) {
    // Redirect to dashboard after successful auth
    window.location.href = 'dashboard.html';
}

// ═══════════════ REGISTER ═══════════════
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirm = document.getElementById('regConfirm').value;

    if (password !== confirm) {
        showError('registerError', 'Las contraseñas no coinciden');
        return;
    }

    if (password.length < 6) {
        showError('registerError', 'La contraseña debe tener al menos 6 caracteres');
        return;
    }

    const btn = document.getElementById('registerBtn');
    btn.classList.add('loading');

    try {
        const res = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name }),
        });

        const data = await res.json();

        if (!res.ok) {
            showError('registerError', data.detail || 'Error al registrar');
            return;
        }

        // Store token
        localStorage.setItem('voz_token', data.access_token);
        localStorage.setItem('voz_user', JSON.stringify(data.user));

        showSuccess(data.user, true);
    } catch (err) {
        showError('registerError', 'Error de conexión. ¿El servidor está activo?');
    } finally {
        btn.classList.remove('loading');
    }
});

// ═══════════════ LOGIN ═══════════════
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    const btn = document.getElementById('loginBtn');
    btn.classList.add('loading');

    try {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        const data = await res.json();

        if (!res.ok) {
            showError('loginError', data.detail || 'Credenciales incorrectas');
            return;
        }

        // Store token
        localStorage.setItem('voz_token', data.access_token);
        localStorage.setItem('voz_user', JSON.stringify(data.user));

        showSuccess(data.user, false);
    } catch (err) {
        showError('loginError', 'Error de conexión. ¿El servidor está activo?');
    } finally {
        btn.classList.remove('loading');
    }
});

// ═══════════════ CHECK EXISTING SESSION ═══════════════
(function checkSession() {
    const token = localStorage.getItem('voz_token');
    const user = localStorage.getItem('voz_user');
    if (token && user) {
        // Verify token is still valid → redirect to dashboard
        fetch(`${API_BASE}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` },
        })
            .then(res => {
                if (res.ok) {
                    // Valid session → go to dashboard
                    window.location.href = 'dashboard.html';
                    return;
                }
                // Token expired, clear storage
                localStorage.removeItem('voz_token');
                localStorage.removeItem('voz_user');
            })
            .catch(() => { /* Ignore, show login form */ });
    }
})();
