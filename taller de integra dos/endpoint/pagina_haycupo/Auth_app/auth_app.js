const STORAGE_KEYS = {
  users: 'haycupo_users',
  currentUser: 'haycupo_current_user'
};

function readUsers() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.users) || '[]');
}

function writeUsers(users) {
  localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users));
}

function setMessage(element, text, type = 'success') {
  element.textContent = text;
  element.classList.remove('success', 'error');
  element.classList.add(type);
}

function clearMessages() {
  ['loginMessage', 'registerMessage', 'profileMessage'].forEach((id) => {
    const element = document.getElementById(id);
    if (!element) return;
    element.textContent = '';
    element.classList.remove('success', 'error');
  });
}

function resetAuthForms() {
  ['loginForm', 'registerForm'].forEach((id) => {
    const form = document.getElementById(id);
    if (form) form.reset();
  });
  document.querySelectorAll('[data-password-target]').forEach((button) => {
    const input = document.getElementById(button.dataset.passwordTarget);
    const icon = button.querySelector('i');
    if (input) input.type = 'password';
    if (icon) icon.className = 'fa-solid fa-eye';
    button.setAttribute('aria-label', 'Mostrar contraseña');
  });
  clearMessages();
}

const mockApi = {
  async register(payload) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const users = readUsers();
        const exists = users.some((user) => user.email.toLowerCase() === payload.email.toLowerCase());

        if (exists) {
          reject(new Error('Ya existe un usuario con ese correo.'));
          return;
        }

        const user = {
          id: Date.now(),
          name: payload.name,
          email: payload.email,
          password: payload.password,
          phone: '',
          city: '',
          bio: ''
        };

        users.push(user);
        writeUsers(users);
        localStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(user));
        resolve({ success: true, user });
      }, 400);
    });
  },

  async login(payload) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const users = readUsers();
        const user = users.find(
          (item) => item.email.toLowerCase() === payload.email.toLowerCase() && item.password === payload.password
        );

        if (!user) {
          reject(new Error('Credenciales incorrectas. Verifica tu correo y contraseña.'));
          return;
        }

        localStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(user));
        resolve({ success: true, user });
      }, 400);
    });
  },

  async updateProfile(payload) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const users = readUsers();
        const currentUser = JSON.parse(localStorage.getItem(STORAGE_KEYS.currentUser) || 'null');

        if (!currentUser) {
          reject(new Error('Debes iniciar sesión para actualizar el perfil.'));
          return;
        }

        const index = users.findIndex((user) => user.id === currentUser.id);
        if (index === -1) {
          reject(new Error('No se encontró el usuario actual.'));
          return;
        }

        const updatedUser = {
          ...users[index],
          name: payload.name,
          email: payload.email,
          phone: payload.phone,
          city: payload.city,
          bio: payload.bio
        };

        users[index] = updatedUser;
        writeUsers(users);
        localStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(updatedUser));
        resolve({ success: true, user: updatedUser });
      }, 400);
    });
  }
};

function switchTab(target) {
  const panels = document.querySelectorAll('.form-panel');
  panels.forEach((panel) => {
    panel.classList.toggle('active', panel.id === target + 'Form');
  });

  clearMessages();
}

function getInitials(name) {
  return String(name || 'U')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'U';
}

function showProfile(user) {
  const authSection = document.getElementById('authSection');
  const profileSection = document.getElementById('profileSection');

  if (!user) {
    authSection.classList.remove('hidden');
    profileSection.classList.add('hidden');
    return;
  }

  authSection.classList.add('hidden');
  profileSection.classList.remove('hidden');

  const initials = getInitials(user.name);
  document.getElementById('profileAvatar').textContent = initials;
  document.getElementById('profileTitle').textContent = user.name;
  document.getElementById('profileName').value = user.name;
  document.getElementById('profileEmail').value = user.email;
  document.getElementById('profilePhone').value = user.phone || '';
  document.getElementById('profileCity').value = user.city || '';
  document.getElementById('profileBio').value = user.bio || '';
}

