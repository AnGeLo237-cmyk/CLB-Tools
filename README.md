# Introduction

## Objectif du système
`CLB-Tools` est une suite web modulaire (PWA) orientée production graphique et impression. Elle permet de :
1. Générer des **QR codes** et **codes-barres**.
2. Composer des **étiquettes** (PNG ou SVG) à partir d’informations produit (nom, SKU, prix) et d’images insérées (code-barres/QR).
3. Réaliser une **imposition multi-images** (mise en page en mm, édition et rognage) puis **exporter un PDF** prêt à imprimer.
4. Centraliser la **persistance** via une **bibliothèque d’assets** partagée : fichiers uploadés + miniatures + index `metadata.json`.

## Contexte et problématique résolue
Dans un flux de préparation d’éléments imprimés, les utilisateurs ont besoin de :
- créer rapidement des visuels (codes, étiquettes) ;
- conserver ces visuels et pouvoir les réutiliser facilement ;
- produire un export final imprimable (PDF) à partir d’images placées précisément en dimensions réelles.

`CLB-Tools` résout cette problématique en orchestrant une chaîne de production bout-en-bout, avec :
- une UI par outil spécialisé ;
- une API backend PHP file-based qui stocke et indexe les assets ;
- des intégrations “one-click import” entre modules via `import_id`.

## Portée du système (ce qu’il fait et ne fait pas)

### Ce que le système fait
- Hub PWA : `index.html` avec navigation vers :
  - `codegenerator/`
  - `labelgenerator/`
  - `zimager/`
- Backend API PHP (endpoints dans `api/`) :
  - upload : `upload.php`
  - listing : `list.php`
  - récupération : `get.php`
  - suppression : `delete.php`
  - miniatures : `thumb.php`
- Bibliothèque partagée dans `assets/library/` :
  - `uploads/` (fichiers)
  - `thumbs/` (miniatures)
  - `metadata.json` (index)
- Rendu/exports côté client :
  - QR et barcodes (canvas + SVG)
  - étiquettes (SVG natif + PNG rasterisé)
  - imposition (Konva + export PDF via pdf-lib)
- Mode PWA : `manifest.php` + `sw.js` + bouton `beforeinstallprompt`.

### Ce que le système ne fait pas
- Pas de base de données relationnelle (tout est indexé dans `metadata.json`).
- Pas d’authentification/gestion de rôles multi-utilisateur.
- Pas de pipeline CI/CD ni de tests automatisés fournis dans le dossier.
- Pas de chiffrement des fichiers stockés.
- Offline data pour les endpoints API non garanti (le SW met surtout en cache les ressources statiques et n’écrit pas systématiquement les réponses `/api/` dans le cache).

# Vue d’Architecture Globale (C4 Context + Container)

## Description haute niveau de l’architecture
Architecture **monolithe web modulaire** :
- **Conteneur navigateur** : pages HTML/CSS/JS propres à chaque module + runtime PWA (Service Worker + Manifest).
- **Conteneur serveur** : endpoints PHP dans `api/` + stockage disque dans `assets/library/`.

Les modules front se partagent un contrat implicite :
- un **id d’asset** ;
- une **représentation standard** dans `metadata.json` (champ `path`, `thumb`, `mime`, `ppi`, `tags`, etc.) ;
- une logique d’intégration via `import_id` et récupération via `get.php`.

## Schéma textuel / ASCII

```text
[Utilisateur navigateur]
        |
        v
[Hub / Modules PWA]
  - index.html
  - codegenerator/
  - labelgenerator/
  - zimager/
        |
        | HTTP(S) fetch / form-data
        v
[API Backend PHP (api/)]
  - upload.php  --> assets/library/uploads + thumb + metadata.json
  - list.php    --> metadata.json filtré + tri + pagination
  - get.php     --> metadata JSON ou streaming binaire (fichier/thumbnail)
  - thumb.php   --> génération/serving thumb (JPEG) via GD
  - delete.php  --> suppression physique + metadata.json
        |
        v
[File Storage / Bibliothèque]
  - assets/library/uploads/
  - assets/library/thumbs/
  - assets/library/metadata.json

[PWA Runtime]
  - manifest.php (dynamique)
  - sw.js (precaching + runtime cache-first / network-first)
  - pwa-config.php (injecte APP_BASE / API_BASE / ASSETS_BASE)
```

# Organisation et Structure du Code

## Arborescence des dossiers/fichiers de CLB-Tools

```text
CLB-Tools/
├── accueil.index.css
├── desc.txt
├── index.html
├── manifest.php
├── pwa-config.php
├── struct.text
├── sw.js
├── api/
│   ├── config.php
│   ├── lib.php
│   ├── list.php
│   ├── get.php
│   ├── upload.php
│   ├── delete.php
│   └── thumb.php
├── assets/
│   ├── init_library.ps1
│   ├── pwa/
│   │   └── manifest.json
│   └── library/
│       ├── metadata.json
│       ├── manifest.json
│       ├── uploads/
│       └── thumbs/
├── scripts/
│   └── imageservice.js
├── codegenerator/
│   ├── index.html
│   ├── script.js
│   └── style.css
├── labelgenerator/
│   ├── index.html
│   ├── script.js
│   └── style.css
├── zimager/
    ├── index.html
    ├── script.js
    └── style.css

```

