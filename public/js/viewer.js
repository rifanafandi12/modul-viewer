const moduleList = document.querySelector('#module-list');
const moduleStatus = document.querySelector('#module-status');
const moduleCount = document.querySelector('#module-count');
const viewer = document.querySelector('#viewer');
const viewerStatus = document.querySelector('#viewer-status');
const viewerState = document.querySelector('#viewer-state');
const pdfPages = document.querySelector('#pdf-pages');
let activeRequest = 0;

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Permintaan gagal (${response.status}).`);
  }
  return response.json();
}

function refreshIcons() {
  if (globalThis.lucide) {
    globalThis.lucide.createIcons();
  }
}

function setViewerState(iconName, message, detail = '') {
  viewerState.replaceChildren();
  const isReady = iconName === 'check-circle';
  const isError = iconName === 'alert-circle';
  viewerState.className = isReady
    ? 'flex items-center justify-center gap-2 pb-4 text-sm text-brand-green'
    : 'flex min-h-[55vh] flex-col items-center justify-center gap-2 text-center text-text-muted';
  if (isError) {
    viewerState.classList.add('text-brand-red');
  }

  if (iconName) {
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', iconName);
    icon.setAttribute('aria-hidden', 'true');
    if (iconName === 'loader-2') {
      icon.className = 'viewer-spinner h-6 w-6 text-brand-blue';
    } else if (iconName === 'alert-circle') {
      icon.className = 'h-8 w-8 text-brand-red';
    } else if (iconName === 'check-circle') {
      icon.className = 'h-6 w-6 text-brand-green';
    } else {
      icon.className = 'h-10 w-10';
    }
    viewerState.append(icon);
  }

  const label = document.createElement('p');
  label.className = 'font-medium';
  label.textContent = message;
  viewerState.append(label);

  if (detail) {
    const hint = document.createElement('p');
    hint.className = 'text-sm';
    hint.textContent = detail;
    viewerState.append(hint);
  }

  refreshIcons();
}

function makeStatusBadge(status) {
  const configByStatus = {
    ready: { icon: 'check-circle', label: 'Siap', classes: 'bg-brand-green-lt text-brand-green' },
    failed: { icon: 'alert-circle', label: 'Gagal', classes: 'bg-brand-red-lt text-brand-red' },
    processing: { icon: 'loader', label: 'Diproses', classes: 'bg-bg-soft text-text-muted' },
    pending: { icon: 'loader', label: 'Menunggu', classes: 'bg-bg-soft text-text-muted' }
  };
  const config = configByStatus[status] || configByStatus.pending;
  const badge = document.createElement('span');
  badge.className = `inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs ${config.classes}`;

  const icon = document.createElement('i');
  icon.setAttribute('data-lucide', config.icon);
  icon.className = 'h-4 w-4';
  icon.setAttribute('aria-hidden', 'true');

  const label = document.createElement('span');
  label.textContent = config.label;
  badge.append(icon, label);
  return badge;
}

async function loadModules() {
  moduleStatus.replaceChildren();
  const loadingIcon = document.createElement('i');
  loadingIcon.setAttribute('data-lucide', 'loader-2');
  loadingIcon.className = 'viewer-spinner mr-2 inline-block h-4 w-4 align-[-3px]';
  loadingIcon.setAttribute('aria-hidden', 'true');
  moduleStatus.append(loadingIcon, document.createTextNode('Memuat daftar modul…'));
  refreshIcons();

  try {
    const modules = await fetchJson('/api/modul');
    moduleList.replaceChildren();
    moduleCount.textContent = String(Array.isArray(modules) ? modules.length : 0);

    if (!Array.isArray(modules) || modules.length === 0) {
      moduleStatus.textContent = 'Belum ada modul.';
      refreshIcons();
      setViewerState('folder-open', 'Belum ada modul.', 'Modul yang tersedia akan muncul di sini.');
      return;
    }

    moduleStatus.textContent = '';
    for (const modul of modules) {
      const item = document.createElement('li');
      const card = document.createElement('button');
      card.type = 'button';
      card.disabled = modul.status !== 'ready';
      card.className = 'flex w-full items-start gap-3 rounded-lg border border-border-soft bg-white p-3 text-left transition-colors duration-150 hover:border-brand-blue disabled:cursor-not-allowed disabled:opacity-70';

      const icon = document.createElement('i');
      icon.setAttribute('data-lucide', 'file-text');
      icon.className = 'mt-0.5 h-4 w-4 shrink-0 text-brand-blue';
      icon.setAttribute('aria-hidden', 'true');

      const content = document.createElement('span');
      content.className = 'flex min-w-0 flex-1 flex-col gap-2';

      const title = document.createElement('span');
      title.className = 'truncate text-sm font-medium text-text-main';
      title.textContent = modul.title;

      const badgeRow = document.createElement('span');
      badgeRow.className = 'flex';
      badgeRow.append(makeStatusBadge(modul.status));
      content.append(title, badgeRow);
      card.append(icon, content);
      card.addEventListener('click', () => openModule(modul.id, modul.title));
      item.append(card);
      moduleList.append(item);
    }

    refreshIcons();
  } catch (error) {
    moduleCount.textContent = '0';
    moduleStatus.replaceChildren();
    const errorIcon = document.createElement('i');
    errorIcon.setAttribute('data-lucide', 'alert-circle');
    errorIcon.className = 'mr-1 inline-block h-4 w-4 align-[-3px] text-brand-red';
    errorIcon.setAttribute('aria-hidden', 'true');
    moduleStatus.append(errorIcon, document.createTextNode(`Daftar modul gagal dimuat: ${error.message}`));
    refreshIcons();
  }
}

async function openModule(id, title) {
  const requestId = ++activeRequest;
  pdfPages.replaceChildren();
  setViewerState('loader-2', `Memuat "${title}"…`);
  viewerStatus.textContent = '';

  try {
    const metadata = await fetchJson(`/api/modul/${encodeURIComponent(id)}/meta`);
    if (requestId !== activeRequest) return;
    if (!metadata.stream_url) {
      throw new Error('URL streaming tidak tersedia.');
    }

    const response = await fetch(metadata.stream_url, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`PDF gagal diambil (${response.status}).`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const pdf = await globalThis.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    if (requestId !== activeRequest) return;

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const availableWidth = Math.max(280, viewer.clientWidth - 64);
      const viewport = page.getViewport({ scale: availableWidth / baseViewport.width });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      canvas.setAttribute('aria-label', `Halaman ${pageNumber} dari ${pdf.numPages}`);
      pdfPages.append(canvas);
      await page.render({ canvasContext: context, viewport }).promise;
      if (requestId !== activeRequest) {
        pdfPages.replaceChildren();
        return;
      }
    }

    setViewerState('check-circle', `${pdf.numPages} halaman siap dibaca.`);
    viewerStatus.textContent = title;
    viewer.focus();
  } catch (error) {
    if (requestId !== activeRequest) return;
    pdfPages.replaceChildren();
    setViewerState('alert-circle', 'Modul gagal ditampilkan.', error.message);
    viewerStatus.textContent = '';
  }
}

// Blokir klik kanan HANYA di area viewer
viewer.addEventListener('contextmenu', (event) => event.preventDefault());

// Blokir Ctrl/Cmd+S/P di seluruh dokumen (bukan hanya viewer)
document.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && (key === 's' || key === 'p')) {
    event.preventDefault();
  }
});

refreshIcons();
loadModules();