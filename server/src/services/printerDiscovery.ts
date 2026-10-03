import { exec } from 'child_process';
import { promisify } from 'util';
import { createRequire } from 'module';

const execAsync = promisify(exec);
const require = createRequire(import.meta.url);

export type PrinterConnectionType = 'usb' | 'network' | 'network_ipp' | 'cups_local' | 'virtual' | 'other';
export type PrinterAvailabilityStatus = 'Available' | 'Ready' | 'Idle' | 'Printing' | 'Busy' | 'Offline' | 'Error' | 'Unknown';

export interface DiscoveredPrinter {
  id: string;
  name: string;
  displayName: string;
  identifier: string;
  status: PrinterAvailabilityStatus;
  isDefault: boolean;
  connectionType: PrinterConnectionType;
  portName?: string;
  driverName?: string;
  uri?: string;
  colorSupport: boolean;
  recommendedFor: 'bw' | 'color' | 'both';
  isRealSystemPrinter: boolean;
  description: string;
  rawStatus?: string | number;
}

export interface PrinterDiscoveryResult {
  success: boolean;
  printers: DiscoveredPrinter[];
  totalFound: number;
  realPrintersFound: number;
  scannedAt: string;
  os: string;
  error?: string;
}

export interface IPrinterDiscoveryService {
  discoverPrinters(): Promise<DiscoveredPrinter[]>;
}

/**
 * Windows Printer Discovery using Windows Printing Subsystem (CIM/WMI, .NET, pdf-to-printer fallback)
 */
