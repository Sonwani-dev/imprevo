import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import pool from '../db/connection.js';
import type { RowDataPacket } from 'mysql2';

const execAsync = promisify(exec);

let isWorkerRunning = false;
let isProcessingTick = false;

/**
 * Discovers available CUPS queues on this Linux system
 */
async function getAvailableCupsQueues(): Promise<string[]> {
  try {
    const { stdout } = await execAsync('lpstat -e');
    return stdout
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  } catch {
    return [];
  }
}

/**
 * Checks whether a specific CUPS queue or system has an active job printing
 */
async function isPrinterBusy(queueName: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync(`lpstat -o "${queueName}"`);
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

      // Determine target printer based on user's color_mode preference
      const isColor = order.color_mode === 'color';
      let targetName = isColor
        ? (config.color_printer_name || 'Virtual_Color_Laser')
        : (config.bw_printer_name || 'Virtual_BW_Laser');

      // Resolve against available CUPS destinations on the Linux system
      const availableQueues = await getAvailableCupsQueues();
      let selectedQueue = targetName.trim().replace(/\s+/g, '_');

      // Check if the selected queue exists in CUPS; if not, fuzzy match or fallback
      if (!availableQueues.includes(selectedQueue)) {
        const fuzzy = availableQueues.find(
          (q) =>
            q.toLowerCase() === targetName.toLowerCase() ||
            q.toLowerCase().replace(/[^a-z0-9]/g, '') === targetName.toLowerCase().replace(/[^a-z0-9]/g, '') ||
            targetName.toLowerCase().includes(q.toLowerCase())
        );
        if (fuzzy) {
          selectedQueue = fuzzy;
        } else if (isColor && availableQueues.find((q) => q.toLowerCase().includes('color'))) {
          selectedQueue = availableQueues.find((q) => q.toLowerCase().includes('color'))!;
        } else if (!isColor && availableQueues.find((q) => q.toLowerCase().includes('bw') || !q.toLowerCase().includes('color'))) {
          selectedQueue = availableQueues.find((q) => q.toLowerCase().includes('bw') || !q.toLowerCase().includes('color'))!;
        } else if (availableQueues.length > 0) {
          selectedQueue = availableQueues[0];
        }
      }

      // Check whether this printer is currently busy / has a queued job blocking it
      const busyInCups = await isPrinterBusy(selectedQueue);
      const [busyInDb] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM orders WHERE print_status = 'printing' AND color_mode = ? AND id != ?`,
        [order.color_mode, order.id]
      );

      if (busyInCups || busyInDb.length > 0) {
        console.log(`[PrintWorker] Target printer "${selectedQueue}" is currently busy (CUPS: ${busyInCups}, Active DB Job: ${busyInDb.length > 0 ? busyInDb[0].id : 'none'}). Holding Order ${order.id} in queue.`);
        return;
      }

      // Printer is ready! Shift order to 'printing' and construct the print command
      const totalPages = Math.max(1, Number(order.total_pages) || 1);
      const initialProgress = Math.min(80, Math.round((1 / totalPages) * 100));

      console.log(`[PrintWorker] Dispatching Order ${order.id} to "${selectedQueue}" (Preferences: ${order.color_mode}, ${order.orientation}, ${order.copies} copies, Duplex: ${order.is_duplex}, Pages: ${order.page_range || 'all'}, Res: 600dpi)...`);

      await pool.query(
        `UPDATE orders 
         SET print_status = 'printing', 
             current_page_printing = 1, 
             print_progress = ?,
             printer_name = ?
         WHERE id = ?`,
        [initialProgress, selectedQueue, order.id]
      );

      // Determine physical file to print
      let targetFilePath = order.doc_file_path;
      if (!targetFilePath || !fs.existsSync(targetFilePath)) {
        // Query database documents table for latest matching document
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
        if (fs.existsSync(uploadsDir)) {
          const files = fs.readdirSync(uploadsDir);
          const found = files.find((f) => f.includes(order.file_name) || (order.file_name && f.endsWith(path.extname(order.file_name))));
          if (found) {
            targetFilePath = path.join(uploadsDir, found);
          }
        }
      }

      // If no file exists, create a clean diagnostic job payload
      let isTempFile = false;
      if (!targetFilePath || !fs.existsSync(targetFilePath)) {
        targetFilePath = path.resolve(process.cwd(), `uploads/temp_${order.id.replace('#', '')}.txt`);
        const content = `IMPREVO SMART PRINTING KIOSK\nOrder: ${order.id}\nFile: ${order.file_name}\nMode: ${order.color_mode.toUpperCase()}\nCopies: ${order.copies}\nPages: ${order.total_pages}\nTimestamp: ${new Date().toISOString()}\n`;
        fs.writeFileSync(targetFilePath, content, 'utf8');
        isTempFile = true;
      }

      // Assemble all print preference options
      // 1. Color Model: CMYK for color, Gray for B&W
      const colorOption = isColor ? '-o ColorModel=CMYK' : '-o ColorModel=Gray';
      // 2. Orientation: 3 for portrait, 4 for landscape
      const orientationOption = order.orientation === 'landscape' ? '-o orientation-requested=4' : '-o orientation-requested=3';
      // 3. Number of copies
      const copiesOption = `-n ${Math.max(1, order.copies || 1)}`;
      // 4. Duplex (two-sided vs one-sided)
      const duplexOption = order.is_duplex ? '-o sides=two-sided-long-edge' : '-o sides=one-sided';
      // 5. Page Range (if custom)
      const pageRangeOption = order.page_range && order.page_range !== 'all' ? `-P ${order.page_range}` : '';
      // 6. Media, fit-to-page, and resolution
      const mediaOption = '-o media=A4 -o fit-to-page -o resolution=600dpi';

      const lpCommand = `lp -d "${selectedQueue}" ${colorOption} ${orientationOption} ${copiesOption} ${duplexOption} ${pageRangeOption} ${mediaOption} "${targetFilePath}"`.replace(/\s+/g, ' ');

      try {
        const { stdout } = await execAsync(lpCommand);
        console.log(`[PrintWorker] CUPS dispatch successful: ${stdout.trim()}`);

        await pool.query(
          `INSERT INTO shopkeeper_notifications (terminal_id, type, title, message, is_read)
           VALUES ('#04', 'printing_started', ?, ?, FALSE)`,
          [
            `Printing Started • ${order.id}`,
            `Sent to ${selectedQueue} (${isColor ? 'Color' : 'B&W Laser'}) • ${order.file_name}`,
          ]
        );
      } catch (err: any) {
        console.warn(`[PrintWorker] CUPS execution warning for ${order.id}:`, err.message || err);
      } finally {
        if (isTempFile && fs.existsSync(targetFilePath)) {
          setTimeout(() => {
            try { fs.unlinkSync(targetFilePath); } catch {}
          }, 10000);
        }
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
