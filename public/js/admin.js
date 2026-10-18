const dashboardApp = document.querySelector('#dashboard-app');
const adminWelcome = document.querySelector('#admin-welcome');
const moduleState = document.querySelector('#module-state');
const moduleTableWrap = document.querySelector('#module-table-wrap');
const moduleRows = document.querySelector('#module-rows');
const logoutButton = document.querySelector('#logout-button');
const logoutError = document.querySelector('#logout-error');
const moduleFeedback = document.querySelector('#module-feedback');
const openUploadButton = document.querySelector('#open-upload-button');
const uploadDialog = document.querySelector('#upload-dialog');
const uploadForm = document.querySelector('#upload-form');
const uploadTitle = document.querySelector('#upload-title');
const uploadFile = document.querySelector('#upload-file');
const uploadDropzone = document.querySelector('#upload-dropzone');
const uploadFileName = document.querySelector('#upload-file-name');
const uploadError = document.querySelector('#upload-error');
const uploadProgressSection = document.querySelector('#upload-progress-section');
const uploadProgress = document.querySelector('#upload-progress');
const uploadProgressFill = document.querySelector('#upload-progress-fill');
const uploadProgressLabel = document.querySelector('#upload-progress-label');
const uploadProgressValue = document.querySelector('#upload-progress-value');
const submitUploadButton = document.querySelector('#submit-upload-button');
const submitUploadLabel = document.querySelector('#submit-upload-label');
const closeUploadButton = document.querySelector('#close-upload-button');
const cancelUploadButton = document.querySelector('#cancel-upload-button');
const openSettingsButton = document.querySelector('#open-settings-button');
const settingsDialog = document.querySelector('#settings-dialog');
const settingsForm = document.querySelector('#settings-form');
const compressionLevelInput = document.querySelector('#compression-level');
const settingsFeedback = document.querySelector('#settings-feedback');
const cancelSettingsButton = document.querySelector('#cancel-settings-button');
const saveSettingsButton = document.querySelector('#save-settings-button');
const saveSettingsLabel = document.querySelector('#save-settings-label');

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
    processing: ['Processing', 'border border-brand-blue/30 bg-white text-brand-blue'],
    pending: ['Pending', 'border border-border-soft bg-bg-soft text-text-muted']
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
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.dataset.deleteModule = module.id;
    deleteButton.dataset.moduleTitle = module.title || 'modul ini';
    deleteButton.className = 'inline-flex h-9 w-9 items-center justify-center rounded-lg text-text-muted transition hover:bg-bg-soft hover:text-brand-red focus:outline-none focus:ring-2 focus:ring-brand-blue disabled:cursor-not-allowed disabled:opacity-60';
    deleteButton.setAttribute('aria-label', `Hapus ${module.title || 'modul'}`);
    deleteButton.title = 'Hapus modul';
    const deleteIcon = document.createElement('i');
    deleteIcon.setAttribute('data-lucide', 'trash-2');
    deleteIcon.className = 'h-4 w-4';
    deleteIcon.setAttribute('aria-hidden', 'true');
    deleteButton.append(deleteIcon);
    actionCell.append(deleteButton);

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

function setUploadProgress(percent, label) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  uploadProgressFill.style.width = `${value}%`;
  uploadProgress.setAttribute('aria-valuenow', String(value));
  uploadProgressValue.textContent = `${value}%`;
  if (label) uploadProgressLabel.textContent = label;
}

function displayUploadError(message) {
  uploadError.textContent = message;
  uploadError.classList.remove('hidden');
}

function displaySettingsFeedback(message, isError = false) {
  settingsFeedback.textContent = message;
  settingsFeedback.className = `mt-4 rounded-lg border px-3 py-2.5 text-sm ${isError
    ? 'border-brand-red/30 bg-white text-brand-red'
    : 'border-brand-green/30 bg-white text-text-main'}`;
}