export class WindowsPrinterDiscoveryService implements IPrinterDiscoveryService {
  public async discoverPrinters(): Promise<DiscoveredPrinter[]> {
    const discovered: DiscoveredPrinter[] = [];

    // Attempt 1: Windows CIM/WMI Subsystem via PowerShell (fast, non-interactive, rich telemetry)
    try {
      const psCommand = 'powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Printer | Select-Object Name, DeviceID, Default, PrinterStatus, PrinterState, WorkOffline, PortName, DriverName, DetectedErrorState, ExtendedPrinterStatus | ConvertTo-Json -Compress"';
      
      const { stdout } = await execAsync(psCommand, { timeout: 12000 });
      if (stdout && stdout.trim()) {
        const raw = JSON.parse(stdout.trim());
        const list = Array.isArray(raw) ? raw : [raw];

        for (const item of list) {
          const name = String(item.Name || item.DeviceID || '').trim();
          if (!name) continue;

          const identifier = String(item.DeviceID || name);
          const port = String(item.PortName || '').trim();
          const driver = String(item.DriverName || '').trim();
          const isDefault = Boolean(item.Default);
          const isWorkOffline = Boolean(item.WorkOffline);
          const printerStatus = Number(item.PrinterStatus);
          const printerState = Number(item.PrinterState);
          const errorState = Number(item.DetectedErrorState);

          // Connection Type Determination based on Port Name and Driver
          let connectionType: PrinterConnectionType = 'other';
          const portUpper = port.toUpperCase();
          const nameLower = name.toLowerCase();

          if (
            portUpper === 'PORTPROMPT:' ||
            portUpper.startsWith('PORTPROMPT') ||
            portUpper.startsWith('MICROSOFT') ||
            portUpper.startsWith('NULL') ||
            nameLower.includes('pdf') ||
            nameLower.includes('onenote') ||
            nameLower.includes('xps') ||
            driver.toLowerCase().includes('software printer driver')
          ) {
            connectionType = 'virtual';
          } else if (portUpper.startsWith('USB') || portUpper.includes('USB')) {
            connectionType = 'usb';
          } else if (
            portUpper.startsWith('IP_') ||
            portUpper.startsWith('WSD') ||
            portUpper.startsWith('TCP') ||
            portUpper.includes('192.168.') ||
            portUpper.includes('10.') ||
            portUpper.includes('172.') ||
            port.includes(':') ||
            port.includes('.')
          ) {
            connectionType = 'network';
          } else {
            connectionType = 'usb'; // Standard local port (LPT, COM, or local hardware port)
          }

          // Availability Status Determination
          let status: PrinterAvailabilityStatus = 'Available';
          if (isWorkOffline) {
            status = 'Offline';
          } else if (errorState === 4 || errorState === 5) {
            status = 'Error'; // Out of paper
          } else if (errorState === 9) {
            status = 'Error'; // Jammed
          } else if (errorState === 10 || printerStatus === 7) {
            status = 'Offline';
          } else if (printerStatus === 4 || printerState === 1) {
            status = 'Printing';
          } else if (printerStatus === 3 || printerState === 0) {
            status = 'Available';
          } else if (printerStatus === 5) {
            status = 'Ready';
          } else {
            status = 'Available';
          }

          // Color Support Analysis
          const isColor =
            nameLower.includes('color') ||
            nameLower.includes('clx') ||
            nameLower.includes('cmyk') ||
            nameLower.includes('ecotank') ||
            nameLower.includes('pixma') ||
            nameLower.includes('deskjet') ||
            nameLower.includes('inkjet') ||
            nameLower.includes('designjet') ||
            nameLower.includes('photosmart') ||
            nameLower.includes('stylus');

          const safeId = `win_${name.replace(/[^a-zA-Z0-9_]/g, '_')}`;

          discovered.push({
            id: safeId,
            name,
            displayName: name,
            identifier,
            status,
            isDefault,
            connectionType,
            portName: port || undefined,
            driverName: driver || undefined,
            uri: `windows://${encodeURIComponent(name)}`,
            colorSupport: isColor,
            recommendedFor: isColor ? 'color' : 'bw',
            isRealSystemPrinter: connectionType !== 'virtual',
            description: `Windows Subsystem Printer • Port: ${port || 'Standard'} • Driver: ${driver || 'Generic'}`,
            rawStatus: isWorkOffline ? 'WorkOffline' : printerStatus,
          });
        }

        if (discovered.length > 0) {
          return discovered;
        }
      }
    } catch (cimErr) {
      console.warn('[WindowsPrinterDiscovery] Win32_Printer CIM query failed, trying Get-Printer / Registry fallback:', cimErr);
    }

    // Attempt 2: Modern PowerShell Get-Printer cmdlet fallback (faster, native print management)
    try {
      const getPrinterCmd = 'powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Printer | Select-Object Name, Type, DriverName, PortName, PrinterStatus | ConvertTo-Json -Compress"';
      const { stdout: gpOut } = await execAsync(getPrinterCmd, { timeout: 8000 });
      if (gpOut && gpOut.trim()) {
        const raw = JSON.parse(gpOut.trim());
        const list = Array.isArray(raw) ? raw : [raw];

        let defaultPrinterName = '';
        try {
          const { stdout: defOut } = await execAsync('powershell -NoProfile -Command "(Get-CimInstance Win32_Printer -Filter Default=True).Name"', { timeout: 4000 });
          defaultPrinterName = defOut.trim();
        } catch {}

        for (const item of list) {
          const name = String(item.Name || '').trim();
          if (!name) continue;

          const port = String(item.PortName || '').trim();
          const driver = String(item.DriverName || '').trim();
          const portUpper = port.toUpperCase();
          const nameLower = name.toLowerCase();

          const isVirtual =
            portUpper.startsWith('PORTPROMPT') ||
            portUpper.startsWith('MICROSOFT') ||
            nameLower.includes('pdf') ||
            nameLower.includes('onenote') ||
            nameLower.includes('xps') ||
            driver.toLowerCase().includes('software printer driver');

          const isUsb = portUpper.includes('USB') || !isVirtual;
          const isColor = nameLower.includes('color') || nameLower.includes('cmyk') || nameLower.includes('ecotank') || nameLower.includes('pixma');
          const isDefault = defaultPrinterName ? name.toLowerCase() === defaultPrinterName.toLowerCase() : discovered.length === 0;

          discovered.push({
            id: `win_${name.replace(/[^a-zA-Z0-9_]/g, '_')}`,
            name,
            displayName: name,
            identifier: name,
            status: 'Available',
            isDefault,
            connectionType: isVirtual ? 'virtual' : isUsb ? 'usb' : 'network',
            portName: port || undefined,
            driverName: driver || undefined,
            uri: `windows://${encodeURIComponent(name)}`,
            colorSupport: isColor,
            recommendedFor: isColor ? 'color' : 'bw',
            isRealSystemPrinter: !isVirtual,
            description: `Windows Spooler Printer • Port: ${port || 'Standard'} • Driver: ${driver || 'Generic'}`,
          });
        }

        if (discovered.length > 0) {
          return discovered;
        }
      }
    } catch (gpErr) {
      console.warn('[WindowsPrinterDiscovery] Get-Printer query fallback notice:', gpErr);
    }

    // Attempt 3: Pure Windows Registry Query (reg query) - ZERO-DEPENDENCY, FAILS-SAFE (<50ms)
    // Works even if PowerShell is restricted, slow, or WMI service is unresponsive
    try {
      const { stdout: regOut } = await execAsync('reg query "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Print\\Printers"', { timeout: 4000 });
      let defaultPrinter = '';
      try {
        const { stdout: defOut } = await execAsync('reg query "HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Windows" /v Device', { timeout: 3000 });
        const match = defOut.match(/Device\s+REG_SZ\s+([^,\r\n]+)/i);
        if (match) defaultPrinter = match[1].trim();
      } catch {}

      for (const line of regOut.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed.startsWith('HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Print\\Printers\\')) {
          let name = trimmed.replace('HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Print\\Printers\\', '').trim();
          if (name.includes(':')) {
            name = name.split(':').pop() || name;
          }
          if (!name) continue;

          const nameLower = name.toLowerCase();
          const isVirtual = nameLower.includes('pdf') || nameLower.includes('onenote') || nameLower.includes('xps');
          const isColor = nameLower.includes('color') || nameLower.includes('cmyk') || nameLower.includes('ecotank') || nameLower.includes('pixma');
          const isDefault = defaultPrinter ? name.toLowerCase() === defaultPrinter.toLowerCase() : discovered.length === 0;

          discovered.push({
            id: `win_${name.replace(/[^a-zA-Z0-9_]/g, '_')}`,
            name,
            displayName: name,
            identifier: name,
            status: 'Available',
            isDefault,
            connectionType: isVirtual ? 'virtual' : 'usb',
            uri: `windows://${encodeURIComponent(name)}`,
            colorSupport: isColor,
            recommendedFor: isColor ? 'color' : 'bw',
            isRealSystemPrinter: !isVirtual,
            description: `Windows Registry Detected Spooler Printer • ${name}`,
          });
        }
      }

      if (discovered.length > 0) {
        return discovered;
      }
    } catch (regErr) {
      console.warn('[WindowsPrinterDiscovery] Windows Registry printer query fallback notice:', regErr);
    }

