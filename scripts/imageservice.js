// Service "ImageService" : encapsule l'accès à la bibliothèque côté navigateur via IndexedDB.

const DB_NAME = 'CLB-Library';
const DB_VERSION = 2;
let db;

const script = document.createElement('script');
script.src = (window.location.pathname.includes('/codegenerator/') || 
              window.location.pathname.includes('/labelgenerator/') || 
              window.location.pathname.includes('/zimager/')) 
             ? '../pwa-config.php' 
             : 'pwa-config.php';
document.head.appendChild(script);

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event) => {
      db = event.target.result;
      if (!db.objectStoreNames.contains('images')) {
        const store = db.createObjectStore('images', { keyPath: 'id', autoIncrement: true });
        store.createIndex('filename', 'filename', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    
    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };
    
    request.onerror = (event) => reject(event.target.error);
  });
}

async function saveToLibrary(file, metadata = {}) {
  const arrayBuffer = await file.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
  
  const record = {
    filename: file.name,
    type: file.type,
    size: file.size,
    timestamp: Date.now(),
    data: base64,
    ...metadata
  };
  
  const tx = db.transaction('images', 'readwrite');
  const store = tx.objectStore('images');
  const request = store.add(record);
  
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getLibrary() {
  const tx = db.transaction('images', 'readonly');
  const store = tx.objectStore('images');
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deleteFromLibrary(id) {
  const tx = db.transaction('images', 'readwrite');
  const store = tx.objectStore('images');
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

function generateThumbnail(file, maxWidth = 200) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ratio = maxWidth / img.width;
      canvas.width = maxWidth;
      canvas.height = img.height * ratio;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
  });
}

async function syncOfflineLibrary() {
  if (!navigator.onLine) return;
  console.log('🔄 Synchronisation bibliothèque hors-ligne...');
}

(async () => {
  await openDB();
  window.addEventListener('online', syncOfflineLibrary);
  
  window.ImageService = {
    saveToLibrary,
    getLibrary,
    deleteFromLibrary,
    generateThumbnail,
    syncOfflineLibrary
  };
  
  console.log('✅ ImageService PWA v2 initialisé (IndexedDB + offline ready)');
})();