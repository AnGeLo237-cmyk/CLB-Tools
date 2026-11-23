// Script CodeGenerator : génération de QR / codes-barres et interaction avec la bibliothèque.
(function () {
  'use strict';

  // Charge la configuration PWA afin de générer des URLs correctes selon le sous-dossier courant.
  const script = document.createElement('script');
  script.src = (window.location.pathname.includes('/codegenerator/') || 
                window.location.pathname.includes('/labelgenerator/') || 
                window.location.pathname.includes('/zimager/')) 
              ? '../pwa-config.php' 
              : 'pwa-config.php';
  document.head.appendChild(script);

  /* Paramètres / constantes de l'application : limites, pages cibles et timeouts. */
  const LABELGENERATOR_PAGE = '../labelgenerator/index.html';
  const ZIMAGER_PAGE = '../zimager/index.html';

  const MAX_TOTAL_CHARS = 1000;
  const MAX_PER_LINE = 250;
  const MAX_LOGO_BYTES = 2_000_000;
  const FETCH_TIMEOUT_MS = 10_000;

  /* Références DOM utilisées par les contrôles (formulaire, résultats, modale). */
  const inputData = document.getElementById('inputData');
  const inputDataCount = document.getElementById('inputDataCount');
  const typeQr = document.getElementById('typeQr');
  const typeBarcode = document.getElementById('typeBarcode');
  const barcodeOptions = document.getElementById('barcodeOptions');
  const qrOptions = document.getElementById('qrOptions');
  const barcodeFormat = document.getElementById('barcodeFormat');
  const barcodeHeight = document.getElementById('barcodeHeight');
  const barcodeLength = document.getElementById('barcodeLength');
  const qrCorrection = document.getElementById('qrCorrection');
  const sizeInput = document.getElementById('sizeInput');
  const colorInput = document.getElementById('colorInput');
  const formatSelect = document.getElementById('formatSelect');
  const logoInput = document.getElementById('logoInput');
  const perLine = document.getElementById('perLine');
  const generateBtn = document.getElementById('generateBtn');
  const downloadAllBtn = document.getElementById('downloadAllBtn');
  const clearBtn = document.getElementById('clearBtn');
  const formError = document.getElementById('formError');
  const resultsEl = document.getElementById('results');
  const dpiInput = document.getElementById('dpiInput');
  const labelPreviewHolder = document.getElementById('labelPreviewHolder');

  const openLibraryBtn = document.getElementById('openLibraryBtn');
  const libraryModal = document.getElementById('libraryModal');
  const libGrid = document.getElementById('libGrid');
  const libClose = document.getElementById('libClose');
  const libRefresh = document.getElementById('libRefresh');
  const logoLibraryIdInput = document.getElementById('logoLibraryId');
  const toastEl = document.getElementById('toast');
  const logoLocalWrapper = document.getElementById('logoLocalWrapper');
  const logoLibraryWrapper = document.getElementById('logoLibraryWrapper');
  const logoPreview = document.getElementById('logoPreview');

  /* Etat applicatif : données courantes du logo et gestion des URL temporaires. */
  let logoDataUrl = null;
  let logoFileObject = null;
  let logoLibraryId = null;
  const objectUrlsToRevoke = new Set();

  /* Fonctions utilitaires : affichage d'erreurs, gestion d'URL et helpers réseau. */
  function showError(msg) {
    if (!formError) return;
    if (!msg) {
      formError.style.display = 'none';
      formError.textContent = '';
      return;
    }
    formError.textContent = msg;
    formError.style.display = 'block';
  }

  function showToast(msg, timeout = 3000) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), timeout);
  }

  function sanitizeFilename(s) {
    return String(s).replace(/[^a-z0-9_\-\.]/gi, '_').slice(0, 120);
  }

  function setDisabled(el, state) {
    if (!el) return;
    el.disabled = !!state;
    if (state) el.classList.add('disabled');
    else el.classList.remove('disabled');
  }

  function registerObjectUrl(url) {
    objectUrlsToRevoke.add(url);
    return url;
  }

  function clearObjectUrl(url) {
    try {
      URL.revokeObjectURL(url);
    } catch (_) {}
    objectUrlsToRevoke.delete(url);
  }

  function absoluteUrl(path) {
    try {
      return new URL(path, window.location.href).toString();
    } catch (_) {
      return path;
    }
  }

  async function fetchWithTimeout(url, opts = {}, timeout = FETCH_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      return await fetch(url, {
        credentials: 'same-origin',
        ...opts,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchTextOrJson(url, opts = {}, timeout = FETCH_TIMEOUT_MS) {
    const res = await fetchWithTimeout(url, opts, timeout);
    const text = await res.text();

    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch (_) {
      parsed = { raw: text };
    }

    if (!res.ok) {
      const err = new Error((parsed && (parsed.error || parsed.message)) || `HTTP ${res.status}`);
      err.status = res.status;
      err.body = parsed;
      throw err;
    }

    return { res, parsed, text };
  }

  async function fetchBlob(url, opts = {}, timeout = FETCH_TIMEOUT_MS) {
    const res = await fetchWithTimeout(url, opts, timeout);
    if (!res.ok) {
      let detail = '';
      try {
        detail = await res.text();
      } catch (_) {}
      throw new Error(`Téléchargement impossible (HTTP ${res.status})${detail ? `: ${detail}` : ''}`);
    }
    return await res.blob();
  }

  function addNonNegativeGuard(el, minAllowed = 0) {
    if (!el) return;
    el.setAttribute('min', String(minAllowed));
    el.addEventListener('input', () => {
      const val = Number(el.value);
      if (!Number.isFinite(val)) return;
      if (val < minAllowed) {
        el.classList.add('invalid');
        showError(`La valeur minimale pour "${el.id}" est ${minAllowed}.`);
      } else {
        el.classList.remove('invalid');
        showError('');
      }
    });
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = () => reject(new Error('Erreur lecture fichier'));
      fr.onload = () => resolve(fr.result);
      fr.readAsDataURL(file);
    });
  }

  function updateTypeUI() {
    if (typeBarcode && typeBarcode.checked) {
      barcodeOptions.style.display = '';
      qrOptions.style.display = 'none';
    } else {
      barcodeOptions.style.display = 'none';
      qrOptions.style.display = '';
    }
  }

  function updateLogoSourceUI() {
    const v = document.querySelector('input[name="logoSource"]:checked')?.value || 'local';
    if (v === 'local') {
      if (logoLocalWrapper) logoLocalWrapper.style.display = '';
      if (logoLibraryWrapper) logoLibraryWrapper.style.display = 'none';
    } else {
      if (logoLocalWrapper) logoLocalWrapper.style.display = 'none';
      if (logoLibraryWrapper) logoLibraryWrapper.style.display = '';
    }
  }

  /* Validation des entrées : bornes numériques et règles de format. */
  addNonNegativeGuard(barcodeHeight, 1);
  addNonNegativeGuard(barcodeLength, 100);
  addNonNegativeGuard(sizeInput, 64);
  addNonNegativeGuard(dpiInput, 72);

  function validateBarcodeInput(text, format) {
    const value = String(text).trim();
    if (!value) return 'Valeur vide non autorisée pour un code-barres.';

    if (format === 'EAN13' && !/^\d{12,13}$/.test(value)) {
      return 'EAN13 exige 12 ou 13 chiffres.';
    }

    if (format === 'UPC' && !/^\d{11,12}$/.test(value)) {
      return 'UPC exige 11 ou 12 chiffres.';
    }

    return null;
  }

  /* Compteur et découpage par ligne : limite la quantité de caractères produite. */
  if (inputData) {
    inputData.addEventListener('input', () => {
      if (inputData.value.length > MAX_TOTAL_CHARS) {
        inputData.value = inputData.value.slice(0, MAX_TOTAL_CHARS);
        showError(`Nombre maximal de caractères : ${MAX_TOTAL_CHARS}.`);
      }

      if (perLine && perLine.checked) {
        const lines = inputData.value
          .split(/\r?\n/)
          .map(l => l.slice(0, MAX_PER_LINE));
        const newVal = lines.join('\n');

        if (newVal !== inputData.value) {
          inputData.value = newVal;
          showError(`Chaque ligne est limitée à ${MAX_PER_LINE} caractères.`);
        }
      }

      inputDataCount.textContent = `${inputData.value.length} / ${MAX_TOTAL_CHARS}`;
    });

    inputDataCount.textContent = `${inputData.value.length} / ${MAX_TOTAL_CHARS}`;
  }

  /* Gestion du logo local : conversion en data URL et prévisualisation. */
  if (logoInput) {
    logoInput.addEventListener('change', async (ev) => {
      const file = ev.target.files && ev.target.files[0];
      logoFileObject = null;
      logoDataUrl = null;
      logoLibraryId = null;
      if (logoLibraryIdInput) logoLibraryIdInput.value = '';
      if (logoPreview) logoPreview.innerHTML = '';

      if (!file) return;
      if (!file.type.startsWith('image/')) {
        showError('Le fichier logo doit être une image.');
        return;
      }
      if (file.size > MAX_LOGO_BYTES) {
        showError(`Logo trop volumineux (max ${Math.round(MAX_LOGO_BYTES / 1_000_000)} MB).`);
        return;
      }

      try {
        logoDataUrl = await fileToDataUrl(file);
        logoFileObject = file;
        if (logoPreview) {
          logoPreview.innerHTML = `<img src="${logoDataUrl}" alt="logo" style="max-width:80px;display:block">`;
        }
        showToast('Logo chargé localement.');
      } catch (err) {
        console.error(err);
        showError('Impossible de lire le logo.');
      }
    });
  }

  /* Bibliothèque : récupération de la liste et import comme logo. */
  async function fetchLibraryList() {
    try {
      const { parsed } = await fetchTextOrJson(`${API_BASE}/list.php`, { cache: 'no-store' });
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.items)) return parsed.items;
      if (parsed && Array.isArray(parsed.assets)) return parsed.assets;
      return [];
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
      mime: a.mime || a.type || ''
    };
  }

  async function buildLibraryGrid() {
    if (!libGrid) return;
    libGrid.innerHTML = '<div class="hint-small">Chargement...</div>';

    const assets = await fetchLibraryList();
    libGrid.innerHTML = '';

    if (!assets.length) {
      libGrid.innerHTML = '<div class="hint-small">Aucun asset trouvé.</div>';
      return;
    }

    for (const raw of assets) {
      const a = normalizeAsset(raw);
      const item = document.createElement('div');
      item.className = 'lib-item';

      const img = document.createElement('img');
      img.src = a.thumb || a.url || '';
      img.alt = a.filename || a.id;

      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.innerHTML = `<div>${a.filename || a.id}</div><div style="font-size:11px;color:#666">${a.mime || ''}</div>`;

      const useBtn = document.createElement('button');
      useBtn.className = 'btn';
      useBtn.textContent = 'Utiliser comme logo';
      useBtn.addEventListener('click', () => selectLibraryAssetAsLogo(a));

      const openBtn = document.createElement('button');
      openBtn.className = 'btn muted';
      openBtn.textContent = 'Ouvrir';
      openBtn.addEventListener('click', () => {
        if (a.url) window.open(absoluteUrl(a.url), '_blank');
        else if (a.id) window.open(`${API_BASE}/get.php?id=${encodeURIComponent(a.id)}`, '_blank');
      });

      item.appendChild(img);
      item.appendChild(meta);
      item.appendChild(useBtn);
      item.appendChild(openBtn);
      libGrid.appendChild(item);
    }
  }

  function openLibraryModal() {
    if (!libraryModal) return;
    libraryModal.style.display = 'flex';
    libraryModal.setAttribute('aria-hidden', 'false');
    buildLibraryGrid();
  }

  function closeLibraryModal() {
    if (!libraryModal) return;
    libraryModal.style.display = 'none';
    libraryModal.setAttribute('aria-hidden', 'true');
  }

  async function selectLibraryAssetAsLogo(asset) {
    try {
      const id = encodeURIComponent(asset.id);
      const resp = await fetchWithTimeout(`${API_BASE}/get.php?id=${id}`);

      if (!resp.ok) throw new Error('import asset failed');

      const contentType = resp.headers.get('content-type') || '';
      let dataUrl = null;

      if (contentType.includes('application/json')) {
        const meta = await resp.json();
        const url = meta.url || meta.path || asset.url;
        if (!url) throw new Error('Asset URL manquante');
        const blob = await fetchBlob(absoluteUrl(url));
        dataUrl = await fileToDataUrl(new File([blob], asset.filename || `logo_${asset.id}`, { type: blob.type }));
      } else {
        const blob = await resp.blob();
        dataUrl = await fileToDataUrl(new File([blob], asset.filename || `logo_${asset.id}`, { type: blob.type }));
      }

      logoDataUrl = dataUrl;
      logoLibraryId = asset.id;
      if (logoLibraryIdInput) logoLibraryIdInput.value = asset.id;
      if (logoPreview) logoPreview.innerHTML = `<img src="${logoDataUrl}" alt="logo" style="max-width:80px;display:block">`;

      closeLibraryModal();
      showToast('Logo importé depuis la bibliothèque.');
    } catch (err) {
      console.error('selectLibraryAssetAsLogo', err);
      showToast('Impossible d\'importer l\'asset.');
    }
  }

  if (openLibraryBtn) openLibraryBtn.addEventListener('click', openLibraryModal);
  if (libClose) libClose.addEventListener('click', closeLibraryModal);
  if (libRefresh) libRefresh.addEventListener('click', buildLibraryGrid);

  /* Génération d'image QR (canvas) à partir du texte et du niveau de correction. */
  function generateQrImage(text, size, color, correctLevel, logoData) {
    return new Promise((resolve) => {
      const container = document.createElement('div');
      container.style.display = 'inline-block';
      container.style.lineHeight = '0';

      const qrLevel =
        window.QRCode &&
        QRCode.CorrectLevel &&
        QRCode.CorrectLevel[correctLevel]
          ? QRCode.CorrectLevel[correctLevel]
          : (window.QRCode && QRCode.CorrectLevel ? QRCode.CorrectLevel.M : undefined);

      try {
        new QRCode(container, {
          text: String(text),
          width: size,
          height: size,
          colorDark: color || '#000000',
          colorLight: '#ffffff',
          correctLevel: qrLevel
        });
      } catch (err) {
        console.warn('QRCode lib failed', err);
      }

      setTimeout(async () => {
        const img = container.querySelector('img');
        const canvas = container.querySelector('canvas');

        if (img) {
          const c = document.createElement('canvas');
          c.width = size;
          c.height = size;
          const ctx = c.getContext('2d');
          ctx.imageSmoothingEnabled = false;

          const tmp = new Image();
          tmp.crossOrigin = 'anonymous';
          tmp.onload = async () => {
            try {
              ctx.drawImage(tmp, 0, 0, size, size);
              if (logoData) await drawLogoOnCanvas(ctx, logoData, size);
            } catch (e) {
              console.warn('draw tmp error', e);
            } finally {
              resolve(c);
            }
          };
          tmp.onerror = async () => {
            if (canvas) {
              try {
                canvas.width = size;
                canvas.height = size;
                const ctx2 = canvas.getContext('2d');
                if (ctx2) {
                  ctx2.imageSmoothingEnabled = false;
                  if (logoData) await drawLogoOnCanvas(ctx2, logoData, size);
                }
              } catch (e) {
                console.warn('fallback logo error', e);
              }
              resolve(canvas);
            } else {
              resolve(c);
            }
          };
          tmp.src = img.src;
          return;
        }

        if (canvas) {
          try {
            const ctx = canvas.getContext('2d');
            if (ctx && logoData) await drawLogoOnCanvas(ctx, logoData, size);
          } catch (e) {}
          canvas.width = size;
          canvas.height = size;
          resolve(canvas);
          return;
        }

        const c = document.createElement('canvas');
        c.width = size;
        c.height = size;
        resolve(c);
      }, 40);
    });
  }

  async function drawLogoOnCanvas(ctx, logoData, size) {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
        img.src = logoData;
      });

      const logoMax = Math.round(size * 0.25);
      let w = img.naturalWidth || size;
      let h = img.naturalHeight || size;
      const ratio = Math.min(logoMax / w, logoMax / h, 1);
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);

      const x = Math.round((size - w) / 2);
      const y = Math.round((size - h) / 2);
      const pad = 6;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - pad, y - pad, w + pad * 2, h + pad * 2);
      ctx.drawImage(img, x, y, w, h);
    } catch (e) {
      console.warn('Impossible d\'ajouter le logo', e);
    }
  }

  /* Génération du code-barres en SVG via JsBarcode. */
  function generateBarcodeSvg(text, format, widthPx, heightPx, color) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('xmlns', svgNS);
    svg.setAttribute('width', String(widthPx));
    svg.setAttribute('height', String(heightPx));
    svg.setAttribute('viewBox', `0 0 ${widthPx} ${heightPx}`);

    try {
      if (window.JsBarcode) {
        JsBarcode(svg, String(text), {
          format: String(format || 'CODE128'),
          width: Math.max(1, Math.round(Number(widthPx) / 130)),
          height: Math.max(1, Math.round(Number(heightPx))),
          displayValue: false,
          margin: 4,
          background: '#ffffff',
          lineColor: color || '#000000',
          xmlDocument: document
        });
      } else {
        throw new Error('JsBarcode not loaded');
      }
    } catch (e) {
      console.warn('JsBarcode failed or absent', e);
      const textEl = document.createElementNS(svgNS, 'text');
      textEl.setAttribute('x', '10');
      textEl.setAttribute('y', String(Math.round(heightPx / 2)));
      textEl.setAttribute('fill', color || '#000');
      textEl.textContent = String(text);
      svg.appendChild(textEl);
    }
    return svg;
  }

  /* Conversion DOM -> Blob : rasterise Canvas/SVG/IMG pour téléchargement ou upload. */
  async function domToPngBlob(el, dpi) {
    const scale = Math.max(1, (Number(dpi) || 300) / 96);

    function canvasToBlobPromise(canvas) {
      return new Promise((res) => canvas.toBlob((b) => res(b), 'image/png'));
    }

    if (!el) throw new Error('element required');

    if (el.tagName && el.tagName.toLowerCase() === 'canvas') {
      const src = el;
      const w = src.width || src.clientWidth || 256;
      const h = src.height || src.clientHeight || 256;
      const out = document.createElement('canvas');
      out.width = Math.round(w * scale);
      out.height = Math.round(h * scale);
      const ctx = out.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(src, 0, 0, w, h, 0, 0, out.width, out.height);
      return await canvasToBlobPromise(out);
    }

    if (el.tagName && el.tagName.toLowerCase() === 'svg') {
      let width = parseInt(el.getAttribute('width')) || (el.viewBox && el.viewBox.baseVal && el.viewBox.baseVal.width) || 300;
      let height = parseInt(el.getAttribute('height')) || (el.viewBox && el.viewBox.baseVal && el.viewBox.baseVal.height) || 150;

      const serializer = new XMLSerializer();
      let svgText = serializer.serializeToString(el);
      if (!/xmlns=/.test(svgText)) {
        svgText = svgText.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
      }

      const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
      const img = new Image();
      img.crossOrigin = 'anonymous';

      return await new Promise((resolve, reject) => {
        img.onload = async () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(width * scale);
            canvas.height = Math.round(height * scale);
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const blob = await canvasToBlobPromise(canvas);
            resolve(blob);
          } catch (err) {
            reject(err);
          }
        };

        img.onerror = async () => {
          try {
            const blob = await html2canvasFallback(el, scale);
            resolve(blob);
          } catch (err2) {
            reject(err2);
          }
        };

        img.src = svgUrl;
      });
    }

    if (el.tagName && el.tagName.toLowerCase() === 'img') {
      const img = el;
      if (!img.complete) {
        await new Promise((r, rej) => {
          img.onload = r;
          img.onerror = rej;
        });
      }

      const w = img.naturalWidth || img.width || 300;
      const h = img.naturalHeight || img.height || 150;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;

      try {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        return await canvasToBlobPromise(canvas);
      } catch (err) {
        return await html2canvasFallback(el, scale);
      }
    }

    return await html2canvasFallback(el, scale);
  }

  async function html2canvasFallback(el, scale) {
    if (typeof html2canvas === 'undefined') {
      throw new Error('html2canvas non disponible pour le fallback.');
    }

    const holder =
      labelPreviewHolder ||
      document.getElementById('labelPreviewHolder') ||
      (function createHolder() {
        const h = document.createElement('div');
        h.style.display = 'none';
        h.id = 'labelPreviewHolder';
        document.body.appendChild(h);
        return h;
      })();

    const wrapper = document.createElement('div');
    wrapper.style.background = '#ffffff';
    wrapper.style.padding = '8px';
    wrapper.appendChild(el.cloneNode(true));
    holder.appendChild(wrapper);

    try {
      const canvas = await html2canvas(wrapper, { backgroundColor: '#ffffff', scale, useCORS: true });
      return await new Promise((res) => canvas.toBlob(b => res(b), 'image/png'));
    } finally {
      holder.removeChild(wrapper);
    }
  }

  /* Téléchargement, upload en bibliothèque et construction des URLs "en un clic". */
  function downloadBlob(blob, filename) {
    const url = registerObjectUrl(URL.createObjectURL(blob));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'download.bin';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => clearObjectUrl(url), 10000);
  }

  function buildOneClickUrl(assetId, target = 'label') {
    const page = target === 'zimager' ? ZIMAGER_PAGE : LABELGENERATOR_PAGE;
    const u = new URL(page, window.location.href);
    u.searchParams.set('import_id', assetId);
    return u.toString();
  }

  async function uploadToLibrary(fileOrBlob, filename, source = 'codegenerator', ppi = null, tags = []) {
    const fd = new FormData();
    fd.append('file', fileOrBlob, filename);
    fd.append('source', source);
    if (ppi) fd.append('ppi', String(ppi));
    if (tags && tags.length) fd.append('tags', tags.join(','));

    const { res, parsed } = await fetchTextOrJson(`${API_BASE}/upload.php`, {
      method: 'POST',
      body: fd
    });

    if (!res.ok || !(parsed && (parsed.ok || parsed.success))) {
      throw new Error((parsed && (parsed.error || parsed.message)) || 'upload_failed');
    }

    return parsed.asset || parsed.data || parsed;
  }

  async function nodeToBlobAndName(node, text, preferSvg = false) {
    if (node.tagName && node.tagName.toLowerCase() === 'canvas') {
      return {
        blob: await new Promise(res => node.toBlob(res, 'image/png')),
        filename: `code_${sanitizeFilename(text)}.png`,
        mime: 'image/png'
      };
    }

    if (node.tagName && node.tagName.toLowerCase() === 'svg') {
      const svgText = new XMLSerializer().serializeToString(node);
      if (preferSvg) {
        return {
          blob: new Blob([svgText], { type: 'image/svg+xml' }),
          filename: `code_${sanitizeFilename(text)}.svg`,
          mime: 'image/svg+xml'
        };
      }
      const b = await domToPngBlob(node, Number(dpiInput.value));
      return {
        blob: b,
        filename: `code_${sanitizeFilename(text)}.png`,
        mime: 'image/png'
      };
    }

    if (node.tagName && node.tagName.toLowerCase() === 'img') {
      const resp = await fetchWithTimeout(node.src);
      const blob = await resp.blob();
      const ext = blob.type === 'image/svg+xml' ? 'svg' : 'png';
      return {
        blob,
        filename: `code_${sanitizeFilename(text)}.${ext}`,
        mime: blob.type
      };
    }

    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);

    return {
      blob: await new Promise(res => c.toBlob(res, 'image/png')),
      filename: `code_${sanitizeFilename(text)}.png`,
      mime: 'image/png'
    };
  }

  /* Interface des résultats : cartes + actions (ouvrir, télécharger, enregistrer). */
  function createResultCard(text) {
    const card = document.createElement('div');
    card.className = 'result-card result-item visible';

    const title = document.createElement('div');
    title.className = 'hint-small';
    title.textContent = text;
    card.appendChild(title);

    const mediaWrap = document.createElement('div');
    mediaWrap.className = 'result-media';
    card.appendChild(mediaWrap);

    const actions = document.createElement('div');
    actions.className = 'result-actions';
    actions.style.display = 'flex';
    actions.style.gap = '0.5rem';
    actions.style.marginTop = '0.5rem';
    card.appendChild(actions);

    return { card, mediaWrap, actions };
  }

  async function pushResult(text, node, isSvg) {
    const { card, mediaWrap, actions } = createResultCard(text);

    const visualWrap = document.createElement('div');
    visualWrap.style.display = 'flex';
    visualWrap.style.alignItems = 'center';
    visualWrap.style.justifyContent = 'center';
    visualWrap.style.minWidth = '160px';
    visualWrap.style.minHeight = '160px';
    visualWrap.style.maxWidth = '320px';
    visualWrap.style.maxHeight = '320px';
    visualWrap.style.background = '#fff';
    visualWrap.style.borderRadius = '6px';
    visualWrap.style.padding = '8px';
    visualWrap.style.boxSizing = 'border-box';
    mediaWrap.appendChild(visualWrap);
    visualWrap.appendChild(node);

    const openBtn = document.createElement('button');
    openBtn.className = 'btn';
    openBtn.textContent = 'Ouvrir';
    openBtn.addEventListener('click', async () => {
      try {
        if (isSvg && formatSelect.value === 'svg') {
          const svgText = new XMLSerializer().serializeToString(node);
          const blob = new Blob([svgText], { type: 'image/svg+xml' });
          const url = registerObjectUrl(URL.createObjectURL(blob));
          window.open(url, '_blank');
          setTimeout(() => clearObjectUrl(url), 10000);
          return;
        }

        if (node.tagName && node.tagName.toLowerCase() === 'canvas') {
          try {
            const dataUrl = node.toDataURL('image/png');
            window.open(dataUrl, '_blank');
            return;
          } catch (_) {}
        }

        const blob = await domToPngBlob(node, Number(dpiInput.value));
        const url = registerObjectUrl(URL.createObjectURL(blob));
        window.open(url, '_blank');
        setTimeout(() => clearObjectUrl(url), 10000);
      } catch (err) {
        console.error(err);
        showError('Impossible d\'ouvrir l\'image.');
      }
    });

    const dlBtn = document.createElement('button');
    dlBtn.className = 'btn';
    dlBtn.textContent = 'Télécharger';
    dlBtn.addEventListener('click', async () => {
      try {
        if (formatSelect.value === 'svg' && isSvg) {
          const svgText = new XMLSerializer().serializeToString(node);
          const blob = new Blob([svgText], { type: 'image/svg+xml' });
          downloadBlob(blob, `code_${sanitizeFilename(text)}.svg`);
        } else {
          const blob = await domToPngBlob(node, Number(dpiInput.value));
          downloadBlob(blob, `code_${sanitizeFilename(text)}.png`);
        }
      } catch (err) {
        console.error(err);
        showError('Erreur lors du téléchargement.');
      }
    });

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn';
    saveBtn.textContent = 'Enregistrer dans la bibliothèque';
    saveBtn.addEventListener('click', async () => {
      try {
        setDisabled(saveBtn, true);
        saveBtn.textContent = 'Enregistrement...';

        const preferSvg = (formatSelect.value === 'svg' && isSvg);
        const { blob, filename } = await nodeToBlobAndName(node, text, preferSvg);
        const ppi = Number(dpiInput.value) || 300;
        const asset = await uploadToLibrary(blob, filename, 'codegenerator', ppi, ['generated']);

        showToast('Asset enregistré en bibliothèque.');

        const assetId = asset && (asset.id || asset.asset_id);
        if (assetId) {
          let openLabelBtn = actions.querySelector('[data-role="open-label"]');
          let openZimagerBtn = actions.querySelector('[data-role="open-zimager"]');

          if (!openLabelBtn) {
            openLabelBtn = document.createElement('button');
            openLabelBtn.className = 'btn';
            openLabelBtn.dataset.role = 'open-label';
            openLabelBtn.textContent = 'Ouvrir dans LabelGenerator';
            openLabelBtn.addEventListener('click', () => {
              window.open(buildOneClickUrl(assetId, 'label'), '_blank');
            });
            actions.appendChild(openLabelBtn);
          }

          if (!openZimagerBtn) {
            openZimagerBtn = document.createElement('button');
            openZimagerBtn.className = 'btn';
            openZimagerBtn.dataset.role = 'open-zimager';
            openZimagerBtn.textContent = 'Ouvrir dans Zimager';
            openZimagerBtn.addEventListener('click', () => {
              window.open(buildOneClickUrl(assetId, 'zimager'), '_blank');
            });
            actions.appendChild(openZimagerBtn);
          }
        }
      } catch (err) {
        console.error(err);
        showToast('Erreur lors de l\'enregistrement.');
      } finally {
        saveBtn.textContent = 'Enregistrer dans la bibliothèque';
        setDisabled(saveBtn, false);
      }
    });

    actions.appendChild(openBtn);
    actions.appendChild(dlBtn);
    actions.appendChild(saveBtn);

    resultsEl.appendChild(card);
  }

  /* Génération principale : interprétation des entrées et création des images. */
  function clearResults() {
    if (resultsEl) resultsEl.innerHTML = '';
    showError('');
  }

  async function loadLogoFromLibraryIfNeeded() {
    const logoSource = document.querySelector('input[name="logoSource"]:checked')?.value || 'local';
    if (logoSource !== 'library') return logoDataUrl;

    const id = (logoLibraryIdInput && logoLibraryIdInput.value) ? logoLibraryIdInput.value.trim() : '';
    if (!id) return null;

    try {
      const resp = await fetchWithTimeout(`${API_BASE}/get.php?id=${encodeURIComponent(id)}`);
      if (!resp.ok) throw new Error('Impossible de récupérer le logo');

      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const meta = await resp.json();
        const url = meta.url || meta.path;
        if (!url) throw new Error('URL du logo absente');
        const blob = await fetchBlob(absoluteUrl(url));
        return await fileToDataUrl(new File([blob], meta.filename || `logo_${id}`, { type: blob.type }));
      }

      const blob = await resp.blob();
      return await fileToDataUrl(new File([blob], `logo_${id}`, { type: blob.type }));
    } catch (e) {
      console.error(e);
      showToast('Impossible de récupérer le logo depuis la bibliothèque.');
      return null;
    }
  }

  async function handleGenerate() {
    showError('');
    clearResults();

    const raw = inputData.value || '';
    const lines = (perLine && perLine.checked)
      ? raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
      : [raw.trim()].filter(Boolean);

    if (lines.length === 0) {
      showError('Aucune donnée fournie.');
      return;
    }

    const color = colorInput.value || '#000000';
    const size = Math.max(64, Number(sizeInput.value) || 256);
    const format = barcodeFormat.value || 'CODE128';
    const bHeight = Math.max(1, Number(barcodeHeight.value) || 80);
    const bLength = Math.max(100, Number(barcodeLength.value) || 260);
    const correct = qrCorrection.value || 'M';

    let logoToUse = logoDataUrl;
    if ((document.querySelector('input[name="logoSource"]:checked')?.value || 'local') === 'library') {
      logoToUse = await loadLogoFromLibraryIfNeeded();
    }

    for (const line of lines) {
      try {
        if (typeBarcode && typeBarcode.checked) {
          const err = validateBarcodeInput(line, format);
          if (err) {
            showError(`Erreur validation pour "${line}" : ${err}`);
            continue;
          }

          const svg = generateBarcodeSvg(line, format, bLength, bHeight, color);
          svg.setAttribute('role', 'img');
          svg.setAttribute('aria-label', `Code-barres ${line}`);
          await pushResult(line, svg, true);
        } else {
          const canvas = await generateQrImage(line, size, color, correct, logoToUse);
          if (canvas && canvas.setAttribute) {
            canvas.setAttribute('role', 'img');
            canvas.setAttribute('aria-label', `QR code ${line}`);
          }
          await pushResult(line, canvas, false);
        }
      } catch (err) {
        console.error('Erreur génération pour', line, err);
        showError(`Erreur génération pour "${line}".`);
      }
    }
  }

  async function downloadAllSaved() {
    const cards = Array.from(resultsEl.querySelectorAll('.result-card, .result-item'));
    if (cards.length === 0) {
      showError('Aucun résultat à télécharger.');
      return;
    }

    showError('');

    for (const card of cards) {
      const media = card.querySelector('.result-media');
      if (!media) continue;

      const imgNode = media.querySelector('canvas') || media.querySelector('svg') || media.querySelector('img');
      if (!imgNode) continue;

      try {
        if (imgNode.tagName && imgNode.tagName.toLowerCase() === 'svg' && formatSelect.value === 'svg') {
          const svgText = new XMLSerializer().serializeToString(imgNode);
          const blob = new Blob([svgText], { type: 'image/svg+xml' });
          downloadBlob(blob, `codes_${Date.now()}.svg`);
        } else {
          const blob = await domToPngBlob(imgNode, Number(dpiInput.value));
          downloadBlob(blob, `codes_${Date.now()}.png`);
        }
      } catch (err) {
        console.error(err);
        showError('Erreur lors du téléchargement multiple.');
      }
    }
  }

  /* Mise en place des événements UI (changements, clics, handlers). */
  if (typeQr) typeQr.addEventListener('change', updateTypeUI);
  if (typeBarcode) typeBarcode.addEventListener('change', updateTypeUI);

  document.querySelectorAll('input[name="logoSource"]').forEach(r => {
    r.addEventListener('change', updateLogoSourceUI);
  });

  if (generateBtn) {
    generateBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleGenerate().catch(err => {
        console.error(err);
        showError('Erreur lors de la génération.');
      });
    });
  }

  if (downloadAllBtn) {
    downloadAllBtn.addEventListener('click', (e) => {
      e.preventDefault();
      downloadAllSaved().catch(err => {
        console.error(err);
        showError('Erreur téléchargement.');
      });
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (inputData) inputData.value = '';
      if (inputDataCount) inputDataCount.textContent = `0 / ${MAX_TOTAL_CHARS}`;
      if (logoInput) logoInput.value = '';
      if (logoLibraryIdInput) logoLibraryIdInput.value = '';
      logoDataUrl = null;
      logoFileObject = null;
      logoLibraryId = null;
      if (logoPreview) logoPreview.innerHTML = '';
      clearResults();
    });
  }

  if (openLibraryBtn) openLibraryBtn.addEventListener('click', openLibraryModal);
  if (libClose) libClose.addEventListener('click', closeLibraryModal);
  if (libRefresh) libRefresh.addEventListener('click', buildLibraryGrid);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (libraryModal && libraryModal.style.display === 'flex') closeLibraryModal();
    }
  });

  window.addEventListener('beforeunload', () => {
    for (const url of Array.from(objectUrlsToRevoke)) {
      clearObjectUrl(url);
    }
  });

  /* Initialisation initiale de l'interface au chargement. */
  updateTypeUI();
  updateLogoSourceUI();

  if (inputDataCount && inputData) {
    inputDataCount.textContent = `${inputData.value.length} / ${MAX_TOTAL_CHARS}`;
  }
})();