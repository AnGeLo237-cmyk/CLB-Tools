// Module Zimager : interface d'imposition, rognage d'images (crop) et export PDF,
// tout en gérant la synchronisation avec la bibliothèque distante.

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

  /* Constantes : limites d'images, budget DPI et timeout réseau. */
  const MAX_IMAGES = 50;
  const DPI_BUDGET_POINTS = 50;
  const MAX_FILE_BYTES = 8_000_000;
  const FETCH_TIMEOUT_MS = 12_000;

  /* Utilitaires : conversions mm<->px, notifications et wrappers réseau. */
  const mmToPx = (mm, dpi)=> Math.round(mm * dpi / 25.4);
  const pxToMm = (px, dpi)=> (px * 25.4 / dpi);
  const toastEl = document.getElementById('toast');

  function showToast(msg, timeout = 3000) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), timeout);
  }
  function safeAlert(msg) { try { alert(msg); } catch(e) { console.log('alert:', msg); } }

  function fetchWithTimeout(url, opts = {}, timeout = FETCH_TIMEOUT_MS) {
    const controller = new AbortController();
    opts.signal = controller.signal;
    opts.credentials = opts.credentials || 'same-origin';
    const id = setTimeout(() => controller.abort(), timeout);
    return fetch(url, opts).finally(() => clearTimeout(id));
  }

  function sanitizeFilename(s) { return String(s).replace(/[^a-z0-9_\-\.]/gi, '_').slice(0, 120); }

  /* Références DOM : paramètres d'export, navigation pages et zone de scène. */
  const pageWidthEl = document.getElementById('pageWidthMm');
  const pageHeightEl = document.getElementById('pageHeightMm');
  const dpiEl = document.getElementById('dpi');
  const marginEl = document.getElementById('marginMm');
  const applyBtn = document.getElementById('applyPage');
  const fileInput = document.getElementById('fileInput');
  const thumbs = document.getElementById('thumbs');
  const exportBtn = document.getElementById('exportPdf');
  const saveLayoutBtn = document.getElementById('saveLayoutBtn');
  const openLibraryBtn = document.getElementById('openLibraryBtn');
  const autoLayoutBtn = document.getElementById('autoLayout');
  const gapMmEl = document.getElementById('gapMm');
  const pagesCountEl = document.getElementById('pagesCount');
  const prevPageBtn = document.getElementById('prevPage');
  const nextPageBtn = document.getElementById('nextPage');
  const currentPageEl = document.getElementById('currentPage');
  const stageContainer = document.getElementById('stage-container');
  const stageWrapper = document.getElementById('stage-wrapper');
  const imagesCountEl = document.getElementById('imagesCount');
  const maxImagesDisplay = document.getElementById('maxImagesDisplay');
  const dpiBudgetEl = document.getElementById('dpiBudget');
  const dpiUsedEl = document.getElementById('dpiUsed');
  const printFormatEl = document.getElementById('printFormat');
  const cutMarksToggle = document.getElementById('cutMarksToggle');

  const libraryModal = document.getElementById('libraryModal');
  const libGrid = document.getElementById('libGrid');
  const libClose = document.getElementById('libClose');
  const libRefresh = document.getElementById('libRefresh');

  // Références pour l'inspecteur (dimensions/rotation) et la fenêtre de rognage.
  const inspector = document.getElementById('inspector');
  const insWidth = document.getElementById('insWidth');
  const insHeight = document.getElementById('insHeight');
  const insLockAspect = document.getElementById('insLockAspect');
  const insApply = document.getElementById('insApply');
  const insDelete = document.getElementById('insDelete');
  const closeInspector = document.getElementById('closeInspector');
  const insRotate = document.getElementById('insRotate');
  const openCropToolBtn = document.getElementById('openCropTool');

  /* Etat de l'application : dpi, pages, images importées et sélection courante. */
  let dpi = Math.max(1, parseInt(dpiEl.value, 10) || 300);
  let pageWmm = Math.max(1, parseFloat(pageWidthEl.value) || 210);
  let pageHmm = Math.max(1, parseFloat(pageHeightEl.value) || 297);
  let marginMm = Math.max(0, parseFloat(marginEl ? marginEl.value : 5) || 5);
  let gapMm = Math.max(0, parseFloat(gapMmEl ? gapMmEl.value : 2) || 2);

  let images = [];
  let pages = [[]];
  let currentPage = 0;

  let stage = null, layer = null, cutLayer = null, displayScale = 1;
  let selectedNode = null;
  let cutMarksEnabled = cutMarksToggle ? !!cutMarksToggle.checked : false;

  const objectUrlsToRevoke = new Set();

  /* Initialisation de l'UI : valeurs de départ et affichage de l'usage DPI. */
  maxImagesDisplay.textContent = MAX_IMAGES;
  dpiBudgetEl.textContent = DPI_BUDGET_POINTS;
  imagesCountEl.textContent = 0;
  updateDpiUsageDisplay();


  /* Calcul et rendu des repères de coupe (cut marks) sur la page. */
  function getRotatedBoundsPx(x, y, w, h, rotationDeg) {
    const cx = x + (w / 2);
    const cy = y + (h / 2);
    const rad = (Number(rotationDeg) || 0) * Math.PI / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const bw = (w * cos) + (h * sin);
    const bh = (w * sin) + (h * cos);
    return { x: cx - (bw / 2), y: cy - (bh / 2), w: bw, h: bh };
  }

  function getPlacementBoundsPx(p, scaleFactor = 1) {
    const x = mmToPx(p.x_mm, dpi) * scaleFactor;
    const y = mmToPx(p.y_mm, dpi) * scaleFactor;
    const w = mmToPx(p.w_mm, dpi) * scaleFactor;
    const h = mmToPx(p.h_mm, dpi) * scaleFactor;
    return getRotatedBoundsPx(x, y, w, h, p.rotation_deg || 0);
  }

  function renderPreviewCutMarks(pageIdx) {
    if (!cutLayer || !cutMarksEnabled) return;
    cutLayer.destroyChildren();

    const placements = pages[pageIdx] || [];
    placements.forEach((p) => {
      const b = getPlacementBoundsPx(p, displayScale);
      cutLayer.add(new Konva.Rect({
        x: Math.round(b.x - 3),
        y: Math.round(b.y - 3),
        width: Math.max(1, Math.round(b.w + 6)),
        height: Math.max(1, Math.round(b.h + 6)),
        stroke: 'rgba(70,70,70,0.9)',
        strokeWidth: 1,
        dash: [12, 8],
        listening: false,
        name: 'cutmark'
      }));
    });

    cutLayer.draw();
  }

  function drawCutMarksOnCanvas(ctx, placements) {
    if (!cutMarksEnabled) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(70,70,70,0.9)';
    ctx.lineWidth = Math.max(1, Math.round(dpi / 400));
    ctx.setLineDash([12, 8]);

    placements.forEach((p) => {
      const b = getPlacementBoundsPx(p, 1);
      ctx.strokeRect(
        Math.round(b.x - 3),
        Math.round(b.y - 3),
        Math.max(1, Math.round(b.w + 6)),
        Math.max(1, Math.round(b.h + 6))
      );
    });

    ctx.restore();
  }

  if (cutMarksToggle) {
    cutMarksToggle.addEventListener('change', () => {
      cutMarksEnabled = !!cutMarksToggle.checked;
      if (stage) renderPage(currentPage);
    });
  }

  window.addEventListener('beforeunload', () => {
    for (const u of objectUrlsToRevoke) try { URL.revokeObjectURL(u); } catch {}
  });

  /* Gestion du "budget DPI" :
     calcul du coût en points (qualité/poids) et ajustement automatique si la limite est dépassée. */
  function pointsForPpi(ppi) { if (!ppi || ppi <= 0) return 0; return Math.ceil(ppi / 100); }
  function totalPointsIf(imgs) { return imgs.reduce((s,i)=> s + pointsForPpi(i.defaultPpi || dpi), 0); }
  function currentDpiPointsUsage() { return totalPointsIf(images); }
  function updateDpiUsageDisplay() { dpiUsedEl.textContent = currentDpiPointsUsage(); imagesCountEl.textContent = images.length; }

  function applyClampingWithNew(imagesWithNew){
    let projected = totalPointsIf(imagesWithNew);
    if (projected <= DPI_BUDGET_POINTS) return { success:true, scaled:false, newImages: imagesWithNew };
    const s = DPI_BUDGET_POINTS / projected;
    const adjusted = imagesWithNew.map(img => {
      const oldPpi = img.defaultPpi || dpi;
      let newPpi = Math.max(1, Math.floor(oldPpi * s));
      return {...img, _oldPpi: oldPpi, defaultPpi: newPpi};
    });
    let sum = adjusted.reduce((acc,cur)=> acc + pointsForPpi(cur.defaultPpi), 0);
    if (sum > DPI_BUDGET_POINTS) {
      const indices = adjusted.map((v,i)=>i).sort((a,b)=> adjusted[b].defaultPpi - adjusted[a].defaultPpi);
      let idxPos = 0;
      while(sum > DPI_BUDGET_POINTS && idxPos < indices.length){
        const i = indices[idxPos];
        if(adjusted[i].defaultPpi > 1){ adjusted[i].defaultPpi -= 1; sum = adjusted.reduce((acc,cur)=> acc + pointsForPpi(cur.defaultPpi), 0); }
        else idxPos++;
        if(idxPos >= indices.length){ idxPos = 0; const allOnes = adjusted.every(a=>a.defaultPpi === 1); if(allOnes) break; }
      }
    }
    return { success:true, scaled:true, newImages: adjusted };
  }

  /* Création de la scène Konva :
     dimensionnement en fonction de la page (mm), mise à l'échelle pour l'écran et initialisation des calques. */
  function createStage(){
    pageWmm = Math.max(1, parseFloat(pageWidthEl.value) || pageWmm);
    pageHmm = Math.max(1, parseFloat(pageHeightEl.value) || pageHmm);
    dpi = Math.max(1, parseInt(dpiEl.value,10) || dpi);
    marginMm = Math.max(0, parseFloat(marginEl ? marginEl.value : marginMm) || marginMm);

    const fullW = mmToPx(pageWmm, dpi);
    const fullH = mmToPx(pageHmm, dpi);
    const sidebarReserve = 340;
    const avail = Math.max(480, Math.min(1200, window.innerWidth - (sidebarReserve + 80)));
    displayScale = Math.min(1, avail / Math.max(fullW, fullH));

    stageContainer.innerHTML = '';
    const cssW = Math.round(fullW * displayScale);
    const cssH = Math.round(fullH * displayScale);
    stageContainer.style.width = cssW + 'px';
    stageContainer.style.height = cssH + 'px';

    stage = new Konva.Stage({ container: 'stage-container', width: cssW, height: cssH });
    layer = new Konva.Layer();
    cutLayer = new Konva.Layer();
    stage.add(layer);
    stage.add(cutLayer);

    const bg = new Konva.Rect({ x:0, y:0, width:cssW, height:cssH, fill:'#fff', name:'background' });
    layer.add(bg);

    stage.on('click', (e)=> { if(e.target === stage || e.target.name() === 'background') selectNode(null); });
    renderPage(currentPage);
  }

  function renderPage(pageIdx){
    if(!stage || !layer) return;
    layer.destroyChildren();
    const fullWpx = mmToPx(pageWmm, dpi) * displayScale;
    const fullHpx = mmToPx(pageHmm, dpi) * displayScale;
    const bg = new Konva.Rect({ x:0, y:0, width:fullWpx, height:fullHpx, fill:'#fff', name:'background' });
    layer.add(bg);

    const placements = pages[pageIdx] || [];
    placements.forEach((p, idx) => {
      const imgObj = images.find(i=>i.id === p.imgId);
      if(!imgObj) return;
      const image = new Image();
      image.onload = ()=> {
        const imgPpi = p.ppi || imgObj.defaultPpi || dpi;
        const sx = Math.round((p.crop && p.crop.left_mm ? p.crop.left_mm : 0) * imgPpi / 25.4);
        const sy = Math.round((p.crop && p.crop.top_mm ? p.crop.top_mm : 0) * imgPpi / 25.4);
        const sw = Math.max(1, Math.round(((p.crop && p.crop.width_mm) ? p.crop.width_mm : ((imgObj.naturalW * 25.4)/imgPpi)) * imgPpi / 25.4));
        const sh = Math.max(1, Math.round(((p.crop && p.crop.height_mm) ? p.crop.height_mm : ((imgObj.naturalH * 25.4)/imgPpi)) * imgPpi / 25.4));
        const node = new Konva.Image({
          image,
          x: mmToPx(p.x_mm, dpi) * displayScale,
          y: mmToPx(p.y_mm, dpi) * displayScale,
          width: mmToPx(p.w_mm, dpi) * displayScale,
          height: mmToPx(p.h_mm, dpi) * displayScale,
          name: 'placed',
          rotation: p.rotation_deg || 0,
          crop: { x: sx, y: sy, width: sw, height: sh }
        });
        node.offsetX(node.width()/2);
        node.offsetY(node.height()/2);
        node.x(node.x() + node.width()/2);
        node.y(node.y() + node.height()/2);
        node._pageIndex = pageIdx;
        node._placementIndex = idx;
        node._placement = p;
        layer.add(node);
        node.on('click', (e)=>{ e.cancelBubble = true; selectNode(node); });
        node.draggable(true);
        node.on('dragend', ()=> {
          const nx = (node.x() - node.offsetX()) / displayScale;
          const ny = (node.y() - node.offsetY()) / displayScale;
          const ref = pages[node._pageIndex][node._placementIndex];
          ref.x_mm = +(pxToMm(nx, dpi)).toFixed(1);
          ref.y_mm = +(pxToMm(ny, dpi)).toFixed(1);
          renderPage(node._pageIndex);
        });
        layer.draw();
      };
      image.src = imgObj.url;
    });

    layer.draw();
    renderPreviewCutMarks(pageIdx);
    updateDpiUsageDisplay();
    selectNode(null);
  }

  /* Vignette d'image et import :
     enregistre les dimensions naturelles, prépare les champs (W/H/PPP/copies) et alimente la scène. */
  function addThumb(file, url, naturalW, naturalH){
    if(images.length >= MAX_IMAGES){ safeAlert(`Limite d'images atteinte : ${MAX_IMAGES}`); return; }
    const id = 'img_' + (Date.now().toString(36) + '_' + (images.length+1));
    const imgObj = { id, file, url, naturalW, naturalH, defaultPpi: null };

    const candidateImages = images.map(i => ({...i, defaultPpi: i.defaultPpi || dpi}));
    candidateImages.push({...imgObj, defaultPpi: dpi});
    const clampResult = applyClampingWithNew(candidateImages);
    if(clampResult.scaled){
      for(let i=0;i<images.length;i++) images[i].defaultPpi = clampResult.newImages[i].defaultPpi;
      imgObj.defaultPpi = clampResult.newImages[clampResult.newImages.length - 1].defaultPpi;
      safeAlert('Budget DPI insuffisant — PPP ajustés automatiquement.');
    } else imgObj.defaultPpi = null;

    images.push(imgObj);
    imagesCountEl.textContent = images.length; updateDpiUsageDisplay();

    // Conteneur UI de la vignette : affiche l'image et expose les contrôles de placement/qualité.
    const wrapper = document.createElement('div'); wrapper.className = 'thumb-wrap';
    const defaultW = Math.round(Math.min(50, (naturalW / naturalH) * 50));
    const defaultH = Math.round((defaultW * naturalH / naturalW) * 10) / 10 || 50;
    wrapper.innerHTML = `
      <img class="thumb" src="${url}" alt="">
      <div style="flex:1">
        <div style="display:flex;gap:8px;align-items:center">
          <label style="flex:1">W (mm)<input class="wmm" type="number" min="0" step="0.1" value="${defaultW}"></label>
          <label style="flex:1">H (mm)<input class="hmm" type="number" min="0" step="0.1" value="${defaultH}"></label>
        </div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:8px">
          <label>Copies <input class="copies" type="number" min="1" value="1" style="width:72px"></label>
          <label style="margin-left:6px">PPP image <input class="ppi" type="number" min="1" placeholder="ex:300" style="width:84px"></label>
        </div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="addBtn" style="flex:1">Ajouter</button>
          <button class="removeImgBtn muted" style="flex:0">Suppr</button>
        </div>
      </div>
    `;
    thumbs.appendChild(wrapper);

    const wInput = wrapper.querySelector('.wmm');
    const hInput = wrapper.querySelector('.hmm');
    const copiesInput = wrapper.querySelector('.copies');
    const ppiInput = wrapper.querySelector('.ppi');
    const addBtn = wrapper.querySelector('.addBtn');
    const removeBtn = wrapper.querySelector('.removeImgBtn');

    if(imgObj.defaultPpi) ppiInput.value = imgObj.defaultPpi;

    wInput.addEventListener('input', ()=> {
      const w = Math.max(0, parseFloat(wInput.value) || defaultW);
      const h = Math.round((w * naturalH / naturalW) * 10) / 10;
      hInput.value = h;
    });

    ppiInput.addEventListener('input', ()=> {
      const p = parseInt(ppiInput.value,10);
      const idx = images.findIndex(it => it.id === imgObj.id);
      if (isNaN(p) || p < 1) { safeAlert('PPP doit être entier positif.'); ppiInput.value = images[idx].defaultPpi || ''; return; }
      const candidate = images.map(i=>({...i, defaultPpi: i.defaultPpi || dpi}));
      if(idx === -1) return;
      candidate[idx].defaultPpi = p;
      const res = applyClampingWithNew(candidate);
      if(res.scaled){
        for(let i=0;i<images.length;i++) images[i].defaultPpi = res.newImages[i].defaultPpi;
        safeAlert('Le PPP demandé a été ajusté automatiquement (budget).');
        ppiInput.value = images[idx].defaultPpi;
      } else if(res.success){
        images[idx].defaultPpi = p;
      } else {
        images[idx].defaultPpi = 1;
        ppiInput.value = 1;
      }
      updateDpiUsageDisplay();
      renderPage(currentPage);
    });

    addBtn.addEventListener('click', ()=> {
      const copies = Math.max(1, parseInt(copiesInput.value,10) || 1);
      const w_mm = Math.max(0, parseFloat(wInput.value) || defaultW);
      const h_mm = Math.max(0, parseFloat(hInput.value) || defaultH);
      addPlacementsForImage(imgObj.id, copies, w_mm, h_mm, imgObj.defaultPpi);
      renderPage(currentPage);
    });

    removeBtn.addEventListener('click', ()=> {
      const idx = images.findIndex(i=>i.id === imgObj.id);
      if(idx !== -1){
        images.splice(idx,1);
        thumbs.removeChild(wrapper);
        pages.forEach(pg => { for(let i = pg.length -1; i>=0; i--) if(pg[i].imgId === imgObj.id) pg.splice(i,1); });
        updateDpiUsageDisplay();
        renderPage(currentPage);
      }
    });

    return imgObj;
  }

  async function handleFiles(files){
    if(!files || files.length === 0) return;
    const toAdd = Array.from(files).slice(0, Math.max(0, MAX_IMAGES - images.length));
    for(const f of toAdd){
      if (!f.type.startsWith('image/')) { showToast('Fichier ignoré (non-image).'); continue; }
      if (f.size > MAX_FILE_BYTES) { showToast('Fichier trop volumineux (max 8MB).'); continue; }
      try {
        const url = URL.createObjectURL(f);
        objectUrlsToRevoke.add(url);
        const bmp = await createImageBitmap(f);
        addThumb(f, url, bmp.width, bmp.height);
      } catch(e){ console.error('Erreur lecture image', e); showToast('Impossible de lire une image locale.'); }
    }
    updateDpiUsageDisplay();
  }

  fileInput.addEventListener('change', (e)=> handleFiles(e.target.files));

  /* Construction du modèle de placement (pages + éléments) :
     déroule les copies en grille avec prise en compte de la marge, du gap et de la création de pages supplémentaires. */
  function addPlacementsForImage(imgId, copies, w_mm, h_mm, perImagePpi){
    const usableW = pageWmm - 2*marginMm;
    const usableH = pageHmm - 2*marginMm;
    let pageIndex = pages.length - 1;
    let cursorX = 0, cursorY = 0, rowH = 0;
    const last = pages[pageIndex];
    if(last && last.length > 0){
      let maxY = 0, maxX = 0;
      last.forEach(p=>{ maxY = Math.max(maxY, p.y_mm + p.h_mm); maxX = Math.max(maxX, p.x_mm + p.w_mm); });
      cursorX = (maxX <= usableW) ? (maxX % usableW) : 0;
      cursorY = Math.min(maxY, usableH);
    }
    for(let i=0;i<copies;i++){
      if(cursorX + w_mm > usableW + 1e-6){ cursorX = 0; cursorY += rowH + gapMm; rowH = 0; }
      if(cursorY + h_mm > usableH + 1e-6){ pages.push([]); pageIndex = pages.length - 1; cursorX = 0; cursorY = 0; rowH = 0; }
      pages[pageIndex].push({
        imgId,
        x_mm: marginMm + cursorX,
        y_mm: marginMm + cursorY,
        w_mm, h_mm, rotation_deg: 0,
        crop: { left_mm:0, top_mm:0, width_mm:null, height_mm:null },
        ppi: perImagePpi || null
      });
      cursorX += w_mm + gapMm;
      rowH = Math.max(rowH, h_mm);
    }
    pagesCountEl.textContent = 'Pages: ' + pages.length;
    currentPage = Math.min(currentPage, pages.length - 1);
    currentPageEl.textContent = currentPage + 1;
  }

  /* Sélection et inspection :
     synchronise la sélection Konva avec les champs de l'inspecteur (dimensions et rotation) et positionne le panneau. */
  function selectNode(node){
    selectedNode = node;
    if(!node){ inspector.style.display = 'none'; return; }
    const dispWpx = node.width();
    const dispHpx = node.height();
    const w_mm = +(pxToMm(dispWpx / displayScale, dpi)).toFixed(1);
    const h_mm = +(pxToMm(dispHpx / displayScale, dpi)).toFixed(1);
    insWidth.value = w_mm;
    insHeight.value = h_mm;
    insRotate.value = node.rotation() || 0;
    inspector.style.display = 'block';
    positionInspector(node);
  }

  function positionInspector(node){
    const nodeRect = node.getClientRect({ relativeTo: stage });
    const stageRect = stage.container().getBoundingClientRect();
    const insRect = inspector.getBoundingClientRect();
    const candRight = stageRect.left + nodeRect.x + nodeRect.width + 10;
    const candLeft = stageRect.left + nodeRect.x - insRect.width - 10;
    const candTop = Math.max(stageRect.top + nodeRect.y, 8);
    const left = (candRight + insRect.width < window.innerWidth - 10) ? candRight : Math.max(candLeft, 8);
    const top = (candTop + insRect.height > window.innerHeight - 10) ? Math.max(window.innerHeight - insRect.height - 10, 8) : candTop;
    inspector.style.left = `${Math.round(left)}px`;
    inspector.style.top = `${Math.round(top)}px`;
  }

  insApply.addEventListener('click', ()=>{
    if(!selectedNode) return;
    const newW = Math.max(0, parseFloat(insWidth.value) || 0);
    const newH = Math.max(0, parseFloat(insHeight.value) || 0);
    const rotate = parseFloat(insRotate.value) || 0;
    const pg = selectedNode._pageIndex; const idx = selectedNode._placementIndex;
    if(typeof pg !== 'number' || typeof idx !== 'number') return;
    pages[pg][idx].w_mm = newW; pages[pg][idx].h_mm = newH; pages[pg][idx].rotation_deg = rotate;
    renderPage(pg);
  });

  insDelete.addEventListener('click', ()=>{
    if(!selectedNode) return;
    const pg = selectedNode._pageIndex; const idx = selectedNode._placementIndex;
    pages[pg].splice(idx,1); renderPage(pg);
  });

  insWidth.addEventListener('input', ()=> {
    if(!selectedNode || !insLockAspect.checked) return;
    const origW = selectedNode.width() / displayScale; const origH = selectedNode.height() / displayScale;
    if(origH <= 0) return;
    const aspect = origW / origH;
    const newW = Math.max(0, parseFloat(insWidth.value) || 0);
    insHeight.value = +(newW / aspect).toFixed(1);
  });

  insHeight.addEventListener('input', ()=> {
    if(!selectedNode || !insLockAspect.checked) return;
    const origW = selectedNode.width() / displayScale; const origH = selectedNode.height() / displayScale;
    if(origH <= 0) return;
    const aspect = origW / origH;
    const newH = Math.max(0, parseFloat(insHeight.value) || 0);
    insWidth.value = +(newH * aspect).toFixed(1);
  });

  closeInspector.addEventListener('click', ()=> selectNode(null));
  window.addEventListener('resize', ()=> { if(selectedNode) positionInspector(selectedNode); });
  stageWrapper.addEventListener('scroll', ()=> { if(selectedNode) positionInspector(selectedNode); });

  /* Outil de rognage (Konva) :
     ouvre une modale, affiche une version mise à l'échelle de l'image et convertit le rectangle vers des mm. */
  const cropModal = document.getElementById('cropModal');
  const cropStageContainer = document.getElementById('cropStageContainer');
  let cropKonvaStage = null, cropLayer = null, cropImageNode = null, cropRect = null, cropTransformer = null;
  let cropTargetImgObj = null, cropTargetPlacementRef = null;

  function openCropModalForSelection(){
    if(!selectedNode){ safeAlert('Sélectionne d\'abord une image.'); return; }
    const placement = selectedNode._placement;
    const imgObj = images.find(i=>i.id === placement.imgId);
    if(!imgObj) return;
    cropTargetImgObj = imgObj; cropTargetPlacementRef = placement;
    cropModal.style.display = 'flex'; cropModal.setAttribute('aria-hidden','false');
    cropStageContainer.innerHTML = '';
    const containerRect = cropStageContainer.getBoundingClientRect();
    const w = containerRect.width || 800, h = containerRect.height || 500;
    cropKonvaStage = new Konva.Stage({ container: cropStageContainer, width: w, height: h });
    cropLayer = new Konva.Layer(); cropKonvaStage.add(cropLayer);

    createImageBitmap(imgObj.file).then(bmp => {
      const imgW = bmp.width, imgH = bmp.height;
      const scale = Math.min(w / imgW, h / imgH, 1);
      const dispW = Math.round(imgW * scale), dispH = Math.round(imgH * scale);
      const x = Math.round((w - dispW) / 2), y = Math.round((h - dispH) / 2);
      const tmpCan = document.createElement('canvas'); tmpCan.width = imgW; tmpCan.height = imgH;
      const tCtx = tmpCan.getContext('2d'); tCtx.drawImage(bmp, 0, 0);
      cropImageNode = new Konva.Image({ x, y, image: tmpCan, width: dispW, height: dispH });
      cropLayer.add(cropImageNode);
      cropRect = new Konva.Rect({
        x: x + dispW*0.05, y: y + dispH*0.05, width: Math.max(10, dispW*0.9), height: Math.max(10, dispH*0.9),
        stroke:'#00bcd4', strokeWidth:2, dash:[6,4], draggable:true
      });
      cropLayer.add(cropRect);
      cropTransformer = new Konva.Transformer({
        nodes: [cropRect],
        enabledAnchors: ['top-left','top-right','bottom-left','bottom-right','middle-left','middle-right','top-center','bottom-center'],
        rotateEnabled: false,
        boundBoxFunc: (oldBox, newBox) => {
          const minX = x, minY = y, maxX = x + dispW, maxY = y + dispH;
          if(newBox.x < minX) newBox.x = minX;
          if(newBox.y < minY) newBox.y = minY;
          if(newBox.x + newBox.width > maxX) newBox.width = maxX - newBox.x;
          if(newBox.y + newBox.height > maxY) newBox.height = maxY - newBox.y;
          return newBox;
        }
      });
      cropLayer.add(cropTransformer); cropLayer.draw();
    }).catch(err => { console.error('Erreur crop', err); safeAlert('Impossible d\'ouvrir le rognage.'); closeCropModal(); });
  }

  function closeCropModal(){
    if(cropKonvaStage){ cropKonvaStage.destroy(); cropKonvaStage = null; }
    cropStageContainer.innerHTML = '';
    cropModal.style.display = 'none'; cropModal.setAttribute('aria-hidden','true');
    cropImageNode = cropRect = cropTransformer = null; cropTargetImgObj = cropTargetPlacementRef = null;
  }

  document.getElementById('cropCancel').addEventListener('click', closeCropModal);
  document.getElementById('cropConfirm').addEventListener('click', ()=>{
    if(!cropRect || !cropImageNode || !cropTargetImgObj || !cropTargetPlacementRef){ closeCropModal(); return; }
    const imgDispX = cropImageNode.x(), imgDispY = cropImageNode.y();
    const imgDispW = cropImageNode.width(), imgDispH = cropImageNode.height();
    const rx = cropRect.x(), ry = cropRect.y(), rw = cropRect.width(), rh = cropRect.height();
    const leftRatio = (rx - imgDispX) / imgDispW;
    const topRatio = (ry - imgDispY) / imgDispH;
    const wRatio = rw / imgDispW, hRatio = rh / imgDispH;
    const pppi = cropTargetPlacementRef.ppi || cropTargetImgObj.defaultPpi || dpi;
    const sourceWidthMm = (cropTargetImgObj.naturalW * 25.4) / pppi;
    const sourceHeightMm = (cropTargetImgObj.naturalH * 25.4) / pppi;
    const left_mm = Math.max(0, leftRatio * sourceWidthMm);
    const top_mm = Math.max(0, topRatio * sourceHeightMm);
    const width_mm = Math.max(0, wRatio * sourceWidthMm);
    const height_mm = Math.max(0, hRatio * sourceHeightMm);
    cropTargetPlacementRef.crop = { left_mm, top_mm, width_mm, height_mm };
    closeCropModal(); renderPage(currentPage);
  });

  openCropToolBtn.addEventListener('click', openCropModalForSelection);

  /* Auto-layout :
     génère automatiquement une grille de placements à partir des dimensions naturelles et des contraintes de page. */
  function computeAutoLayout(){
    pages = [[]];
    const usableW = pageWmm - 2*marginMm;
    const usableH = pageHmm - 2*marginMm;
    let cursorX = 0, cursorY = 0, rowH = 0;
    for(const img of images){
      const defaultW = Math.min(usableW, 50);
      const aspect = img.naturalW / img.naturalH;
      const defaultH = +(defaultW / aspect).toFixed(1);
      if(cursorX + defaultW > usableW + 1e-6){ cursorX = 0; cursorY += rowH + gapMm; rowH = 0; }
      if(cursorY + defaultH > usableH + 1e-6){ pages.push([]); cursorX = 0; cursorY = 0; rowH = 0; }
      pages[pages.length - 1].push({ imgId: img.id, x_mm: marginMm + cursorX, y_mm: marginMm + cursorY, w_mm: defaultW, h_mm: defaultH, rotation_deg:0, crop:{left_mm:0,top_mm:0,width_mm:null,height_mm:null}, ppi: img.defaultPpi || null });
      cursorX += defaultW + gapMm;
      rowH = Math.max(rowH, defaultH);
    }
    pagesCountEl.textContent = 'Pages: ' + pages.length;
    currentPage = 0; currentPageEl.textContent = 1; renderPage(0);
  }

  /* Export PDF :
     compose chaque page (images + rognage + rotation + repères de coupe) et retourne un `Blob` si demandé. */
  async function exportPdfFull(returnBlob = false){
    exportBtn.disabled = true;
    dpi = Math.max(1, parseInt(dpiEl.value,10) || dpi);
    const usedPoints = currentDpiPointsUsage();
    if(usedPoints > DPI_BUDGET_POINTS){
      safeAlert(`Budget DPI dépassé (${usedPoints} > ${DPI_BUDGET_POINTS}). Ajuste PPP/DPI avant export.`); exportBtn.disabled = false; return;
    }
    const pdfDoc = await PDFLib.PDFDocument.create();
    for(let i=0;i<pages.length;i++){
      const w = mmToPx(pageWmm, dpi);
      const h = mmToPx(pageHmm, dpi);
      const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h;
      const ctx = tmp.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0,0,w,h);
      for(const p of pages[i]){
        const imgObj = images.find(x=>x.id === p.imgId); if(!imgObj) continue;
        const bmp = await createImageBitmap(imgObj.file);
        const imgPpi = p.ppi || imgObj.defaultPpi || dpi;
        const left_mm = Math.max(0, p.crop.left_mm || 0);
        const top_mm = Math.max(0, p.crop.top_mm || 0);
        const cropWmm = (p.crop.width_mm == null || p.crop.width_mm <= 0) ? ( (bmp.width * 25.4) / imgPpi - left_mm ) : p.crop.width_mm;
        const cropHmm = (p.crop.height_mm == null || p.crop.height_mm <= 0) ? ( (bmp.height * 25.4) / imgPpi - top_mm ) : p.crop.height_mm;
        const sx = Math.round(left_mm * imgPpi / 25.4);
        const sy = Math.round(top_mm * imgPpi / 25.4);
        const sw = Math.max(1, Math.round(cropWmm * imgPpi / 25.4));
        const sh = Math.max(1, Math.round(cropHmm * imgPpi / 25.4));
        const off = document.createElement('canvas'); off.width = sw; off.height = sh;
        const offCtx = off.getContext('2d'); offCtx.drawImage(bmp, sx, sy, sw, sh, 0, 0, sw, sh);
        const rot = (p.rotation_deg || 0) % 360;
        let finalCanvas = off;
        if(rot !== 0){
          const rad = rot * Math.PI / 180;
          const cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
          const rw = Math.round(off.width * cos + off.height * sin);
          const rh = Math.round(off.width * sin + off.height * cos);
          const rotCanvas = document.createElement('canvas'); rotCanvas.width = rw; rotCanvas.height = rh;
          const rctx = rotCanvas.getContext('2d'); rctx.translate(rw/2, rh/2); rctx.rotate(rad); rctx.drawImage(off, -off.width/2, -off.height/2);
          finalCanvas = rotCanvas;
        }
        const dw = mmToPx(p.w_mm, dpi);
        const dh = mmToPx(p.h_mm, dpi);
        const dx = mmToPx(p.x_mm, dpi);
        const dy = mmToPx(p.y_mm, dpi);
        ctx.drawImage(finalCanvas, 0, 0, finalCanvas.width, finalCanvas.height, dx, dy, dw, dh);
      }
      drawCutMarksOnCanvas(ctx, pages[i]);
      const blob = await new Promise(res => tmp.toBlob(res, 'image/png'));
      const arr = await blob.arrayBuffer();
      const png = await pdfDoc.embedPng(arr);
      const page = pdfDoc.addPage([w, h]);
      page.drawImage(png, { x: 0, y: 0, width: w, height: h });
    }
    const bytes = await pdfDoc.save();
    const b = new Blob([bytes], { type: 'application/pdf' });
    if(returnBlob) { exportBtn.disabled = false; return b; }
    const url = URL.createObjectURL(b); objectUrlsToRevoke.add(url);
    const a = document.createElement('a'); a.href = url; a.download = 'export.pdf'; a.click();
    setTimeout(()=> { try { URL.revokeObjectURL(url); objectUrlsToRevoke.delete(url); } catch(e){} }, 10000);
    exportBtn.disabled = false;
  }

  /* Envoi vers la bibliothèque :
     poste un fichier (image ou PDF) via `upload.php` en transmettant la source et des métadonnées optionnelles. */
  async function uploadToLibrary(fileOrBlob, filename, source = 'zimager', meta = {}){
    const fd = new FormData(); fd.append('file', fileOrBlob, filename); fd.append('source', source);
    if(meta && meta.ppi) fd.append('ppi', String(meta.ppi));
    if(meta && meta.name) fd.append('name', meta.name);
    if(meta && meta.tags) fd.append('tags', Array.isArray(meta.tags) ? meta.tags.join(',') : String(meta.tags));
    const res = await fetchWithTimeout(`${API_BASE}/upload.php`, { method:'POST', body: fd });
    if(!res.ok) throw new Error('upload failed');
    const json = await res.json();
    if(!(json && (json.ok || json.success))) throw new Error(json && (json.error || json.message) ? (json.error || json.message) : 'upload_failed');
    return json.asset || json.data || null;
  }

  saveLayoutBtn && saveLayoutBtn.addEventListener('click', async ()=>{
    try {
      disableActions(true);
      const blob = await exportPdfFull(true);
      if(!blob){ safeAlert('Erreur génération PDF.'); disableActions(false); return; }
      const name = `imposition_${Date.now()}.pdf`;
      const meta = { name, tags: ['layout','imposition'] };
      showToast('Envoi vers bibliothèque...');
      const asset = await uploadToLibrary(blob, name, 'zimager', meta);
      showToast('Export enregistré en bibliothèque.');
      if(asset && asset.id){ if(confirm('Ouvrir l’asset enregistré dans LabelGenerator ?')) window.open(`../labelgenerator/index.html?import_id=${encodeURIComponent(asset.id)}`, '_blank'); }
    } catch(err){ console.error('saveLayout failed', err); safeAlert('Échec de l\'enregistrement.'); }
    finally { disableActions(false); }
  });

  function disableActions(state){
    [applyBtn, exportBtn, saveLayoutBtn, openLibraryBtn, autoLayoutBtn].forEach(b => { if(!b) return; b.disabled = state; if(state) b.classList.add('disabled'); else b.classList.remove('disabled'); });
  }

  /* Bibliothèque :
     récupère la liste des assets (list.php), construit la grille UI et importe un asset sélectionné. */
  async function fetchLibraryList(){
    try {
      const res = await fetchWithTimeout(`${API_BASE}/list.php`, { cache: 'no-store' });
      if(!res.ok) throw new Error('liste impossible');
      const list = await res.json(); return Array.isArray(list) ? list : [];
    } catch (err) { console.error('fetchLibraryList', err); showToast('Erreur récupération bibliothèque.'); return []; }
  }

  function normalizeAsset(a){
    return {
      id: a.id || a.asset_id || a.filename || '',
      filename: a.filename || a.name || '',
      url: a.url || a.path || a.asset_url || a.src || '',
      thumb: a.thumb || a.preview || null,
      mime: a.mime || a.type || ''
    };
  }

  async function buildLibraryGrid(){
    libGrid.innerHTML = '<div class="hint-small">Chargement...</div>';
    const assets = await fetchLibraryList(); libGrid.innerHTML = '';
    if(!assets.length){ libGrid.innerHTML = '<div class="hint-small">Aucun asset trouvé.</div>'; return; }
    for(const raw of assets){
      const a = normalizeAsset(raw);
      const it = document.createElement('div'); it.className = 'lib-item';
      const img = document.createElement('img'); img.src = a.thumb || a.url || ''; img.alt = a.filename || a.id;
      const meta = document.createElement('div'); meta.className = 'meta'; meta.innerHTML = `<div>${a.filename || a.id}</div><div style="font-size:11px;color:#666">${a.mime || ''}</div>`;
      const insertBtn = document.createElement('button'); insertBtn.className = 'btn'; insertBtn.textContent = 'Importer ici';
      insertBtn.addEventListener('click', ()=> selectLibraryAssetForZimager(a));
      const openBtn = document.createElement('button'); openBtn.className = 'btn muted'; openBtn.textContent = 'Ouvrir';
      openBtn.addEventListener('click', ()=> window.open(a.url || '#', '_blank'));
      it.appendChild(img); it.appendChild(meta); it.appendChild(insertBtn); it.appendChild(openBtn);
      libGrid.appendChild(it);
    }
  }

  function openLibraryModal(){ libraryModal.style.display = 'flex'; libraryModal.setAttribute('aria-hidden','false'); libGrid.setAttribute('tabindex','0'); libGrid.focus(); buildLibraryGrid(); }
  function closeLibraryModal(){ libraryModal.style.display = 'none'; libraryModal.setAttribute('aria-hidden','true'); libGrid.innerHTML = ''; }

  libClose && libClose.addEventListener('click', closeLibraryModal);
  libRefresh && libRefresh.addEventListener('click', buildLibraryGrid);
  openLibraryBtn && openLibraryBtn.addEventListener('click', openLibraryModal);

  async function selectLibraryAssetForZimager(assetMeta){
    try {
      if(!assetMeta) return;
      if(assetMeta.url){
        const url = assetMeta.url;
        try {
          const res = await fetchWithTimeout(url, {}, 8000);
          if(res.ok){
            const blob = await res.blob();
            const ext = blob.type === 'image/svg+xml' ? 'svg' : (blob.type.includes('png') ? 'png' : 'jpg');
            const file = new File([blob], `${assetMeta.id || Date.now()}.${ext}`, { type: blob.type });
            const objectUrl = URL.createObjectURL(file);
            objectUrlsToRevoke.add(objectUrl);
            const bmp = await createImageBitmap(file);
            addThumb(file, objectUrl, bmp.width, bmp.height);
            showToast('Asset importé depuis la bibliothèque.');
          } else {
            addThumb(new File([], 'remote.png'), assetMeta.url, 1000, 800);
            showToast('Asset référencé depuis la bibliothèque.');
          }
        } catch (err) {
          console.warn('fetch remote asset failed, using URL as-is', err);
          addThumb(new File([], 'remote.png'), assetMeta.url, 1000, 800);
          showToast('Asset référencé depuis la bibliothèque.');
        }
      } else {
        const resp = await fetchWithTimeout(`${API_BASE}/get.php?id=${encodeURIComponent(assetMeta.id)}`);
        if(!resp.ok) throw new Error('get asset failed');
        const blob = await resp.blob();
        const ext = blob.type === 'image/svg+xml' ? 'svg' : (blob.type.includes('png') ? 'png' : 'jpg');
        const file = new File([blob], `${assetMeta.id}.${ext}`, { type: blob.type });
        const url = URL.createObjectURL(file); objectUrlsToRevoke.add(url);
        const bmp = await createImageBitmap(file);
        addThumb(file, url, bmp.width, bmp.height);
        showToast('Asset importé depuis la bibliothèque.');
      }
    } catch (err) { console.error('selectLibraryAssetForZimager', err); showToast('Impossible d\'importer l\'asset.'); }
    finally { closeLibraryModal(); }
  }

  /* Import via paramètre d'URL (Méthode E) :
     charge un asset depuis `get.php` puis l'ajoute comme vignette et élément de la scène. */
  async function handleImportIdFromUrl(){
    try {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('import_id') || params.get('asset_id');
      if(!id) return;
      const resp = await fetchWithTimeout(`${API_BASE}/get.php?id=${encodeURIComponent(id)}`);
      if(!resp.ok) throw new Error('asset fetch failed');
      const ct = resp.headers.get('content-type') || '';
      if(ct.includes('application/json')){
        const meta = await resp.json();
        const url = meta.url || meta.path || meta.asset_url;
        if(url){
          try {
            const r2 = await fetchWithTimeout(url, {}, 8000);
            if(r2.ok){
              const blob = await r2.blob();
              const ext = blob.type === 'image/svg+xml' ? 'svg' : (blob.type.includes('png') ? 'png' : 'jpg');
              const file = new File([blob], `${id}.${ext}`, { type: blob.type });
              const objectUrl = URL.createObjectURL(file); objectUrlsToRevoke.add(objectUrl);
              const bmp = await createImageBitmap(file); addThumb(file, objectUrl, bmp.width, bmp.height);
              showToast('Asset importé via URL.');
              return;
            }
          } catch(e){}
          addThumb(new File([], 'remote.png'), url, 1000, 800);
          showToast('Asset référencé via URL.');
          return;
        }
      }
      const blob = await resp.blob();
      const ext = blob.type === 'image/svg+xml' ? 'svg' : (blob.type.includes('png') ? 'png' : 'jpg');
      const file = new File([blob], `${id}.${ext}`, { type: blob.type });
      const url = URL.createObjectURL(file); objectUrlsToRevoke.add(url);
      const bmp = await createImageBitmap(file); addThumb(file, url, bmp.width, bmp.height);
      showToast('Asset importé via URL.');
    } catch (err) { console.error('handleImportIdFromUrl', err); showToast('Impossible d\'importer l\'asset via URL.'); }
  }

  /* Interactions UI :
     applique les modifications globales (DPI, taille de page) et déclenche les actions de navigation/export/auto-layout. */
  applyBtn.addEventListener('click', ()=>{
    const newDpi = parseInt(dpiEl.value,10); if(isNaN(newDpi) || newDpi < 1){ safeAlert('DPI doit être entier positif.'); dpiEl.value = dpi; return; }
    dpi = Math.max(1, newDpi);
    const newW = parseFloat(pageWidthEl.value); const newH = parseFloat(pageHeightEl.value);
    if(isNaN(newW) || newW < 1){ safeAlert('Largeur page >= 1 mm.'); pageWidthEl.value = pageWmm; return; }
    if(isNaN(newH) || newH < 1){ safeAlert('Hauteur page >= 1 mm.'); pageHeightEl.value = pageHmm; return; }
    pageWmm = Math.max(1, newW); pageHmm = Math.max(1, newH);
    marginMm = Math.max(0, parseFloat(marginEl ? marginEl.value : marginMm) || marginMm);
    const candidateImgs = images.map(i => ({...i, defaultPpi: i.defaultPpi || dpi}));
    const clampCandidate = applyClampingWithNew(candidateImgs);
    if(clampCandidate.scaled){ for(let i=0;i<images.length;i++) images[i].defaultPpi = clampCandidate.newImages[i].defaultPpi; safeAlert('PPP ajustés pour respecter le budget DPI.'); }
    createStage();
  });

  autoLayoutBtn.addEventListener('click', ()=>{ gapMm = Math.max(0, parseFloat(gapMmEl.value) || gapMm); computeAutoLayout(); });
  exportBtn.addEventListener('click', ()=> exportPdfFull());
  prevPageBtn.addEventListener('click', ()=>{ if(currentPage>0){ currentPage--; currentPageEl.textContent = currentPage+1; renderPage(currentPage); }});
  nextPageBtn.addEventListener('click', ()=>{ if(currentPage < pages.length - 1){ currentPage++; currentPageEl.textContent = currentPage+1; renderPage(currentPage); }});
  printFormatEl.addEventListener('change', (e)=> {
    const v = e.target.value;
    if(v === 'A4'){ pageWidthEl.value = 210; pageHeightEl.value = 297; }
    else if(v === 'A3'){ pageWidthEl.value = 297; pageHeightEl.value = 420; }
    else if(v === 'A5'){ pageWidthEl.value = 148; pageHeightEl.value = 210; }
    else if(v === 'Letter'){ pageWidthEl.value = 216; pageHeightEl.value = 279; }
  });

  /* Contrôles d'interface :
     gestion de la fermeture/ouverte du panneau latéral et de l'affichage du menu principal. */
  const collapseBtn = document.getElementById('collapseBtn');
  const navToggle = document.getElementById('navToggle');
  const primaryNav = document.getElementById('primaryNav');
  collapseBtn && collapseBtn.addEventListener('click', ()=>{
    const collapsed = document.body.classList.toggle('side-collapsed');
    collapseBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    collapseBtn.innerHTML = collapsed ? '<i class="fas fa-chevron-right"></i>' : '<i class="fas fa-chevron-left"></i>';
    setTimeout(()=> createStage(), 320);
  });
  navToggle && navToggle.addEventListener('click', ()=>{ const isOpen = primaryNav.classList.toggle('show'); navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false'); });

  /* Initialisation :
     démarre la scène, affiche le compteur de pages et déclenche l'import automatique depuis l'URL si présent. */
  createStage();
  pagesCountEl.textContent = 'Pages: ' + pages.length;
  currentPageEl.textContent = currentPage + 1;
  window.addEventListener('load', ()=>{ handleImportIdFromUrl().catch(()=>{}); });

})();