// Rutas del mismo servidor FastAPI que sirve este HTML.
let registroPendiente = null;
let correoConfirmado = false;
let correoOcupado = false;

async function solicitarCorreo(ruta, datos) {
  let respuesta;
  try {
    respuesta = await fetch(`/api/correo/${ruta}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor. Revisa que FastAPI esté iniciado.');
  }
  let resultado;
  try { resultado = await respuesta.json(); }
  catch { throw new Error('Abre esta página desde FastAPI; el servidor no devolvió JSON.'); }
  if (!respuesta.ok) {
    throw new Error(typeof resultado.detail === 'string'
      ? resultado.detail : 'Revisa el correo y el código ingresados.');
  }
  return resultado;
}

function actualizarControlesCorreo() {
  const pendiente = Boolean(registroPendiente);
  ['registerName', 'registerEmail', 'registerPassword'].forEach(id => {
    document.getElementById(id).readOnly = pendiente || correoOcupado;
  });
  document.querySelector('#registerForm button[type="submit"]').disabled = pendiente || correoOcupado;
  document.getElementById('emailVerification').hidden = !pendiente;
  ['verifyCodeBtn', 'resendCodeBtn', 'changeEmailBtn'].forEach(id => {
    document.getElementById(id).disabled = correoOcupado;
  });
  document.getElementById('verificationCode').disabled = correoOcupado || correoConfirmado;
  document.getElementById('resendCodeBtn').disabled = correoOcupado || correoConfirmado;
}

async function handleRegister(event) {
  event.preventDefault();
  if (correoOcupado || registroPendiente) return;
  const form = event.currentTarget;
  const message = document.getElementById('registerMessage');
  const payload = {
    name: document.getElementById('registerName').value.trim(),
    email: document.getElementById('registerEmail').value.trim(),
    password: document.getElementById('registerPassword').value
  };
  if (!form.reportValidity() || !payload.name || payload.password.length < 6) {
    setMessage(message, 'Completa los campos y usa al menos 6 caracteres en la contraseña.', 'error');
    return;
  }
  correoOcupado = true;
  actualizarControlesCorreo();
  try {
    if (readUsers().some(user => user.email.toLowerCase() === payload.email.toLowerCase())) {
      throw new Error('Ya existe un usuario de prueba con ese correo.');
    }
    await solicitarCorreo('enviar-codigo', { correo: payload.email });
    registroPendiente = payload;
    correoConfirmado = false;
    setMessage(message, `Enviamos un código a ${payload.email}. Vence en 10 minutos.`);
  } catch (error) {
    setMessage(message, error.message, 'error');
  } finally {
    correoOcupado = false;
    actualizarControlesCorreo();
    if (registroPendiente) document.getElementById('verificationCode').focus();
  }
}

async function comprobarCorreo() {
  if (correoOcupado || !registroPendiente) return;
  const message = document.getElementById('registerMessage');
  const codigo = document.getElementById('verificationCode').value.trim();
  if (!correoConfirmado && !/^[0-9]{3}$/.test(codigo)) {
    setMessage(message, 'Ingresa los 3 números del código.', 'error');
    return;
  }
  correoOcupado = true;
  actualizarControlesCorreo();
  try {
    if (!correoConfirmado) {
      const resultado = await solicitarCorreo('verificar-codigo', {
        correo: registroPendiente.email, codigo
      });
      if (resultado.resultado !== 'CORRECTO' || resultado.verificado !== true) {
        throw new Error(resultado.mensaje || 'Código incorrecto o vencido.');
      }
      correoConfirmado = true;
    }
    // El registro original sigue siendo una demo local; no es autenticación real.
    await mockApi.register(registroPendiente);
    localStorage.removeItem(STORAGE_KEYS.currentUser);
    registroPendiente = null;
    correoConfirmado = false;
    resetAuthForms();
    switchTab('login');
    setMessage(document.getElementById('loginMessage'), 'Cuenta de prueba creada. Correo verificado correctamente.');
    document.getElementById('loginEmail').focus();
  } catch (error) {
    setMessage(message, error.message || 'No se pudo verificar el correo.', 'error');
  } finally {
    correoOcupado = false;
    actualizarControlesCorreo();
  }
}

async function reenviarCorreo() {
  if (correoOcupado || !registroPendiente || correoConfirmado) return;
  correoOcupado = true;
  actualizarControlesCorreo();
  const message = document.getElementById('registerMessage');
  try {
    await solicitarCorreo('enviar-codigo', { correo: registroPendiente.email });
    document.getElementById('verificationCode').value = '';
    setMessage(message, 'Nuevo código enviado. Usa el más reciente.');
  } catch (error) {
    setMessage(message, error.message, 'error');
  } finally {
    correoOcupado = false;
    actualizarControlesCorreo();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('verifyCodeBtn').addEventListener('click', comprobarCorreo);
  document.getElementById('resendCodeBtn').addEventListener('click', reenviarCorreo);
  document.getElementById('changeEmailBtn').addEventListener('click', () => {
    if (correoOcupado) return;
    registroPendiente = null;
    correoConfirmado = false;
    document.getElementById('verificationCode').value = '';
    actualizarControlesCorreo();
    setMessage(document.getElementById('registerMessage'), 'Edita tus datos y vuelve a pulsar Registrarse.');
    document.getElementById('registerEmail').focus();
  });
  document.getElementById('verificationCode').addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); comprobarCorreo(); }
  });
  actualizarControlesCorreo();
});


async function handleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);

  const payload = {
    email: String(data.get('email') || '').trim(),
    password: String(data.get('password') || '')
  };

  const message = document.getElementById('loginMessage');

  if (!payload.email || !payload.password) {
    setMessage(message, 'Ingresa tu correo y contraseña.', 'error');
    return;
  }

  try {
    await mockApi.login(payload);
    form.reset();
    setMessage(message, 'Inicio de sesión exitoso.', 'success');
    window.location.href = 'hayCupo.html';
  } catch (error) {
    setMessage(message, error.message || 'Credenciales inválidas.', 'error');
  }
}

async function handleProfileUpdate(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);

  const payload = {
    name: String(data.get('name') || '').trim(),
    email: String(data.get('email') || '').trim(),
    phone: String(data.get('phone') || '').trim(),
    city: String(data.get('city') || '').trim(),
    bio: String(data.get('bio') || '').trim()
  };

  const message = document.getElementById('profileMessage');

  if (!payload.name || !payload.email) {
    setMessage(message, 'Nombre y correo son obligatorios.', 'error');
    return;
  }

  try {
    const result = await mockApi.updateProfile(payload);
    setMessage(message, 'Perfil actualizado correctamente.', 'success');
    showProfile(result.user);
  } catch (error) {
    setMessage(message, error.message || 'No se pudo guardar el perfil.', 'error');
  }
}

function logout() {
  localStorage.removeItem(STORAGE_KEYS.currentUser);
  resetAuthForms();
  showProfile(null);
  switchTab('login');
}

window.addEventListener('DOMContentLoaded', () => {
  localStorage.removeItem(STORAGE_KEYS.currentUser);

  document.querySelectorAll('[data-target]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.target;
      switchTab(target);
    });
  });

  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('registerForm').addEventListener('submit', handleRegister);
  document.getElementById('profileForm').addEventListener('submit', handleProfileUpdate);
  document.getElementById('logoutBtn').addEventListener('click', logout);

  document.querySelectorAll('[data-password-target]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.passwordTarget);
      const icon = button.querySelector('i');
      const isHidden = input.type === 'password';

      input.type = isHidden ? 'text' : 'password';
      icon.className = isHidden ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
      button.setAttribute('aria-label', isHidden ? 'Ocultar contraseña' : 'Mostrar contraseña');
    });
  });

  resetAuthForms();
  showProfile(null);
  switchTab('login');
});

