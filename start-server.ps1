# Enkel lokal server for Min Forsikring (bare for testing på denne PC-en).
# Startes med start.bat. Bruker bare det som er innebygd i Windows.

$root = (Split-Path -Parent $MyInvocation.MyCommand.Path).TrimEnd('\') + '\'
$port = 8080
$prefix = "http://localhost:$port/"

$types = @{
  '.html' = 'text/html; charset=utf-8'
  '.js' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.webmanifest' = 'application/manifest+json'
  '.svg' = 'image/svg+xml'
  '.png' = 'image/png'
  '.jpg' = 'image/jpeg'
  '.ico' = 'image/x-icon'
  '.woff2' = 'font/woff2'
  '.md' = 'text/plain; charset=utf-8'
  '.pdf' = 'application/pdf'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
try {
  $listener.Start()
} catch {
  Write-Host "Kunne ikke starte serveren på port $port. Kanskje den allerede kjører i et annet vindu?" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "  Min Forsikring kjører på $prefix" -ForegroundColor Green
Write-Host "  Nettleseren åpnes automatisk. Lukk dette vinduet for å stoppe serveren."
Write-Host ""
Start-Process $prefix

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $res = $ctx.Response
  try {
    $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    if ($path -eq '' -or $path.EndsWith('/')) { $path = $path + 'index.html' }
    $full = [IO.Path]::GetFullPath((Join-Path $root $path))
    if ($full.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $full -PathType Leaf)) {
      $ext = [IO.Path]::GetExtension($full).ToLower()
      if ($types.ContainsKey($ext)) { $res.ContentType = $types[$ext] } else { $res.ContentType = 'application/octet-stream' }
      $bytes = [IO.File]::ReadAllBytes($full)
    } else {
      $res.StatusCode = 404
      $bytes = [Text.Encoding]::UTF8.GetBytes('Ikke funnet')
    }
    $res.Headers.Add('Cache-Control', 'no-cache')
    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
  } catch {
    $res.StatusCode = 500
  } finally {
    $res.OutputStream.Close()
  }
}
