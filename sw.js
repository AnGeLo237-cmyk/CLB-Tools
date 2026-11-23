// Service Worker PWA de CLB-Tools.
// Cache les ressources statiques pour le mode hors-ligne, avec une stratégie de priorité au cache,
// et un traitement spécifique des requêtes `/api/` pour privilégier la donnée la plus récente.

const CACHE_NAME = 'CLB-Tools-cache-v1';

const urlsToCache = [
  // Fichiers essentiels pour le fonctionnement de l'application, y compris les ressources dans les sous-dossiers.
  './',
  './index.php',
  './accueil.index.css',
  './manifest.php',
  './pwa-config.php',
  './scripts/imageservice.js',
  './assets/pwa/manifest.json',
  './pwa/manifest.json',
  
  // Images statiques (À compléter selon vos icônes réelles)
  './Images/logo.jpg',
  
  // Module AuthForm
  './authform/index.php',
  './authform/script.js',
  './authform/style.css',
  
  // Module Admin
  './admin/index.php',
  './admin/script.js',
  './admin/style.css',
  
  // Section Home et ses composants UI (uniquement les assets chargés par le client)
  './home/index.php',
  './home/style.css',
  './home/script.js', // Corrigé selon votre note (srcipt.js -> script.js)
  
  './home/components/cards/cards.css',
  './home/components/cards/cards.js',
  './home/components/cta/cta.css',
  './home/components/cta/cta.js',
  './home/components/features/features.css',
  './home/components/features/features.js',
  './home/components/footer/footer.css',
  './home/components/footer/footer.js',
  './home/components/hero/hero.css',
  './home/components/hero/hero.js',
  './home/components/library/library.css',
  './home/components/library/library.js',
  './home/components/navbar/navbar.css',
  './home/components/navbar/navbar.js',
  './home/components/workflow/workflow.css',
  './home/components/workflow/workflow.js',

  // Outils de production graphique
  './codegenerator/index.html',
  './codegenerator/script.js',
  './codegenerator/style.css',
  './labelgenerator/index.html',
  './labelgenerator/script.js',
  './labelgenerator/style.css',
  './zimager/index.html',
  './zimager/script.js',
  './zimager/style.css',
  
  // CDNs Externes
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css',
  'https://unpkg.com/ionicons@5.5.2/dist/ionicons/ionicons.esm.js',
  'https://unpkg.com/ionicons@5.5.2/dist/ionicons/ionicons.js',
  'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://unpkg.com/konva@8/konva.min.js',
  'https://unpkg.com/pdf-lib/dist/pdf-lib.min.js'
];

// Installer : pré-cache les URL listées et active immédiatement le nouveau SW.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Activer : supprime les caches obsolètes pour éviter les doublons.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
      );
    })
  );
});

// Stratégie de cache :
// - `/api/` : priorité au réseau (récupère d'abord, puis repli sur le cache)
// - autres ressources : priorité au cache (utile pour le mode hors-ligne)
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Pour les appels API : essayer de récupérer la version fraîche, sinon utiliser le cache.
  if (url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Pour tout le reste (HTML/CSS/JS/images/manifest) : priorité au cache.
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

console.log('✅ Service Worker CLB-Tools v1 chargé (portable + sous-dossiers)');