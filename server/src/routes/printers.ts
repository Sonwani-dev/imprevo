import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import pool from '../db/connection.js';
import { printerDiscoveryManager } from '../services/printerDiscovery.js';
import type { DiscoveredPrinter } from '../services/printerDiscovery.js';

const execAsync = promisify(exec);
const router = Router();

export type { DiscoveredPrinter };

/**
 * GET /api/printers/scan
 * Scans connected local system printers in real-time across Windows/Linux
 */
router.get('/scan', async (_req: Request, res: Response) => {
  try {
    const result = await printerDiscoveryManager.scan();

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to scan system printers',
        printers: [],
        scannedAt: result.scannedAt,
        os: result.os,
      });
    }

    return res.json({
      success: true,
      printers: result.printers,
      totalFound: result.totalFound,
      realPrintersFound: result.realPrintersFound,
      scannedAt: result.scannedAt,
      os: result.os,
    });
  } catch (error: any) {
    console.error('Error in /api/printers/scan:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Operating system printing subsystem unavailable',
      printers: [],
      scannedAt: new Date().toISOString(),
      os: process.platform,
    });
  }
});

/**
 * GET /api/printers/system
 * Backward compatibility alias for GET /api/printers/scan
 */
router.get('/system', async (_req: Request, res: Response) => {
  try {
    const result = await printerDiscoveryManager.scan();

    return res.json({
      success: result.success,
      totalFound: result.totalFound,
      realPrintersFound: result.realPrintersFound,
      printers: result.printers,
      scannedAt: result.scannedAt,
      os: result.os,
    });
  } catch (error: any) {
    console.error('Error in /api/printers/system:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to scan system printers',
      printers: [],
    });
  }
});

/**
 * GET /api/printers/config
 * Retrieves saved printer assignments for terminal and checks if they currently exist
 */
router.get('/config', async (req: Request, res: Response) => {
  try {
    const terminalId = (req.query.terminalId as string) || '#04';

    let savedConfig: any = null;
    try {
      const [rows]: any = await pool.query(
        `SELECT 
          terminal_id,
          default_printer_id,
          default_printer_name,
          default_connection_type,
          default_device_uri,
          default_status,
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
          use_same_printer_for_both,
          updated_at
        FROM printer_configs
        WHERE terminal_id = ?
        LIMIT 1`,
        [terminalId]
      );
      if (rows && rows.length > 0) {
        savedConfig = rows[0];
      }
    } catch (dbErr) {
      console.warn('Database query notice in /config:', dbErr);
    }

    // Discover current printers from OS to validate presence
    const scanResult = await printerDiscoveryManager.scan();
    const livePrinters = scanResult.printers || [];

    if (savedConfig && (savedConfig.default_printer_name || savedConfig.bw_printer_name)) {
      // Check whether saved printers are currently detected
      const isDefaultDetected = savedConfig.default_printer_name
        ? livePrinters.some((p) => p.name.toLowerCase() === savedConfig.default_printer_name.toLowerCase())
        : false;

      const isBwDetected = savedConfig.bw_printer_name
        ? livePrinters.some((p) => p.name.toLowerCase() === savedConfig.bw_printer_name.toLowerCase())
        : false;

      const isColorDetected = savedConfig.color_printer_name
        ? livePrinters.some((p) => p.name.toLowerCase() === savedConfig.color_printer_name.toLowerCase())
        : false;

      return res.json({
        success: true,
        config: {
          ...savedConfig,
          isDefaultDetected,
          isBwDetected,
          isColorDetected,
        },
        livePrintersCount: livePrinters.length,
      });
    }

    // Fallback: Pick genuinely detected printers from the current OS scan
    const osDefault = livePrinters.find((p) => p.isDefault) || livePrinters[0];
    const defaultBw = livePrinters.find((p) => !p.colorSupport && p.connectionType !== 'virtual') || osDefault;
    const defaultColor = livePrinters.find((p) => p.colorSupport && p.id !== defaultBw?.id) || osDefault || defaultBw;

    return res.json({
      success: true,
      config: {
        terminal_id: terminalId,
        default_printer_id: osDefault ? osDefault.id : null,
        default_printer_name: osDefault ? osDefault.name : null,
        default_connection_type: osDefault ? osDefault.connectionType : 'usb',
        default_device_uri: osDefault ? osDefault.uri : null,
        default_status: osDefault ? osDefault.status : 'Available',
        bw_printer_id: defaultBw ? defaultBw.id : null,
        bw_printer_name: defaultBw ? defaultBw.name : null,
        bw_connection_type: defaultBw ? defaultBw.connectionType : 'usb',
        bw_device_uri: defaultBw ? defaultBw.uri : null,
        bw_status: defaultBw ? defaultBw.status : 'Available',
        color_printer_id: defaultColor ? defaultColor.id : null,
        color_printer_name: defaultColor ? defaultColor.name : null,
        color_connection_type: defaultColor ? defaultColor.connectionType : 'usb',
        color_device_uri: defaultColor ? defaultColor.uri : null,
        color_status: defaultColor ? defaultColor.status : 'Available',
        use_same_printer_for_both: defaultBw?.id === defaultColor?.id,
        isDefaultDetected: Boolean(osDefault),
        isBwDetected: Boolean(defaultBw),
        isColorDetected: Boolean(defaultColor),
      },
      livePrintersCount: livePrinters.length,
    });
  } catch (error: any) {
    console.error('Error fetching printer config:', error);
    return res.status(500).json({ error: 'Failed to fetch printer configuration' });
  }
});

