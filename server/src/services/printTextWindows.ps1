param(
    [Parameter(Mandatory=$true)]
    [string]$FilePath,
    [Parameter(Mandatory=$true)]
    [string]$PrinterName,
    [int]$Copies = 1
)

Add-Type -AssemblyName System.Drawing

if (-not (Test-Path -LiteralPath $FilePath)) {
    Write-Error "Text file not found: $FilePath"
    exit 1
}

$content = Get-Content -LiteralPath $FilePath -Raw -ErrorAction Stop

$doc = New-Object System.Drawing.Printing.PrintDocument
$doc.PrinterSettings.PrinterName = $PrinterName
$doc.PrinterSettings.Copies = [Math]::Max(1, $Copies)

if (-not $doc.PrinterSettings.IsValid) {
    Write-Error "Invalid printer: '$PrinterName' is not recognized by Windows Printing Subsystem"
    exit 1
}

# Auto-match A4 paper if supported
foreach ($ps in $doc.PrinterSettings.PaperSizes) {
    if ($ps.PaperName -match 'A4' -or $ps.RawKind -eq 9) {
        $doc.DefaultPageSettings.PaperSize = $ps
        break
    }
}

# Auto-match main tray or multi-purpose tray
foreach ($src in $doc.PrinterSettings.PaperSources) {
    if ($src.SourceName -match 'Tray|Auto|Multi' -or $src.RawKind -eq 4 -or $src.RawKind -eq 7) {
        $doc.DefaultPageSettings.PaperSource = $src
        break
    }
}

$doc.DefaultPageSettings.Landscape = $false

$lines = $content -split "`r?`n"
$lineIndex = 0

$printAction = [System.Drawing.Printing.PrintPageEventHandler]{
    param($sender, $e)
    
    $g = $e.Graphics
    $font = New-Object System.Drawing.Font("Consolas", 10, [System.Drawing.FontStyle]::Regular)
    $brush = [System.Drawing.Brushes]::Black
    $lineHeight = $font.GetHeight($g)
    
    $marginBounds = $e.MarginBounds
    if ($marginBounds.Width -le 0 -or $marginBounds.Height -le 0) {
        $marginBounds = $e.PageBounds
    }
    
    $y = $marginBounds.Top
    $linesPerPage = [Math]::Floor($marginBounds.Height / $lineHeight)
    $linesPrinted = 0
    
    while ($script:lineIndex -lt $lines.Length -and $linesPrinted -lt $linesPerPage) {
        $lineText = $lines[$script:lineIndex]
        $g.DrawString($lineText, $font, $brush, $marginBounds.Left, $y)
        $y += $lineHeight
        $script:lineIndex++
        $linesPrinted++
    }
    
    if ($script:lineIndex -lt $lines.Length) {
        $e.HasMorePages = $true
    } else {
        $e.HasMorePages = $false
        $script:lineIndex = 0
    }
}

$doc.add_PrintPage($printAction)

try {
    $doc.Print()
    Write-Output "Text file printed successfully via GDI to $PrinterName"
} catch {
    Write-Error ("Print failed: " + $_.Exception.Message)
    exit 1
} finally {
    $doc.Dispose()
}
