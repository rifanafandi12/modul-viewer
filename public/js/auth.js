const loginForm = document.querySelector('#login-form');
const loginError = document.querySelector('#login-error');
const loginSubmit = document.querySelector('#login-submit');
const loginSubmitLabel = document.querySelector('#login-submit-label');

if (globalThis.lucide) globalThis.lucide.createIcons();

function showLoginError(message) {
  loginError.textContent = message;
  loginError.classList.remove('hidden');
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.textContent = '';
  loginError.classList.add('hidden');
  loginSubmit.disabled = true;
  loginSubmitLabel.textContent = 'Memeriksa…';

  const formData = new FormData(loginForm);

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: formData.get('username'),
        password: formData.get('password')
      })
    });

    if (response.status === 401) {
      showLoginError('Username atau password salah.');
      return;
    }

    if (!response.ok) {
      showLoginError('Login belum dapat diproses. Coba lagi beberapa saat.');
      return;
    }

    window.location.replace('/admin/');
  } catch {
    showLoginError('Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.');
  } finally {
    loginSubmit.disabled = false;
    loginSubmitLabel.textContent = 'Masuk';
  }
});

fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' })
  .then((response) => {
    if (response.ok) window.location.replace('/admin/');
  })
  .catch(() => {});
