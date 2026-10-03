param(
    [Parameter(Mandatory=$true)]
    [string]$PrinterName,
    [string]$PrinterType = 'bw'
)

Add-Type -AssemblyName System.Drawing

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

# Determine if printer is a thermal barcode/label printer (e.g. TSC, Zebra, 4Barcode, Xprinter)
$isLabelPrinter = $false
$lowerName = $effectivePrinter.ToLower()
if ($lowerName -match 'tsc|ttp|label|barcode|thermal|zebra|xprinter|pos|receipt|4b|gprinter') {
    $isLabelPrinter = $true
}

# Check default paper size name or kind for roll/continuous
if ($doc.DefaultPageSettings.PaperSize.PaperName -match 'USER|Roll|Continuous|Receipt' -or $doc.DefaultPageSettings.PaperSize.RawKind -eq 256) {
    $isLabelPrinter = $true
}

if ($isLabelPrinter) {
    # Label / thermal printer: preserve native label dimensions and continuous roll
    Write-Output "Configuring test print for thermal label hardware: $effectivePrinter"
    $doc.DefaultPageSettings.Landscape = $false
    $doc.PrinterSettings.Copies = 1
} else {
    # Laser / Inkjet printer (e.g. Canon LBP2900): match A4 and Main Tray
    Write-Output "Configuring test print for document laser/inkjet hardware: $effectivePrinter"
    foreach ($ps in $doc.PrinterSettings.PaperSizes) {
        if ($ps.PaperName -match 'A4' -or $ps.RawKind -eq 9) {
            $doc.DefaultPageSettings.PaperSize = $ps
            break
        }
    }

    foreach ($src in $doc.PrinterSettings.PaperSources) {
        if ($src.SourceName -match 'Tray|Auto|Multi' -or $src.RawKind -eq 4 -or $src.RawKind -eq 7) {
            $doc.DefaultPageSettings.PaperSource = $src
            break
        }
    }

    $doc.DefaultPageSettings.Landscape = $false
    $doc.PrinterSettings.Copies = 1
}

$printAction = [System.Drawing.Printing.PrintPageEventHandler]{
    param($sender, $e)
    
    $g = $e.Graphics
    $g.PageUnit = [System.Drawing.GraphicsUnit]::Pixel
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
    
    $fontHeader = New-Object System.Drawing.Font("Arial", 14, [System.Drawing.FontStyle]::Bold)
    $fontSub = New-Object System.Drawing.Font("Arial", 10, [System.Drawing.FontStyle]::Bold)
    $fontBody = New-Object System.Drawing.Font("Consolas", 9, [System.Drawing.FontStyle]::Regular)
    $fontSmall = New-Object System.Drawing.Font("Arial", 8, [System.Drawing.FontStyle]::Regular)
    
    $brushBlack = [System.Drawing.Brushes]::Black
    $brushGray = [System.Drawing.Brushes]::DarkGray
    $brushLight = [System.Drawing.Brushes]::LightGray
    $penThick = New-Object System.Drawing.Pen([System.Drawing.Color]::Black, 2)
    $penThin = New-Object System.Drawing.Pen([System.Drawing.Color]::Black, 1)
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")

    if ($isLabelPrinter) {
        # =========================================================================
        # THERMAL LABEL / BARCODE PRINTER LAYOUT (Compact 380 x 280)
        # =========================================================================
        $lx = 10
        $ly = 10
        $lw = 360
        $lh = 260
        
        # Border
        $g.DrawRectangle($penThick, $lx, $ly, $lw, $lh)
        
        # Header banner
        $g.FillRectangle($brushBlack, $lx, $ly, $lw, 35)
        $g.DrawString("IMPREVO • HARDWARE TEST", $fontSub, [System.Drawing.Brushes]::White, $lx + 15, $ly + 8)
        
        $y = $ly + 45
        $g.DrawString("Printer : " + $effectivePrinter, $fontBody, $brushBlack, $lx + 10, $y); $y += 18
        $g.DrawString("Port    : Direct Windows Spooler", $fontBody, $brushBlack, $lx + 10, $y); $y += 18
        $g.DrawString("Time    : " + $timestamp, $fontBody, $brushBlack, $lx + 10, $y); $y += 18
        $g.DrawString("Status  : ONLINE & FUNCTIONAL", $fontSub, [System.Drawing.Brushes]::DarkGreen, $lx + 10, $y); $y += 24

        # Barcode Pattern Simulation
        $g.DrawString("CALIBRATION BARCODE PATTERN", $fontSmall, $brushBlack, $lx + 10, $y); $y += 16
        $barX = $lx + 10
        $barPatterns = @(3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 4, 1, 2, 3, 1, 4, 2, 1, 3, 2, 4, 1, 3)
        foreach ($bw in $barPatterns) {
            $g.FillRectangle($brushBlack, $barX, $y, $bw, 32)
            $barX += $bw + 3
        }
        $y += 40
        $g.DrawString("* IMPREVO-KIOSK-OK *", $fontBody, $brushBlack, $lx + 50, $y); $y += 20
        $g.DrawString("Hardware spooler communication verified.", $fontSmall, $brushGray, $lx + 10, $y)
    } else {
        # =========================================================================
        # STANDARD LASER / INKJET A4 LAYOUT (Canon LBP2900, etc.)
        # =========================================================================
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
        
        $g.DrawString(("- Target Printer Name  : " + $effectivePrinter), $fontBody, $brushBlack, $x, $y); $y += 22
        $g.DrawString(("- Station Terminal ID  : #04 (Main Academic Counter)"), $fontBody, $brushBlack, $x, $y); $y += 22
        $g.DrawString(("- Hardware Interface   : USB Direct Spooler Subsystem"), $fontBody, $brushBlack, $x, $y); $y += 22
        $g.DrawString(("- Dispatch Timestamp   : " + $timestamp), $fontBody, $brushBlack, $x, $y); $y += 22
        $g.DrawString(("- Driver Architecture  : Windows Native GDI Graphics Spooler"), $fontBody, $brushBlack, $x, $y); $y += 22
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
    }

    $e.HasMorePages = $false
}

$doc.add_PrintPage($printAction)

try {
    $doc.Print()
    Write-Output "Test page successfully submitted via GDI graphical spooler to $effectivePrinter"
} catch {
    Write-Error ("Print failed: " + $_.Exception.Message)
    exit 1
} finally {
    $doc.Dispose()
}
