<?php
header('Content-Type: application/javascript; charset=utf-8');

// Génère des constantes JavaScript (APP_BASE, API_BASE, ASSETS_BASE) pour que les autres scripts
// puissent construire des URLs correctes même si l'application est servie dans un sous-dossier.
$base = rtrim(dirname($_SERVER['PHP_SELF']), '/\\') . '/';
?>
const APP_BASE = '<?= $base ?>';
const API_BASE = '<?= $base ?>api/';
const ASSETS_BASE = '<?= $base ?>assets/library/';
console.log('✅ PWA Config chargé – Base:', APP_BASE);