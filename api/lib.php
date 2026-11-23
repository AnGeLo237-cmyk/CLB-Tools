<?php
// Bibliothèque commune utilisée par les endpoints de l'API.
// Contient des helpers pour : préparation des répertoires, lecture/écriture de `metadata.json`,
// génération d'identifiants, miniatures (thumbnails) et conversion de chemins en URLs.
// La configuration est chargée depuis `config.php`.
$CFG = include __DIR__ . '/config.php';

// Prépare les dossiers de stockage requis pour que les endpoints puissent lire/écrire sans échec.
function ensure_dirs() {
    global $CFG;
    $dirs = [$CFG['LIB_ROOT'], $CFG['UPLOADS_DIR'], $CFG['THUMBS_DIR']];
    foreach ($dirs as $d) {
        if (!is_dir($d)) {
            @mkdir($d, 0755, true);
        }
    }
    // Initialise metadata.json si le fichier n'existe pas encore.
    if (!file_exists($CFG['METADATA_FILE'])) {
        file_put_contents($CFG['METADATA_FILE'], json_encode(new stdClass(), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
    }
}
ensure_dirs();

// Répond en JSON et stoppe l'exécution (pour éviter des sorties partielles).
function send_json($payload, $status = 200) {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

// Lit `metadata.json` avec verrou partagé (LOCK_SH) afin de limiter les corruptions concurrentes.
function read_metadata() {
    global $CFG;
    $path = $CFG['METADATA_FILE'];
    if (!file_exists($path)) return [];
    $fp = fopen($path, 'r');
    if (!$fp) return [];
    flock($fp, LOCK_SH);
    $contents = stream_get_contents($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    $data = json_decode($contents, true);
    if (!is_array($data)) return [];
    return $data;
}
function write_metadata(array $meta) {
    global $CFG;
    $path = $CFG['METADATA_FILE'];
    $tmp = $path . '.tmp.' . rand(1000,9999);
    $fp = fopen($tmp, 'c');
    if (!$fp) return false;
    if (!fwrite($fp, json_encode($meta, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES))) { fclose($fp); return false; }
    fflush($fp); fclose($fp);
    // Écriture atomique : on écrit d'abord dans un fichier temporaire puis on remplace via rename().
    rename($tmp, $path);
    return true;
}

// Génère un identifiant non prévisible (hex) pour indexer les assets.
function generate_id() {
    return bin2hex(random_bytes(12));
}

// Nettoie un nom de fichier côté serveur pour limiter les caractères problématiques.
function sanitize_filename($name) {
    $name = preg_replace('/[^\w\.\-_\s]/u','', $name);
    $name = preg_replace('/\s+/', '_', $name);
    return mb_substr($name, 0, 200);
}

// Détermine l'extension de stockage à partir du MIME détecté.
// En absence de correspondance MIME connue, on tente un repli via l'extension du nom d'origine.
function ext_from_mime($mime, $origName = '') {
    $map = [
        'image/png' => 'png',
        'image/jpeg' => 'jpg',
        'image/jpg' => 'jpg',
        'image/gif' => 'gif',
        'image/webp' => 'webp',
        'image/svg+xml' => 'svg'
    ];
    if (isset($map[$mime])) return $map[$mime];
    $p = pathinfo($origName, PATHINFO_EXTENSION);
    $p = strtolower($p);
    return $p ?: 'bin';
}

// Vérifie si le MIME détecté est autorisé par la configuration.
function is_allowed_mime($mime) {
    global $CFG;
    return in_array($mime, $CFG['ALLOWED_MIME'], true);
}
function is_allowed_ext($ext) {
    global $CFG;
    return in_array(strtolower($ext), $CFG['ALLOWED_EXT'], true);
}

// Crée une miniature via la librairie GD.
// Retour : chemin de destination si succès, sinon `false`.
function create_thumb($sourcePath, $destPath, $maxW = 400, $maxH = 400, $quality = 85) {
    // Pour les images vectorielles (SVG), on évite la rasterisation automatique.
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime = finfo_file($finfo, $sourcePath);
    finfo_close($finfo);

    if ($mime === 'image/svg+xml') {
        // SVG : pas de miniature JPEG par défaut.
        return false;
    }

    if (!extension_loaded('gd')) return false;

    switch ($mime) {
        case 'image/jpeg':
        case 'image/jpg':
            $src = @imagecreatefromjpeg($sourcePath);
            break;
        case 'image/png':
            $src = @imagecreatefrompng($sourcePath);
            break;
        case 'image/gif':
            $src = @imagecreatefromgif($sourcePath);
            break;
        case 'image/webp':
            if (function_exists('imagecreatefromwebp')) $src = @imagecreatefromwebp($sourcePath);
            else $src = null;
            break;
        default:
            $src = null;
    }
    if (!$src) return false;
    $w = imagesx($src); $h = imagesy($src);
    if ($w <= 0 || $h <= 0) { imagedestroy($src); return false; }
    $scale = min($maxW / $w, $maxH / $h, 1);
    $nw = (int)round($w * $scale); $nh = (int)round($h * $scale);
    $dst = imagecreatetruecolor($nw, $nh);
    // Préserve la transparence (alpha) lors du rendu.
    imagealphablending($dst, false);
    imagesavealpha($dst, true);
    imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $w, $h);
    // Enregistre au format JPEG (force d'extension implicite via destPath).
    $saved = imagejpeg($dst, $destPath, $quality);
    imagedestroy($src); imagedestroy($dst);
    return $saved ? $destPath : false;
}

// Récupère les métadonnées d'un asset depuis `metadata.json`.
// Retour : tableau de métadonnées ou `null` si l'asset est introuvable.
function get_asset($id) {
    $meta = read_metadata();
    return isset($meta[$id]) ? $meta[$id] : null;
}

// Supprime les fichiers associés (uploads et thumb si présent) puis met à jour `metadata.json`.
// Retour : `true` si l'écriture des métadonnées a abouti, sinon `false`.
function delete_asset($id) {
    global $CFG;
    $meta = read_metadata();
    if (!isset($meta[$id])) return false;
    $item = $meta[$id];
    // Tentative de suppression en mode tolérant : l'absence des fichiers n'est pas considérée comme une erreur.
    $paths = [];
    if (!empty($item['path'])) $paths[] = $CFG['LIB_ROOT'] . '/' . ltrim($item['path'], '/');
    if (!empty($item['thumb'])) $paths[] = $CFG['LIB_ROOT'] . '/' . ltrim($item['thumb'], '/');
    foreach ($paths as $p) {
        if (file_exists($p)) @unlink($p);
    }
    unset($meta[$id]);
    return write_metadata($meta);
}

// Construit une URL publique relative pour un asset à partir de sa métadonnée `path`.
// (Aide à homogénéiser les usages côté client.)
function asset_public_url($asset) {
    return '/' . ltrim($asset['path'], '/');
}