import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import pool from '../db/connection.js';
import type { RowDataPacket } from 'mysql2';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const require = createRequire(import.meta.url);
const ptp = require('pdf-to-printer');

const execAsync = promisify(exec);

import { printerDiscoveryManager } from './printerDiscovery.js';

let isWorkerRunning = false;
let isProcessingTick = false;
let lastMissingPrinterAlert = 0;
let lastOfflinePrinterAlert = 0;

async function notifyMissingPrinter(printerName: string, orderId: string): Promise<void> {
  if (Date.now() - lastMissingPrinterAlert < 60000) return;
  lastMissingPrinterAlert = Date.now();
  try {
    await pool.query(
      `INSERT INTO shopkeeper_notifications (terminal_id, type, title, message, is_read)
       VALUES ('#04', 'system', 'Selected Printer Missing', ?, FALSE)`,
      [`Order ${orderId} is on hold: Selected printer "${printerName}" is not detected on this system. Please check the printer connection or select an available printer in Settings.`]
    );
  } catch {}
}

async function notifyOfflinePrinter(printerName: string, orderId: string): Promise<void> {
  if (Date.now() - lastOfflinePrinterAlert < 60000) return;
  lastOfflinePrinterAlert = Date.now();
  try {
    await pool.query(
      `INSERT INTO shopkeeper_notifications (terminal_id, type, title, message, is_read)
       VALUES ('#04', 'system', 'Printer Offline', ?, FALSE)`,
      [`Order ${orderId} is on hold: Printer "${printerName}" is reported offline. Please verify printer power and cable connection.`]
    );
  } catch {}
}



/**
 * Checks whether a specific printer or system has an active job printing
 */
