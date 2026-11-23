<?php
require_once __DIR__ . '/lib.php';
$CFG = include __DIR__ . '/config.php';
ensure_dirs();

// Point d'entrée de suppression d'un asset (élément).
// Attendu : requête `POST` contenant au minimum `id` (et éventuellement `api_key` selon la configuration).
if ($_SERVER['REQUEST_METHOD'] !== 'POST') send_json(['ok'=>false,'error'=>'Method not allowed'], 405);

// Authentification : clé API fournie soit via `Authorization: Bearer <key>` (schéma Bearer, jeton), soit via le champ POST `api_key`.
$provided = null;
$hdr = isset($_SERVER['HTTP_AUTHORIZATION']) ? trim($_SERVER['HTTP_AUTHORIZATION']) : '';
if ($hdr && stripos($hdr, 'Bearer ') === 0) $provided = substr($hdr, 7);
if (!$provided && isset($_POST['api_key'])) $provided = $_POST['api_key'];
if ($CFG['API_KEY'] && (!$provided || $provided !== $CFG['API_KEY'])) send_json(['ok'=>false,'error'=>'Invalid API key'], 403);

$id = isset($_POST['id']) ? preg_replace('/[^a-f0-9]/i','', $_POST['id']) : null;
if (!$id) send_json(['ok'=>false,'error'=>'Missing id'], 400);

$existed = get_asset($id);
if (!$existed) send_json(['ok'=>false,'error'=>'Asset not found'], 404);

$ok = delete_asset($id);
if ($ok) send_json(['ok'=>true]);
send_json(['ok'=>false,'error'=>'Failed to delete'], 500);