## Rôle de chaque dossier et module principal
- **Racine** (`index.html`, `manifest.php`, `pwa-config.php`, `sw.js`) : orchestrateur PWA et configuration d’URL (support des déploiements en sous-dossier).
- **`api/`** : backend file-based (validation, persistance, génération de miniatures, index `metadata.json`).
- **`assets/library/`** : stockage persistant d’assets.
- **`codegenerator/`** : génération de QR / codes-barres, ajout optionnel d’un logo, upload en bibliothèque, export et liens vers autres modules.
- **`labelgenerator/`** : composition d’étiquette dimensionnée (SVG natif, export PNG via rasterisation), impression, upload en bibliothèque.
- **`zimager/`** : imposition multi-pages (auto-layout, édition interactive, crop, export PDF), upload en bibliothèque.
- **`scripts/`** : `imageservice.js` (IndexedDB offline “library”, non consommé explicitement par les modules stables dans les fichiers relus).

# Composants et Modules Principaux

## 1) Hub PWA (`index.html` + `accueil.index.css`)
- Rôle : page d’accueil et navigation vers les 3 outils.
- PWA :
  - `<link rel="manifest" href="manifest.php">`
  - enregistrement Service Worker avec logique de chemin selon le sous-dossier courant ;
  - bouton d’installation piloté par `beforeinstallprompt`.

## 2) Configuration PWA (`manifest.php`, `pwa-config.php`, `sw.js`)
- `manifest.php` :
  - renvoie un manifest JSON dynamique ;
  - calcule un `basePath` à partir de `$_SERVER['PHP_SELF']` pour supporter un hébergement en sous-dossier ;
  - définit `start_url` et `scope` en cohérence.
- `pwa-config.php` :
  - expose des constantes JS :
    - `APP_BASE`
    - `API_BASE`
    - `ASSETS_BASE`
  - calculées via le `base` du chemin réel.
- `sw.js` :
  - precache d’un ensemble d’URLs (`urlsToCache`) incluant pages et ressources ;
  - stratégie :
    - cache-first pour le “reste”,
    - network-first pour les appels contenant `/api/` (fallback sur `caches.match`).

## 3) Backend API file-based (`api/config.php`, `api/lib.php`, endpoints)

### `api/config.php` (configuration)
- Détermine :
  - chemins :
    - `LIB_ROOT`
    - `UPLOADS_DIR`
    - `THUMBS_DIR`
    - `METADATA_FILE`
  - limites :
    - taille max upload (8 MB)
    - MIME et extensions autorisés
  - paramètres thumb :
    - largeur/hauteur max (400x400)
    - qualité JPEG (85)
  - sécurité :
    - `API_KEY` optionnelle pour upload/suppression
    - `IMPORT_TOKEN_SECRET` pour HMAC de `import_token`
    - `ALLOW_PUBLIC_DOWNLOADS` (détermine si `get.php` exige un token).

### `api/lib.php` (bibliothèque commune)
- `ensure_dirs()` : crée dossiers `uploads/`, `thumbs/` + initialise `metadata.json` si absente.
- `send_json(payload, status)` : réponse JSON standardisée.
- `read_metadata()` / `write_metadata()` :
  - lecture JSON sous `flock(LOCK_SH)` ;
  - écriture atomique via fichier temporaire + `rename`.
- `generate_id()` : `random_bytes(12)` (hex) pour générer des IDs non prévisibles.
- `sanitize_filename()` : nettoyage de nom de fichier côté serveur.
- `ext_from_mime()` : mappe MIME vers extension, fallback sur extension originale.
- `create_thumb()` :
  - utilise GD selon MIME (images raster) ;
  - évite la rasterisation native pour `image/svg+xml` (thumb JPEG non créé).
- `get_asset(id)` : lit `metadata.json` et retourne l’entrée par `id`.
- `delete_asset(id)` : supprime fichiers associés (uploads + thumb) puis supprime l’entrée `metadata.json`.
- `asset_public_url(asset)` : construit une URL publique relative à partir de `path`.

### Endpoints
- `api/upload.php` :
  - `POST multipart/form-data` : champ `file` requis + métadonnées optionnelles (`source`, `ppi`, `tags`).
  - validation MIME + taille + extension.
  - stockage dans `assets/library/uploads/<id>.<ext>`
  - miniatures :
    - création thumb JPEG si possible ;
    - si non-réussite : `thumb = null`.
  - insertion dans `metadata.json` + `import_token = HMAC(id, IMPORT_TOKEN_SECRET)`.
- `api/list.php` :
  - `GET q`, `tag`, `page`, `limit`.
  - recherche :
    - `q` sur `filename` et sur tags join ;
    - `tag` sur appartenance stricte à `tags`.
  - tri :
    - par `uploaded_at` décroissant (comparaison string ISO).
  - pagination.
- `api/get.php` :
  - `GET id` (obligatoire).
  - si `meta=1` : renvoie `{ asset: <meta> }` (JSON).
  - sinon : renvoie le binaire avec `Content-Type`, `Content-Length` et support d’`attachment` via `download=1`.
  - si `ALLOW_PUBLIC_DOWNLOADS` est `false` : vérifie token HMAC (`token`) côté serveur.
  - streaming par blocs pour limiter l’usage mémoire.
