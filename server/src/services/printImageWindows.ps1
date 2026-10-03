param(
    [Parameter(Mandatory=$true)]
    [string]$ImagePath,
    [Parameter(Mandatory=$true)]
    [string]$PrinterName,
    [string]$Orientation = 'portrait',
    [int]$Copies = 1,
    [int]$RotateDegrees = 0
)

Add-Type -AssemblyName System.Drawing

if (-not (Test-Path -LiteralPath $ImagePath)) {
    Write-Error "File not found: $ImagePath"
    exit 1
}

try {
    $image = [System.Drawing.Image]::FromFile($ImagePath)
    if ($RotateDegrees -eq 90) {
        $image.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipNone)
    } elseif ($RotateDegrees -eq 180) {
        $image.RotateFlip([System.Drawing.RotateFlipType]::Rotate180FlipNone)
    } elseif ($RotateDegrees -eq 270) {
        $image.RotateFlip([System.Drawing.RotateFlipType]::Rotate270FlipNone)
    }
} catch {
    Write-Error "Failed to load image: $_"
    exit 1
}

$doc = New-Object System.Drawing.Printing.PrintDocument
$doc.PrinterSettings.PrinterName = $PrinterName
$doc.PrinterSettings.Copies = [Math]::Max(1, $Copies)

if ($Orientation -eq 'landscape') {
    $doc.DefaultPageSettings.Landscape = $true
} else {
    $doc.DefaultPageSettings.Landscape = $false
}

# Detect if target is a thermal label printer
$isLabelPrinter = $false
$lowerName = $PrinterName.ToLower()
if ($lowerName -match 'tsc|ttp|label|barcode|thermal|zebra|xprinter|pos|receipt|4b|gprinter' -or $doc.DefaultPageSettings.PaperSize.PaperName -match 'USER|Roll|Continuous|Receipt' -or $doc.DefaultPageSettings.PaperSize.RawKind -eq 256) {
    $isLabelPrinter = $true
}

if (-not $isLabelPrinter) {
    # Auto-match A4 paper if supported for laser/inkjet printers
    foreach ($ps in $doc.PrinterSettings.PaperSizes) {
        if ($ps.PaperName -match 'A4' -or $ps.RawKind -eq 9) {
            $doc.DefaultPageSettings.PaperSize = $ps
            break
        }
    }

    # Auto-match main tray or multi-purpose tray to avoid Manual Feed pause on laser printers
    foreach ($src in $doc.PrinterSettings.PaperSources) {
        if ($src.SourceName -match 'Tray|Auto|Multi' -or $src.RawKind -eq 4 -or $src.RawKind -eq 7) {
            $doc.DefaultPageSettings.PaperSource = $src
            break
        }
    }
}

$printAction = [System.Drawing.Printing.PrintPageEventHandler]{
    param($sender, $e)
    
    $marginBounds = $e.MarginBounds
    if ($marginBounds.Width -le 0 -or $marginBounds.Height -le 0) {
        $marginBounds = $e.PageBounds
    }
    
    $pageW = [double]$marginBounds.Width
    $pageH = [double]$marginBounds.Height
    
    $imgW = [double]$image.Width
    $imgH = [double]$image.Height
    
    # Scale proportionally to fit within printable bounds
    $scale = [Math]::Min($pageW / $imgW, $pageH / $imgH)
    $destW = [int]($imgW * $scale)
    $destH = [int]($imgH * $scale)
    
    $destX = [int]($marginBounds.Left + ($pageW - $destW) / 2)
    $destY = [int]($marginBounds.Top + ($pageH - $destH) / 2)
    
    $e.Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $e.Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $e.Graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    
    $e.Graphics.DrawImage($image, $destX, $destY, $destW, $destH)
    
    # Strictly 1 page
    $e.HasMorePages = $false
}

$doc.add_PrintPage($printAction)

try {
    $doc.Print()
    Write-Output "Image printed successfully to $PrinterName"
} catch {
    Write-Error "Print error: $_"
    exit 1
} finally {
    $image.Dispose()
    $doc.Dispose()
}
