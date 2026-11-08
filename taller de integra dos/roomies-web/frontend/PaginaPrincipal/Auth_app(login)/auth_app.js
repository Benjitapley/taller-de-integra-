function setMessage(element, text, type = 'success') {
  if (!element) return;
  element.textContent = text;
  element.classList.remove('success', 'error');
  element.classList.add(type);
}

function clearMessages() {
  ['loginMessage', 'registerMessage'].forEach((id) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = '';
      element.classList.remove('success', 'error');
    }
  });
}

function switchTab(target) {
  const panels = document.querySelectorAll('.form-panel');
  panels.forEach((panel) => {
    panel.classList.toggle('active', panel.id === target + 'Form');
  });
  clearMessages();
}

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

    // NUEVA LÍNEA: Guarda el nombre directamente en la memoria del navegador
    localStorage.setItem('nombre_usuario', payload.nombre);

    setMessage(message, 'Registro exitoso. Redirigiendo...', 'success');
    window.location.href = '/inicio';
  } catch (error) {
    setMessage(message, error.message, 'error');
  }
}

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
        throw new Error(json.detail || 'Credenciales inválidas');
    }

    localStorage.setItem('access_token', json.access_token);
    
    // CORREGIDO: Tu backend envía el nombre dentro de "user", así que usamos json.user.nombre
    localStorage.setItem('nombre_usuario', json.user.nombre || payload.correo.split('@')[0]);

    // NUEVA LÍNEA: Guardamos el ID dinámico exacto de quien inicia sesión
    localStorage.setItem('user_id', json.user.id);

    setMessage(message, 'Inicio de sesión exitoso.', 'success');
    window.location.href = '/inicio';
  } catch (error) {
    setMessage(message, error.message, 'error');
  }
}

// Esto es lo que hace que los botones reaccionen a los clics
window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-target]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.target;
      switchTab(target);
    });
  });

  const loginForm = document.getElementById('loginForm');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);

  const registerForm = document.getElementById('registerForm');
  if (registerForm) registerForm.addEventListener('submit', handleRegister);

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

  switchTab('login');
});