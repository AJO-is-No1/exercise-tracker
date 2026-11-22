# Renders the app icons (PNG) with System.Drawing: four rising bars for the 1-2-3-4 club.
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\make-icons.ps1
Add-Type -AssemblyName System.Drawing
$out = Join-Path $PSScriptRoot '..\icons'
New-Item -ItemType Directory -Force $out | Out-Null

function New-RoundRect([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = 2 * $r
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddLine($x + $w, $y + $h, $x, $y + $h)
  $p.CloseFigure()
  return $p
}

function Write-Icon([int]$size, [string]$path) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::FromArgb(255, 16, 17, 20))
  $s = $size / 512.0
  $colors = @(
    [System.Drawing.Color]::FromArgb(255, 57, 135, 229),
    [System.Drawing.Color]::FromArgb(255, 217, 89, 38),
    [System.Drawing.Color]::FromArgb(255, 25, 158, 112),
    [System.Drawing.Color]::FromArgb(255, 201, 133, 0)
  )
  $heights = @(110, 170, 230, 290)
  $bw = 62; $gap = 22; $base = 392
  $x0 = (512 - (4 * $bw + 3 * $gap)) / 2
  for ($i = 0; $i -lt 4; $i++) {
    $x = ($x0 + $i * ($bw + $gap)) * $s
    $h = $heights[$i] * $s
    $shape = New-RoundRect $x (($base * $s) - $h) ($bw * $s) $h (14 * $s)
    $g.FillPath((New-Object System.Drawing.SolidBrush $colors[$i]), $shape)
    $shape.Dispose()
  }
  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 240, 239, 236)), ([float](10 * $s))
  $pen.StartCap = 'Round'; $pen.EndCap = 'Round'
  $g.DrawLine($pen, [float](($x0 - 10) * $s), [float](($base + 22) * $s), [float]((512 - $x0 + 10) * $s), [float](($base + 22) * $s))
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}

Write-Icon 180 (Join-Path $out 'icon-180.png')
Write-Icon 192 (Join-Path $out 'icon-192.png')
Write-Icon 512 (Join-Path $out 'icon-512.png')
Write-Output "Icons written to $out"