async function loadCompressionSetting() {
  settingsFeedback.classList.add('hidden');
  compressionLevelInput.disabled = true;
  saveSettingsButton.disabled = true;
  let loaded = false;
  try {
    const response = await fetch('/api/settings', {
      credentials: 'same-origin',
      cache: 'no-store'
    });
    if (response.status === 401) {
      window.location.replace('/login.html');
      return;
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Pengaturan gagal dimuat.');
    compressionLevelInput.value = result.compression_level;
    loaded = true;
  } catch (error) {
    displaySettingsFeedback(error.message || 'Pengaturan gagal dimuat.', true);
  } finally {
    compressionLevelInput.disabled = false;
    saveSettingsButton.disabled = !loaded;
  }
}

async function saveCompressionSetting(event) {
  event.preventDefault();
  saveSettingsButton.disabled = true;
  compressionLevelInput.disabled = true;
  saveSettingsLabel.textContent = 'Menyimpan…';
  settingsFeedback.classList.add('hidden');

  try {
    const response = await fetch('/api/settings', {
      method: 'PATCH',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ compression_level: compressionLevelInput.value })
    });
    if (response.status === 401) {
      window.location.replace('/login.html');
      return;
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Pengaturan gagal disimpan.');
    compressionLevelInput.value = result.compression_level;
    displaySettingsFeedback('Level kompresi berhasil disimpan.');
  } catch (error) {
    displaySettingsFeedback(error.message || 'Pengaturan gagal disimpan.', true);
  } finally {
    saveSettingsButton.disabled = false;
    compressionLevelInput.disabled = false;
    saveSettingsLabel.textContent = 'Simpan pengaturan';
  }
}

function validateSelectedFile(file) {
  if (!file) return 'Pilih file modul terlebih dahulu.';
  if (file.size > 20 * 1024 * 1024) return 'Ukuran file maksimal 20 MB.';
  const extension = file.name.split('.').pop().toLowerCase();
  if (!['pdf', 'doc', 'docx', 'ppt', 'pptx'].includes(extension)) {
    return 'Pilih file PDF, Word, atau PowerPoint.';
  }
  return '';
}

function requestModuleUpload(formData, onProgress) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', '/api/modul');
    request.withCredentials = true;
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress((event.loaded / event.total) * 100);
    });
    request.addEventListener('load', () => {
      let data = {};
      try {
        data = JSON.parse(request.responseText);
      } catch {
        data = {};
      }

      if (request.status >= 200 && request.status < 300) return resolve(data);
      const error = new Error(data.error || 'Upload gagal. Silakan coba lagi.');
      error.status = request.status;
      reject(error);
    });
    request.addEventListener('error', () => reject(new Error('Koneksi terputus saat mengunggah file.')));
    request.addEventListener('abort', () => reject(new Error('Upload dibatalkan.')));
    request.send(formData);
  });
}

function resetUploadDialog() {
  uploadForm.reset();
  uploadFileName.textContent = 'PDF, DOC, DOCX, PPT, PPTX · maksimal 20 MB';
  uploadError.textContent = '';
  uploadError.classList.add('hidden');
  uploadProgressSection.classList.add('hidden');
  setUploadProgress(0, 'Mengunggah…');
  uploadDropzone.classList.remove('border-brand-blue', 'bg-white');
}

function openUploadModal() {
  resetUploadDialog();
  uploadDialog.showModal();
  if (globalThis.lucide) globalThis.lucide.createIcons();
  uploadTitle.focus();
}

async function deleteModule(moduleId, title, button) {
  if (!window.confirm(`Hapus modul “${title}” beserta file aslinya?`)) return;

  button.disabled = true;
  moduleFeedback.classList.add('hidden');
  try {
    const response = await fetch(`/api/modul/${encodeURIComponent(moduleId)}`, {
      method: 'DELETE',
      credentials: 'same-origin',
      cache: 'no-store'
    });
    if (response.status === 401) {
      window.location.replace('/login.html');
      return;
    }
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || 'Modul gagal dihapus.');
    }

    await loadModules();
    moduleFeedback.textContent = `Modul “${title}” berhasil dihapus.`;
    moduleFeedback.classList.remove('hidden');
  } catch (error) {
    moduleFeedback.textContent = error.message || 'Modul gagal dihapus. Periksa koneksi lalu coba lagi.';
    moduleFeedback.classList.remove('hidden');
    button.disabled = false;
  }
}