    // Attempt 4: pdf-to-printer native Windows spooler query fallback
    try {
      const ptp = require('pdf-to-printer');
      const printers = await ptp.getPrinters();
      let defaultPrinterName = '';
      try {
        const def = await ptp.getDefaultPrinter();
        if (def && def.name) defaultPrinterName = def.name;
      } catch {}

      if (Array.isArray(printers) && printers.length > 0) {
        for (const p of printers) {
          const name = String(p.name || p.deviceId || '').trim();
          if (!name) continue;
          const isDefault = name.toLowerCase() === defaultPrinterName.toLowerCase();
          const nameLower = name.toLowerCase();
          const isColor = nameLower.includes('color') || nameLower.includes('cmyk') || nameLower.includes('ecotank');
          const isVirtual = nameLower.includes('pdf') || nameLower.includes('onenote') || nameLower.includes('xps');

          discovered.push({
            id: `win_${name.replace(/[^a-zA-Z0-9_]/g, '_')}`,
            name,
            displayName: name,
            identifier: p.deviceId || name,
            status: 'Available',
            isDefault,
            connectionType: isVirtual ? 'virtual' : 'usb',
            uri: `windows://${encodeURIComponent(name)}`,
            colorSupport: isColor,
            recommendedFor: isColor ? 'color' : 'bw',
            isRealSystemPrinter: !isVirtual,
            description: `Windows Spooler Printer • ${name}`,
          });
        }
        return discovered;
      }
    } catch (ptpErr) {
      console.warn('[WindowsPrinterDiscovery] pdf-to-printer query fallback notice:', ptpErr);
    }

    // Attempt 5: .NET System.Drawing.Printing.PrinterSettings fallback
    try {
      const netCommand = 'powershell -NoProfile -Command "Add-Type -AssemblyName System.Drawing; [System.Drawing.Printing.PrinterSettings]::InstalledPrinters"';
      const { stdout } = await execAsync(netCommand, { timeout: 5000 });
      const lines = stdout.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

      for (const name of lines) {
        const nameLower = name.toLowerCase();
        const isColor = nameLower.includes('color') || nameLower.includes('cmyk');
        const isVirtual = nameLower.includes('pdf') || nameLower.includes('onenote') || nameLower.includes('xps');

        discovered.push({
          id: `win_${name.replace(/[^a-zA-Z0-9_]/g, '_')}`,
          name,
          displayName: name,
          identifier: name,
          status: 'Available',
          isDefault: discovered.length === 0,
          connectionType: isVirtual ? 'virtual' : 'usb',
          uri: `windows://${encodeURIComponent(name)}`,
          colorSupport: isColor,
          recommendedFor: isColor ? 'color' : 'bw',
          isRealSystemPrinter: !isVirtual,
          description: `.NET Spooler Detected Printer • ${name}`,
        });
      }
    } catch (netErr) {
      console.warn('[WindowsPrinterDiscovery] .NET printer fallback query notice:', netErr);
    }

