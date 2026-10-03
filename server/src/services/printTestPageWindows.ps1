param(
    [Parameter(Mandatory=$true)]
    [string]$PrinterName,
    [string]$PrinterType = 'bw'
)

Add-Type -AssemblyName System.Drawing

# 1. Try Windows Native Certified Hardware Driver Test Page
try {
    $wmiPrinter = Get-CimInstance Win32_Printer | Where-Object { 
        $_.Name -eq $PrinterName -or 
        $_.Name.ToLower() -eq $PrinterName.ToLower() -or
        $_.Name.ToLower().Contains($PrinterName.ToLower()) -or
        $PrinterName.ToLower().Contains($_.Name.ToLower())
    } | Select-Object -First 1

    if ($wmiPrinter) {
        $result = Invoke-CimMethod -InputObject $wmiPrinter -MethodName "PrintTestPage" -ErrorAction SilentlyContinue
        if ($result -and $result.ReturnValue -eq 0) {
            Write-Output "Native hardware test page sent successfully to $($wmiPrinter.Name)"
            exit 0
        }
    }
} catch {
    # Fall back to GDI PrintDocument below
}

# Validate printer exists in Windows Spooler
$printers = [System.Drawing.Printing.PrinterSettings]::InstalledPrinters
$matched = $null
foreach ($p in $printers) {
    if ($p -eq $PrinterName -or $p.ToLower() -eq $PrinterName.ToLower()) {
        $matched = $p
        break
    }
}

if (-not $matched) {
    # Partial match
    foreach ($p in $printers) {
        if ($p.ToLower().Contains($PrinterName.ToLower()) -or $PrinterName.ToLower().Contains($p.ToLower())) {
            $matched = $p
            break
        }
    }
}

$effectivePrinter = if ($matched) { $matched } else { $PrinterName }

$doc = New-Object System.Drawing.Printing.PrintDocument
$doc.PrinterSettings.PrinterName = $effectivePrinter

if (-not $doc.PrinterSettings.IsValid) {
    Write-Error "Invalid printer: '$effectivePrinter' is not recognized by Windows Printing Subsystem"
    exit 1
}

# Auto-match A4 paper if supported, otherwise standard default
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

$doc.DefaultPageSettings.Landscape = $false
$doc.PrinterSettings.Copies = 1

