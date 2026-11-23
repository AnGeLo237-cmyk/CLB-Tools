<?php
require_once __DIR__ . '/lib.php';
$CFG = include __DIR__ . '/config.php';
ensure_dirs();

// Point d'entrée d'import/téléversement d'un fichier vers la bibliothèque.
// Reçoit un `POST multipart/form-data` contenant :
// - `file` (obligatoire) : le binaire à stocker
// - `source` (optionnel), `ppi` (optionnel), `tags` (optionnel)
// - `api_key` (optionnel côté client, sinon via en-tête `Authorization` avec schéma Bearer (jeton))
// Retour : JSON `{ ok:true, asset:{...} }` ou `{ ok:false, error:"..." }`
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    send_json(['ok' => false, 'error' => 'Method not allowed'], 405);
}

// Authentification : si `API_KEY` est configuré, le téléversement exige une clé valide.
$provided = null;
$hdr = isset($_SERVER['HTTP_AUTHORIZATION']) ? trim($_SERVER['HTTP_AUTHORIZATION']) : '';
if ($hdr && stripos($hdr, 'Bearer ') === 0) $provided = substr($hdr, 7);
if (!$provided && isset($_POST['api_key'])) $provided = $_POST['api_key'];
if ($CFG['API_KEY'] && !$provided) send_json(['ok'=>false,'error'=>'Missing API key'], 401);
if ($CFG['API_KEY'] && $provided !== $CFG['API_KEY']) send_json(['ok'=>false,'error'=>'Invalid API key'], 403);

// Validation de la présence du fichier.
if (!isset($_FILES['file']) || !is_uploaded_file($_FILES['file']['tmp_name'])) {
    send_json(['ok'=>false,'error'=>'No file uploaded'], 400);
}
$file = $_FILES['file'];
if ($file['size'] <= 0 || $file['size'] > $CFG['MAX_FILE_BYTES']) send_json(['ok'=>false,'error'=>'File too large or empty'], 413);

// Détection MIME côté serveur (finfo) pour limiter les faux types.
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);
if (!is_allowed_mime($mime)) send_json(['ok'=>false,'error'=>'MIME type not allowed: '.$mime], 415);

// Déduction de l'extension à partir du MIME (et repli sur le nom d'origine).
$ext = ext_from_mime($mime, $file['name']);
if (!is_allowed_ext($ext)) send_json(['ok'=>false,'error'=>'Extension not allowed: '.$ext], 415);

// Générer un identifiant et un chemin de destination dans le répertoire uploads.
$id = generate_id();
$filename_safe = sanitize_filename($file['name'] ?? 'upload');
$storeName = $id . '.' . $ext;
$destPath = $CFG['UPLOADS_DIR'] . '/' . $storeName;

// Déplacer le fichier temporaire vers la destination finale.
if (!move_uploaded_file($file['tmp_name'], $destPath)) send_json(['ok'=>false,'error'=>'Failed to move uploaded file'], 500);

// Permissions : standardisées pour une lecture simple côté serveur.
@chmod($destPath, 0644);

// Miniature JPEG (si possible) : certaines sources (ex. SVG) ne sont pas rasterisées.
$thumbName = $id . '.jpg';
$thumbPathFull = $CFG['THUMBS_DIR'] . '/' . $thumbName;
$thumbCreated = create_thumb($destPath, $thumbPathFull, $CFG['THUMB_MAX_W'], $CFG['THUMB_MAX_H'], $CFG['THUMB_QUALITY']);
$thumbRel = $thumbCreated ? 'assets/library/thumbs/' . $thumbName : null;

// Construction de l'entrée de métadonnées (persistée ensuite dans metadata.json).
$now = gmdate('c');
$asset = [
    'id' => $id,
    'filename' => $filename_safe,
    'ext' => $ext,
    'mime' => $mime,
    'size' => filesize($destPath),
    'uploaded_at' => $now,
    'path' => 'assets/library/uploads/' . $storeName,
    'thumb' => $thumbRel,
    'source' => isset($_POST['source']) ? substr($_POST['source'],0,50) : 'upload',
    'ppi' => isset($_POST['ppi']) ? intval($_POST['ppi']) : null,
    'tags' => isset($_POST['tags']) ? array_filter(array_map('trim', explode(',', $_POST['tags']))) : [],
];

// Token HMAC pour permettre un import "en un clic" et une validation côté `get.php`.
$asset['import_token'] = hash_hmac('sha256', $id, $CFG['IMPORT_TOKEN_SECRET']);

// Persistance atomique : écriture via fichier temporaire + rename pour limiter les fichiers corrompus.
$meta = read_metadata();
$meta[$id] = $asset;
if (!write_metadata($meta)) {
    // En cas d'échec de la métadonnée, on supprime le fichier déjà déplacé pour rester cohérent.
    @unlink($destPath);
    send_json(['ok'=>false,'error'=>'Failed to write metadata'], 500);
}

// Réponse finale.
send_json(['ok'=>true, 'asset' => $asset]);