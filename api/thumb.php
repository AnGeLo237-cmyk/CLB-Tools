<?php
require_once __DIR__ . '/lib.php';
$CFG = include __DIR__ . '/config.php';
ensure_dirs();

// Point d'entrée des miniatures.
// Utilisation : `GET id=ASSET_ID`
// - Si une miniature existe déjà dans le système de fichiers, elle est servie telle quelle.
// - Sinon, une miniature est générée à partir du fichier original (si possible), puis la métadonnée est mise à jour.
$id = isset($_GET['id']) ? preg_replace('/[^a-f0-9]/i','', $_GET['id']) : null;
if (!$id) send_json(['ok'=>false,'error'=>'Missing id'], 400);
$asset = get_asset($id);
if (!$asset) send_json(['ok'=>false,'error'=>'Not found'], 404);

if (!empty($asset['thumb'])) {
    $thumbFull = realpath(__DIR__ . '/../' . $asset['thumb']);
    if ($thumbFull && file_exists($thumbFull)) {
        header('Content-Type: image/jpeg');
        header('Cache-Control: public, max-age=604800');
        readfile($thumbFull);
        exit;
    }
}

// Génération de la miniature depuis le fichier original : tentative effectuée sans garantir systématiquement la réussite.
$rel = $asset['path'];
$full = realpath(__DIR__ . '/../' . $rel);
if (!$full || !file_exists($full)) send_json(['ok'=>false,'error'=>'Original not found'], 404);

// Chemin de destination (thumb) pour l'encodage.
$thumbName = $id . '.jpg';
$thumbFullPath = $CFG['THUMBS_DIR'] . '/' . $thumbName;
$created = create_thumb($full, $thumbFullPath, $CFG['THUMB_MAX_W'], $CFG['THUMB_MAX_H'], $CFG['THUMB_QUALITY']);
if ($created && file_exists($thumbFullPath)) {
    // Mise à jour de la métadonnée : on mémorise la référence de thumb pour les prochaines requêtes.
    $meta = read_metadata();
    if (isset($meta[$id])) {
        $meta[$id]['thumb'] = 'assets/library/thumbs/' . $thumbName;
        write_metadata($meta);
    }
    header('Content-Type: image/jpeg');
    header('Cache-Control: public, max-age=604800');
    readfile($thumbFullPath);
    exit;
}

// Repli : servir le fichier original tel quel (par exemple SVG/PNG qui peuvent ne pas avoir de miniature JPEG).
$mime = $asset['mime'] ?? mime_content_type($full);
header('Content-Type: ' . $mime);
readfile($full);
exit;