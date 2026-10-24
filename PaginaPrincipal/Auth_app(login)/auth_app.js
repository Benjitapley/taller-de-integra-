// ==========================================
// Auth App - Roomies
// Maneja: Login, Registro, Verificación, JWT
// ==========================================

// ==========================================
// UTILIDADES
// ==========================================
function setMessage(element, text, type = 'success') {
  if (!element) return;
  element.textContent = text;
  element.classList.remove('success', 'error');
  element.classList.add(type);
}

function clearMessages() {
  ['loginMessage', 'registerMessage', 'verifyMessage'].forEach((id) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = '';
      element.classList.remove('success', 'error');
    }
  });
}

/**
 * Cambia entre paneles: 'login', 'register', 'verify'
 */
function switchTab(target) {
  const panels = document.querySelectorAll('.form-panel');
  panels.forEach((panel) => {
    // verifyPanel no sigue la convención "targetForm", se maneja por id
    const panelTarget = panel.id === 'verifyPanel' ? 'verify' : panel.id.replace('Form', '');
    panel.classList.toggle('active', panelTarget === target);
  });
  clearMessages();
}

// Correo pendiente de verificación (se guarda al registrar)
let pendingVerifyEmail = '';

// ==========================================
// REGISTRO
// ==========================================
async function handleRegister(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);

  const payload = {
    nombre: String(data.get('name') || '').trim(),
    correo: String(data.get('email') || '').trim(),
    contrasena: String(data.get('password') || '').trim(),
    fecha_nacimiento: String(data.get('fecha_nacimiento') || '').trim()
  };

  const message = document.getElementById('registerMessage');

  if (!payload.nombre || !payload.correo || payload.contrasena.length < 6 || !payload.fecha_nacimiento) {
    setMessage(message, 'Completa todos los campos y usa al menos 6 caracteres en la contraseña.', 'error');
    return;
  }

  try {
    const respuesta = await fetch('/auth/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const json = await respuesta.json();

    if (!respuesta.ok) {
        throw new Error(json.detail || 'Error al registrarse');
    }

    // Guardar el correo para la verificación
    pendingVerifyEmail = payload.correo;
    localStorage.setItem('nombre_usuario', payload.nombre);
    localStorage.setItem('pending_verify_email', payload.correo);

    // Si el backend indica que hay verificación pendiente, ir al panel de verificación
    if (json.verificacion_pendiente) {
      showVerifyPanel(payload.correo);
    } else {
      // Caso fallback: si no requiere verificación, ir al login
      setMessage(message, 'Registro exitoso. Inicia sesión.', 'success');
      switchTab('login');
    }
  } catch (error) {
    setMessage(message, error.message, 'error');
  }
}

// ==========================================
// VERIFICACIÓN DE CUENTA
// ==========================================

/**
 * Muestra el panel de verificación con el correo indicado
 */
function showVerifyPanel(correo) {
  pendingVerifyEmail = correo;
  const emailDisplay = document.getElementById('verifyEmailDisplay');
  if (emailDisplay) {
    emailDisplay.textContent = correo;
  }

  // Limpiar inputs de código
  const digits = document.querySelectorAll('.code-digit');
  digits.forEach(d => {
    d.value = '';
    d.classList.remove('filled', 'success', 'error-shake');
  });

  switchTab('verify');

  // Focus en el primer input
  setTimeout(() => {
    const first = document.querySelector('.code-digit[data-index="0"]');
    if (first) first.focus();
  }, 300);
}

/**
 * Configura los inputs de código OTP (auto-avance, paste, backspace)
 */
function setupCodeInputs() {
  const digits = document.querySelectorAll('.code-digit');

  digits.forEach((input, index) => {
    // Solo permitir números
    input.addEventListener('input', (e) => {
      const val = e.target.value.replace(/\D/g, '');
      e.target.value = val;

      if (val) {
        e.target.classList.add('filled');
        // Avanzar al siguiente
        if (index < digits.length - 1) {
          digits[index + 1].focus();
        }
      } else {
        e.target.classList.remove('filled');
      }
    });

    // Backspace: retroceder
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && index > 0) {
        digits[index - 1].focus();
        digits[index - 1].value = '';
        digits[index - 1].classList.remove('filled');
      }
      // Enter: verificar
      if (e.key === 'Enter') {
        handleVerify();
      }
    });

    // Paste: repartir los dígitos
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasteData = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
      pasteData.split('').forEach((char, i) => {
        if (digits[i]) {
          digits[i].value = char;
          digits[i].classList.add('filled');
        }
      });
      // Focus en el último dígito pegado o el siguiente vacío
      const focusIndex = Math.min(pasteData.length, digits.length - 1);
      digits[focusIndex].focus();
    });
  });
}

/**
 * Obtiene el código de los 6 inputs
 */
function getCodeFromInputs() {
  const digits = document.querySelectorAll('.code-digit');
  return Array.from(digits).map(d => d.value).join('');
}

/**
 * Envía el código de verificación al backend
 */
