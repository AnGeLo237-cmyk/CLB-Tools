<?php
header('Content-Type: application/json; charset=utf-8');

// Calcule le chemin de base (base path) en fonction du répertoire réellement servi.
// Cela permet de générer correctement les URLs des icônes, du `start_url` et du `scope`
// même si l'application est hébergée dans un sous-dossier (XAMPP/Herd/LiveServer).
$basePath = rtrim(dirname($_SERVER['PHP_SELF']), '/\\') . '/';

echo json_encode([
  "name" => "CLB-Tools - Mini Projets Berth-Ana Inc.",
  "short_name" => "CLB-Tools",
  "description" => "Pack d'outils dédiés à la création de code-barre/QR code, à la création d'étiquettes et à l'impression multiple d'images redimensionnables.",
  "start_url" => $basePath . "index.html",
  "scope" => $basePath,
  "display" => "standalone",
  "background_color" => "#ffffff",
  "theme_color" => "#111111",
  "orientation" => "any",
  "lang" => "fr",
  "icons" => [
    [
      "src" => $basePath . "Images/icon-192x192.png",
      "sizes" => "192x192",
      "type" => "image/png",
      "purpose" => "any maskable"
    ],
    [
      "src" => $basePath . "Images/icon-512x512.png",
      "sizes" => "512x512",
      "type" => "image/png",
      "purpose" => "any maskable"
    ]
  ]
]);
?>