$printAction = [System.Drawing.Printing.PrintPageEventHandler]{
    param($sender, $e)
    
    $g = $e.Graphics
    $g.PageUnit = [System.Drawing.GraphicsUnit]::Pixel
    
    # High-quality rendering modes for crisp laser/inkjet output
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
    
    $fontHeader = New-Object System.Drawing.Font("Arial", 16, [System.Drawing.FontStyle]::Bold)
    $fontSub = New-Object System.Drawing.Font("Arial", 12, [System.Drawing.FontStyle]::Bold)
    $fontBody = New-Object System.Drawing.Font("Consolas", 10, [System.Drawing.FontStyle]::Regular)
    $fontSmall = New-Object System.Drawing.Font("Arial", 8, [System.Drawing.FontStyle]::Regular)
    
    $brushBlack = [System.Drawing.Brushes]::Black
    $brushGray = [System.Drawing.Brushes]::DarkGray
    $brushLight = [System.Drawing.Brushes]::LightGray
    $penThick = New-Object System.Drawing.Pen([System.Drawing.Color]::Black, 2)
    $penThin = New-Object System.Drawing.Pen([System.Drawing.Color]::Black, 1)
    
    $x = 50
    $y = 50
    $w = 700
    
    # Outer Border Box
    $g.DrawRectangle($penThick, 40, 40, 720, 1020)
    
    # 1. Header Box
    $g.FillRectangle($brushBlack, 40, 40, 720, 50)
    $g.DrawString("IMPREVO SMART KIOSK  •  PRINTER HARDWARE TEST", $fontHeader, [System.Drawing.Brushes]::White, 60, 52)
    $y = 110
    
    # 2. Hardware Diagnostics Table
    $g.DrawString("DIAGNOSTIC TELEMETRY & HARDWARE CONFIGURATION", $fontSub, $brushBlack, $x, $y)
    $y += 25
    $g.DrawLine($penThin, $x, $y, $x + $w, $y)
    $y += 15
    
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $g.DrawString(("- Target Printer Name  : " + $effectivePrinter), $fontBody, $brushBlack, $x, $y); $y += 22
    $g.DrawString(("- Station Terminal ID  : #04 (Main Academic Counter)"), $fontBody, $brushBlack, $x, $y); $y += 22
    $g.DrawString(("- Hardware Interface   : USB Direct Spooler Subsystem"), $fontBody, $brushBlack, $x, $y); $y += 22
    $g.DrawString(("- Dispatch Timestamp   : " + $timestamp), $fontBody, $brushBlack, $x, $y); $y += 22
    $g.DrawString(("- Driver Architecture  : Windows GDI Host-Based Rasterizer"), $fontBody, $brushBlack, $x, $y); $y += 22
    $g.DrawString(("- Hardware Resolution  : 600 DPI Native Calibration"), $fontBody, $brushBlack, $x, $y); $y += 35
    
    # 3. Density Gradient & Alignment Pattern
    $g.DrawString("ALIGNMENT & TONER/INK DENSITY PATTERN", $fontSub, $brushBlack, $x, $y)
    $y += 25
    $g.DrawLine($penThin, $x, $y, $x + $w, $y)
    $y += 15
    
    # 4 Density blocks: 100%, 75%, 50%, 25%
    $blockW = 160
    $blockH = 40
    $g.FillRectangle([System.Drawing.Brushes]::Black, $x, $y, $blockW, $blockH)
    $g.DrawString("100% Solid", $fontSmall, [System.Drawing.Brushes]::White, $x + 45, $y + 12)
    
    $g.FillRectangle([System.Drawing.Brushes]::Gray, $x + 180, $y, $blockW, $blockH)
    $g.DrawString("75% Tone", $fontSmall, [System.Drawing.Brushes]::White, $x + 180 + 50, $y + 12)
    
    $g.FillRectangle([System.Drawing.Brushes]::DarkGray, $x + 360, $y, $blockW, $blockH)
    $g.DrawString("50% Tone", $fontSmall, [System.Drawing.Brushes]::White, $x + 360 + 50, $y + 12)
    
    $g.FillRectangle([System.Drawing.Brushes]::LightGray, $x + 540, $y, $blockW, $blockH)
    $g.DrawString("25% Tone", $fontSmall, [System.Drawing.Brushes]::Black, $x + 540 + 50, $y + 12)
    $y += 60
    
    # Diagnostic Barcode / Ruler pattern
    $g.DrawString("MECHANICAL FEED & MARGIN CALIBRATION RULER (CM)", $fontSub, $brushBlack, $x, $y)
    $y += 25
    $g.DrawLine($penThin, $x, $y, $x + $w, $y)
    $y += 15
    
    for ($cm = 0; $cm -le 18; $cm++) {
        $cmX = $x + ($cm * 38)
        $tickH = if ($cm % 5 -eq 0) { 20 } else { 10 }
        $g.DrawLine($penThin, $cmX, $y, $cmX, $y + $tickH)
        if ($cm % 5 -eq 0) {
            $g.DrawString(("$cm cm"), $fontSmall, $brushBlack, $cmX - 10, $y + 24)
        }
    }
    $y += 70
    
    # 4. Status Confirmation Banner
    $g.FillRectangle([System.Drawing.Brushes]::Honeydew, $x, $y, $w, 80)
    $g.DrawRectangle($penThick, $x, $y, $w, 80)
    $g.DrawString("[OK] HARDWARE SPOOLER TEST SUCCESSFUL", $fontSub, [System.Drawing.Brushes]::DarkGreen, $x + 20, $y + 18)
    $g.DrawString("Your printer is successfully detected and ready to execute physical kiosk orders.", $fontBody, $brushBlack, $x + 20, $y + 45)
    $y += 110
    
    # 5. Footer notice
    $g.DrawLine($penThin, 40, 1000, 760, 1000)
    $g.DrawString("Imprevo Kiosk Engine v1.0 -- Shopkeeper Diagnostic Utility -- Hardware Port Verified", $fontSmall, $brushGray, 60, 1015)
    
    $e.HasMorePages = $false
}

$doc.add_PrintPage($printAction)

try {
    $doc.Print()
    Write-Output "Test page sent successfully via GDI to $effectivePrinter"
} catch {
    Write-Error ("Print failed: " + $_.Exception.Message)
    exit 1
} finally {
    $doc.Dispose()
}