    return discovered;
  }
}

/**
 * Linux / CUPS Printer Discovery Service (CUPS commands lpstat, ippfind, lpinfo)
 */
export class LinuxPrinterDiscoveryService implements IPrinterDiscoveryService {
  public async discoverPrinters(): Promise<DiscoveredPrinter[]> {
    const discovered: DiscoveredPrinter[] = [];

    try {
      // 1. Get list of destinations via lpstat -e
      const { stdout: destOutput } = await execAsync('lpstat -e 2>/dev/null || true', { timeout: 4000 });
      const destinations = destOutput
        .split('\n')
        .map((d) => d.trim())
        .filter((d) => d.length > 0 && !d.includes('No destinations'));

      // 2. Get default destination via lpstat -d
      const { stdout: defaultOutput } = await execAsync('lpstat -d 2>/dev/null || true', { timeout: 3000 });
      const defaultMatch = defaultOutput.match(/system default destination:\s*([^\s\n]+)/i);
      const defaultPrinterName = defaultMatch ? defaultMatch[1].trim() : (destinations[0] || '');

      // 3. Get device URIs via lpstat -v
      const { stdout: uriOutput } = await execAsync('lpstat -v 2>/dev/null || true', { timeout: 3000 });
      const uriMap = new Map<string, string>();
      for (const line of uriOutput.split('\n')) {
        const match = line.match(/device for\s+([^:]+):\s+(.+)/i);
        if (match) {
          uriMap.set(match[1].trim(), match[2].trim());
        }
      }

      // 4. Get printer status via lpstat -p
      const { stdout: pOutput } = await execAsync('lpstat -p 2>/dev/null || true', { timeout: 3000 });
      const statusMap = new Map<string, PrinterAvailabilityStatus>();
      for (const line of pOutput.split('\n')) {
        const pMatch = line.match(/^printer\s+([^\s]+)\s+is\s+([^.]+)/i);
        if (pMatch) {
          const pName = pMatch[1].trim();
          const pStat = pMatch[2].toLowerCase();
          if (pStat.includes('disabled') || pStat.includes('offline') || pStat.includes('stopped')) {
            statusMap.set(pName, 'Offline');
          } else if (pStat.includes('printing') || pStat.includes('busy')) {
            statusMap.set(pName, 'Printing');
          } else if (pStat.includes('idle')) {
            statusMap.set(pName, 'Available');
          } else {
            statusMap.set(pName, 'Ready');
          }
        }
      }

      // 5. Parse discovered CUPS destinations
      for (const dest of destinations) {
        const uri = uriMap.get(dest) || 'cups://localhost';
        const isDefault = dest === defaultPrinterName;
        const isUsb = uri.startsWith('usb://');
        const isIpp = uri.startsWith('ipp://') || uri.startsWith('ipps://') || uri.startsWith('socket://');
        const connectionType: PrinterConnectionType = isUsb ? 'usb' : isIpp ? 'network_ipp' : 'cups_local';
        const lower = dest.toLowerCase();
        const isColor =
          lower.includes('color') ||
          lower.includes('clx') ||
          lower.includes('cmyk') ||
          lower.includes('ecotank') ||
          lower.includes('pixma') ||
          lower.includes('deskjet');
        const printerStatus = statusMap.get(dest) || 'Available';

        discovered.push({
          id: `cups_${dest.replace(/[^a-zA-Z0-9_]/g, '_')}`,
          name: dest,
          displayName: dest.replace(/_/g, ' '),
          identifier: dest,
          status: printerStatus,
          isDefault,
          connectionType,
          uri,
          colorSupport: isColor,
          recommendedFor: isColor ? 'color' : 'bw',
          isRealSystemPrinter: true,
          description: `CUPS Subsystem Destination (${connectionType.toUpperCase()}) • URI: ${uri.split('?')[0]}`,
        });
      }

      // 6. Check for newly plugged USB or LAN printers reported by hardware subsystem
      try {
        const { stdout: hwInfo } = await execAsync('timeout 2 lpinfo -v 2>/dev/null || true', { timeout: 3000 });
        const hwLines = hwInfo.split('\n').filter((l) => l.startsWith('direct usb://') || l.startsWith('network ipp://'));

        for (const hw of hwLines) {
          const parts = hw.split(' ');
          const hwUri = parts[1]?.trim();
          if (!hwUri) continue;

          const isUsbHw = hwUri.startsWith('usb://');
          const cleanName = isUsbHw
            ? hwUri.replace('usb://', '').split('/')[0]?.replace(/[^a-zA-Z0-9_]/g, '_') || 'USB_Printer'
            : 'Network_Printer_' + Math.floor(Math.random() * 1000);

          if (!destinations.some((d) => d.toLowerCase() === cleanName.toLowerCase() || uriMap.get(d) === hwUri)) {
            discovered.push({
              id: `hw_${cleanName}`,
              name: cleanName,
              displayName: cleanName.replace(/_/g, ' '),
              identifier: cleanName,
              status: 'Available',
              isDefault: discovered.length === 0,
              connectionType: isUsbHw ? 'usb' : 'network_ipp',
              uri: hwUri,
              colorSupport: true,
              recommendedFor: 'both',
              isRealSystemPrinter: true,
              description: `Hardware Detected (${isUsbHw ? 'USB Direct' : 'Network IPP'})`,
            });
          }
        }
      } catch {}
    } catch (err) {
      console.warn('[LinuxPrinterDiscovery] CUPS query notice:', err);
    }

    return discovered;
  }
}