- `api/delete.php` :
  - `POST` avec `id` (et `api_key` si configuré).
  - supprime fichiers physiques + met à jour `metadata.json`.
- `api/thumb.php` :
  - `GET id`.
  - renvoie miniatures existantes si présentes ;
  - sinon tente génération depuis le fichier original via `create_thumb` ;
  - fallback sur original (mime d’origine) si thumb impossible (ex: SVG).

## 4) Module `codegenerator/` (QR + code-barres)
- UI :
  - saisie multi-lignes (option `perLine`) ;
  - choix type code (QR vs code-barres) ;
  - options QR : correction d’erreur ;
  - options code-barres : format (CODE128/EAN13/UPC), hauteur/longueur ;
  - choix couleur ;
  - options logo :
    - upload local (fichier)
    - import depuis bibliotheque (sélection dans modal).
- Logique génération :
  - QR : `qrcodejs` (canvas) puis sur-couche logo si présent.
  - code-barres : `JsBarcode` (SVG), puis conversion possible en PNG lors export/enregistrement.
- Upload en bibliothèque :
  - conversion DOM -> `Blob` (canvas/SVG/IMG) ;
  - enregistrement via `api/upload.php` avec tags (ex: `generated`).
- Intégration inter-outils :
  - ajoute des boutons “Ouvrir dans LabelGenerator” et “Ouvrir dans Zimager” via `import_id`.

## 5) Module `labelgenerator/` (étiquettes)
- UI :
  - nom produit, SKU, prix (optionnel) ;
  - choix “image insérée” : code-barres ou QR ;
  - upload local de l’image, ou import depuis la bibliothèque (sélecteur modal) ;
  - dimensions : `widthMm` et `heightMm` (mm) ;
  - sortie : PNG ou SVG ;
  - DPI (affecte l’export PNG).
- Logique :
  - rendu aperçu dimensionné en mm (conteneur CSS).
  - construction SVG “composée” (texte + image intégrée dans `<image href="dataURL">`).
  - export :
    - SVG natif : blob SVG ;
    - PNG : conversion SVG -> canvas -> `Blob` PNG (via `Image` + `canvas.drawImage`).
  - impression : ouverture d’un HTML minimaliste et exécution `window.print()`.
- Enregistrement bibliothèque :
  - export (SVG ou PNG) puis `POST` à `api/upload.php` (source `labelgenerator`, tags `label`).
  - optionnel : prompt et redirection vers `zimager` avec `import_id`.

## 6) Module `zimager/` (imposition + crop + PDF)
- UI :
  - paramètres page :
    - format (custom/A4/A3/A5/Letter) ;
    - page width/height en mm ;
    - DPI global ;
    - marges mm ;
    - repères de coupe (toggle) ;
    - export PDF
  - gestion images :
    - upload multi-images local ;
    - pour chaque image : W/H mm, copies, PPP (optionnel) ;
    - vignettes + controls d’ajout/suppression ;
  - auto-layout :
    - gap mm ;
    - génération automatique de la grille.
  - édition :
    - stage Konva (drag/resize/rotation via inspecteur) ;
    - sélection de l’élément affichant un panneau d’inspection ;
    - outil de rognage (crop) via Konva.
- Modèle de données en mémoire :
  - `images[]` : objets contenant fichier local (File), `url` objectURL, dimensions naturelles, `defaultPpi`.
  - `pages[][]` : placements (imgId, x_mm, y_mm, w_mm, h_mm, rotation_deg, crop {left/top/width/height_mm}, ppi).
- Algorithmes clés :
  - **DPI budget** :
    - conversion `ppi -> points` (`ceil(ppi/100)`) ;
    - si budget dépassé, réduction automatique des PPP pour respecter une limite globale (50 points).
  - **Auto-layout** :
    - remplissage ligne/colonne dans l’espace disponible (page - marges), création de nouvelles pages si nécessaire.
  - **Crop** :
    - conversion d’un rectangle sélectionné en ratios d’emplacement -> mm source (à partir des dimensions naturelles et du PPP de placement).
- Export PDF :
  - rendus page par page :
    - pour chaque placement : extraction/crop sur canvas hors écran,
    - rotation éventuelle,
    - composition finale sur canvas,
    - embedding PNG dans un PDF via `pdf-lib`.
  - téléchargement et possibilité d’envoi en bibliothèque (`api/upload.php` avec tags `layout`, `imposition`).

## 7) `scripts/imageservice.js` (IndexedDB offline “library”)
- Construit une interface `window.ImageService` autour d’IndexedDB :
  - stocke des images en base locale (`data` base64) et métadonnées.
- Sert potentiellement de fondation offline, mais le code des modules stables ne montre pas d’intégration directe explicite.

## 8) Script d’initialisation Windows (`assets/init_library.ps1`)
- Crée `assets/library/uploads` et `assets/library/thumbs`.
- Initialise `assets/library/metadata.json` à `{}` si absent.
- Optionnellement applique une ACL “Modify” pour un compte web (`-WebUser`), typiquement requis pour IIS.

# Logique Métier et Fonctionnement

## Flux principal du système (end-to-end)

### Scénario A : Générer un QR/Code-barres -> enregistrer -> réutiliser
1. L’utilisateur ouvre `codegenerator/index.html`.
2. Il saisit une liste de valeurs (une par ligne si `perLine`).
3. En cliquant “Générer” :
   - création visuelle (QR canvas ou barcode SVG) pour chaque ligne ;
   - ajout du logo si sélectionné.