/**
 * POST /api/printers/configure
 * Saves selected Default, B&W, and Color printer assignments for the kiosk terminal
 */
router.post('/configure', async (req: Request, res: Response) => {
  try {
    const {
      terminalId = '#04',
      defaultPrinter,
      bwPrinter,
      colorPrinter,
      useSameForBoth = false,
    } = req.body;

    // Validate and normalize parameters
    const defId = defaultPrinter?.id || bwPrinter?.id || 'default_printer';
    const defName = defaultPrinter?.name || bwPrinter?.name || 'Default Printer';
    const defConn = defaultPrinter?.connectionType || bwPrinter?.connectionType || 'usb';
    const defUri = defaultPrinter?.uri || bwPrinter?.uri || null;
    const defStatus = defaultPrinter?.status || 'Available';

    const bwId = bwPrinter?.id || defId;
    const bwName = bwPrinter?.name || defName;
    const bwConn = bwPrinter?.connectionType || defConn;
    const bwUri = bwPrinter?.uri || defUri;
    const bwStatus = bwPrinter?.status || 'Available';

    const colorId = useSameForBoth ? bwId : (colorPrinter?.id || defId);
    const colorName = useSameForBoth ? bwName : (colorPrinter?.name || defName);
    const colorConn = useSameForBoth ? bwConn : (colorPrinter?.connectionType || defConn);
    const colorUri = useSameForBoth ? bwUri : (colorPrinter?.uri || defUri);
    const colorStatus = useSameForBoth ? bwStatus : (colorPrinter?.status || 'Available');

    await pool.query(
      `INSERT INTO printer_configs (
        terminal_id, 
        default_printer_id, default_printer_name, default_connection_type, default_device_uri, default_status,
        bw_printer_id, bw_printer_name, bw_connection_type, bw_device_uri, bw_status,
        color_printer_id, color_printer_name, color_connection_type, color_device_uri, color_status,
        use_same_printer_for_both
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        default_printer_id = VALUES(default_printer_id),
        default_printer_name = VALUES(default_printer_name),
        default_connection_type = VALUES(default_connection_type),
        default_device_uri = VALUES(default_device_uri),
        default_status = VALUES(default_status),
        bw_printer_id = VALUES(bw_printer_id),
        bw_printer_name = VALUES(bw_printer_name),
        bw_connection_type = VALUES(bw_connection_type),
        bw_device_uri = VALUES(bw_device_uri),
        bw_status = VALUES(bw_status),
        color_printer_id = VALUES(color_printer_id),
        color_printer_name = VALUES(color_printer_name),
        color_connection_type = VALUES(color_connection_type),
        color_device_uri = VALUES(color_device_uri),
        color_status = VALUES(color_status),
        use_same_printer_for_both = VALUES(use_same_printer_for_both),
        updated_at = CURRENT_TIMESTAMP`,
      [
        terminalId,
        defId, defName, defConn, defUri, defStatus,
        bwId, bwName, bwConn, bwUri, bwStatus,
        colorId, colorName, colorConn, colorUri, colorStatus,
        useSameForBoth ? 1 : 0,
      ]
    );

    // Update printer_hardware table primary model display
    try {
      await pool.query(
        `UPDATE printer_hardware 
        SET model_name = ?, connection_type = ?, status = 'ready'
        WHERE terminal_id = ?`,
        [defName, defConn === 'usb' ? 'usb' : 'network_ipp', terminalId]
      );
    } catch {}

    // Record notification for shopkeeper audit
    try {
      await pool.query(
        `INSERT INTO shopkeeper_notifications (terminal_id, type, title, message, is_read)
        VALUES (?, 'system', 'Printer Configuration Updated', ?, FALSE)`,
        [
          terminalId,
          useSameForBoth
            ? `Default Kiosk Printer set: ${defName}`
            : `Default: ${defName} • B&W: ${bwName} • Color: ${colorName}`,
        ]
      );
    } catch {}

    return res.json({
      success: true,
      message: 'Printer hardware successfully configured!',
      config: {
        terminalId,
        defaultPrinter: { id: defId, name: defName, connectionType: defConn, uri: defUri, status: defStatus },
        bwPrinter: { id: bwId, name: bwName, connectionType: bwConn, uri: bwUri, status: bwStatus },
        colorPrinter: { id: colorId, name: colorName, connectionType: colorConn, uri: colorUri, status: colorStatus },
        useSameForBoth,
      },
    });
  } catch (error: any) {
    console.error('Error saving printer configuration:', error);
    return res.status(500).json({ error: 'Failed to save printer configuration' });
  }
});