async function handleVerify() {
  const codigo = getCodeFromInputs();
  const message = document.getElementById('verifyMessage');
  const digits = document.querySelectorAll('.code-digit');

  if (codigo.length !== 6) {
    setMessage(message, 'Ingresa los 6 dígitos del código.', 'error');
    digits.forEach(d => d.classList.add('error-shake'));
    setTimeout(() => digits.forEach(d => d.classList.remove('error-shake')), 500);
    return;
  }

  const correo = pendingVerifyEmail || localStorage.getItem('pending_verify_email') || '';

  if (!correo) {
    setMessage(message, 'No se encontró el correo. Vuelve a registrarte.', 'error');
    return;
  }

  try {
    const respuesta = await fetch('/auth/verificar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo, codigo })
    });

    const json = await respuesta.json();

    if (!respuesta.ok) {
      throw new Error(json.detail || 'Código incorrecto.');
    }

    // Éxito: animación verde en los dígitos
    digits.forEach((d, i) => {
      setTimeout(() => d.classList.add('success'), i * 80);
    });

    setMessage(message, '¡Cuenta verificada! Redirigiendo al login...', 'success');
    localStorage.removeItem('pending_verify_email');

    setTimeout(() => {
      switchTab('login');
      const loginMsg = document.getElementById('loginMessage');
      setMessage(loginMsg, '¡Cuenta verificada! Ya puedes iniciar sesión.', 'success');
    }, 1500);

  } catch (error) {
    setMessage(message, error.message, 'error');
    digits.forEach(d => d.classList.add('error-shake'));
    setTimeout(() => digits.forEach(d => d.classList.remove('error-shake')), 500);
  }
}

/**
 * Reenvía el código de verificación
 */
async function handleResendCode() {
  const message = document.getElementById('verifyMessage');
  const btn = document.getElementById('resendCodeBtn');
  const correo = pendingVerifyEmail || localStorage.getItem('pending_verify_email') || '';

  if (!correo) {
    setMessage(message, 'No se encontró el correo. Vuelve a registrarte.', 'error');
    return;
  }

  // Deshabilitar botón temporalmente (30 segundos)
  btn.disabled = true;
  let countdown = 30;
  const originalText = btn.innerHTML;
  btn.innerHTML = `<i class="fa-solid fa-rotate-right"></i> Reenviar en ${countdown}s`;

  const interval = setInterval(() => {
    countdown--;
    btn.innerHTML = `<i class="fa-solid fa-rotate-right"></i> Reenviar en ${countdown}s`;
    if (countdown <= 0) {
      clearInterval(interval);
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }, 1000);

  try {
    const respuesta = await fetch('/auth/reenviar-codigo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo })
    });

    const json = await respuesta.json();

    if (!respuesta.ok) {
      throw new Error(json.detail || 'Error al reenviar el código.');
    }

    setMessage(message, 'Nuevo código enviado a tu correo.', 'success');
  } catch (error) {
    setMessage(message, error.message, 'error');
  }
}

// ==========================================
// LOGIN
// ==========================================
async function handleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);

  const payload = {
    correo: String(data.get('email') || '').trim(),
    contrasena: String(data.get('password') || '').trim()
  };

  const message = document.getElementById('loginMessage');

  if (!payload.correo || !payload.contrasena) {
    setMessage(message, 'Ingresa tu correo y contraseña.', 'error');
    return;
  }

  try {
    const respuesta = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const json = await respuesta.json();

    if (!respuesta.ok) {
      // Si la cuenta no está verificada, mostrar panel de verificación
      if (respuesta.status === 403 && json.detail && json.detail.includes('verificad')) {
        pendingVerifyEmail = payload.correo;
        localStorage.setItem('pending_verify_email', payload.correo);
        setMessage(message, 'Tu cuenta no está verificada. Revisa tu correo.', 'error');
        setTimeout(() => showVerifyPanel(payload.correo), 1200);
        return;
      }
      throw new Error(json.detail || 'Credenciales inválidas');
    }

    // Guardar token y datos del usuario
    localStorage.setItem('access_token', json.access_token);
    localStorage.setItem('nombre_usuario', json.user.nombre || payload.correo.split('@')[0]);
    localStorage.setItem('user_id', json.user.id);

    // Limpiar email de verificación pendiente
    localStorage.removeItem('pending_verify_email');

    setMessage(message, 'Inicio de sesión exitoso.', 'success');
    window.location.href = '/inicio';
  } catch (error) {
    setMessage(message, error.message, 'error');
  }
}

// ==========================================
// INICIALIZACIÓN
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
  // Tabs: login / register / verify
  document.querySelectorAll('[data-target]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.target;
      switchTab(target);
    });
  });

  // Forms
  const loginForm = document.getElementById('loginForm');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);

  const registerForm = document.getElementById('registerForm');
  if (registerForm) registerForm.addEventListener('submit', handleRegister);

  // Verificación
  const verifyBtn = document.getElementById('verifyBtn');
  if (verifyBtn) verifyBtn.addEventListener('click', handleVerify);

  const resendBtn = document.getElementById('resendCodeBtn');
  if (resendBtn) resendBtn.addEventListener('click', handleResendCode);

  setupCodeInputs();

  // Toggle password visibility
  document.querySelectorAll('[data-password-target]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.passwordTarget);
      const icon = button.querySelector('i');
      if (!input || !icon) return;
      
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      icon.className = isHidden ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
      button.setAttribute('aria-label', isHidden ? 'Ocultar contraseña' : 'Mostrar contraseña');
    });
  });

  // Si hay email pendiente de verificación, mostrar panel de verificación
  const pendingEmail = localStorage.getItem('pending_verify_email');
  if (pendingEmail) {
    showVerifyPanel(pendingEmail);
  } else {
    switchTab('login');
  }
});