async function isPrinterBusy(printerName: string): Promise<boolean> {
  if (process.platform === 'win32') {
    try {
      const safeName = printerName.replace(/'/g, "''");
      const { stdout } = await execAsync(
        `powershell -Command "Get-PrintJob -PrinterName '${safeName}' -ErrorAction SilentlyContinue | Measure-Object | Select-Object -ExpandProperty Count"`
      );
      const count = parseInt(stdout.trim(), 10);
      return !isNaN(count) && count > 0;
    } catch {
      return false;
    }
  }

  try {
    const { stdout } = await execAsync(`lpstat -o "${printerName}" 2>/dev/null || true`);
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Core 3-second cycle function for the print queue worker
 */
export async function processPrintQueueTick(): Promise<void> {
  if (isProcessingTick) return;
  isProcessingTick = true;

  try {
    // =========================================================================
    // STEP 1: Advance any currently PRINTING orders and track real-time pages
    // =========================================================================
    const [printingOrders] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM orders 
       WHERE print_status = 'printing' 
       ORDER BY updated_at ASC`
    );

    for (const order of printingOrders) {
      const totalPages = Math.max(1, Number(order.total_pages) || 1);
      const currentPage = Math.max(1, Number(order.current_page_printing) || 1);

      if (currentPage < totalPages) {
        // Advance to next page
        const nextPage = currentPage + 1;
        const progress = Math.min(95, Math.round((nextPage / totalPages) * 100));

        await pool.query(
          `UPDATE orders 
           SET current_page_printing = ?, print_progress = ? 
           WHERE id = ?`,
          [nextPage, progress, order.id]
        );
        console.log(`[PrintWorker] Order ${order.id}: Printing page ${nextPage} of ${totalPages} (${progress}%)`);
      } else {
        // All pages have completed printing!
        const sheetsUsed = order.is_duplex
          ? Math.ceil(totalPages / 2)
          : totalPages;

        await pool.query(
          `UPDATE orders 
           SET print_status = 'completed', 
               print_progress = 100, 
               current_page_printing = ?,
               completed_at = CURRENT_TIMESTAMP 
           WHERE id = ?`,
          [totalPages, order.id]
        );

        // Deduct paper count from terminal & printer hardware
        await pool.query(
          'UPDATE terminals SET paper_count = GREATEST(0, paper_count - ?) WHERE id = "#04"',
          [sheetsUsed]
        );
        await pool.query(
          'UPDATE printer_hardware SET paper_count = GREATEST(0, paper_count - ?) WHERE terminal_id = "#04"',
          [sheetsUsed]
        );

        // Notify shopkeeper
        await pool.query(
          `INSERT INTO shopkeeper_notifications (terminal_id, type, title, message, is_read)
           VALUES ('#04', 'printing_completed', ?, ?, FALSE)`,
          [
            `Print Completed • ${order.id}`,
            `${sheetsUsed} sheet(s) printed • ${order.file_name} (${order.color_mode === 'color' ? 'Color' : 'B&W'})`,
          ]
        );
        console.log(`[PrintWorker] Order ${order.id} COMPLETED! ${sheetsUsed} sheet(s) dispensed.`);
      }
    }

    // =========================================================================
    // STEP 2: Check for next QUEUED order and dispatch to target printer
    // =========================================================================
    const [queuedOrders] = await pool.query<RowDataPacket[]>(
      `SELECT o.*, d.file_path as doc_file_path 
       FROM orders o
       LEFT JOIN documents d ON (d.order_id = o.id OR d.original_name = o.file_name)
       WHERE o.payment_status IN ('paid', 'success') 
         AND o.print_status = 'queued'
       ORDER BY o.created_at ASC
       LIMIT 1`
    );

    if (queuedOrders.length > 0) {
      const order = queuedOrders[0];

      // Retrieve configured printer hardware from printer_configs
      const [configRows] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM printer_configs WHERE terminal_id = '#04' LIMIT 1`
      );
      const config = configRows[0] || {};

      // Determine target printer based on user's color_mode preference and default printer
      const isColor = order.color_mode === 'color';
      let targetName = (isColor
        ? (config.color_printer_name || config.default_printer_name || '')
        : (config.bw_printer_name || config.default_printer_name || '')).trim();

      // Scan local operating system in real-time to validate presence
      const scanResult = await printerDiscoveryManager.scan();
      const livePrinters = scanResult.printers || [];

      // Clean name for matching
      const cleanTarget = targetName.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();

      // Match target against genuinely detected system printers
      let matchedPrinter = livePrinters.find(
        (p) =>
          p.name.toLowerCase() === targetName.toLowerCase() ||
          p.name.toLowerCase() === cleanTarget ||
          p.identifier.toLowerCase() === cleanTarget ||
          p.displayName.toLowerCase() === cleanTarget
      );

      if (!matchedPrinter && cleanTarget) {
        matchedPrinter = livePrinters.find(
          (p) =>
            p.name.toLowerCase().includes(cleanTarget) ||
            cleanTarget.includes(p.name.toLowerCase()) ||
            p.name.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanTarget.replace(/[^a-z0-9]/g, '')
        );
      }

      // CRITICAL REQUIREMENTS 4 & 5:
      // "Validate that the selected printer still exists before sending a print job.
      // If it is missing or unavailable, prevent unintended printing and request another selection.
      // Do not silently send jobs to a different printer."
      if (!matchedPrinter) {
        console.warn(`[PrintWorker] Configured printer "${targetName || 'None'}" is not detected by the local operating system. Holding Order ${order.id} to prevent unintended printing.`);
        await notifyMissingPrinter(targetName || 'Not configured', order.id);
        return;
      }

      if (matchedPrinter.status === 'Offline') {
        console.warn(`[PrintWorker] Selected printer "${matchedPrinter.name}" is currently reported Offline. Holding Order ${order.id}.`);
        await notifyOfflinePrinter(matchedPrinter.name, order.id);
        return;
      }

      const selectedPrinter = matchedPrinter.name;

      // Check whether this printer is currently busy
      const busyInSpooler = await isPrinterBusy(selectedPrinter);
      const [busyInDb] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM orders WHERE print_status = 'printing' AND color_mode = ? AND id != ?`,
        [order.color_mode, order.id]
      );

      if (busyInSpooler || busyInDb.length > 0) {
        console.log(`[PrintWorker] Target printer "${selectedPrinter}" is currently busy (Spooler: ${busyInSpooler}, Active DB Job: ${busyInDb.length > 0 ? busyInDb[0].id : 'none'}). Holding Order ${order.id} in queue.`);
        return;
      }

      // Printer is ready! Shift order to 'printing' and dispatch
      const totalPages = Math.max(1, Number(order.total_pages) || 1);
      const initialProgress = Math.min(80, Math.round((1 / totalPages) * 100));

      console.log(`[PrintWorker] Dispatching Order ${order.id} to "${selectedPrinter}" (Preferences: ${order.color_mode}, ${order.orientation}, ${order.copies} copies, Duplex: ${order.is_duplex}, Pages: ${order.page_range || 'all'}, Res: 600dpi)...`);

      await pool.query(
        `UPDATE orders 
         SET print_status = 'printing', 
             current_page_printing = 1, 
             print_progress = ?,
             printer_name = ?
         WHERE id = ?`,
        [initialProgress, selectedPrinter, order.id]
      );

      // Determine physical file to print
      let targetFilePath = order.doc_file_path;
      if (!targetFilePath || !fs.existsSync(targetFilePath)) {
        try {
          const [docRows] = await pool.query<RowDataPacket[]>(
            `SELECT file_path FROM documents WHERE order_id = ? OR original_name = ? ORDER BY id DESC LIMIT 1`,
            [order.id, order.file_name]
          );
          if (docRows.length > 0 && fs.existsSync(docRows[0].file_path)) {
            targetFilePath = docRows[0].file_path;
          }
        } catch {}
      }

      if (!targetFilePath || !fs.existsSync(targetFilePath)) {
        const uploadsDir = path.resolve(process.cwd(), 'uploads');
        if (fs.existsSync(uploadsDir) && order.file_name) {
          const directMatch = path.join(uploadsDir, order.file_name);
          if (fs.existsSync(directMatch)) {
            targetFilePath = directMatch;
          } else {
            const files = fs.readdirSync(uploadsDir);
            const baseWithoutExt = path.parse(order.file_name).name.toLowerCase();
            const found = files.find((f) =>
              f.toLowerCase().includes(order.file_name.toLowerCase()) ||
              (baseWithoutExt.length > 3 && f.toLowerCase().includes(baseWithoutExt))
            );
            if (found) {
              targetFilePath = path.join(uploadsDir, found);
            }
          }
        }
      }

      if (!targetFilePath || !fs.existsSync(targetFilePath)) {
        console.warn(`[PrintWorker] No physical file found on disk for order ${order.id} (${order.file_name}). Skipping physical hardware dispatch.`);
        return;
      }

      // -----------------------------------------------------------------------
      // HARDWARE PRINT TRANSMISSION (WINDOWS vs LINUX)
      // -----------------------------------------------------------------------
      try {
        if (process.platform === 'win32') {
          const ext = path.extname(targetFilePath).toLowerCase();
          const isImage = ['.jpg', '.jpeg', '.png', '.bmp', '.webp', '.gif', '.tiff'].includes(ext);

          console.log(`[PrintWorker] [Windows] Sending job to physical printer "${selectedPrinter}" (File: ${path.basename(targetFilePath)}, Type: ${isImage ? 'Image/Photo' : ext === '.pdf' ? 'PDF' : 'Text'})...`);

          if (isImage) {
            // High-quality native GDI graphical photo printing
            const printScript = path.resolve(__dirname, 'printImageWindows.ps1');
            const safeImgPath = targetFilePath.replace(/'/g, "''");
            const safePrinter = selectedPrinter.replace(/'/g, "''");
            const orientationParam = order.orientation === 'landscape' ? 'landscape' : 'portrait';
            const copiesParam = Math.max(1, order.copies || 1);
            const rotateParam = Number((order as any).rotation) || 0;
            const psCommand = `powershell -ExecutionPolicy Bypass -File "${printScript}" -ImagePath "${safeImgPath}" -PrinterName "${safePrinter}" -Orientation "${orientationParam}" -Copies ${copiesParam} -RotateDegrees ${rotateParam}`;
            const { stdout } = await execAsync(psCommand);
            console.log(`[PrintWorker] ✓ Physical photo print job sent to Windows printer "${selectedPrinter}"! ${stdout.trim()}`);
          } else if (ext === '.pdf') {
            const printOptions: any = {
              printer: selectedPrinter,
              copies: Math.max(1, order.copies || 1),
            };

            // Specify exact page range if custom, or restrict to 1 page if total_pages is 1
            if (order.page_range && order.page_range !== 'all') {
              printOptions.pages = order.page_range;
            } else if (Number(order.total_pages) === 1 || Number(order.doc_pages) === 1) {
              printOptions.pages = '1';
            }

            if (order.orientation === 'landscape' || order.orientation === 'portrait') {
              printOptions.orientation = order.orientation;
            }
            if (order.is_duplex) {
              printOptions.side = 'duplexlong';
            }
            if (order.color_mode === 'bw') {
              printOptions.monochrome = true;
            }

            await ptp.print(targetFilePath, printOptions);
            console.log(`[PrintWorker] ✓ Physical PDF print job sent to Windows printer "${selectedPrinter}"!`);
          } else if (ext === '.txt') {
            // ONLY pure text files are allowed to use Out-Printer
            const safePath = targetFilePath.replace(/'/g, "''");
            const safePrinter = selectedPrinter.replace(/'/g, "''");
            await execAsync(
              `powershell -Command "Get-Content -LiteralPath '${safePath}' | Out-Printer -Name '${safePrinter}'"`
            );
            console.log(`[PrintWorker] ✓ Text document dispatched to Windows printer "${selectedPrinter}"!`);
          } else {
            console.warn(`[PrintWorker] Unsupported file extension '${ext}' for direct printing.`);
          }
        } else {
          // Linux CUPS lp command
          const colorOption = isColor ? '-o ColorModel=CMYK' : '-o ColorModel=Gray';
          const orientationOption = order.orientation === 'landscape' ? '-o orientation-requested=4' : '-o orientation-requested=3';
          const copiesOption = `-n ${Math.max(1, order.copies || 1)}`;
          const duplexOption = order.is_duplex ? '-o sides=two-sided-long-edge' : '-o sides=one-sided';
          const pageRangeOption = order.page_range && order.page_range !== 'all' ? `-P ${order.page_range}` : '';
          const mediaOption = '-o media=A4 -o fit-to-page -o resolution=600dpi';

          const lpCommand = `lp -d "${selectedPrinter}" ${colorOption} ${orientationOption} ${copiesOption} ${duplexOption} ${pageRangeOption} ${mediaOption} "${targetFilePath}"`.replace(/\s+/g, ' ');
          const { stdout } = await execAsync(lpCommand);
          console.log(`[PrintWorker] CUPS dispatch successful: ${stdout.trim()}`);
        }

        await pool.query(
          `INSERT INTO shopkeeper_notifications (terminal_id, type, title, message, is_read)
           VALUES ('#04', 'printing_started', ?, ?, FALSE)`,
          [
            `Printing Started • ${order.id}`,
            `Sent to ${selectedPrinter} (${isColor ? 'Color' : 'B&W Laser'}) • ${order.file_name}`,
          ]
        );
      } catch (err: any) {
        console.warn(`[PrintWorker] Hardware print dispatch warning for ${order.id}:`, err.message || err);
      }
    }
  } catch (error) {
    console.error('[PrintWorker] Error during print queue processing tick:', error);
  } finally {
    isProcessingTick = false;
  }
}

/**
 * Initializes the background 3-second print queue worker
 */
export function initPrintQueueWorker(): void {
  if (isWorkerRunning) return;
  isWorkerRunning = true;

  console.log('🖨️ [PrintWorker] Initialized real-time print queue worker (Interval: 3000ms)');

  setTimeout(() => {
    processPrintQueueTick();
  }, 1000);

  setInterval(() => {
    processPrintQueueTick();
  }, 3000);
}