4. Pour chaque résultat :
   - clic “Enregistrer dans la bibliothèque” :
     1. conversion du DOM généré en `Blob` (canvas -> PNG, SVG -> SVG ou PNG selon option) ;
     2. envoi à `api/upload.php` ;
     3. réponse JSON avec `asset.id`.
5. L’utilisateur clique “Ouvrir dans LabelGenerator” ou “Ouvrir dans Zimager”.
6. Le module destination récupère l’asset via `get.php?id=<id>` et injecte l’image sélectionnée dans l’UI.

### Scénario B : Composer une étiquette -> export -> sauvegarde
1. L’utilisateur ouvre `labelgenerator/index.html`.
2. Il remplit nom, SKU, prix, dimensions, DPI et choisit l’image insérée.
3. “Prévisualiser” :
   - construit un SVG composite et ajuste dimensions mm.
4. “Télécharger” :
   - si PNG : conversion SVG -> PNG via canvas ;
   - si SVG : téléchargement du blob SVG.
5. “Enregistrer dans la bibliothèque” :
   - export SVG/PNG selon le choix ;
   - `POST` à `api/upload.php` (source `labelgenerator`, tags `label`).
6. Optionnel : prompt d’ouverture dans `zimager` avec `import_id`.

### Scénario C : Imposition multi-images -> édition/crop -> export PDF -> sauvegarde
1. L’utilisateur ouvre `zimager/index.html`.
2. Il configure format page, DPI global, marges et repères de coupe.
3. Il importe des images localement (multi) :
   - chaque image reçoit une vignette et des valeurs par défaut (PPP optionnel).
4. Il ajoute des placements via “Ajouter” (copies et dimensions).
5. Edition :
   - sélection d’un placement -> panneau d’inspection (dimensions + rotation) ;
   - “Rogner” ouvre un outil crop et met à jour `pages` avec des dimensions crop en mm.
6. Export :
   - “Exporter PDF” :
     - rendus canvas page par page ;
     - insertion PNG images dans PDF via `pdf-lib`.
7. “Enregistrer export (bibliothèque)” :
   - envoie le PDF en tant qu’asset à `api/upload.php` (source `zimager`).
   - optionnel : ouvre l’asset exporté dans `labelgenerator` via `import_id`.

## Algorithmes et règles métier importants
- **Génération QR** :
  - overlay du logo avec calcul d’une taille max = `size * 0.25` puis ratio et centrage.
- **Code-barres** :
  - `JsBarcode` en SVG ; fallback SVG texte si lib non chargée.
- **SVG -> PNG** :
  - dans `labelgenerator` et `codegenerator`, conversion :
    - `SVG` en `data:image/svg+xml` ;
    - rendu via `canvas.drawImage` ;
    - `toBlob('image/png')`.
- **Conversion mm <-> px** (règle commune) :
  - `px = mm * dpi / 25.4` ;
  - `mm = px * 25.4 / dpi`.
- **Auto-layout Zimager** :
  - utilise l’espace page disponible = `page - 2*marges` ;
  - remplit ligne par ligne avec `gapMm` ;
  - si insuffisant : nouvelle page.
- **Budget DPI** :
  - budget total en “points” ;
  - si dépassement :
    - réduction proportionnelle puis ajustement itératif des PPP des images (priorité à réduire les plus grandes).
- **Crop Zimager** :
  - mapping rectangle crop en ratios (left/top/width/height par rapport à l’image affichée) ;
  - conversion ratios -> mm sur la source réelle à partir des dimensions naturelles et PPP.

## Séquences d’exécution critiques
- Upload :
  - validation -> move_uploaded_file -> chmod -> create_thumb -> write_metadata atomique.
- Upload multi-modules :
  - conversion DOM -> `Blob` (rasterisation SVG si nécessaire) -> `POST /api/upload.php`.
- Récupération d’asset :
  - `get.php` :
    - meta-only ou binaire ;
    - streaming par blocs.
- Export PDF :
  - création d’un canvas page globale ;
  - crop extraction + rotation ;
  - composition + embedding PNG.

# Flux de Données et Interactions

## Comment les données circulent entre les composants
- Frontend -> API (principaux cas) :
  - `upload.php` reçoit un `multipart/form-data` :
    - `file` : image générée/exportée
    - `source` : nom du module
    - `ppi` : DPI/PPI métier (utile pour un traitement ultérieur)
    - `tags` : liste comma séparée
  - `list.php` renvoie une liste d’assets à afficher dans une grille de bibliothèque.
  - `get.php` renvoie soit :
    - la métadonnée JSON (paramètre `meta=1`)
    - soit le binaire image/PDF (streaming).
  - `thumb.php` renvoie une miniature JPEG (ou fallback sur original).
- API -> Stockage :
  - binaire stocké sur disque, indexé par entrée `metadata.json`.
- Interactions inter-modules :
  - passage de l’ID via `?import_id=<id>` ;
  - le module destination appelle `get.php?id=<id>` et injecte l’image dans l’UI.

## Formats de données, stockage, transformation

