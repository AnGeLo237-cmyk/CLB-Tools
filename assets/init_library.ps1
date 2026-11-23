<#
 SYNTHÈSE
Initialise la bibliothèque utilisée par l'application CLB-Tools (dossiers et `metadata.json`).

 DESCRIPTION
Crée les répertoires `assets\library\uploads` et `assets\library\thumbs` s'ils n'existent pas.
Ensuite, crée `assets\library\metadata.json` (contenu initial `{}`) si le fichier est absent.

Optionnellement, applique une ACL côté système de fichiers pour permettre au compte web
fourni par `-WebUser` d'écrire/modifier les dossiers de la bibliothèque.

 EXEMPLE
PS> cd CLB-Tools
PS> .\assets\init_library.ps1 -WebUser "IIS_IUSRS"

 NOTES
L'exécution en tant qu'administrateur est recommandée (la modification d'ACL peut nécessiter des privilèges).
#>

param(
  [string]$WebUser = "IIS_IUSRS",
  [string]$BaseDir = (Split-Path -Path $MyInvocation.MyCommand.Path -Parent)
)

$assetsDir = Join-Path $BaseDir "assets\library"
$uploadsDir = Join-Path $assetsDir "uploads"
$thumbsDir  = Join-Path $assetsDir "thumbs"
$metadata = Join-Path $assetsDir "metadata.json"

Write-Host "BaseDir: $BaseDir"
Write-Host "Assets: $assetsDir"
Write-Host "Uploads: $uploadsDir"
Write-Host "Thumbs: $thumbsDir"
Write-Host "Metadata: $metadata"
Write-Host "WebUser (for ACL): $WebUser"

# Crée les répertoires nécessaires à la bibliothèque (uploads et thumbs).
New-Item -ItemType Directory -Force -Path $uploadsDir | Out-Null
New-Item -ItemType Directory -Force -Path $thumbsDir  | Out-Null

# Initialise `metadata.json` si le fichier n'existe pas encore.
if (-not (Test-Path $metadata)) {
  '{}' | Out-File -FilePath $metadata -Encoding UTF8
  Write-Host "Created metadata.json"
} else { Write-Host "metadata.json already exists" }

# Configure une ACL permissive pour le compte web : autorise le mode `Modify` sur le dossier bibliothèque.
try {
  $acl = Get-Acl -Path $assetsDir
  $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($WebUser, "Modify", "ContainerInherit,ObjectInherit", "None", "Allow")
  $acl.SetAccessRule($rule)
  Set-Acl -Path $assetsDir -AclObject $acl
  Write-Host "Set Modify ACL for $WebUser on $assetsDir"
} catch {
  Write-Warning "Failed to set ACL automatically: $_. You may need to run as admin or set permissions manually."
}

Write-Host "Initialization complete. Verify that your webserver user can write to $uploadsDir and $thumbsDir."

<# 
  Note : un second en-tête/commentaire est présent dans le fichier d'origine.
  Conserver la structure telle quelle pour ne pas modifier le comportement du script.
#>

param(
  [string]$WebUser = "IIS_IUSRS",
  [string]$BaseDir = (Split-Path -Path $MyInvocation.MyCommand.Path -Parent)
)

$assetsDir = Join-Path $BaseDir "assets\library"
$uploadsDir = Join-Path $assetsDir "uploads"
$thumbsDir  = Join-Path $assetsDir "thumbs"
$metadata = Join-Path $assetsDir "metadata.json"

Write-Host "BaseDir: $BaseDir"
Write-Host "Assets: $assetsDir"
Write-Host "Uploads: $uploadsDir"
Write-Host "Thumbs: $thumbsDir"
Write-Host "Metadata: $metadata"
Write-Host "WebUser (for ACL): $WebUser"

# Crée les répertoires nécessaires à la bibliothèque (uploads et thumbs).
New-Item -ItemType Directory -Force -Path $uploadsDir | Out-Null
New-Item -ItemType Directory -Force -Path $thumbsDir  | Out-Null

# Initialise `metadata.json` si le fichier n'existe pas encore.
if (-not (Test-Path $metadata)) {
  '{}' | Out-File -FilePath $metadata -Encoding UTF8
  Write-Host "Created metadata.json"
} else { Write-Host "metadata.json already exists" }

# Configure une ACL permissive pour le compte web : autorise le mode `Modify` sur le dossier bibliothèque.
try {
  $acl = Get-Acl -Path $assetsDir
  $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($WebUser, "Modify", "ContainerInherit,ObjectInherit", "None", "Allow")
  $acl.SetAccessRule($rule)
  Set-Acl -Path $assetsDir -AclObject $acl
  Write-Host "Set Modify ACL for $WebUser on $assetsDir"
} catch {
  Write-Warning "Failed to set ACL automatically: $_. You may need to run as admin or set permissions manually."
}

# Commande de lancement (depuis le dossier `CLB-Tools`)
# PS> .\assets\init_library.ps1 -WebUser "IIS_IUSRS"