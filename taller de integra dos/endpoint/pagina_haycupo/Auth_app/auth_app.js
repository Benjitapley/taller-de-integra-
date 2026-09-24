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

async function handleRegister(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);

  const payload = {
    name: String(data.get('name') || '').trim(),
    email: String(data.get('email') || '').trim(),
    password: String(data.get('password') || '').trim()
  };

  const message = document.getElementById('registerMessage');

  if (!payload.name || !payload.email || payload.password.length < 6) {
    setMessage(message, 'Completa todos los campos y usa al menos 6 caracteres en la contraseña.', 'error');
    return;
  }

  try {
    await mockApi.register(payload);
    resetAuthForms();
    switchTab('login');
    document.getElementById('loginEmail').focus();
  } catch (error) {
    setMessage(message, error.message || 'No se pudo registrar.', 'error');
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);

  const payload = {
    email: String(data.get('email') || '').trim(),
    password: String(data.get('password') || '').trim()
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
