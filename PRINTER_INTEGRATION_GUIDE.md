# Imprevo Printer Integration & Real-Time Telemetry Guide

This document explains the end-to-end technical process of how physical printers connect to the Imprevo Kiosk station, how system scanning and auto-detection work under the hood on Linux, how B&W vs. Color printers are configured, how print jobs are automatically routed, and how real-time hardware telemetry (toner, paper, offline status) is retrieved.

---

## 1. Physical & Network Connection Methods

Printers connect to the Imprevo Kiosk host machine (Linux PC, mini-PC, or kiosk compute module) via two standard interfaces:

```
┌────────────────────────────────────────────────────────┐
│                   IMPREVO KIOSK HOST                   │
│               (Ubuntu / Debian / Linux)                │
└────────────┬──────────────────────────────┬────────────┘
             │ (USB 2.0 / 3.0 Cable)        │ (Local Network / Ethernet)
             ▼                              ▼
  ┌───────────────────────┐      ┌────────────────────────┐
  │   B&W Laser Printer   │      │  Color Laser / Inkjet  │
  │ (e.g., Brother / HP)  │      │ (e.g., Canon / Epson)  │
  └───────────────────────┘      └────────────────────────┘
```

### Method A: USB Direct Connection
1. **Physical Cable**: Standard USB-A to USB-B cable plugged into the kiosk PC.
2. **Kernel Detection**:
   - The Linux kernel `usblp` driver detects the connection.
   - The device appears in `/dev/usb/lp0` (or `lp1`).
   - Device details can be viewed with:
     ```bash
     lsusb
     # Example: Bus 001 Device 004: ID 04f9:0042 Brother Industries, Ltd HL-L6400DW series
     ```
3. **CUPS Backend Registration**:
   - Linux CUPS (Common Unix Printing System) registers the device URI:
     `usb://Brother/HL-L6400DW?serial=000E8J123456`

### Method B: Network IPP / Ethernet Connection (Recommended for Multi-function / High-Speed)
1. **Network Cable or Wi-Fi**: Printer connects to the same local subnet as the kiosk (e.g., router assigns `192.168.1.120`).
2. **IPP Everywhere / Driverless Printing**:
   - Modern printers support Apple AirPrint / Mopria / IPP Everywhere.
   - The printer advertises its capabilities on the network via mDNS/DNS-SD (Bonjour).
   - URI format: `ipp://192.168.1.120/ipp/print` or `socket://192.168.1.120:9100`.

---

## 2. How System Scanning & Auto-Detection Works

When the shopkeeper clicks **"Scan Printers"** on the dashboard, the frontend calls:
`GET /api/printers/scan` (with alias support for `/api/printers/system`)

### The Under-the-Hood Discovery Engine

