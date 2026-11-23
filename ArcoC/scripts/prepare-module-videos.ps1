<#
.SYNOPSIS
  Genera las versiones web de los videos master de un módulo del curso.

.DESCRIPTION
  Toma los masters "M0<N>_V<k>_Master_<Tema>.mp4" de -SourceDir y escribe en
  client/public/videos/modulo<N>/ los archivos "M0<N>_V<k>_<Tema>.mp4" listos para web:
    - H.264 (High, yuv420p) con CRF limitado por -MaxRate (~4 Mbps por defecto)
    - AAC-LC estéreo 160 kbps
    - faststart: el índice (moov) va al inicio, así la reproducción arranca sin
      tener que descargar el final del archivo.
  Los masters nunca se modifican. Los archivos ya generados se omiten si son más
  nuevos que su master (usa -Force para regenerarlos).

  Después de generarlos:
    - registra cada video en client/src/lib/courseConfig.js (videoSrc: '/videos/modulo<N>/<archivo>.mp4');
    - copia las duraciones que imprime el script en VIDEO_DURATION_SECONDS de
      server/config/curriculum.js (en producción definen el tiempo mínimo de visualización).

.EXAMPLE
  .\scripts\prepare-module-videos.ps1 -Module 1 -SourceDir "C:\Oscar\Src_arcoenc\Video\Master"
#>
param(
    [Parameter(Mandatory = $true)][ValidateRange(1, 9)][int]$Module,
    [Parameter(Mandatory = $true)][string]$SourceDir,
    [string]$OutputDir,
    [ValidateRange(16, 30)][int]$Crf = 21,
    [string]$MaxRate = '4M',
    [string]$Preset = 'slow',
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

function Find-FFmpeg {
    $cmd = Get-Command ffmpeg -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    # La sesión actual puede no tener el PATH actualizado tras "winget install".
    $dirs = @()
    $dirs += [Environment]::GetEnvironmentVariable('Path', 'User') -split ';'
    $dirs += [Environment]::GetEnvironmentVariable('Path', 'Machine') -split ';'
    foreach ($dir in $dirs) {
        if ([string]::IsNullOrWhiteSpace($dir)) { continue }
        $candidate = Join-Path $dir 'ffmpeg.exe'
        if (Test-Path $candidate) { return $candidate }
    }
    throw 'No se encontró ffmpeg. Instálalo con: winget install Gyan.FFmpeg'
}

if (-not (Test-Path $SourceDir)) { throw "No existe la carpeta de masters: $SourceDir" }
if (-not $OutputDir) {
    $OutputDir = Join-Path $PSScriptRoot ("..\client\public\videos\modulo{0}" -f $Module)
}
$OutputDir = [System.IO.Path]::GetFullPath($OutputDir)
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$ffmpeg = Find-FFmpeg
$pattern = 'M{0:D2}_V*_Master_*.mp4' -f $Module
$masters = @(Get-ChildItem -Path $SourceDir -Filter $pattern | Sort-Object Name)
if ($masters.Count -eq 0) { throw "No hay masters que coincidan con '$pattern' en $SourceDir" }

$bufSize = if ($MaxRate -match '^(\d+)M$') { '{0}M' -f ([int]$Matches[1] * 2) } else { $MaxRate }

foreach ($master in $masters) {
    $outName = $master.Name -replace '_Master_', '_'
    $outPath = Join-Path $OutputDir $outName
    $tmpPath = "$outPath.partial.mp4"

    if (-not $Force -and (Test-Path $outPath) -and ((Get-Item $outPath).LastWriteTime -gt $master.LastWriteTime)) {
        Write-Host "= $outName ya está actualizado (usa -Force para regenerarlo)"
        continue
    }

    Write-Host "> $($master.Name) -> $outName"
    $ffArgs = @(
        '-hide_banner', '-nostats', '-loglevel', 'error', '-y',
        '-i', $master.FullName,
        '-map', '0:v:0', '-map', '0:a:0?',
        '-c:v', 'libx264', '-preset', $Preset, '-crf', $Crf,
        '-maxrate', $MaxRate, '-bufsize', $bufSize,
        '-profile:v', 'high', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '160k', '-ac', '2',
        '-movflags', '+faststart',
        $tmpPath
    )
    $started = Get-Date
    # PowerShell 5.1 convierte cualquier línea de stderr de un ejecutable nativo en un
    # error; con 'Stop' abortaría el script aunque ffmpeg termine bien. Se decide por
    # el código de salida.
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & $ffmpeg @ffArgs 2>&1 | ForEach-Object { Write-Host "  ffmpeg: $_" }
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousPreference
    }
    if ($exitCode -ne 0) {
        if (Test-Path $tmpPath) { Remove-Item $tmpPath -Force }
        throw "ffmpeg falló con $($master.Name) (código $exitCode)"
    }
    Move-Item -Force $tmpPath $outPath
    $mb = (Get-Item $outPath).Length / 1MB
    $minutes = ((Get-Date) - $started).TotalMinutes
    Write-Host ("  listo en {0:N1} min: {1:N1} MB (master: {2:N1} MB)" -f $minutes, $mb, ($master.Length / 1MB))
}

Write-Host "Videos del módulo $Module en: $OutputDir"

# Duraciones para VIDEO_DURATION_SECONDS (server/config/curriculum.js)
$ffprobe = Join-Path (Split-Path $ffmpeg -Parent) 'ffprobe.exe'
if (Test-Path $ffprobe) {
    $entries = @()
    foreach ($master in $masters) {
        $outPath = Join-Path $OutputDir ($master.Name -replace '_Master_', '_')
        if (-not (Test-Path $outPath)) { continue }
        $previousPreference = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        $seconds = & $ffprobe -v error -show_entries format=duration -of csv=p=0 $outPath 2>$null
        $ErrorActionPreference = $previousPreference
        if ($master.Name -match '_V(\d+)_') {
            $entries += "m$($Module)_v$([int]$Matches[1]): $([math]::Floor([double]$seconds))"
        }
    }
    Write-Host "Duraciones para VIDEO_DURATION_SECONDS en server/config/curriculum.js:"
    Write-Host ("  " + ($entries -join ', ') + ',')
}