### `metadata.json` (schéma logique)
L’index est un objet JSON map :
- clé : `id` (hex) ;
- valeur : structure typique avec :
  - `id`, `filename`, `ext`, `mime`, `size`
  - `uploaded_at` (ISO string)
  - `path` (chemin uploads relatif)
  - `thumb` (chemin thumb relatif ou `null`)
  - `source` (module d’origine)
  - `ppi` (valeur métier, ex 300)
  - `tags` (array)
  - `import_token` (HMAC de l’ID, utile si téléchargement protégé).

### Transformations côté client
- Canvas/SVG/IMG -> PNG :
  - `canvas.toBlob('image/png')` ou rasterisation via canvas.
- SVG -> PNG :
  - encoding SVG en data URI -> `Image` -> draw -> toBlob.
- DOM -> fichier pour upload :
  - création de `Blob`/`File` puis `FormData` pour `api/upload.php`.

### Stockage backend
- Déplacement upload :
  - `move_uploaded_file(tmp, destPath)` ;
- Miniatures :
  - génération JPEG via GD ;
  - thumb = `id.jpg` dans `thumbs/`.
- Cohérence metadata :
  - write atomique (tmp + rename) pour réduire le risque de corruption.

# Dépendances et Interfaces Externes

## Dépendances techniques et bibliothèques
- Backend :
  - PHP (obligatoire)
  - Extensions PHP :
    - `fileinfo` (détection MIME)
    - `gd` (génération thumbnails)
- Frontend :
  - CDN externes :
    - Font Awesome (icônes)
    - Ionicons (icônes)
    - qrcodejs (QR)
    - JsBarcode (codes-barres)
    - html2canvas (fallback rasterisation, utilisé dans codegenerator)
    - Konva (édition et crop)
    - pdf-lib (export PDF)
- API web :
  - `Service Worker` + `Cache API` (sw.js)
  - `IndexedDB` (imageservice.js)
  - Canvas 2D (rasterisation)

## Interfaces avec d’autres systèmes
- Système de fichiers :
  - lecture/écriture dans `assets/library/*`.
- Serveur HTTP :
  - exécution PHP sur un hôte compatible (Apache/Nginx/PHP built-in).
- Déploiement en sous-dossier :
  - géré via `manifest.php` et `pwa-config.php` (basePath) et par logique de chemin côté HTML.

# Patterns, Bonnes Pratiques et Qualité

## Design patterns utilisés
- **Monolithe modulaire** :
  - UI séparées par dossier (`codegenerator`, `labelgenerator`, `zimager`) ;
  - backend séparé par endpoints.
- **Shared backend helpers** :
  - `api/lib.php` comme bibliothèque réutilisée par les endpoints.
- **Repository file-based** :
  - persistance directe disque + index `metadata.json`.
- **Modules front encapsulés** :
  - IIFE/closure (`(function(){ ... })()`), mode strict.

## Principes appliqués
- Validation “defensive” côté client et côté serveur :
  - limites numériques et erreurs UI côté JS ;
  - MIME + extensions + taille côté PHP.
- Cohérence de persistance :
  - écriture atomique metadata (tmp + rename).
- Limitation mémoire :
  - streaming fichier dans `get.php` par chunks.
- Gestion d’exécution :
  - fetch avec `AbortController` et timeout dans les modules.

## Points forts et choix d’implémentation remarquables
- Chaîne de production intégrée :
  - génération -> sauvegarde -> import -> export final.
- Calcul métier en unités réelles (mm ↔ DPI).
- Crop et placement gérés par un modèle interne simple (`pages`/`placements`) compatible export PDF.
- Token HMAC introduit pour un modèle de téléchargement protégé (configurable côté serveur).

## Points d’attention (qualité / risques)
- Concurrence metadata :
  - `read_metadata()` utilise `LOCK_SH` et écrit via `rename`, mais il n’y a pas de lock exclusif côté écriture (selon environnement, risque de race à très forte concurrence).
- PWA offline “API” partiel :
  - `sw.js` fallback sur cache pour `/api/` mais ne stocke pas systématiquement les réponses dans le cache.
- Absence de tests automatisés et pas de pipeline de qualité.
- Pas de CSP/SRI dans les pages (risque de posture sécurité/perf).

# Points d’Entrée et Utilisation

## Comment démarrer / utiliser le système
1. Déployer `CLB-Tools` sur un serveur exécutant PHP.
2. Vérifier que le serveur peut écrire dans :
   - `assets/library/uploads/`
   - `assets/library/thumbs/`
   - `assets/library/metadata.json` (création si absent).
3. (Optionnel recommandé sous Windows/IIS) initialiser la bibliothèque :
   - `assets/init_library.ps1`.
4. Ouvrir :
   - `index.html` (hub) depuis le navigateur.
5. Utiliser chaque outil depuis le hub :
   - créer -> enregistrer en bibliothèque -> importer -> exporter.

## Commandes principales, API, scripts d’exécution

### Initialisation bibliothèque (PowerShell Windows)
```powershell
cd CLB-Tools
.\assets\init_library.ps1 -WebUser "IIS_IUSRS"
```

### Endpoints API (contrat)
- `GET api/list.php`
  - params : `q`, `tag`, `page`, `limit`
  - renvoie : JSON avec `ok`, `total`, `page`, `limit`, `items`.
