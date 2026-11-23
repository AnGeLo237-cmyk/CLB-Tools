<?php
require_once __DIR__ . '/lib.php';
$CFG = include __DIR__ . '/config.php';
ensure_dirs();

// Point d'entrée de liste des assets (éléments).
// Renvoie un JSON contenant les métadonnées (et éventuellement quelques champs de tri/filtrage).
$meta = read_metadata();
$items = array_values($meta);

// Filtres optionnels :
// - `q` : recherche partielle sur `filename` et sur la liste de tags
// - `tag` : filtre strict (appartenance à la liste `tags`)
// Pagination : `page` et `limit`.
$q = isset($_GET['q']) ? trim($_GET['q']) : '';
$tag = isset($_GET['tag']) ? trim($_GET['tag']) : '';
if ($q !== '') {
    $items = array_filter($items, function($a) use ($q) {
        return stripos($a['filename'] ?? '', $q) !== false || stripos(join(' ', $a['tags'] ?? []), $q) !== false;
    });
}

if ($tag !== '') {
    $items = array_filter($items, function($a) use ($tag) {
        return in_array($tag, $a['tags'] ?? [], true);
    });
}

// Tri : les assets les plus récents d'abord (champ `uploaded_at` en string ISO/compat).
usort($items, function($a,$b){ return strcmp($b['uploaded_at'] ?? '', $a['uploaded_at'] ?? ''); });

// Pagination : bornage pour éviter les valeurs absurdes.
$page = max(1, intval($_GET['page'] ?? 1));
$limit = max(1, min(200, intval($_GET['limit'] ?? 50)));
$offset = ($page - 1) * $limit;
$total = count($items);
$items = array_slice($items, $offset, $limit);

header('Content-Type: application/json; charset=utf-8');
echo json_encode(['ok'=>true,'total'=>$total,'page'=>$page,'limit'=>$limit,'items'=>array_values($items)], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
exit;