/**
 * POST /api/printers/validate
 * Validates if a printer still exists and is reachable on the local system
 */
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { printerName } = req.body;
    if (!printerName) {
      return res.status(400).json({ success: false, error: 'Printer name is required' });
    }

    const check = await printerDiscoveryManager.isPrinterAvailable(printerName);
    return res.json({
      success: true,
      printerName,
      exists: check.exists,
      status: check.status,
      printer: check.printer || null,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/printers/test-page
 * Submits a diagnostic test print job to the selected printer queue
 */
router.post('/test-page', async (req: Request, res: Response) => {
  try {
    const { printerType = 'bw', printerName, printerQueue } = req.body;

    // Upfront input validation to prevent command injection
    if (printerName && /[;&|`$<>]/.test(printerName)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid printer name specified: disallowed characters detected',
      });
    }
    if (printerQueue && /[;&|`$<>]/.test(printerQueue)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid printer queue specified: disallowed characters detected',
      });
    }

    // Retrieve database configuration for fallback
    let config: any = {};
    try {
      const [configRows]: any = await pool.query(
        `SELECT default_printer_name, bw_printer_name, color_printer_name 
         FROM printer_configs WHERE terminal_id = '#04' LIMIT 1`
      );
      config = configRows?.[0] || {};
    } catch {}

    // Verify current system printers
    const scanResult = await printerDiscoveryManager.scan();
    const livePrinters = scanResult.printers || [];

    const requestedName = (printerName || printerQueue || (
      printerType === 'color' ? config.color_printer_name : (config.default_printer_name || config.bw_printer_name)
    ) || '').trim();

    if (!requestedName && livePrinters.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No printers detected on the local system. Please connect a printer and scan again.',
      });
    }

    // Match against real system printers
    let targetPrinter = livePrinters.find(
      (p) =>
        p.name.toLowerCase() === requestedName.toLowerCase() ||
        p.identifier.toLowerCase() === requestedName.toLowerCase() ||
        p.displayName.toLowerCase() === requestedName.toLowerCase()
    );

    if (!targetPrinter && requestedName) {
      const cleanRequested = requestedName.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
      targetPrinter = livePrinters.find(
        (p) =>
          p.name.toLowerCase().includes(cleanRequested) ||
          cleanRequested.includes(p.name.toLowerCase())
      );
    }

    if (!targetPrinter && livePrinters.length > 0) {
      targetPrinter = livePrinters.find((p) => p.isDefault) || livePrinters[0];
    }

    const targetQueue = targetPrinter ? targetPrinter.name : requestedName;

    // Safety validation on target queue name to prevent command injection
    if (/[;&|`$<>]/.test(targetQueue)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid printer queue name specified',
      });
    }

    const isColor = printerType === 'color' || (targetPrinter ? targetPrinter.colorSupport : targetQueue.toLowerCase().includes('color'));
    const timestamp = new Date().toLocaleString();

    // Create diagnostic test content
    const testContent = 
`================================================================
          IMPREVO SMART KIOSK HARDWARE DIAGNOSTIC TEST
================================================================
Station Terminal : #04 (Main Academic Concourse)
Printer Queue    : ${targetQueue}
Device ID        : ${targetPrinter?.identifier || targetQueue}
Connection Type  : ${targetPrinter?.connectionType ? targetPrinter.connectionType.toUpperCase() : 'LOCAL SPOOLER'}
Print Mode       : ${isColor ? 'FULL COLOR (CMYK/RGB)' : 'MONOCHROME LASER (GRAYSCALE)'}
Dispatched At    : ${timestamp}
Resolution       : 600 DPI High-Precision Diagnostic Pattern
Paper Standard   : ISO A4 (210 x 297 mm)
Hardware Status  : ${targetPrinter?.status || 'ONLINE & FUNCTIONAL'}
Spooler Platform : ${process.platform === 'win32' ? 'Windows Print Spooler' : 'CUPS Subsystem'}
----------------------------------------------------------------
[ALIGNMENT GRID TARGET]
+--------------------------------------------------------------+
| [TOP LEFT]                                      [TOP RIGHT]  |
|                                                              |
|        TEST PATTERN: ################################        |
|        TONER / INK DENSITY: [|||||||||||||||||||||||]        |
|                                                              |
| [BOTTOM LEFT]                                [BOTTOM RIGHT]  |
+--------------------------------------------------------------+
Imprevo Kiosk Engine v1.0 • Genuine Print Job Subsystem
================================================================
`;

    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    const testFilePath = path.join(uploadsDir, `test_page_${Date.now()}.txt`);
    fs.writeFileSync(testFilePath, testContent, 'utf8');

    let jobId: string | null = null;
    let rawOutput = '';

    if (process.platform === 'win32') {
      try {
        const safePath = testFilePath.replace(/'/g, "''");
        const safePrinter = targetQueue.replace(/'/g, "''");
        const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Content -LiteralPath '${safePath}' | Out-Printer -Name '${safePrinter}'"`;
        await execAsync(psCmd, { timeout: 8000 });
        jobId = `win_${Date.now()}`;
        rawOutput = `Job queued to Windows Print Spooler for ${targetQueue}`;
      } catch (winErr: any) {
        console.error('[Windows Print Test Error]:', winErr.message || winErr);
        try { fs.unlinkSync(testFilePath); } catch {}
        return res.status(500).json({
          success: false,
          error: `Failed to submit test job to ${targetQueue}: ${winErr.message || 'Windows Spooler error'}`,
          targetQueue,
        });
      }
    } else {
      // Linux CUPS lp command
      const colorOpt = isColor ? '-o ColorModel=CMYK' : '-o ColorModel=Gray';
      const safeQueue = targetQueue.replace(/"/g, '\\"');
      const safePath = testFilePath.replace(/"/g, '\\"');
      const lpCommand = `lp -d "${safeQueue}" ${colorOpt} -o media=A4 -o fit-to-page "${safePath}"`;

      try {
        const { stdout } = await execAsync(lpCommand, { timeout: 8000 });
        rawOutput = stdout.trim();
        const match = rawOutput.match(/request id is ([^\s]+)/i);
        if (match) jobId = match[1];
      } catch (cupsErr: any) {
        console.error('[CUPS Print Test Error]:', cupsErr.message || cupsErr);
        try { fs.unlinkSync(testFilePath); } catch {}
        return res.status(500).json({
          success: false,
          error: `Failed to submit test job to ${targetQueue}: ${cupsErr.message || 'CUPS error'}`,
          targetQueue,
        });
      }
    }

    // Clean up temporary test file
    setTimeout(() => {
      try { if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath); } catch {}
    }, 5000);

    // Record test print in shopkeeper audit notifications
    try {
      await pool.query(
        `INSERT INTO shopkeeper_notifications (terminal_id, type, title, message, is_read)
         VALUES ('#04', 'system', ?, ?, FALSE)`,
        [
          `Test Page Sent (${isColor ? 'Color' : 'B&W'})`,
          jobId
            ? `Dispatched test job [${jobId}] to ${targetQueue}. Job submitted to spooler.`
            : `Test page job submitted to ${targetQueue}.`,
        ]
      );
    } catch {}

    // Distinguish job submission from confirmed physical printing
    return res.json({
      success: true,
      message: jobId
        ? `✓ Test page successfully submitted to spooler for ${targetQueue} [${jobId}]. Awaiting physical output.`
        : `✓ Test page submitted to ${targetQueue} print queue.`,
      target: targetQueue,
      queue: targetQueue,
      jobId: jobId || `job_${Date.now()}`,
      rawOutput,
      note: 'Job successfully accepted by the operating system spooler queue.',
    });
  } catch (error: any) {
    console.error('Error triggering test page:', error);
    return res.status(500).json({ error: error.message || 'Failed to send test print page' });
  }
});

export default router;