- `GET api/get.php`
  - params : `id` (obligatoire), `meta=1` (métadonnées), `token` (si téléchargement non public), `download=1`
  - renvoie : JSON (meta-only) ou streaming binaire.
- `POST api/upload.php`
  - `multipart/form-data` :
    - `file` (obligatoire)
    - `source` (optionnel)
    - `ppi` (optionnel)
    - `tags` (optionnel, comma-separated côté client)
    - `api_key` ou en-tête `Authorization: Bearer ...` si `API_KEY` configurée.
  - renvoie : JSON `{ ok:true, asset:{...} }`.
- `POST api/delete.php`
  - params : `id` requis ; `api_key` si activé.
  - renvoie : JSON `{ ok:true }` ou erreur.
- `GET api/thumb.php`
  - param : `id` requis.
  - renvoie : miniature JPEG si possible (sinon fallback original).

### Points d’entrée UI
- `index.html` : hub
- `codegenerator/index.html`
- `labelgenerator/index.html`
- `zimager/index.html`
- Variantes : `new/` (non alignées systématiquement avec la logique stable).

# Conclusion et Perspectives

## Résumé des forces du système
- Architecture simple à opérer : backend PHP + stockage disque + index JSON.
- Couverture métier alignée sur une chaîne d’impression :
  - codes -> étiquettes -> imposition -> PDF.
- Réutilisation d’assets entre outils via `import_id` et bibliothèque.
- Export contrôlé en unités réelles (mm + DPI) et rendu client riche.

## Améliorations possibles (recommandées)
1. Tests et qualité :
   - ajouter tests unitaires (JS et PHP) et e2e (playwright/cypress).
2. Robustesse PWA offline :
   - écrire des réponses `/api/` en cache (au moins pour `list.php` et `get.php?meta=1`).
   - ajouter fallback offline de navigation.
3. Sécurité :
   - CSP + SRI pour libs CDN,
   - durcir les entrées/sorties (notamment tags et filenames).
4. Concurrence metadata :
   - passer à un lock exclusif lors d’écriture ou un mécanisme de versioning.
5. Déduplication :
   - aligner/éliminer les divergences `new/` ou documenter le statut exact de ces prototypes.

# Documentation Technique Complete - CLB-Tools

## Introduction

### Objectif du systeme
CLB-Tools est une suite web modulaire orientee production graphique qui couvre trois besoins metier principaux :
1. generation de QR codes et codes-barres ;
2. creation d'etiquettes imprimables ;
3. imposition multi-images et export PDF pour impression.

Le systeme integre aussi une bibliotheque d'assets (uploads + metadonnees + miniatures) partagee entre les modules, afin de permettre des flux inter-outils (ex: CodeGenerator -> LabelGenerator -> Zimager).

### Contexte et problematique resolue
Dans un contexte de preparation d'elements graphiques pour impression, les utilisateurs avaient besoin d'une plateforme unique pour :
- creer les visuels (codes, etiquettes) ;
- les conserver en bibliotheque ;
- les reutiliser rapidement dans d'autres outils ;
- produire un export final imprimable (PDF).

CLB-Tools resout ce probleme en centralisant la chaine de production dans une PWA locale/serveur leger, avec backend PHP file-based.

### Portee du systeme (ce qu'il fait et ne fait pas)
#### Ce que le systeme fait
- fournit 3 applications frontend specialisees (`codegenerator`, `labelgenerator`, `zimager`) ;
- expose une API REST-like simple pour upload, listing, recuperation, suppression et miniatures ;
- stocke les assets dans `assets/library/uploads` avec metadonnees JSON ;
- gere la navigation "one-click import" entre modules via `import_id` ;
- prend en charge un mode PWA (manifest + service worker + installation).

#### Ce que le systeme ne fait pas
- pas de base de donnees relationnelle ;
- pas de gestion multi-utilisateurs/roles ;
- pas de pipeline CI/CD ou tests automatises versionnes ;
- pas de chiffrement fort des fichiers stockes ;
- pas de mecanisme robuste de sync offline->online (stub present cote JS).

## Vue d'Architecture Globale (C4 Context + Container)

### Description haute niveau de l'architecture
Architecture de type **monolithe web modulaire** :
- **Client web** : pages HTML/CSS/JS par outil ;
- **Serveur applicatif** : endpoints PHP dans `api/` ;
- **Stockage fichier** : dossier `assets/library` ;
- **PWA runtime** : `sw.js`, `manifest.php`, `pwa-config.php`.

Les applications frontend appellent l'API PHP pour persister ou relire les assets. La bibliotheque joue le role de backbone transverse entre modules.

### Schema textuel / ASCII
```text
[Utilisateur navigateur]
        |
        v
[Frontend Web Apps]
  - index.html (hub)
  - codegenerator/
  - labelgenerator/
  - zimager/
        |
        | HTTP(S) fetch/form-data
        v
[API PHP]
  - upload.php
  - list.php
  - get.php
  - delete.php
  - thumb.php
  - lib.php + config.php
        |
        | lecture/ecriture disque
        v
[File Storage]
  assets/library/uploads/
  assets/library/thumbs/
  assets/library/metadata.json

PWA transverse:
  sw.js <-> cache navigateur
  manifest.php / assets/pwa/manifest.json
  pwa-config.php -> constantes APP_BASE/API_BASE/ASSETS_BASE
```