/**
 * Universal Printer Discovery Manager
 * Thread-safe scan execution with active concurrency lock
 */
export class PrinterDiscoveryManager {
  private service: IPrinterDiscoveryService;
  private isScanning = false;
  private currentScanPromise: Promise<PrinterDiscoveryResult> | null = null;

  constructor() {
    if (process.platform === 'win32') {
      this.service = new WindowsPrinterDiscoveryService();
    } else {
      this.service = new LinuxPrinterDiscoveryService();
    }
  }

  /**
   * Scan printers from the operating system in real-time.
   * Concurrency protected so simultaneous requests share the in-flight scan safely.
   */
  public async scan(): Promise<PrinterDiscoveryResult> {
    if (this.isScanning && this.currentScanPromise) {
      return this.currentScanPromise;
    }

    this.isScanning = true;
    this.currentScanPromise = (async () => {
      try {
        console.log(`[PrinterDiscovery] Querying local operating system (${process.platform}) for printers...`);
        const printers = await this.service.discoverPrinters();
        const realCount = printers.filter((p) => p.isRealSystemPrinter).length;
        const scannedAt = new Date().toISOString();

        console.log(`[PrinterDiscovery] Discovered ${printers.length} printer(s) (${realCount} real system hardware) at ${scannedAt}`);

        return {
          success: true,
          printers,
          totalFound: printers.length,
          realPrintersFound: realCount,
          scannedAt,
          os: process.platform,
        };
      } catch (error: any) {
        console.error('[PrinterDiscovery] Error scanning printers from operating system:', error);
        return {
          success: false,
          printers: [],
          totalFound: 0,
          realPrintersFound: 0,
          scannedAt: new Date().toISOString(),
          os: process.platform,
          error: error.message || 'Operating system printing subsystem unavailable',
        };
      } finally {
        this.isScanning = false;
        this.currentScanPromise = null;
      }
    })();

    return this.currentScanPromise;
  }

  /**
   * Validates whether a specific printer name exists on the operating system right now
   */
  public async isPrinterAvailable(printerName: string): Promise<{ exists: boolean; status: PrinterAvailabilityStatus; printer?: DiscoveredPrinter }> {
    const result = await this.scan();
    if (!result.success || result.printers.length === 0) {
      return { exists: false, status: 'Unknown' };
    }

    const clean = printerName.trim().toLowerCase().replace(/\s*\([^)]*\)/g, '');
    const found = result.printers.find(
      (p) =>
        p.name.toLowerCase() === printerName.trim().toLowerCase() ||
        p.name.toLowerCase() === clean ||
        p.identifier.toLowerCase() === clean ||
        p.displayName.toLowerCase() === clean ||
        p.id.toLowerCase() === printerName.trim().toLowerCase()
    );

    if (found) {
      return {
        exists: true,
        status: found.status,
        printer: found,
      };
    }

    return { exists: false, status: 'Unknown' };
  }
}

export const printerDiscoveryManager = new PrinterDiscoveryManager();
