const katalogSection = document.querySelector('#katalog-section');
const viewerSection = document.querySelector('#viewer-section');
const btnBack = document.querySelector('#btn-back');
const viewerTitle = document.querySelector('#viewer-title');
const moduleList = document.querySelector('#module-list');
const moduleStatus = document.querySelector('#module-status');
const viewer = document.querySelector('#viewer');
const viewerStatus = document.querySelector('#viewer-status');
const viewerState = document.querySelector('#viewer-state');
const pdfPages = document.querySelector('#pdf-pages');
let activeRequest = 0;

// --- UTILITAS ---

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Permintaan gagal (${response.status}).`);
  return response.json();
}

function refreshIcons() {
  if (globalThis.lucide) globalThis.lucide.createIcons();
}

function formatDate(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

// --- STATE VIEWER ---

function setViewerState(iconName, message, detail = '') {
  viewerState.replaceChildren();
  viewerState.className = 'flex min-h-[60vh] flex-col items-center justify-center gap-2 text-center text-text-muted';
  
  if (iconName) {
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', iconName);
    icon.setAttribute('aria-hidden', 'true');
    icon.className = iconName === 'loader-2' ? 'viewer-spinner h-8 w-8 text-brand-blue' : 
                       iconName === 'alert-circle' ? 'h-10 w-10 text-brand-red' : 'h-10 w-10';
    viewerState.append(icon);
  }

  const label = document.createElement('p');
  label.className = 'font-medium text-lg mt-2';
  label.textContent = message;
  viewerState.append(label);

  if (detail) {
    const hint = document.createElement('p');
    hint.className = 'text-sm max-w-md';
    hint.textContent = detail;
    viewerState.append(hint);
  }
  refreshIcons();
}

// --- RENDER KATALOG ---

async function loadModules() {
  moduleStatus.textContent = 'Memuat katalog...';
  try {
    const modules = await fetchJson('/api/modul');
    moduleList.replaceChildren();
    moduleStatus.textContent = '';

    if (!Array.isArray(modules) || modules.length === 0) {
      moduleStatus.textContent = 'Belum ada modul.';
      return;
    }

    for (const modul of modules) {
      // Card Container
      const card = document.createElement('button');
      card.type = 'button';
      card.disabled = modul.status !== 'ready';
      card.className = 'group flex flex-col bg-white rounded-lg border border-border-soft overflow-hidden text-left transition-all duration-200 hover:border-brand-blue hover:shadow-md disabled:cursor-not-allowed disabled:opacity-75 focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2';
      card.addEventListener('click', () => openModule(modul.id, modul.title));

      // Area Cover
      const coverWrapper = document.createElement('div');
      coverWrapper.className = 'relative w-full aspect-[3/4] bg-bg-soft overflow-hidden flex items-center justify-center border-b border-border-soft';
      
      // Placeholder Icon (jika render PDF gagal/lambat)
      const placeholder = document.createElement('i');
      placeholder.setAttribute('data-lucide', 'file-text');
      placeholder.className = 'h-12 w-12 text-border-soft';
      coverWrapper.append(placeholder);

      // Container untuk Canvas PDF (Thumbnail)
      const canvasContainer = document.createElement('div');
      canvasContainer.className = 'absolute inset-0 w-full h-full flex items-center justify-center bg-white';
      coverWrapper.append(canvasContainer);

      // Badge Status (Overlay di pojok kanan atas cover)
      if (modul.status !== 'ready') {
        const badge = document.createElement('div');
        badge.className = 'absolute top-2 right-2 bg-brand-red text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm z-10 uppercase tracking-wider';
        badge.textContent = modul.status === 'failed' ? 'Gagal' : 'Proses';
        coverWrapper.append(badge);
      }

      // Area Info (Judul, Tag, Meta)
      const info = document.createElement('div');
      info.className = 'p-4 flex flex-col flex-1 gap-2';

      const title = document.createElement('h3');
      title.className = 'text-sm font-semibold text-text-main leading-snug line-clamp-2 group-hover:text-brand-blue transition-colors';
      title.textContent = modul.title;

      const tagRow = document.createElement('div');
      tagRow.className = 'flex items-center gap-1.5';
      const tag = document.createElement('span');
      tag.className = 'inline-flex items-center rounded bg-[#3B82F6] px-2 py-0.5 text-[11px] font-medium text-white';
      tag.textContent = 'Modul'; // Atau ambil dari field kategori di database nanti
      tagRow.append(tag);

      const metaRow = document.createElement('div');
      metaRow.className = 'flex items-center justify-between mt-auto pt-2';
      
      const views = document.createElement('div');
      views.className = 'flex items-center gap-1 text-xs text-text-muted';
      views.innerHTML = `<i data-lucide="eye" class="h-3.5 w-3.5"></i> <span>0</span>`; // Placeholder angka view
      
      const date = document.createElement('span');
      date.className = 'text-xs text-text-muted';
      date.textContent = formatDate(modul.created_at);

      metaRow.append(views, date);
      info.append(title, tagRow, metaRow);
      
      card.append(coverWrapper, info);
      moduleList.append(card);

      // Generate Cover Thumbnail Secara Async (Tidak memblokir UI)
      generateCoverThumbnail(modul.id, modul.status, canvasContainer);
    }
    refreshIcons();
  } catch (error) {
    moduleStatus.textContent = `Gagal memuat katalog: ${error.message}`;
  }
}

// Fungsi pembantu untuk membuat gambar cover dari halaman 1 PDF
async function generateCoverThumbnail(id, status, container) {
  if (status !== 'ready') return; // Jangan render jika PDF belum siap
  try {
    const metadata = await fetchJson(`/api/modul/${encodeURIComponent(id)}/meta`);
    if (!metadata.stream_url) return;

    const response = await fetch(metadata.stream_url);
    if (!response.ok) return;
    
    const arrayBuffer = await response.arrayBuffer();
    const pdf = await globalThis.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1); // Hanya ambil halaman 1

    // Render ke canvas ukuran rendah untuk performa
    const viewport = page.getViewport({ scale: 1 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    // Sesuaikan skala agar pas di container (maksimal lebar 400px untuk kualitas cukup)
    const scale = Math.min(400 / viewport.width, 1.5); 
    const scaledViewport = page.getViewport({ scale });
    
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;
    canvas.className = 'w-full h-full object-cover'; // Agar mengisi kotak 3:4

    await page.render({ canvasContext: context, viewport: scaledViewport }).promise;
    
    container.replaceChildren(canvas); // Ganti placeholder dengan gambar PDF asli
  } catch (err) {
    console.warn(`Gagal render cover untuk modul ${id}`, err);
    // Biarkan placeholder icon yang tampil
  }
}

// --- BUKA & RENDER VIEWER ---

async function openModule(id, title) {
  // Transisi UI
  katalogSection.classList.add('hidden');
  viewerSection.classList.remove('hidden');
  viewerSection.classList.add('flex');
  viewerTitle.textContent = title;
  
  const requestId = ++activeRequest;
  pdfPages.replaceChildren();
  setViewerState('loader-2', 'Memuat dokumen...');
  viewerStatus.textContent = '';

  try {
    const metadata = await fetchJson(`/api/modul/${encodeURIComponent(id)}/meta`);
    if (requestId !== activeRequest) return;
    if (!metadata.stream_url) throw new Error('URL streaming tidak tersedia.');

    const response = await fetch(metadata.stream_url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`PDF gagal diambil (${response.status}).`);
    
    const arrayBuffer = await response.arrayBuffer();
    const pdf = await globalThis.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    if (requestId !== activeRequest) return;

    // Sembunyikan state loading
    viewerState.classList.add('hidden');
    
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
    viewer.focus();
  } catch (error) {
    if (requestId !== activeRequest) return;
    pdfPages.replaceChildren();
    setViewerState('alert-circle', 'Modul gagal ditampilkan.', error.message);
  }
}

// --- EVENT LISTENERS ---

btnBack.addEventListener('click', () => {
  activeRequest++; // Batalkan render jika masih berjalan
  viewerSection.classList.add('hidden');
  viewerSection.classList.remove('flex');
  katalogSection.classList.remove('hidden');
});

viewer.addEventListener('contextmenu', (event) => event.preventDefault());

document.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && (key === 's' || key === 'p')) {
    event.preventDefault();
  }
});

refreshIcons();
loadModules();