## Organisation et Structure du Code

### Arborescence des dossiers/fichiers de CLB-Tools
```text
CLB-Tools/
|- index.html
|- accueil.index.css
|- sw.js
|- manifest.php
|- pwa-config.php
|- desc.txt
|- struct.text
|- api/
|  |- config.php
|  |- lib.php
|  |- upload.php
|  |- list.php
|  |- get.php
|  |- delete.php
|  |- thumb.php
|- assets/
|  |- init_library.ps1
|  |- pwa/manifest.json
|  |- library/
|     |- metadata.json
|     |- manifest.json
|     |- uploads/
|     |- thumbs/
|- scripts/
|  |- imageservice.js
|- codegenerator/
|  |- index.html
|  |- script.js
|  |- style.css
|- labelgenerator/
|  |- index.html
|  |- script.js
|  |- style.css
|- zimager/
   |- index.html
   |- script.js
   |- style.css

```

### Role de chaque dossier et module principal
- `api/` : couche backend, logique de stockage/validation/securite.
- `assets/library/` : repository d'assets et miniatures, indexe par `metadata.json`.
- `codegenerator/` : production QR/code-barres + enregistrement bibliotheque.
- `labelgenerator/` : composition d'etiquettes dimensionnelles PNG/SVG.
- `zimager/` : imposition multi-pages, edition placement et export PDF.
- `scripts/` : service client partage (`ImageService` IndexedDB/offline).

## Composants et Modules Principaux

### 1) Hub applicatif
- `index.html` : point d'entree principal, navigation vers les 3 outils.
- `accueil.index.css` : design responsive de la page d'accueil.
- integration PWA : enregistrement SW et bouton d'installation.

### 2) Couche PWA
- `sw.js` :
  - pre-cache d'assets statiques et CDN externes ;
  - strategie **network-first** pour `/api/` ;
  - strategie **cache-first** pour le reste.
- `manifest.php` : manifest dynamique adapte au sous-dossier de deploiement.
- `pwa-config.php` : injection de `APP_BASE`, `API_BASE`, `ASSETS_BASE`.
- `assets/pwa/manifest.json` : manifest statique de fallback.

### 3) API backend
#### `config.php`
Parametrage central :
- chemins de stockage ;
- limites (taille max, formats MIME/extensions) ;
- generation de miniatures ;
- securite (`API_KEY`, `IMPORT_TOKEN_SECRET`, politique public/private download).

#### `lib.php`
Bibliotheque transverse backend :
- creation/verification des repertoires ;
- lecture/ecriture atomique de `metadata.json` ;
- sanitation des noms de fichiers ;
- mapping MIME->extension ;
- creation de miniatures via GD ;
- suppression physique + suppression metadata.

#### `upload.php`
- endpoint `POST multipart/form-data` ;
- validation taille/type/ext ;
- stockage du fichier ;
- generation miniature ;
- insertion metadata + token HMAC (`import_token`).

#### `list.php`
- listing des assets avec filtres `q`, `tag` ;
- tri par recence (`uploaded_at`) ;
- pagination (`page`, `limit`) ;
- reponse JSON normalisee.

#### `get.php`
- recuperation metadata ou binaire selon parametres ;
- gestion optionnelle de token si telechargements non publics ;
- streaming fichier par chunks.

#### `delete.php`
- suppression asset par ID (POST) ;
- verification optionnelle de cle API ;
- suppression fichiers + metadonnees.

#### `thumb.php`
- renvoi d'une miniature existante ;
- regeneration a la demande si absente ;
- fallback sur original si miniature impossible (ex: SVG).

### 4) Frontend `codegenerator`
- types supportes : QR et code-barres ;
- validation forte des entrees (longueur, format EAN13/UPC, etc.) ;
- generation canvas/SVG ;
- ajout logo (upload local ou import bibliotheque) ;
- actions par resultat :
  1. ouvrir ;
  2. telecharger ;
  3. enregistrer en bibliotheque ;
  4. ouvrir directement dans LabelGenerator/Zimager via `import_id`.

### 5) Frontend `labelgenerator`
- formulaire metier (nom, SKU, prix, dimensions, type image) ;
- import d'image locale ou bibliotheque (barcode/QR) ;
- rendu d'apercu dimensionne en mm ;
- export SVG natif ou PNG via rasterisation ;
- impression directe ;
- enregistrement en bibliotheque et rebond optionnel vers Zimager.

### 6) Frontend `zimager`
- ajout d'images locales ou bibliotheque ;
- parametres page (format, dimensions, DPI, marges, gap) ;
- auto-layout multi-pages ;
- edition interactive (drag, resize, rotation, suppression) ;
- outil de rognage (crop) avec Konva ;
- export PDF multi-pages via `pdf-lib` ;
- enregistrement du PDF exporte en bibliotheque.

### 7) Services et scripts annexes
- `scripts/imageservice.js` : service IndexedDB (offline local), expose via `window.ImageService`.
- `assets/init_library.ps1` : script d'initialisation des dossiers + ACL Windows.

## Logique Metier et Fonctionnement

