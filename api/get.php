<?php
require_once __DIR__ . '/lib.php';
$CFG = include __DIR__ . '/config.php';
ensure_dirs();

// Point d'entrée de récupération d'un asset (élément).
// Paramètres :
// - `id` (obligatoire) : identifiant de l'asset (filtré côté serveur).
// - `meta=1` : renvoie uniquement les métadonnées JSON.
// - `token=...` : jeton HMAC requis si `ALLOW_PUBLIC_DOWNLOADS` est à `false`.
$id = isset($_GET['id']) ? preg_replace('/[^a-f0-9]/i','', $_GET['id']) : null;
if (!$id) {
    send_json(['ok'=>false,'error'=>'Missing id'], 400);
}
$asset = get_asset($id);
if (!$asset) {
    send_json(['ok'=>false,'error'=>'Asset not found'], 404);
}

// Vérification de la politique d'accès.
$meta_only = isset($_GET['meta']) && ($_GET['meta'] === '1' || $_GET['meta'] === 'true');
$token = isset($_GET['token']) ? $_GET['token'] : null;
if (!$CFG['ALLOW_PUBLIC_DOWNLOADS']) {
    // Téléchargement protégé : un token HMAC valide est requis.
    if (!$token) send_json(['ok'=>false,'error'=>'Token required'], 403);
    $expected = hash_hmac('sha256', $id, $CFG['IMPORT_TOKEN_SECRET']);
    if (!hash_equals($expected, $token)) send_json(['ok'=>false,'error'=>'Invalid token'], 403);
}

// Si l'appel demande les métadonnées, on renvoie directement le JSON.
if ($meta_only) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok'=>true,'asset'=>$asset], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// Sinon, on sert le binaire de l'asset (headers adaptés au type MIME).
$rel = $asset['path']; // par exemple : assets/library/uploads/ID.png
$full = realpath(__DIR__ . '/../' . $rel);
if (!$full || !file_exists($full)) {
    send_json(['ok'=>false,'error'=>'File not found on disk'], 404);
}

// Sécurisation : l'appel s'appuie sur `realpath` pour éviter tout chemin en dehors de la bibliothèque.
$mime = $asset['mime'] ?? mime_content_type($full);
$size = filesize($full);

// En-têtes HTTP de téléchargement/diffusion.
header('Content-Type: ' . $mime);
header('Content-Length: ' . $size);
header('Cache-Control: public, max-age=31536000');
$download = isset($_GET['download']) ? true : false;
if ($download) {
    $fname = $asset['filename'] ?? basename($full);
    header('Content-Disposition: attachment; filename="' . basename($fname) . '"');
}

// Diffusion du fichier (par blocs) pour limiter la consommation mémoire côté PHP.
$fp = fopen($full, 'rb');
if ($fp === false) { send_json(['ok'=>false,'error'=>'Cannot open file'], 500); }
while (!feof($fp)) {
    echo fread($fp, 8192);
    flush();
}
fclose($fp);
exit;