The Express backend uses `printerDiscoveryManager` ([`server/src/services/printerDiscovery.ts`](file:///c:/Users/win/Downloads/imprevo-main/server/src/services/printerDiscovery.ts)) implementing the common `IPrinterDiscoveryService` to query Windows Printing Subsystem (CIM/WMI/Win32_Printer) or Linux CUPS in real-time:

```
Frontend [Scan Printers] ──▶ GET /api/printers/scan ──▶ OS Printing Subsystem (Windows / CUPS)
                                                              │
                    ┌─────────────────┬───────────────────────┼────────────────────┐
                    ▼                 ▼                       ▼                    ▼
             `lpstat -e`         `lpstat -v`            `lpstat -p -d`        `ippfind`
           (Available CUPS   (Hardware Device URIs:   (Printer Status:     (Network IPP
            Destinations)      USB / Network IPP)      Idle/Printing/Busy)  Auto-Discovery)
```

#### Step-by-Step Command Flow:

1. **Query Available CUPS Queues**:
   ```bash
   lpstat -e
   # Returns installed destinations:
   # Brother_HL_L6400DW
   # Canon_iR_ADV_C3530i
   ```

2. **Query Device URIs & Connection Types**:
   ```bash
   lpstat -v
   # Returns:
   # device for Brother_HL_L6400DW: usb://Brother/HL-L6400DW?serial=000E8J123456
   # device for Canon_iR_ADV_C3530i: ipp://192.168.1.120/ipp/print
   ```

3. **Query Printer Status & Default Device**:
   ```bash
   lpstat -p -d
   # Returns:
   # printer Brother_HL_L6400DW is idle. enabled since Thu 24 Sep 2026
   # system default destination: Brother_HL_L6400DW
   ```

4. **Discover Unconfigured Network Printers (mDNS Discovery)**:
   ```bash
   ippfind
   # Discovers active network printers broadcasting on LAN without requiring manual IP entry:
   # ipp://Canon-C3530i.local:631/ipp/print
   ```

5. **Transform into Clean JSON**:
   The backend inspects each printer's PPD/driver or model name to automatically detect:
   - `colorSupport`: whether it supports CMYK or RGB color models.
   - `connectionType`: `usb`, `network_ipp`, or `cups_local`.
   - `status`: `ready`, `idle`, or `offline`.

---

## 3. How to Set a Printer as Color vs. B&W

### Shopkeeper Workflow on the Dashboard

```
┌────────────────────────────────────────────────────────────────────────┐
│ Detected System Printers                                               │
├────────────────────────────────────────────────────────────────────────┤
│ 🖨️  Brother HL-L6400DW Laser   [USB]    [✓ Selected B&W] [Set as Color] │
│ 🎨  Canon imageRUNNER C3530i    [IPP]    [Set as B&W] [✓ Selected Color] │
└────────────────────────────────────────────────────────────────────────┘
```

1. In **Settings > Configure Printers**, the shopkeeper sees the live list of detected printers.
2. Clicking **"Set as B&W"** assigns that device ID as `selectedBwPrinterId`.
3. Clicking **"Set as Color"** assigns that device ID as `selectedColorPrinterId`.
   *(Note: If a shop only has 1 all-in-one printer, they can set both to the same printer).*
4. Clicking **"Save Configuration"** sends a payload to:
   `POST /api/printers/configure`

### Database Persistence (`printer_configs` table in MySQL)

The server stores the configuration in the `printer_configs` table:
```sql
INSERT INTO printer_configs (
  terminal_id,
  bw_printer_id,
  bw_printer_name,
  bw_connection_type,
  bw_device_uri,
  bw_status,
  color_printer_id,
  color_printer_name,
  color_connection_type,
  color_device_uri,
  color_status,
  use_same_printer_for_both
) VALUES (
  '#04',
  'brother_hl_l6400dw',
  'Brother HL-L6400DW (B&W High-Speed Laser)',
  'usb',
  'usb://Brother/HL-L6400DW',
  'ready',
  'canon_ir_adv_c3530i',
  'Canon imageRUNNER ADVANCE C3530i (Color Laser)',
  'network_ipp',
  'ipp://192.168.1.120/ipp/print',
  'ready',
  0
)
ON DUPLICATE KEY UPDATE ...;
```

---

## 4. How Print Jobs Are Automatically Routed

When a customer completes payment at the kiosk, the print worker loads the saved configuration from MySQL and routes the PDF file:

```
                 Customer Pays at Kiosk
                            │
                  Is document B&W or Color?
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
      [B&W Document]                 [Color Document]
            │                               │
    Fetch `bw_printer`              Fetch `color_printer`
    from `printer_configs`          from `printer_configs`
            │                               │
            ▼                               ▼
    Execute `lp` command:           Execute `lp` command:
    `lp -d <bw_printer_queue>       `lp -d <color_printer_queue>
        -o ColorModel=Gray              -o ColorModel=CMYK
        -o fit-to-page                  -o print-quality=high
        -o sides=two-sided-long-edge`   -o fit-to-page`
            │                               │
            ▼                               ▼
  High-Speed B&W Laser           Calibrated Color Printer
```

### The Native Print Command Generated by Server:

- **For Black & White Jobs**:
  ```bash
  lp -d "Brother_HL_L6400DW" \
     -o ColorModel=Gray \
     -o media=A4 \
     -o fit-to-page \
     -o sides=two-sided-long-edge \
     /path/to/uploads/customer_doc.pdf
  ```
- **For Full Color Jobs**:
  ```bash
  lp -d "Canon_iR_ADV_C3530i" \
     -o ColorModel=CMYK \
     -o media=A4 \
     -o print-quality=5 \
     -o fit-to-page \
     /path/to/uploads/customer_doc.pdf
  ```

---

## 5. How Real-Time Connection & Telemetry is Retrieved

Modern printers report rich real-time state information using IPP (Internet Printing Protocol) and SNMP.

### Real-Time IPP Status Query
The server can query the printer directly via IPP:
```bash
ipptool -tv ipp://192.168.1.120/ipp/print get-printer-attributes.test
```

### Key Attributes Returned:

| Attribute | Meaning / Real-World Values | Dashboard Presentation |
| :--- | :--- | :--- |
| `printer-state` | `3` (idle), `4` (processing), `5` (stopped) | Green dot: "Ready", Yellow: "Printing", Red: "Stopped" |
| `printer-state-reasons` | `media-empty-warning` | "Out of A4 Paper in Tray 1" |
| `printer-state-reasons` | `marker-supply-low-warning` | "Low Toner Warning (< 10%)" |
| `printer-state-reasons` | `door-open` | "Front Cover / Door Open" |
| `printer-state-reasons` | `offline` | "Printer Disconnected / Powered Off" |
| `marker-levels` | Array of percentages: `[85, 92, 40, 78]` | Toner Gauge: K: 85%, C: 92%, M: 40%, Y: 78% |

### Live Telemetry Loop in Imprevo Backend

A lightweight background job queries the hardware status and updates the database every 10–15 seconds:

```typescript
// Example telemetry routine (server/src/services/telemetry.ts)
import { exec } from 'child_process';
import { db } from '../db/connection';

export async function checkPrinterHardwareHealth(queueName: string) {
  return new Promise((resolve) => {
    exec(`lpstat -p "${queueName}"`, async (err, stdout) => {
      let status = 'ready';
      if (err || stdout.includes('disabled') || stdout.includes('offline')) {
        status = 'offline';
      } else if (stdout.includes('printing')) {
        status = 'printing';
      }

      // Update database status
      await db.execute(
        'UPDATE printer_configs SET bw_status = ? WHERE bw_printer_name LIKE ?',
        [status, `%${queueName}%`]
      );

      resolve(status);
    });
  });
}
```

---

## 6. Shopkeeper Checklist for Adding a New Physical Printer

1. **Plug in the Printer**:
   - Connect USB cable to Kiosk PC or connect Ethernet cable to the shop router.
   - Turn the printer power ON.
2. **Verify Linux sees the device**:
   - For USB: Run `lsusb`.
   - For Network: Run `ping <printer-ip>` or check router DHCP list.
3. **Add printer to CUPS (if not auto-added via driverless IPP)**:
   - For most modern printers (AirPrint / Mopria capable), simply run:
     ```bash
     lpadmin -p "Shop_Color_Printer" -E -v "ipp://192.168.1.125/ipp/print" -m everywhere
     ```
   - For USB printers:
     ```bash
     lpadmin -p "Shop_BW_Laser" -E -v "usb://Brother/HL-L6400DW" -m everywhere
     ```
4. **Open the Imprevo Dashboard**:
   - Go to `http://localhost:5173/dashboard`.
   - Click **Settings** in the left sidebar.
   - Click **Scan Printers** — the newly connected printer will appear in the list.
   - Click **"Set as B&W"** or **"Set as Color"**.
   - Click **"Test"** to print a physical verification page.
   - Click **"Save Printer Configuration"**.