openUploadButton.addEventListener('click', openUploadModal);
openSettingsButton.addEventListener('click', () => {
  settingsDialog.showModal();
  if (globalThis.lucide) globalThis.lucide.createIcons();
  loadCompressionSetting();
});
cancelSettingsButton.addEventListener('click', () => settingsDialog.close());
settingsForm.addEventListener('submit', saveCompressionSetting);
closeUploadButton.addEventListener('click', () => uploadDialog.close());
cancelUploadButton.addEventListener('click', () => uploadDialog.close());
uploadDialog.addEventListener('click', (event) => {
  if (event.target === uploadDialog && !submitUploadButton.disabled) uploadDialog.close();
});

uploadFile.addEventListener('change', () => {
  const file = uploadFile.files[0];
  if (file) uploadFileName.textContent = `${file.name} · ${formatFileSize(file.size)}`;
});

uploadDropzone.addEventListener('dragover', (event) => {
  event.preventDefault();
  uploadDropzone.classList.add('border-brand-blue', 'bg-white');
});
uploadDropzone.addEventListener('dragleave', () => {
  uploadDropzone.classList.remove('border-brand-blue', 'bg-white');
});
uploadDropzone.addEventListener('drop', (event) => {
  event.preventDefault();
  uploadDropzone.classList.remove('border-brand-blue', 'bg-white');
  const [file] = event.dataTransfer.files;
  if (!file) return;
  const transfer = new DataTransfer();
  transfer.items.add(file);
  uploadFile.files = transfer.files;
  uploadFile.dispatchEvent(new Event('change', { bubbles: true }));
});

uploadDialog.addEventListener('cancel', (event) => {
  if (submitUploadButton.disabled) event.preventDefault();
});

uploadForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  uploadError.textContent = '';
  uploadError.classList.add('hidden');

  const title = uploadTitle.value.trim();
  const file = uploadFile.files[0];
  if (!title) return displayUploadError('Judul modul wajib diisi.');
  if (title.length > 255) return displayUploadError('Judul maksimal 255 karakter.');
  const fileError = validateSelectedFile(file);
  if (fileError) return displayUploadError(fileError);

  const formData = new FormData();
  formData.append('title', title);
  formData.append('file', file);

  submitUploadButton.disabled = true;
  closeUploadButton.disabled = true;
  cancelUploadButton.disabled = true;
  submitUploadLabel.textContent = 'Mengunggah…';
  uploadProgressSection.classList.remove('hidden');
  setUploadProgress(0, 'Mengunggah file…');

  try {
    await requestModuleUpload(formData, (progress) => setUploadProgress(progress, 'Mengunggah file…'));
    setUploadProgress(100, 'Upload selesai');
    uploadDialog.close();
    resetUploadDialog();
    await loadModules();
    moduleFeedback.textContent = 'Modul berhasil diunggah dan menunggu antrean kompresi.';
    moduleFeedback.classList.remove('hidden');
  } catch (error) {
    if (error.status === 401) {
      window.location.replace('/login.html');
      return;
    }
    displayUploadError(error.message || 'Upload gagal. Periksa koneksi lalu coba lagi.');
    setUploadProgress(0, 'Upload gagal');
  } finally {
    submitUploadButton.disabled = false;
    closeUploadButton.disabled = false;
    cancelUploadButton.disabled = false;
    submitUploadLabel.textContent = 'Unggah modul';
  }
});

moduleRows.addEventListener('click', (event) => {
  const button = event.target.closest('[data-delete-module]');
  if (!button) return;
  deleteModule(button.dataset.deleteModule, button.dataset.moduleTitle, button);
});

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
