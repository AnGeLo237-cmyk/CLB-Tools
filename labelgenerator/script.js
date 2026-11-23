// Script LabelGenerator : génération d'étiquettes PNG/SVG et interactions avec la bibliothèque.
(() => {
  'use strict';

  // Charge la configuration PWA afin de construire les URLs correctes selon le sous-dossier courant.
  const script = document.createElement('script');
  script.src = (window.location.pathname.includes('/codegenerator/') || 
                window.location.pathname.includes('/labelgenerator/') || 
                window.location.pathname.includes('/zimager/')) 
              ? '../pwa-config.php' 
              : 'pwa-config.php';
  document.head.appendChild(script);

  /* Constantes & limites : taille maximale, DPI min/max et timeout réseau. */
  const MAX_LOGO_BYTES = 4_000_000;
  const FETCH_TIMEOUT_MS = 12_000;
  const MIN_WIDTH_MM = 60;
  const MIN_HEIGHT_MM = 30;
  const MIN_DPI = 72;
  const MAX_DPI = 1200;

  /* Références aux éléments DOM : formulaire, boutons, aperçu et zone d'erreur. */
  const form = document.getElementById('labelForm');
  const previewBtn = document.getElementById('previewBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const printBtn = document.getElementById('printBtn');
  const saveLibraryBtn = document.getElementById('saveLibraryBtn');
  const errorMsg = document.getElementById('errorMsg');
  const labelPreview = document.getElementById('labelPreview');

  const barcodeFileInput = document.getElementById('barcodeFile');
  const qrFileInput = document.getElementById('qrFile');
  const barcodeThumb = document.getElementById('barcodePreviewThumb');
  const qrThumb = document.getElementById('qrPreviewThumb');
  const barcodeInputWrapper = document.getElementById('barcodeInput');
  const qrInputWrapper = document.getElementById('qrInput');
  const widthInput = document.getElementById('widthMm');
  const heightInput = document.getElementById('heightMm');
  const dpiInput = document.getElementById('dpi');

  const openBarcodeLibraryBtn = document.getElementById('openBarcodeLibraryBtn');
  const openQrLibraryBtn = document.getElementById('openQrLibraryBtn');
  const libraryModal = document.getElementById('libraryModal');
  const libGrid = document.getElementById('libGrid');
  const libClose = document.getElementById('libClose');
  const libRefresh = document.getElementById('libRefresh');
  const barcodeLibraryIdInput = document.getElementById('barcodeLibraryId');
  const qrLibraryIdInput = document.getElementById('qrLibraryId');
  const toastEl = document.getElementById('toast');

  /* Etat applicatif : dataURL des images, IDs sélectionnés et gestion de la bibliothèque. */
  let barcodeImageDataUrl = null;
  let qrImageDataUrl = null;
  let barcodeLibraryId = null;
  let qrLibraryId = null;
  let objectUrlsToRevoke = new Set();
  let currentLibraryTarget = null;

  /* Helpers UI : affichage des erreurs/toasts, sécurisation simple et activer/désactiver. */
  function showError(msg) {
    if (!msg) { errorMsg.style.display = 'none'; errorMsg.textContent = ''; return; }
    errorMsg.textContent = msg; errorMsg.style.display = 'block';
  }
  function showToast(msg, timeout = 3000) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), timeout);
  }
  function sanitizeFilename(s) { return String(s).replace(/[^a-z0-9_\-\.]/gi, '_').slice(0, 120); }
  function setBusy(state, text = '') {
    [previewBtn, downloadBtn, printBtn, saveLibraryBtn].forEach(b => { if (!b) return; b.disabled = state; if (state) b.classList.add('disabled'); else b.classList.remove('disabled'); });
    if (state) showToast(text || 'Opération en cours...'); else showToast('Terminé', 800);
  }

  /* Récupération réseau avec timeout : évite les opérations bloquées côté navigateur. */
  async function fetchWithTimeout(url, opts = {}, timeout = FETCH_TIMEOUT_MS) {
    const controller = new AbortController();
    opts.signal = controller.signal;
    opts.credentials = opts.credentials || 'same-origin';
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, opts);
      clearTimeout(id);
      return res;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  }

  /* Conversion de fichiers : FileReader pour obtenir une dataURL utilisable pour l'aperçu. */
  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve(null);
      const fr = new FileReader();
      fr.onerror = () => reject(new Error('Lecture du fichier impossible'));
      fr.onload = () => resolve(fr.result);
      fr.readAsDataURL(file);
    });
  }

  function showThumb(container, dataUrl, altText) {
    container.innerHTML = '';
    if (!dataUrl) return;
    const img = document.createElement('img');
    img.src = dataUrl;
    img.alt = altText || '';
    img.style.maxWidth = '120px';
    img.style.maxHeight = '60px';
    img.style.objectFit = 'contain';
    container.appendChild(img);
  }

  /* Garde-fous numériques : impose min/max via validation HTML et correction au blur. */
  function clampNumberInput(el, min, max) {
    if (!el) return;
    el.addEventListener('input', () => {
      const v = el.value === '' ? '' : Number(el.value);
      if (el.value === '') { el.setCustomValidity(''); return; }
      if (!Number.isFinite(v) || (min !== undefined && v < min)) el.setCustomValidity(`La valeur minimale est ${min}`);
      else if (max !== undefined && v > max) el.setCustomValidity(`La valeur maximale est ${max}`);
      else el.setCustomValidity('');
    });
    el.addEventListener('blur', () => {
      if (el.value === '') return;
      const v = Number(el.value);
      if (!Number.isFinite(v)) { el.value = ''; return; }
      if (min !== undefined && v < min) el.value = min;
      if (max !== undefined && v > max) el.value = max;
      el.setCustomValidity('');
    });
  }
  clampNumberInput(widthInput, MIN_WIDTH_MM);
  clampNumberInput(heightInput, MIN_HEIGHT_MM);
  clampNumberInput(dpiInput, MIN_DPI, MAX_DPI);
  const priceInput = document.getElementById('price'); clampNumberInput(priceInput, 0);

  /* Traitement des fichiers image : validation type/taille puis chargement dans la vue. */
  if (barcodeFileInput) barcodeFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    barcodeLibraryId = null; barcodeLibraryIdInput.value = '';
    if (!file) { barcodeImageDataUrl = null; showThumb(barcodeThumb, null); return; }
    if (!file.type.startsWith('image/')) { showError('Fichier non-image.'); return; }
    if (file.size > MAX_LOGO_BYTES) { showError(`Image trop volumineuse (max ${Math.round(MAX_LOGO_BYTES/1_000_000)} MB).`); return; }
    try {
      barcodeImageDataUrl = await fileToDataUrl(file);
      showThumb(barcodeThumb, barcodeImageDataUrl, 'Aperçu code-barres');
      showError('');
      showToast('Image code-barres chargée localement.');
    } catch (err) {
      console.error(err); showError('Impossible de lire l’image de code-barres.');
    }
  });

  if (qrFileInput) qrFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    qrLibraryId = null; qrLibraryIdInput.value = '';
    if (!file) { qrImageDataUrl = null; showThumb(qrThumb, null); return; }
    if (!file.type.startsWith('image/')) { showError('Fichier non-image.'); return; }
    if (file.size > MAX_LOGO_BYTES) { showError(`Image trop volumineuse (max ${Math.round(MAX_LOGO_BYTES/1_000_000)} MB).`); return; }
    try {
      qrImageDataUrl = await fileToDataUrl(file);
      showThumb(qrThumb, qrImageDataUrl, 'Aperçu QR');
      showError('');
      showToast('Image QR chargée localement.');
    } catch (err) {
      console.error(err); showError('Impossible de lire l’image QR.');
    }
  });

  /* Bascules UI : affiche l'input et l'aperçu correspondant au type (QR vs code-barres). */
  if (form) {
    form.querySelectorAll('input[name="imageType"]').forEach(r => {
      r.addEventListener('change', () => {
        const val = form.querySelector('input[name="imageType"]:checked').value;
        if (val === 'barcode') { barcodeInputWrapper.style.display = ''; qrInputWrapper.style.display = 'none'; }
        else { barcodeInputWrapper.style.display = 'none'; qrInputWrapper.style.display = ''; }
        showError('');
      });
    });
  }

  /* Récupération et validation : contrôle des champs avant génération/export. */
  function getFormValues() {
    const width = Number(widthInput.value) || MIN_WIDTH_MM;
    const height = Number(heightInput.value) || MIN_HEIGHT_MM;
    const dpi = Number(dpiInput.value) || 300;
    return {
      name: (document.getElementById('productName') || {}).value?.trim() || '',
      sku: (document.getElementById('sku') || {}).value?.trim() || '',
      price: (document.getElementById('price') || {}).value?.trim() || '',
      imageType: form.querySelector('input[name="imageType"]:checked').value,
      barcodeDataUrl: barcodeImageDataUrl,
      qrDataUrl: qrImageDataUrl,
      outputFormat: form.querySelector('input[name="outputFormat"]:checked').value,
      widthMm: width,
      heightMm: height,
      dpi
    };
  }

  function validateInputs(vals) {
    if (!vals.name) return 'Le nom du produit est requis.';
    if (!vals.sku) return 'Le SKU / code est requis.';
    if (vals.imageType === 'barcode' && !vals.barcodeDataUrl) return 'Veuillez téléverser une image de code-barres ou l\'importer depuis la bibliothèque.';
    if (vals.imageType === 'qr' && !vals.qrDataUrl) return 'Veuillez téléverser une image de QR ou l\'importer depuis la bibliothèque.';
    if (!Number.isFinite(vals.widthMm) || vals.widthMm < MIN_WIDTH_MM) return `La largeur minimale est ${MIN_WIDTH_MM} mm.`;
    if (!Number.isFinite(vals.heightMm) || vals.heightMm < MIN_HEIGHT_MM) return `La hauteur minimale est ${MIN_HEIGHT_MM} mm.`;
    if (vals.price && Number(vals.price) < 0) return 'Le prix ne peut pas être négatif.';
    if (!Number.isFinite(vals.dpi) || vals.dpi < MIN_DPI || vals.dpi > MAX_DPI) return `La résolution DPI doit être entre ${MIN_DPI} et ${MAX_DPI}.`;
    return null;
  }

  /* Rendu de l'aperçu : ajuste dimensions et injecte le média (image insérée). */
  async function renderPreview(vals) {
    labelPreview.style.width = `${vals.widthMm}mm`;
    labelPreview.style.height = `${vals.heightMm}mm`;
    labelPreview.innerHTML = '';

    const top = document.createElement('div'); top.className = 'top';
    const title = document.createElement('div'); title.className = 'title'; title.textContent = vals.name || '—';
    top.appendChild(title);
    if (vals.price) { const priceEl = document.createElement('div'); priceEl.className = 'price'; priceEl.textContent = isNaN(Number(vals.price)) ? vals.price : `${Number(vals.price).toFixed(2)} €`; top.appendChild(priceEl); }
    labelPreview.appendChild(top);

    const mediaWrap = document.createElement('div'); mediaWrap.className = (vals.imageType === 'barcode') ? 'barcode-wrap' : 'qr-wrap';
    const img = document.createElement('img'); img.alt = (vals.imageType === 'barcode') ? 'Code-barres' : 'QR code';
    img.style.maxWidth = '100%'; img.style.height = (vals.imageType === 'barcode') ? '28px' : '48px'; img.style.objectFit = 'contain';
    const src = vals.imageType === 'barcode' ? vals.barcodeDataUrl : vals.qrDataUrl;
    if (src) img.src = src;
    mediaWrap.appendChild(img);
    labelPreview.appendChild(mediaWrap);

    const bottom = document.createElement('div'); bottom.className = 'sku'; bottom.textContent = vals.sku ? `SKU: ${vals.sku}` : '';
    labelPreview.appendChild(bottom);

    if (img.src) {
      try { await ensureImageLoaded(img); } catch (err) { console.error(err); showError('Impossible de charger l’image insérée. Vérifie le fichier.'); }
    }
    showError('');
  }

  function ensureImageLoaded(img) {
    if (img.complete && img.naturalWidth !== 0) return Promise.resolve();
    return new Promise((resolve, reject) => { img.addEventListener('load', () => resolve()); img.addEventListener('error', () => reject(new Error('Erreur chargement image'))); });
  }

  /* Construction SVG : compose le balisage vectoriel de l'étiquette (nom, prix, SKU, image). */
  function buildSvgString(vals, pxPerMm = 10) {
    const vw = Math.max( Math.round(vals.widthMm * pxPerMm), 1 );
    const vh = Math.max( Math.round(vals.heightMm * pxPerMm), 1 );
    const padding = Math.round(vw * 0.05);
    const titleY = padding + Math.round(pxPerMm * 6);
    const imgY = titleY + Math.round(pxPerMm * 2);
    const imgH = Math.round(vh * 0.45);
    const skuY = vh - padding;
    const imgHref = vals.imageType === 'barcode' ? (vals.barcodeDataUrl || '') : (vals.qrDataUrl || '');
    const esc = (s='') => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const nameText = esc(vals.name || '');
    const priceText = vals.price ? (isNaN(Number(vals.price)) ? esc(vals.price) : esc(Number(vals.price).toFixed(2) + ' €')) : '';
    const svg = `<?xml version="1.0" encoding="utf-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${vals.widthMm}mm" height="${vals.heightMm}mm" viewBox="0 0 ${vw} ${vh}" preserveAspectRatio="xMidYMid meet">\n <rect x="0" y="0" width="${vw}" height="${vh}" fill="#ffffff"/>\n <g font-family="Arial, Helvetica, sans-serif" fill="#0f172a">\n <text x="${padding}" y="${titleY}" font-size="${Math.round(pxPerMm*3.2)}" font-weight="700">${nameText}</text>\n ${priceText ? `<text x="${vw - padding}" y="${titleY}" font-size="${Math.round(pxPerMm*2.6)}" font-weight="600" text-anchor="end" fill="#1e40af">${priceText}</text>` : ''}\n </g>\n ${imgHref ? `<image href="${imgHref}" x="${padding}" y="${imgY}" width="${vw - padding*2}" height="${imgH}" preserveAspectRatio="xMidYMid meet"/>` : ''}\n <text x="${padding}" y="${skuY}" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(pxPerMm*1.6)}" fill="#6b7280">SKU: ${esc(vals.sku || '')}</text>\n</svg>`;
    return svg;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    objectUrlsToRevoke.add(url);
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => { try { URL.revokeObjectURL(url); objectUrlsToRevoke.delete(url); } catch (e) {} }, 10000);
  }

  function exportSvgFile(vals) {
    const svgText = buildSvgString(vals, 10);
    const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    downloadBlob(blob, `etiquette_${Date.now()}.svg`);
  }

  async function svgStringToPngBlob(svgText, widthPx, heightPx) {
    const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = svgUrl;
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(widthPx));
    canvas.height = Math.max(1, Math.round(heightPx));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise(res => canvas.toBlob(res, 'image/png'));
  }

  async function exportPngFromSvg(vals) {
    try {
      const pxPerMm = vals.dpi / 25.4;
      const svgText = buildSvgString(vals, pxPerMm);
      const widthPx = Math.max(1, Math.round(vals.widthMm * pxPerMm));
      const heightPx = Math.max(1, Math.round(vals.heightMm * pxPerMm));
      const blob = await svgStringToPngBlob(svgText, widthPx, heightPx);
      if (blob) downloadBlob(blob, `etiquette_${Date.now()}.png`);
      else showError('Impossible de générer le PNG.');
    } catch (err) {
      console.error('Export PNG failed', err);
      showError('Erreur lors de l’export PNG.');
    }
  }

  /* Fallback export PNG : conversion via html2canvas (option de secours). */
  async function exportPngOldWay(element) {
    try {
      const scale = 3 * (window.devicePixelRatio || 1);
      const canvas = await html2canvas(element, { backgroundColor: '#ffffff', scale, useCORS: true, imageTimeout: 5000 });
      const dataUrl = canvas.toDataURL('image/png');
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      downloadBlob(blob, `etiquette_${Date.now()}.png`);
    } catch (err) {
      console.error('Export PNG failed', err);
      showError('Erreur lors de l’export PNG.');
    }
  }

  /* Impression : ouvre une fenêtre et exécute `print()` sur une page HTML minimaliste. */
  function printElement(vals) {
    const svgString = buildSvgString(vals, 10);
    const markup = `
      <html>
        <head><meta charset="utf-8"/><title>Impression - Étiquette</title>
          <style>@page{size:${vals.widthMm}mm ${vals.heightMm}mm;margin:0}html,body{margin:0;height:100%}body{display:flex;align-items:center;justify-content:center}.label{width:${vals.widthMm}mm;height:${vals.heightMm}mm}svg{width:100%;height:100%;display:block}</style>
        </head>
      <body><div class="label">${svgString}</div></body></html>`;
    const w = window.open('', '_blank');
    if (!w) { showError('Le navigateur a bloqué la fenêtre d’impression. Autorise les popups.'); return; }
    w.document.open(); w.document.write(markup); w.document.close();
    w.onload = () => setTimeout(() => { w.focus(); w.print(); }, 300);
    setTimeout(() => { try { w.focus(); w.print(); } catch(e) {} }, 1500);
  }

  /* Actions de l'interface : preview, téléchargement, impression et enregistrement. */
  function disableActions(state) {
    [previewBtn, downloadBtn, printBtn, saveLibraryBtn].forEach(b => {
      if (!b) return;
      b.disabled = state;
      if (state) b.classList.add('disabled'); else b.classList.remove('disabled');
    });
  }

  previewBtn && previewBtn.addEventListener('click', async () => {
    const vals = getFormValues(); const validation = validateInputs(vals);
    if (validation) { showError(validation); return; }
    disableActions(true);
    try { await renderPreview(vals); } finally { disableActions(false); }
  });

  downloadBtn && downloadBtn.addEventListener('click', async () => {
    const vals = getFormValues(); const validation = validateInputs(vals);
    if (validation) { showError(validation); return; }
    disableActions(true);
    try { await renderPreview(vals); if (vals.outputFormat === 'svg') exportSvgFile(vals); else await exportPngFromSvg(vals); } finally { disableActions(false); }
  });

  printBtn && printBtn.addEventListener('click', async () => {
    const vals = getFormValues(); const validation = validateInputs(vals);
    if (validation) { showError(validation); return; }
    disableActions(true);
    try { await renderPreview(vals); printElement(vals); } finally { disableActions(false); }
  });

  /* Upload/enregistrement : envoie à l'API le contenu SVG/PNG et les métadonnées. */
  async function uploadToLibrary(fileOrBlob, filename, source = 'labelgenerator', meta = {}) {
    const fd = new FormData();
    fd.append('file', fileOrBlob, filename);
    fd.append('source', source);
    if (meta && meta.ppi) fd.append('ppi', String(meta.ppi));
    if (meta.name) fd.append('name', meta.name);
    if (meta.sku) fd.append('sku', meta.sku);
    if (meta.tags) fd.append('tags', Array.isArray(meta.tags) ? meta.tags.join(',') : String(meta.tags));
    const res = await fetchWithTimeout(`${API_BASE}/upload.php`, { method: 'POST', body: fd });
    if (!res.ok) throw new Error('upload failed');
    const json = await res.json();
    if (!json || !(json.ok || json.success)) throw new Error(json && (json.error || json.message) ? (json.error || json.message) : 'upload_failed');
    return json.asset || json.data || null;
  }

  async function savePreviewToLibrary() {
    const vals = getFormValues(); const validation = validateInputs(vals);
    if (validation) { showError(validation); return; }
    disableActions(true);
    setBusy(true, 'Enregistrement en bibliothèque...');
    try {
      await renderPreview(vals);
      const preferSvg = (vals.outputFormat === 'svg');
      if (preferSvg) {
        const svgText = buildSvgString(vals, 10);
        const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
        const asset = await uploadToLibrary(blob, `etiquette_${sanitizeFilename(vals.name || 'etik')}.svg`, 'labelgenerator', { ppi: vals.dpi, name: vals.name, sku: vals.sku, tags: ['label'] });
        showToast('Étiquette enregistrée en bibliothèque.');
        if (asset && asset.id) {
          if (confirm('Ouvrir l’étiquette enregistrée dans Zimager ?')) {
            window.open(`../zimager/index.html?import_id=${encodeURIComponent(asset.id)}`, '_blank');
          }
        }
      } else {
        const pxPerMm = vals.dpi / 25.4;
        const svgText = buildSvgString(vals, pxPerMm);
        const widthPx = Math.max(1, Math.round(vals.widthMm * pxPerMm));
        const heightPx = Math.max(1, Math.round(vals.heightMm * pxPerMm));
        const pngBlob = await svgStringToPngBlob(svgText, widthPx, heightPx);
        const asset = await uploadToLibrary(pngBlob, `etiquette_${sanitizeFilename(vals.name || 'etik')}.png`, 'labelgenerator', { ppi: vals.dpi, name: vals.name, sku: vals.sku, tags: ['label'] });
        showToast('Étiquette enregistrée en bibliothèque.');
        if (asset && asset.id) {
          if (confirm('Ouvrir l’étiquette enregistrée dans Zimager ?')) {
            window.open(`../zimager/index.html?import_id=${encodeURIComponent(asset.id)}`, '_blank');
          }
        }
      }
    } catch (err) {
      console.error('savePreviewToLibrary', err);
      showError('Erreur lors de l\'enregistrement en bibliothèque.');
      showToast('Échec enregistrement.');
    } finally {
      disableActions(false);
      setBusy(false);
    }
  }

  saveLibraryBtn && saveLibraryBtn.addEventListener('click', savePreviewToLibrary);

  /* Bibliothèque : liste des assets, affichage en grille et import vers le champ cible. */
  async function fetchLibraryList() {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/list.php`, { cache: 'no-store' });
      if (!res.ok) throw new Error('liste bibliothèque impossible');
      const list = await res.json();
      return Array.isArray(list) ? list : [];
    } catch (err) {
      console.error('fetchLibraryList', err);
      showToast('Erreur récupération bibliothèque.');
      return [];
    }
  }

  function normalizeAsset(a) {
    return {
      id: a.id || a.asset_id || a.filename || '',
      filename: a.filename || a.name || '',
      url: a.url || a.path || a.asset_url || a.src || '',
      thumb: a.thumb || a.preview || null,
      mime: a.mime || a.type || '',
    };
  }

  async function buildLibraryGrid(targetField) {
    libGrid.innerHTML = '<div class="hint-small">Chargement...</div>';
    const assets = await fetchLibraryList();
    libGrid.innerHTML = '';
    if (!assets.length) { libGrid.innerHTML = '<div class="hint-small">Aucun asset trouvé.</div>'; return; }
    for (const raw of assets) {
      const a = normalizeAsset(raw);
      const it = document.createElement('div'); it.className = 'lib-item';
      const img = document.createElement('img'); img.src = a.thumb || a.url || ''; img.alt = a.filename || a.id;
      const meta = document.createElement('div'); meta.className = 'meta'; meta.innerHTML = `<div>${a.filename || a.id}</div><div style="font-size:11px;color:#666">${a.mime || ''}</div>`;
      const insertBtn = document.createElement('button'); insertBtn.className = 'btn'; insertBtn.textContent = 'Importer ici';
      insertBtn.addEventListener('click', () => { selectLibraryAssetForTarget(a, targetField); });
      const openBtn = document.createElement('button'); openBtn.className = 'btn muted'; openBtn.textContent = 'Ouvrir';
      openBtn.addEventListener('click', () => window.open(a.url || a.path || '#', '_blank'));
      it.appendChild(img); it.appendChild(meta); it.appendChild(insertBtn); it.appendChild(openBtn);
      libGrid.appendChild(it);
    }
  }

  function openLibraryModal(targetField) {
    currentLibraryTarget = targetField || 'barcode';
    libraryModal.style.display = 'flex'; libraryModal.setAttribute('aria-hidden','false');
    libGrid.setAttribute('tabindex', '0'); libGrid.focus();
    buildLibraryGrid(currentLibraryTarget);
  }
  function closeLibraryModal() {
    libraryModal.style.display = 'none'; libraryModal.setAttribute('aria-hidden','true');
    currentLibraryTarget = null;
  }

  libClose && libClose.addEventListener('click', closeLibraryModal);
  libRefresh && libRefresh.addEventListener('click', () => { buildLibraryGrid(currentLibraryTarget || 'barcode'); });

  openBarcodeLibraryBtn && openBarcodeLibraryBtn.addEventListener('click', () => openLibraryModal('barcode'));
  openQrLibraryBtn && openQrLibraryBtn.addEventListener('click', () => openLibraryModal('qr'));

  async function selectLibraryAssetForTarget(assetMeta, targetField) {
    try {
      if (!assetMeta) return;
      const id = assetMeta.id;
      if (assetMeta.url) {
        const url = assetMeta.url;
        if (targetField === 'barcode') {
          barcodeImageDataUrl = url; barcodeLibraryId = id; barcodeLibraryIdInput.value = id;
          showThumb(barcodeThumb, barcodeImageDataUrl, 'Code-barres importé bibliothèque');
        } else {
          qrImageDataUrl = url; qrLibraryId = id; qrLibraryIdInput.value = id;
          showThumb(qrThumb, qrImageDataUrl, 'QR importé bibliothèque');
        }
        showToast('Asset référencé depuis la bibliothèque.');
        closeLibraryModal();
        return;
      }
      const resp = await fetchWithTimeout(`${API_BASE}/get.php?id=${encodeURIComponent(id)}`);
      if (!resp.ok) throw new Error('get asset failed');
      const ct = resp.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const meta = await resp.json(); const realUrl = meta.url || meta.path;
        if (realUrl) {
          if (targetField === 'barcode') { barcodeImageDataUrl = realUrl; barcodeLibraryId = id; barcodeLibraryIdInput.value = id; showThumb(barcodeThumb, barcodeImageDataUrl, 'Code-barres importé bibliothèque'); }
          else { qrImageDataUrl = realUrl; qrLibraryId = id; qrLibraryIdInput.value = id; showThumb(qrThumb, qrImageDataUrl, 'QR importé bibliothèque'); }
          showToast('Asset importé depuis la bibliothèque.');
          closeLibraryModal(); return;
        }
      }
      const blob = await resp.blob();
      const file = new File([blob], `${id}.${blob.type === 'image/svg+xml' ? 'svg' : 'png'}`, { type: blob.type });
      const dataUrl = await fileToDataUrl(file);
      if (targetField === 'barcode') { barcodeImageDataUrl = dataUrl; barcodeLibraryId = id; barcodeLibraryIdInput.value = id; showThumb(barcodeThumb, barcodeImageDataUrl, 'Code-barres importé bibliothèque'); }
      else { qrImageDataUrl = dataUrl; qrLibraryId = id; qrLibraryIdInput.value = id; showThumb(qrThumb, qrImageDataUrl, 'QR importé bibliothèque'); }
      showToast('Asset importé depuis la bibliothèque.');
    } catch (err) {
      console.error('selectLibraryAssetForTarget', err); showToast('Impossible d\'importer l\'asset.');
    } finally {
      closeLibraryModal();
    }
  }

  /* Import via paramètre d'URL : extrait `import_id` et charge l'asset depuis l'API. */
  async function handleImportIdFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('import_id') || params.get('asset_id');
      const forField = params.get('import_for') || params.get('for') || null;
      if (!id) return;
      const target = (forField === 'qr' || forField === 'barcode') ? forField : (form.querySelector('input[name="imageType"]:checked').value || 'barcode');
      const resp = await fetchWithTimeout(`${API_BASE}/get.php?id=${encodeURIComponent(id)}`);
      if (!resp.ok) throw new Error('asset fetch failed');
      const ct = resp.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const meta = await resp.json();
        const realUrl = meta.url || meta.path;
        if (realUrl) {
          if (target === 'barcode') { barcodeImageDataUrl = realUrl; barcodeLibraryId = id; barcodeLibraryIdInput.value = id; showThumb(barcodeThumb, barcodeImageDataUrl, 'Import depuis URL'); }
          else { qrImageDataUrl = realUrl; qrLibraryId = id; qrLibraryIdInput.value = id; showThumb(qrThumb, qrImageDataUrl, 'Import depuis URL'); }
          showToast('Asset importé via URL.');
          const currVals = getFormValues(); if (!validateInputs(currVals)) await renderPreview(currVals);
          return;
        }
      }
      const blob = await resp.blob();
      const file = new File([blob], `${id}.${blob.type === 'image/svg+xml' ? 'svg' : 'png'}`, { type: blob.type });
      const dataUrl = await fileToDataUrl(file);
      if (target === 'barcode') { barcodeImageDataUrl = dataUrl; barcodeLibraryId = id; barcodeLibraryIdInput.value = id; showThumb(barcodeThumb, barcodeImageDataUrl, 'Import depuis URL'); }
      else { qrImageDataUrl = dataUrl; qrLibraryId = id; qrLibraryIdInput.value = id; showThumb(qrThumb, qrImageDataUrl, 'Import depuis URL'); }
      showToast('Asset importé via URL.');
      const currVals = getFormValues(); if (!validateInputs(currVals)) await renderPreview(currVals);
    } catch (err) {
      console.error('handleImportIdFromUrl', err); showToast('Impossible d\'importer l\'asset via URL.');
    }
  }

  window.addEventListener('load', () => { handleImportIdFromUrl().catch(() => {}); });

  /* Prépare le blob exportable pour upload : SVG direct ou PNG rendu depuis SVG. */
  async function getPreviewBlob(vals) {
    if (vals.outputFormat === 'svg') {
      const svgText = buildSvgString(vals, 10);
      return { blob: new Blob([svgText], { type: 'image/svg+xml' }), filename: `etiquette_${sanitizeFilename(vals.name||'etik')}.svg` };
    } else {
      const pxPerMm = vals.dpi / 25.4;
      const svgText = buildSvgString(vals, pxPerMm);
      const widthPx = Math.max(1, Math.round(vals.widthMm * pxPerMm));
      const heightPx = Math.max(1, Math.round(vals.heightMm * pxPerMm));
      const pngBlob = await svgStringToPngBlob(svgText, widthPx, heightPx);
      return { blob: pngBlob, filename: `etiquette_${sanitizeFilename(vals.name||'etik')}.png` };
    }
  }

  /* Nettoyage des object URLs : révoque les URLs temporaires au déchargement de la page. */
  window.addEventListener('beforeunload', () => {
    for (const url of objectUrlsToRevoke) {
      try { URL.revokeObjectURL(url); } catch (e) {}
    }
    objectUrlsToRevoke.clear();
  });

  /* Valeurs de démonstration : pré-remplit le formulaire si les champs sont présents. */
  (function seedDemo() {
    const pn = document.getElementById('productName'), sku = document.getElementById('sku'), pr = document.getElementById('price');
    if (pn) pn.value = 'Savon artisanal';
    if (sku) sku.value = '123456789012';
    if (pr) pr.value = '4.95';
  })();

  /* Fin du script */

})();