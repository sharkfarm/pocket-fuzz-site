$ErrorActionPreference = "Stop"

Write-Host "Backing up conflicting public routes..."
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = "v2-route-backup-$stamp"
New-Item -ItemType Directory -Path $backup -Force | Out-Null

if (Test-Path -LiteralPath "app/shows/[id]") {
  Move-Item -LiteralPath "app/shows/[id]" -Destination "$backup/public-id"
}
if (Test-Path -LiteralPath "app/shows/[slug]") {
  Move-Item -LiteralPath "app/shows/[slug]" -Destination "$backup/public-slug"
}
if (Test-Path "app/api/checkout") {
  Move-Item "app/api/checkout" "$backup/checkout"
}
if (Test-Path "app/api/stripe") {
  Move-Item "app/api/stripe" "$backup/stripe"
}

Write-Host "Conflicting routes moved to $backup"
Write-Host "Now copy the bundle's app, components, lib, and public folders into the project root."
