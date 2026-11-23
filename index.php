<?php
    // Ce fichier PHP est utilisé pour servir la page de présentation des modules de l'outil CLB-Tools.
?>

<!DOCTYPE html>
<html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css">
        <link rel="stylesheet" href="accueil.index.css">
        
        <link rel="manifest" href="manifest.php">
        <meta name="theme-color" content="#111111">
        <link rel="apple-touch-icon" href="Images/icon-192x192.png">
        <link rel="icon" href="Images/icon-512x512.png" type="image/png">
        
        <title>Mini_Projets_BAI</title>
    </head>
    <body>
        <header>
            <nav>
                <ul>
                    <div class="logo"><img src="Images/logo.png" alt="Logo">Berth-Ana Inc.</div>
                </ul>
            </nav>
        </header>

        <main>
            <h1 id="title">Modules de l'outils CLB-Tools</h1>
            <div id="ServiceContainer">
                <div class="serviceItem">
                    <ion-icon name="qr-code-outline" class="serviceLogo"></ion-icon>
                    <h3 class="itemTitle">Générateur de Code QR</h3>
                    <a href="codegenerator/index.html" class="itemBtn"><ion-icon name="add-outline"></ion-icon>Accéder au service</a>
                </div>
                <div class="serviceItem">
                    <ion-icon name="bookmarks-outline" class="serviceLogo"></ion-icon>
                    <h3 class="itemTitle">Générateur d'Étiquettes</h3>
                    <a href="labelgenerator/index.html" class="itemBtn"><ion-icon name="add-outline"></ion-icon>Accéder au service</a>
                </div>
                <div class="serviceItem">
                    <ion-icon name="images-outline" class="serviceLogo"></ion-icon>
                    <h3 class="itemTitle">Imposition/Impression d'Images</h3>
                    <a href="zimager/index.html" class="itemBtn"><ion-icon name="add-outline"></ion-icon>Accéder au service</a>
                </div>
            </div>
        </main>

        <footer>© Copyright 2026 Berth-Ana Inc. - All Rights Reserved</footer>

        <button id="installBtn" style="position:fixed;bottom:20px;right:20px;padding:12px 24px;background:#111;color:#fff;border:none;border-radius:50px;font-weight:bold;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:none;z-index:9999;cursor:pointer;">
        📲 Installer l’application
        </button>

        <script>
        // Enregistre le service worker (mode hors-ligne) et choisit automatiquement le bon chemin selon le sous-dossier courant.
        const currentPath = window.location.pathname;
        const swPath = currentPath.includes('/codegenerator/') || 
                        currentPath.includes('/labelgenerator/') || 
                        currentPath.includes('/zimager/') 
                        ? '../sw.js' 
                        : 'sw.js';

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register(swPath)
            .then(reg => console.log('✅ Service Worker enregistré (dynamique)'))
            .catch(err => console.error('❌ Erreur SW:', err));
        }

        // Affiche le bouton "Installer l’application" uniquement lorsque le navigateur déclenche l'événement PWA `beforeinstallprompt` (sinon il reste masqué).
        let deferredPrompt;
        const installBtn = document.getElementById('installBtn');
        window.addEventListener('beforeinstallprompt', e => {
            console.log('🔥 beforeinstallprompt déclenché !');
            e.preventDefault();
            deferredPrompt = e;
            installBtn.style.display = 'block';
        });
        installBtn.addEventListener('click', () => {
            if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then(() => { installBtn.style.display = 'none'; });
            deferredPrompt = null;
            }
        });
        </script>

        <script type="module" src="https://unpkg.com/ionicons@5.5.2/dist/ionicons/ionicons.esm.js"></script>
        <script nomodule src="https://unpkg.com/ionicons@5.5.2/dist/ionicons/ionicons.js"></script>
    </body>
</html>