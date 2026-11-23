<?php

return [
    // Répertoires : emplacements absolus vers la "bibliothèque" (fichiers + métadonnées).
    // Tous les endpoints PHP s'appuient sur ces chemins pour lire/écrire de manière cohérente.
    'LIB_ROOT'        => realpath(__DIR__ . '/../assets/library'),
    'UPLOADS_DIR'     => realpath(__DIR__ . '/../assets/library') . '/uploads',
    'THUMBS_DIR'      => realpath(__DIR__ . '/../assets/library') . '/thumbs',
    'METADATA_FILE'   => realpath(__DIR__ . '/../assets/library') . '/metadata.json',

    // Politique d'accès et limites de stockage.
    'ALLOW_PUBLIC_DOWNLOADS' => true, // si false, le binaire servi par get.php exige un token HMAC valide
    'MAX_FILE_BYTES' => 8 * 1024 * 1024, // limite de taille (8 MB) appliquée côté upload.php
    'ALLOWED_MIME' => [
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/gif',
        'image/webp',
        'image/svg+xml'
    ],
    // Extensions autorisées (utilisées comme contrôle complémentaire côté téléversement).
    'ALLOWED_EXT' => ['png','jpg','jpeg','gif','webp','svg'],

    // Paramètres de génération des miniatures (thumbs).
    'THUMB_MAX_W' => 400,
    'THUMB_MAX_H' => 400,
    'THUMB_QUALITY' => 85, // qualité appliquée lors de l'encodage JPEG/WEBP

    // Sécurité : ces valeurs doivent rester secrètes en production.
    // API_KEY : protège le téléversement et la suppression (optionnel mais recommandé).
    // IMPORT_TOKEN_SECRET : permet de signer/valider un token d'import via HMAC.
    'API_KEY' => '',
    'IMPORT_TOKEN_SECRET' => 'replace_with_a_long_secret_for_hmac'
];