### Flux principal du systeme (end-to-end)
1. L'utilisateur genere un asset (ex: QR) dans `codegenerator`.
2. L'asset est converti en blob/image, puis uploade via `api/upload.php`.
3. L'API stocke le fichier, cree la miniature et met a jour `metadata.json`.
4. L'utilisateur ouvre `labelgenerator` avec `?import_id=<id>` pour reutiliser l'asset.
5. L'etiquette finale est exportee/enregistree puis eventuellement ouverte dans `zimager`.
6. `zimager` compose les pages d'impression et exporte un PDF final.

### Algorithmes et regles metier importants
- **Controle budget DPI (Zimager)** : chaque image consomme des points ; si depassement, les PPP sont reduits automatiquement.
- **Placement auto-layout** : placement ligne/colonne avec passage page selon marges et espace restant.
- **Validation de standards code-barres** : contraintes EAN13/UPC.
- **Generation miniature** : redimensionnement proportionnel bornant largeur/hauteur max.
- **Securite d'import** : tokens HMAC derives de l'ID asset.

### Sequences d'execution critiques
#### Upload asset
Client -> `upload.php` -> validation -> move file -> create thumb -> update metadata -> JSON reponse.

#### Import one-click
Module A ouvre Module B avec `import_id` -> Module B appelle `get.php` -> charge metadata/blob -> injecte dans UI.

#### Export PDF
Placements courants -> rendu canvas page par page -> embedding PNG dans `pdf-lib` -> blob PDF -> download/upload.

## Flux de Donnees et Interactions

### Comment les donnees circulent entre les composants
- Frontend envoie :
  - `multipart/form-data` pour uploads ;
  - `GET` query params pour listing/fetch/import.
- Backend renvoie :
  - JSON (`ok`, `items`, `asset`, erreurs) ;
  - binaire image/PDF selon endpoint et contexte.
- Frontend transforme :
  - canvas/SVG <-> blob ;
  - blob <-> dataURL ;
  - mm <-> px selon DPI.

### Formats de donnees, stockage, transformation
- **Stockage primaire** : fichiers dans `assets/library/uploads`.
- **Index metadata** : objet JSON mappe par `id` dans `assets/library/metadata.json`.
- **Miniatures** : JPEG en `assets/library/thumbs`.
- **Formats metier** :
  - entree: PNG/JPG/GIF/WEBP/SVG (selon endpoint) ;
  - sortie: PNG/SVG/PDF.

## Dependances et Interfaces Externes

### Dependances techniques et bibliotheques
- Frontend CDN :
  - `qrcodejs` ;
  - `JsBarcode` ;
  - `html2canvas` ;
  - `Konva` ;
  - `pdf-lib` ;
  - `Font Awesome` ;
  - `Ionicons`.
- Backend PHP :
  - extensions `fileinfo` et `gd` (pour miniatures raster).

### Interfaces avec d'autres systemes (si presentes)
- Pas d'API tierce metier.
- Dependance aux CDNs publics pour libs JS/CSS.
- Interface systeme de fichiers local/serveur (persistance).

## Patterns, Bonnes Pratiques et Qualite

### Design patterns utilises
- **Facade utilitaire backend** via `lib.php` pour mutualiser la logique.
- **Module pattern IIFE** cote frontend (`(function(){ ... })()`).
- **Repository file-based** pour la bibliotheque d'assets.
- **Progressive enhancement PWA** (fallback manifest statique + dynamique).

### Principes appliques (SOLID, Clean Architecture, etc.)
- Separation partielle des responsabilites :
  - UI par module ;
  - API specialisee par endpoint ;
  - configuration centralisee.
- Validation defensive cote client + cote serveur.
- Ecriture atomique metadata (fichier temporaire + rename).

### Points forts et choix d'implementation remarquables
- architecture modulaire claire et orientee usage ;
- interop transversale forte entre outils via `import_id` ;
- robustesse correcte des controles d'upload ;
- adaptation au deploiement en sous-dossier (`manifest.php`, `pwa-config.php`) ;
- bonne ergonomie de production (apercu, upload bibliotheque, rebonds entre apps).

## Points d'Entree et Utilisation

### Comment demarrer / utiliser le systeme
1. heberger le dossier sous un serveur PHP (Apache/Nginx/PHP builtin).
2. verifier les permissions d'ecriture sur `assets/library/uploads` et `assets/library/thumbs`.
3. initialiser la bibliotheque (optionnel recommande) avec PowerShell.
4. ouvrir `index.html` via le serveur.

### Commandes principales, API, scripts d'execution
#### Initialisation bibliotheque (Windows PowerShell)
```powershell
.\assets\init_library.ps1 -WebUser "IIS_IUSRS"
```

#### Endpoints API
- `GET api/list.php?q=&tag=&page=&limit=`
- `GET api/get.php?id=<assetId>[&meta=1][&token=...]`
- `POST api/upload.php` (form-data: `file`, `source`, `ppi`, `tags`, `api_key`)
- `POST api/delete.php` (`id`, `api_key` optionnelle)
- `GET api/thumb.php?id=<assetId>`

#### Points d'entree UI
- `index.html` (hub)
- `codegenerator/index.html`
- `labelgenerator/index.html`
- `zimager/index.html`

## Conclusion et Perspectives

### Resume des forces du systeme
CLB-Tools constitue une plateforme coherent de production graphique/print :
- modulaire ;
- simple a deployer ;
- orientee flux metier ;
- efficace pour reutiliser les assets entre outils ;
- techniquement accessible (stack web standard + PHP file-based).