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
const viewerDownloadState = document.querySelector('#viewer-download-state');
const viewerDownloadLabel = document.querySelector('#viewer-download-label');
const viewerDownloadPercent = document.querySelector('#viewer-download-percent');
const viewerDownloadProgress = document.querySelector('#viewer-download-progress-fill');
const viewerPageIndicator = document.querySelector('#viewer-page-indicator');
const viewerReadingProgress = document.querySelector('.viewer-reading-progress');
const viewerReadingProgressFill = document.querySelector('#viewer-reading-progress-fill');
const viewerZoomOut = document.querySelector('#viewer-zoom-out');
const viewerZoomIn = document.querySelector('#viewer-zoom-in');
const OFFLINE_RENDER_CACHE = 'modul-viewer-rendered-v2';
const MAX_OFFLINE_PAGES = 30;
const MAX_PARALLEL_RENDERS = 2;
const MAX_CANVAS_PIXELS = 4_000_000;
const RENDER_DISTANCE = 5;
let offlineCacheQueue = Promise.resolve();
let activeRequest = 0;
let activePdfState = null;
let renderQueue = [];
let activeRenderCount = 0;
let currentPageNumber = 1;
let zoomLevel = 1;
let resizeTimer = null;
let scrollFrame = 0;

// --- UTILITAS ---

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Permintaan gagal (${response.status}).`);
  return response.json();
}

function refreshIcons() {
  if (globalThis.lucide) globalThis.lucide.createIcons();
}

// Buat URL sintetis same-origin sebagai kunci Cache API tanpa token streaming.
function offlineCacheUrl(id, suffix) {
  return new URL(`/offline-modul/${encodeURIComponent(String(id))}/${suffix}`, location.origin).href;
}

// Simpan metadata ringan modul agar halaman yang sudah dirender bisa ditemukan saat offline.
async function cacheOfflineMetadata(id, title, pageCount, sourceSize, pageRatio) {
  if (!('caches' in window)) return;
  const cache = await caches.open(OFFLINE_RENDER_CACHE);
  await cache.put(offlineCacheUrl(id, 'meta'), new Response(JSON.stringify({
    id, title, pageCount, sourceSize, pageRatio
  }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  }));
}

// Simpan maksimal 30 halaman pertama sebagai JPEG berkualitas 0.8 di bawah URL cache sintetis.
async function cacheRenderedPage(id, pageNumber, blob) {
  if (pageNumber > MAX_OFFLINE_PAGES || !('caches' in window)) return;
  const cache = await caches.open(OFFLINE_RENDER_CACHE);
  await cache.put(offlineCacheUrl(id, `page/${pageNumber}`), new Response(blob, {
    headers: { 'Content-Type': 'image/jpeg' }
  }));
}

// Proses konversi JPEG satu halaman demi satu halaman agar pekerjaan cache tidak menumpuk di ponsel.
function queueRenderedPage(id, pageNumber, canvas) {
  if (pageNumber > MAX_OFFLINE_PAGES) return;
  const blobPromise = new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas gagal dikonversi ke JPEG.'));
    }, 'image/jpeg', 0.8);
  });
  offlineCacheQueue = offlineCacheQueue
    .then(async () => cacheRenderedPage(id, pageNumber, await blobPromise))
    .catch(() => {});
}

// Baca metadata dan halaman raster, tanpa menyimpan PDF bertoken ke Cache API.
async function readCachedModule(id) {
  if (!('caches' in window)) return false;

  const cache = await caches.open(OFFLINE_RENDER_CACHE);
  const metadataResponse = await cache.match(offlineCacheUrl(id, 'meta'));
  if (!metadataResponse) return false;

  const metadata = await metadataResponse.json();
  const pageLimit = Math.min(Number(metadata.pageCount) || 0, MAX_OFFLINE_PAGES);
  if (pageLimit < 1) return false;
  const pages = await Promise.all(Array.from({ length: pageLimit }, async (_, index) => {
    const pageNumber = index + 1;
    const response = await cache.match(offlineCacheUrl(id, `page/${pageNumber}`));
    return response ? { pageNumber, response } : null;
  }));
  const cachedPages = pages.filter(Boolean);

  if (!cachedPages.length) return false;
  return { metadata, pages: cachedPages };
}

// Ukur ruang konten viewer setelah layout tampil agar render tidak memakai lebar nol.
async function getViewerContentWidth() {
  let viewerWidth = viewer.clientWidth;
  if (!viewerWidth) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    viewerWidth = viewer.clientWidth;
  }
  if (!viewerWidth) throw new Error('Area viewer belum memiliki lebar.');

  const style = window.getComputedStyle(viewer);
  const horizontalPadding = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
  const contentWidth = Math.floor(Math.min(viewerWidth - horizontalPadding, window.innerWidth));
  if (contentWidth <= 0) throw new Error('Lebar konten viewer tidak valid.');
  return contentWidth;
}

// Simpan metadata setelah antrean JPEG selesai dan hapus cache halaman yang sudah tidak berlaku.
function queueOfflineMetadata(id, title, pageCount, sourceSize, pageRatio) {
  if (!('caches' in window)) return;
  offlineCacheQueue = offlineCacheQueue
    .then(async () => {
      const cache = await caches.open(OFFLINE_RENDER_CACHE);
      const pageLimit = Math.min(pageCount, MAX_OFFLINE_PAGES);
      for (let pageNumber = pageLimit + 1; pageNumber <= MAX_OFFLINE_PAGES; pageNumber += 1) {
        await cache.delete(offlineCacheUrl(id, `page/${pageNumber}`));
      }
      await cacheOfflineMetadata(id, title, pageCount, sourceSize, pageRatio);
    })
    .catch(() => {});
}

function observePageShells(state) {
  state.observer?.disconnect();
  if (!('IntersectionObserver' in window)) {
    for (const pageNumber of state.pages.keys()) queuePageRender(state, pageNumber);
    return;
  }
  state.observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) queuePageRender(state, Number(entry.target.dataset.pageNumber));
    }
    scheduleScrollUpdate();
  }, { root: viewer, rootMargin: '600px 0px', threshold: 0 });
  for (const page of state.pages.values()) state.observer.observe(page.shell);
}

// Tampilkan raster cache untuk kunjungan instan tanpa membaca file PDF sumber dari cache.
async function renderCachedPage(state, page) {
  const bitmap = await createImageBitmap(await page.cachedResponse.blob());
  if (state.requestId !== activeRequest) {
    bitmap.close();
    return false;
  }
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.setAttribute('aria-label', `Halaman ${page.pageNumber} dari ${state.pageCount}`);
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  page.shell.append(canvas);
  page.placeholder.classList.add('hidden');
  page.canvas = canvas;
  page.status = 'rendered';
  if (page.pageNumber === 1) {
    viewerState.classList.add('hidden');
    viewerDownloadState.classList.add('hidden');
    endOpenTimer(state, 'first');
  }
  return true;
}

// Render PDF.js dengan DPR maksimum 2 dan batas empat juta piksel per halaman.
async function renderPdfPage(state, page) {
  if (page.cachedResponse && !state.forceNetwork) return renderCachedPage(state, page);
  if (!state.pdf) return false;
  const pdfPage = await state.pdf.getPage(page.pageNumber);
  if (state.requestId !== activeRequest) {
    pdfPage.cleanup();
    return false;
  }

  const baseViewport = pdfPage.getViewport({ scale: 1 });
  const cssWidth = (await getViewerContentWidth()) * zoomLevel;
  const viewport = pdfPage.getViewport({ scale: cssWidth / baseViewport.width });
  const deviceScale = Math.min(window.devicePixelRatio || 1, 2);
  const maxPixelScale = Math.sqrt(MAX_CANVAS_PIXELS / (viewport.width * viewport.height));
  const outputScale = Math.min(deviceScale, maxPixelScale);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { alpha: false });
  canvas.width = Math.ceil(viewport.width * outputScale);
  canvas.height = Math.ceil(viewport.height * outputScale);
  canvas.setAttribute('aria-label', `Halaman ${page.pageNumber} dari ${state.pageCount}`);
  page.shell.append(canvas);
  page.canvas = canvas;

  const task = pdfPage.render({
    canvasContext: context,
    viewport,
    transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0]
  });
  page.renderTask = task;
  try {
    await task.promise;
    if (state.requestId !== activeRequest) return false;
    page.placeholder.classList.add('hidden');
    page.status = 'rendered';
    if (page.pageNumber <= MAX_OFFLINE_PAGES) queueRenderedPage(state.id, page.pageNumber, canvas);
    if (page.pageNumber === 1) {
      viewerState.classList.add('hidden');
      viewerDownloadState.classList.add('hidden');
      endOpenTimer(state, 'first');
    }
    state.renderedSinceCleanup += 1;
    return true;
  } finally {
    page.renderTask = null;
    pdfPage.cleanup();
  }
}

function queuePageRender(state, pageNumber, priority = false) {
  const page = state.pages.get(pageNumber);
  if (!page || page.status !== 'idle') return Promise.resolve(false);
  page.status = 'queued';
  return new Promise((resolve) => {
    const job = { state, page, resolve };
    if (priority) renderQueue.unshift(job);
    else renderQueue.push(job);
    drainRenderQueue();
  });
}

function drainRenderQueue() {
  while (activeRenderCount < MAX_PARALLEL_RENDERS && renderQueue.length) {
    const { state, page, resolve } = renderQueue.shift();
    if (state.requestId !== activeRequest || page.status !== 'queued') {
      resolve(false);
      continue;
    }
    page.status = 'rendering';
    activeRenderCount += 1;
    renderPdfPage(state, page)
      .then(resolve)
      .catch((error) => {
        if (error?.name !== 'RenderingCancelledException' && state.requestId === activeRequest) {
          viewerStatus.textContent = `Halaman ${page.pageNumber} gagal dirender.`;
        }
        if (page.canvas) {
          page.canvas.width = 0;
          page.canvas.height = 0;
          page.canvas.remove();
          page.canvas = null;
        }
        page.status = 'idle';
        resolve(false);
      })
      .finally(() => {
        if (page.status === 'rendering') page.status = page.canvas ? 'rendered' : 'idle';
        activeRenderCount -= 1;
        if (activeRenderCount === 0 && state.pdf && state.renderedSinceCleanup >= 8) {
          state.renderedSinceCleanup = 0;
          state.pdf.cleanup().catch(() => {});
        }
        drainRenderQueue();
      });
  }
}

function releaseFarPages(state) {
  const keep = [];
  for (const job of renderQueue) {
    if (job.state === state && Math.abs(job.page.pageNumber - currentPageNumber) > RENDER_DISTANCE) {
      job.page.status = 'idle';
      job.resolve(false);
    } else keep.push(job);
  }
  renderQueue = keep;
  for (const page of state.pages.values()) {
    if (Math.abs(page.pageNumber - currentPageNumber) <= RENDER_DISTANCE) continue;
    if (page.renderTask) page.renderTask.cancel();
    if (page.canvas) {
      page.canvas.width = 0;
      page.canvas.height = 0;
      page.canvas.remove();
      page.canvas = null;
    }
    page.status = 'idle';
  }
}

function scheduleScrollUpdate() {
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0;
    const state = activePdfState;
    if (!state) return;
    const bounds = viewer.getBoundingClientRect();
    const center = bounds.top + viewer.clientHeight / 2;
    let nearest = currentPageNumber;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const page of state.pages.values()) {
      const pageBounds = page.shell.getBoundingClientRect();
      const distance = Math.abs((pageBounds.top + pageBounds.bottom) / 2 - center);
      if (pageBounds.bottom >= bounds.top && pageBounds.top <= bounds.bottom && distance < nearestDistance) {
        nearest = page.pageNumber;
        nearestDistance = distance;
      }
    }
    currentPageNumber = nearest;
    viewerPageIndicator.textContent = `${nearest} / ${state.pageCount}`;
    viewerPageIndicator.setAttribute('aria-label', `Halaman ${nearest} dari ${state.pageCount}`);
    const scrollRange = viewer.scrollHeight - viewer.clientHeight;
    const progress = scrollRange > 0 ? Math.min(100, (viewer.scrollTop / scrollRange) * 100) : 0;
    viewerReadingProgressFill.style.width = `${progress}%`;
    viewerReadingProgress.setAttribute('aria-valuenow', String(Math.round(progress)));
    const nearestBounds = state.pages.get(nearest)?.shell.getBoundingClientRect();
    if (nearestBounds?.height) {
      state.pageScrollFraction = Math.max(0, Math.min(1, (bounds.top - nearestBounds.top) / nearestBounds.height));
    }
    releaseFarPages(state);
    if (state.pages.get(nearest)?.status === 'idle') queuePageRender(state, nearest, true);
  });
}

function endOpenTimer(state, type) {
  if (state.timersEnded[type]) return;
  state.timersEnded[type] = true;
  console.timeEnd(state.timers[type]);
}

function updateDownloadProgress(loaded, total) {
  viewerDownloadState.classList.remove('hidden');
  viewerDownloadLabel.textContent = 'Mengunduh bagian PDF yang diperlukan...';
  const percent = total > 0 ? Math.min(99, Math.floor((loaded / total) * 100)) : 0;
  viewerDownloadPercent.textContent = `${percent}%`;
  viewerDownloadProgress.style.width = `${percent}%`;
  viewerDownloadProgress.parentElement.setAttribute('aria-valuenow', String(percent));
}

// Ambil metadata token baru dan gunakan byte range PDF.js tanpa menyimpan URL token.
async function fetchModulePdf(state, isBackground = false) {
  const metadata = await fetchJson(`/api/modul/${encodeURIComponent(state.id)}/meta`);
  if (!metadata.stream_url) throw new Error('URL streaming tidak tersedia.');
  if (state.requestId !== activeRequest) return null;
  state.metadata = metadata;

  const loadingTask = globalThis.pdfjsLib.getDocument({
    url: new URL(metadata.stream_url, location.origin).href,
    rangeChunkSize: 65536,
    disableAutoFetch: true,
    disableStream: false
  });
  state.loadingTask = loadingTask;
  loadingTask.onProgress = ({ loaded, total }) => {
    if (state.requestId !== activeRequest) return;
    if (total > 0) state.transferTotal = total;
    if (!isBackground) {
      updateDownloadProgress(loaded, total || Number(metadata.stream_size) || Number(metadata.file_size) || 0);
    }
  };

  const pdf = await loadingTask.promise;
  if (state.requestId !== activeRequest) {
    await loadingTask.destroy();
    return null;
  }
  state.pdf = pdf;
  state.sourceSize = state.transferTotal || Number(metadata.stream_size) || Number(metadata.file_size) || 0;
  return pdf;
}

function showViewerSkeleton() {
  viewerState.replaceChildren();
  viewerState.className = 'viewer-skeleton flex min-h-[60vh] w-full flex-col items-center justify-center gap-4 text-center text-text-muted';
  const page = document.createElement('div');
  page.className = 'skeleton-page w-full max-w-3xl';
  page.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  label.className = 'text-base';
  label.textContent = 'Menyiapkan dokumen...';
  viewerState.append(page, label);
  viewerState.classList.remove('hidden');
}

function buildPageShells(state, pageCount, pageRatio, cachedPages = []) {
  state.observer?.disconnect();
  state.pages = new Map();
  state.pageCount = pageCount;
  state.pageRatio = pageRatio;
  pdfPages.replaceChildren();
  pdfPages.style.width = `${zoomLevel * 100}%`;
  pdfPages.style.maxWidth = 'none';
  const cachedByNumber = new Map(cachedPages.map(({ pageNumber, response }) => [pageNumber, response]));

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const shell = document.createElement('section');
    shell.className = 'pdf-page-shell';
    shell.dataset.pageNumber = String(pageNumber);
    shell.style.aspectRatio = String(pageRatio);
    shell.style.width = '100%';
    shell.setAttribute('aria-label', `Halaman ${pageNumber}`);
    const placeholder = document.createElement('div');
    placeholder.className = 'pdf-page-placeholder';
    placeholder.setAttribute('aria-hidden', 'true');
    placeholder.textContent = `Halaman ${pageNumber}`;
    shell.append(placeholder);
    const page = {
      pageNumber,
      shell,
      placeholder,
      cachedResponse: cachedByNumber.get(pageNumber) || null,
      canvas: null,
      renderTask: null,
      status: 'idle'
    };
    state.pages.set(pageNumber, page);
    pdfPages.append(shell);
  }

  viewerPageIndicator.textContent = `1 / ${pageCount}`;
  viewerPageIndicator.setAttribute('aria-label', `Halaman 1 dari ${pageCount}`);
  observePageShells(state);
  updateZoomButtons();
}

async function loadPageRatio(pdf) {
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const ratio = viewport.width / viewport.height;
  page.cleanup();
  return ratio;
}

// Pasang PDF.js lazy renderer ke state yang sudah menampilkan halaman dari cache.
async function attachPdfInBackground(state, cachedModule) {
  try {
    const pdf = await fetchModulePdf(state, true);
    if (!pdf || state.requestId !== activeRequest) return;
    const sourceSize = state.transferTotal || Number(state.metadata.stream_size)
      || cachedModule.metadata.sourceSize || Number(state.metadata.file_size) || 0;
    const pageRatio = await loadPageRatio(pdf);
    const changed = pdf.numPages !== state.pageCount
      || (sourceSize > 0 && cachedModule.metadata.sourceSize > 0 && sourceSize !== cachedModule.metadata.sourceSize);

    if (changed) {
      state.forceNetwork = true;
      buildPageShells(state, pdf.numPages, pageRatio);
      currentPageNumber = 1;
      queuePageRender(state, 1, true);
      viewerStatus.textContent = 'Dokumen diperbarui; halaman terbaru sedang dimuat.';
    } else {
      state.pageCount = pdf.numPages;
      state.sourceSize = sourceSize;
      observePageShells(state);
      queuePageRender(state, currentPageNumber, true);
    }
    queueOfflineMetadata(state.id, state.title, pdf.numPages, sourceSize, pageRatio);
    endOpenTimer(state, 'total');
    scheduleScrollUpdate();
  } catch {
    if (state.requestId === activeRequest) {
      viewerStatus.textContent = 'Dokumen dibuka dari cache; pembaruan jaringan tidak tersedia.';
    }
  }
}

// Ukur waktu sampai PDF proxy siap; console.timeEnd first-page dicatat saat halaman pertama tampil.
async function openModule(id, title) {
  katalogSection.classList.add('hidden');
  viewerSection.classList.remove('hidden');
  viewerSection.classList.add('flex');
  viewerTitle.textContent = title;

  const requestId = ++activeRequest;
  disposeActiveDocument();
  currentPageNumber = 1;
  viewer.scrollTop = 0;
  pdfPages.replaceChildren();
  viewerStatus.textContent = '';
  viewerReadingProgressFill.style.width = '0%';
  viewerReadingProgress.setAttribute('aria-valuenow', '0');
  showViewerSkeleton();
  viewerDownloadLabel.textContent = 'Menyiapkan dokumen...';
  viewerDownloadPercent.textContent = '0%';
  viewerDownloadProgress.style.width = '0%';
  viewerDownloadState.classList.remove('hidden');

  const state = {
    id,
    title,
    requestId,
    pdf: null,
    loadingTask: null,
    observer: null,
    metadata: null,
    pages: new Map(),
    pageCount: 0,
    pageRatio: 0.707,
    sourceSize: 0,
    transferTotal: 0,
    forceNetwork: false,
    renderedSinceCleanup: 0,
    timers: { first: `pdf-first-page-${requestId}`, total: `pdf-document-ready-${requestId}` },
    timersEnded: {}
  };
  activePdfState = state;
  console.time(state.timers.first);
  console.time(state.timers.total);

  try {
    const cachedModule = await readCachedModule(id);
    if (requestId !== activeRequest) return;
    if (cachedModule?.pages.some(({ pageNumber }) => pageNumber === 1)) {
      const pageOne = cachedModule.pages.find(({ pageNumber }) => pageNumber === 1);
      let pageRatio = Number(cachedModule.metadata.pageRatio) || 0;
      if (!pageRatio) {
        const bitmap = await createImageBitmap(await pageOne.response.blob());
        pageRatio = bitmap.width / bitmap.height;
        bitmap.close();
      }
      state.sourceSize = Number(cachedModule.metadata.sourceSize) || 0;
      buildPageShells(state, Number(cachedModule.metadata.pageCount), pageRatio, cachedModule.pages);
      viewerTitle.textContent = cachedModule.metadata.title || title;
      viewerStatus.textContent = 'Dibuka dari cache; memeriksa pembaruan...';
      const cacheRendered = await queuePageRender(state, 1, true);
      if (requestId !== activeRequest) return;
      if (cacheRendered && state.pages.get(1)?.status === 'rendered') {
        endOpenTimer(state, 'total');
        viewer.focus();
        void attachPdfInBackground(state, cachedModule);
        return;
      }
      viewerStatus.textContent = 'Cache halaman tidak dapat dibaca; memuat ulang dari jaringan.';
    }
  } catch {
    // Cache tidak tersedia atau rusak; lanjutkan dengan PDF.js melalui jaringan.
  }

  if (requestId !== activeRequest) return;
  try {
    const pdf = await fetchModulePdf(state);
    if (!pdf || requestId !== activeRequest) return;
    const pageRatio = await loadPageRatio(pdf);
    buildPageShells(state, pdf.numPages, pageRatio);
    queueOfflineMetadata(id, title, pdf.numPages, state.transferTotal || state.sourceSize, pageRatio);
    endOpenTimer(state, 'total');
    viewerStatus.textContent = `Memuat halaman 1 dari ${pdf.numPages}...`;
    await queuePageRender(state, 1, true);
    if (requestId === activeRequest) viewer.focus();
  } catch (error) {
    if (requestId !== activeRequest) return;
    viewerDownloadState.classList.add('hidden');
    setViewerState('alert-circle', 'Modul gagal ditampilkan.', error.message);
  }
}

function updateZoomButtons() {
  viewerZoomOut.disabled = zoomLevel <= 0.8;
  viewerZoomIn.disabled = zoomLevel >= 2;
}

function scheduleResizeRender(restoreFraction = null) {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const state = activePdfState;
    if (!state) return;
    pdfPages.style.width = `${zoomLevel * 100}%`;
    pdfPages.style.maxWidth = 'none';
    for (const page of state.pages.values()) {
      page.shell.style.width = '100%';
      if (page.renderTask) page.renderTask.cancel();
      if (page.canvas) {
        page.canvas.width = 0;
        page.canvas.height = 0;
        page.canvas.remove();
        page.canvas = null;
      }
      page.status = 'idle';
    }
    const anchor = state.pages.get(currentPageNumber);
    if (anchor) {
      const fraction = restoreFraction ?? state.pageScrollFraction ?? 0;
      const viewerBounds = viewer.getBoundingClientRect();
      const pageBounds = anchor.shell.getBoundingClientRect();
      const pageTopInContent = pageBounds.top - viewerBounds.top + viewer.scrollTop;
      viewer.scrollTop = pageTopInContent + fraction * anchor.shell.clientHeight;
    }
    observePageShells(state);
    queuePageRender(state, currentPageNumber, true);
    scheduleScrollUpdate();
  }, 200);
}

function changeZoom(delta) {
  const state = activePdfState;
  if (!state) return;
  zoomLevel = Math.max(0.8, Math.min(2, Math.round((zoomLevel + delta) * 10) / 10));
  updateZoomButtons();
  scheduleResizeRender(state.pageScrollFraction ?? 0);
}

function disposeActiveDocument() {
  if (!activePdfState) return;
  activePdfState.observer?.disconnect();
  for (const page of activePdfState.pages.values()) {
    try { page.renderTask?.cancel(); } catch {}
    if (page.canvas) {
      page.canvas.width = 0;
      page.canvas.height = 0;
    }
  }
  if (activePdfState.loadingTask) void activePdfState.loadingTask.destroy();
  else if (activePdfState.pdf) void activePdfState.pdf.destroy();
  activePdfState = null;
  for (const job of renderQueue) {
    job.page.status = 'idle';
    job.resolve(false);
  }
  renderQueue = [];
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
  renderCatalogSkeletons();
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
    moduleList.replaceChildren();
    moduleStatus.textContent = `Gagal memuat katalog: ${error.message}`;
  }
}

function renderCatalogSkeletons() {
  moduleList.replaceChildren();
  for (let index = 0; index < 4; index += 1) {
    const card = document.createElement('div');
    card.className = 'overflow-hidden rounded-lg border border-border-soft bg-white';
    const cover = document.createElement('div');
    cover.className = 'skeleton-page aspect-[3/4] w-full';
    const details = document.createElement('div');
    details.className = 'space-y-3 p-4';
    const title = document.createElement('div');
    title.className = 'h-4 w-3/4 rounded bg-bg-soft';
    const meta = document.createElement('div');
    meta.className = 'h-3 w-1/2 rounded bg-bg-soft';
    details.append(title, meta);
    card.append(cover, details);
    moduleList.append(card);
  }
}

// Fungsi pembantu untuk membuat gambar cover dari halaman 1 PDF
async function generateCoverThumbnail(id, status, container) {
  if (status !== 'ready') return; // Jangan render jika PDF belum siap
  let loadingTask;
  try {
    const metadata = await fetchJson(`/api/modul/${encodeURIComponent(id)}/meta`);
    if (!metadata.stream_url) return;

    loadingTask = globalThis.pdfjsLib.getDocument({
      url: new URL(metadata.stream_url, location.origin).href,
      rangeChunkSize: 65536,
      disableAutoFetch: true,
      disableStream: false
    });
    const pdf = await loadingTask.promise;
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
    page.cleanup();
    await pdf.cleanup();

    container.replaceChildren(canvas); // Ganti placeholder dengan gambar PDF asli
  } catch (err) {
    console.warn(`Gagal render cover untuk modul ${id}`, err);
    // Biarkan placeholder icon yang tampil
  } finally {
    if (loadingTask) await loadingTask.destroy().catch(() => {});
  }
}

// --- BUKA & RENDER VIEWER ---

// --- EVENT LISTENERS ---

btnBack.addEventListener('click', () => {
  activeRequest++; // Batalkan render jika masih berjalan
  disposeActiveDocument();
  viewerSection.classList.add('hidden');
  viewerSection.classList.remove('flex');
  katalogSection.classList.remove('hidden');
  viewerDownloadState.classList.add('hidden');
});

viewerZoomOut.addEventListener('click', () => changeZoom(-0.1));
viewerZoomIn.addEventListener('click', () => changeZoom(0.1));
viewer.addEventListener('scroll', scheduleScrollUpdate, { passive: true });
window.addEventListener('resize', scheduleResizeRender);
window.addEventListener('orientationchange', scheduleResizeRender);
if ('ResizeObserver' in window) {
  const viewerResizeObserver = new ResizeObserver(scheduleResizeRender);
  viewerResizeObserver.observe(viewer);
}

viewer.addEventListener('contextmenu', (event) => event.preventDefault());

document.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && (key === 's' || key === 'p')) {
    event.preventDefault();
  }
});

refreshIcons();
loadModules();
