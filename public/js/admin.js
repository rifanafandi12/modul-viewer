const dashboardApp = document.querySelector('#dashboard-app');
const adminWelcome = document.querySelector('#admin-welcome');
const moduleState = document.querySelector('#module-state');
const moduleTableWrap = document.querySelector('#module-table-wrap');
const moduleRows = document.querySelector('#module-rows');
const logoutButton = document.querySelector('#logout-button');
const logoutError = document.querySelector('#logout-error');

function formatFileSize(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) return '—';

  const units = ['B', 'KB', 'MB', 'GB'];
  const unitIndex = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  return `${(size / (1024 ** unitIndex)).toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function createStatusBadge(status) {
  const badge = document.createElement('span');
  badge.className = 'inline-flex rounded-lg px-2.5 py-1 text-xs font-medium';
  const labels = {
    ready: ['Siap', 'border border-brand-green/30 bg-white text-brand-green'],
    failed: ['Gagal', 'border border-brand-red/30 bg-white text-brand-red'],
    processing: ['Diproses', 'border border-border-soft bg-bg-soft text-text-muted'],
    pending: ['Menunggu', 'border border-border-soft bg-bg-soft text-text-muted']
  };
  const [label, classes] = labels[status] || ['Tidak diketahui', 'border border-border-soft bg-bg-soft text-text-muted'];
  badge.textContent = label;
  badge.className = `${badge.className} ${classes}`;
  return badge;
}

function renderModules(modules) {
  moduleRows.replaceChildren();

  for (const module of modules) {
    const row = document.createElement('tr');
    row.className = 'transition hover:bg-bg-soft/70';

    const titleCell = document.createElement('td');
    titleCell.className = 'max-w-sm px-5 py-4 font-medium text-text-main';
    titleCell.textContent = module.title || 'Tanpa judul';

    const statusCell = document.createElement('td');
    statusCell.className = 'px-5 py-4';
    statusCell.append(createStatusBadge(module.status));

    const sizeCell = document.createElement('td');
    sizeCell.className = 'whitespace-nowrap px-5 py-4 text-text-muted';
    sizeCell.textContent = formatFileSize(module.file_size);

    const actionCell = document.createElement('td');
    actionCell.className = 'whitespace-nowrap px-5 py-4 text-right';
    const catalogLink = document.createElement('a');
    catalogLink.href = '/';
    catalogLink.className = 'font-medium text-brand-blue hover:underline';
    catalogLink.textContent = 'Lihat katalog';
    actionCell.append(catalogLink);

    row.append(titleCell, statusCell, sizeCell, actionCell);
    moduleRows.append(row);
  }

  moduleState.classList.add('hidden');
  moduleTableWrap.classList.remove('hidden');
  if (globalThis.lucide) globalThis.lucide.createIcons();
}

async function loadModules() {
  moduleState.textContent = 'Memuat daftar modul…';
  moduleState.classList.remove('hidden');
  moduleTableWrap.classList.add('hidden');

  try {
    const response = await fetch('/api/modul', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error('Gagal memuat daftar modul.');
    const modules = await response.json();

    if (!Array.isArray(modules) || modules.length === 0) {
      moduleState.textContent = 'Belum ada modul untuk ditampilkan.';
      return;
    }

    renderModules(modules);
  } catch {
    moduleState.textContent = 'Daftar modul gagal dimuat. Muat ulang halaman untuk mencoba lagi.';
  }
}

async function initializeDashboard() {
  try {
    const response = await fetch('/api/auth/me', {
      credentials: 'same-origin',
      cache: 'no-store'
    });

    if (response.status === 401 || !response.ok) {
      window.location.replace('/login.html');
      return;
    }

    const { user } = await response.json();
    adminWelcome.textContent = user?.username ? `Masuk sebagai ${user.username}` : 'Administrator';
    dashboardApp.classList.remove('hidden');
    if (globalThis.lucide) globalThis.lucide.createIcons();
    await loadModules();
  } catch {
    window.location.replace('/login.html');
  }
}

logoutButton.addEventListener('click', async () => {
  logoutButton.disabled = true;
  logoutError.classList.add('hidden');
  try {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin'
    });
    if (!response.ok) throw new Error('Logout gagal.');
    window.location.replace('/login.html');
  } catch {
    logoutError.textContent = 'Logout gagal. Periksa koneksi lalu coba lagi.';
    logoutError.classList.remove('hidden');
    logoutButton.disabled = false;
  }
});

initializeDashboard();
