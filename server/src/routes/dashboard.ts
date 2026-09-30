import { Router, Request, Response } from 'express';
import pool from '../db/connection.js';
import { processPrintQueueTick } from '../services/printQueueWorker.js';

const router = Router();

/**
 * GET /api/dashboard/stats
 * Returns shopkeeper profile, kiosk telemetry, printer hardware status, and KPI summary.
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    // 1. Fetch Shopkeeper Profile
    const [shopRows]: any = await pool.query(`
      SELECT id, shop_name, owner_name, initials, email, phone, status 
      FROM shopkeepers 
      LIMIT 1
    `);
    const shop = shopRows[0] || {
      shop_name: 'Shree Ganesh Print',
      owner_name: 'Dev Sharma',
      initials: 'SG',
    };

    // 2. Fetch Terminal State
    const [termRows]: any = await pool.query(`
      SELECT id, name, location, status, api_status, cloud_storage_status, last_heartbeat
      FROM terminals 
      WHERE id = '#04'
      LIMIT 1
    `);
    const terminal = termRows[0] || {
      id: '#04',
      name: 'Terminal Station #04',
      status: 'Online',
      api_status: 'online',
      cloud_storage_status: 'live',
    };

    // 3. Fetch Printer Hardware
    const [prnRows]: any = await pool.query(`
      SELECT model_name, connection_type, toner_level_pct, paper_count, paper_capacity, active_tray, status
      FROM printer_hardware
      WHERE terminal_id = '#04'
      LIMIT 1
    `);
    const printer = prnRows[0] || {
      model_name: 'Brother HL-L6400DW',
      toner_level_pct: 92,
      paper_count: 450,
      paper_capacity: 500,
      active_tray: 'Tray 1',
      status: 'ready',
    };

    // 4. Compute Real KPI Aggregates from Orders Table
    const [todayRows]: any = await pool.query(`
      SELECT 
        COUNT(*) as todayOrders,
        COALESCE(SUM(CASE WHEN payment_status IN ('paid', 'success') THEN total_price ELSE 0 END), 0) as todaySales,
        COALESCE(SUM(CASE WHEN print_status = 'completed' THEN total_pages ELSE 0 END), 0) as todayPrintouts,
        COALESCE(SUM(CASE WHEN print_status = 'completed' THEN 1 ELSE 0 END), 0) as completedOrders
      FROM orders
      WHERE DATE(created_at) = CURRENT_DATE()
    `);
    const todayKpi = todayRows[0] || {};

    const [allRows]: any = await pool.query(`
      SELECT 
        COUNT(*) as totalOrders,
        COALESCE(SUM(CASE WHEN payment_status IN ('paid', 'success') THEN total_price ELSE 0 END), 0) as totalSales,
        COALESCE(SUM(CASE WHEN print_status = 'completed' THEN total_pages ELSE 0 END), 0) as totalPrintouts,
        COALESCE(SUM(CASE WHEN print_status = 'completed' THEN 1 ELSE 0 END), 0) as completedOrders
      FROM orders
    `);
    const allKpi = allRows[0] || {};

    const isTodayActive = Number(todayKpi?.todayOrders || 0) > 0;
    const todayOrders = isTodayActive ? Number(todayKpi.todayOrders) : Number(allKpi?.totalOrders || 0);
    const todaySales = isTodayActive ? Number(todayKpi.todaySales) : Number(allKpi?.totalSales || 0);
    const todayPrintouts = isTodayActive ? Number(todayKpi.todayPrintouts) : Number(allKpi?.totalPrintouts || 0);
    const completedOrders = isTodayActive ? Number(todayKpi.completedOrders) : Number(allKpi?.completedOrders || 0);

    // Dynamic growth percentage (can naturally exceed 100%)
    const [prevRows]: any = await pool.query(`
      SELECT total_orders, total_sales_inr 
      FROM daily_analytics 
      WHERE date < CURRENT_DATE() 
      ORDER BY date DESC 
      LIMIT 1
    `);
    const prevDay = prevRows[0];
    const baseOrders = Math.max(1, Number(prevDay?.total_orders || 1));
    const baseSales = Math.max(1, Number(prevDay?.total_sales_inr || 10));

    const orderTrendPct = Math.round((todayOrders / baseOrders) * 100);
    const salesTrendPct = Math.round((todaySales / baseSales) * 100);

    res.json({
      shop,
      terminal,
      printer,
      kpis: {
        todayOrders,
        orderTrend: `+${orderTrendPct}%`,
        todaySales,
        salesTrend: `+${salesTrendPct}%`,
        todayPrintouts,
        completedOrders,
        allTimeOrders: Number(allKpi?.totalOrders || 0),
        allTimeSales: Number(allKpi?.totalSales || 0),
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to retrieve dashboard stats' });
  }
});

/**
 * GET /api/dashboard/orders
 * Returns paginated, searchable, and filterable orders with real category counts.
 */
router.get('/orders', async (req: Request, res: Response) => {
  try {
    const status = (req.query.status as string) || 'all';
    const search = (req.query.search as string) || '';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit as string) || 10));
    const offset = (page - 1) * limit;

    // Compute status counts for paid orders only
    const [countsRows]: any = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN payment_status IN ('paid', 'success') THEN 1 ELSE 0 END), 0) as totalAll,
        COALESCE(SUM(CASE WHEN payment_status IN ('paid', 'success') THEN 1 ELSE 0 END), 0) as totalPaid,
        COALESCE(SUM(CASE WHEN payment_status IN ('paid', 'success') AND print_status = 'printing' THEN 1 ELSE 0 END), 0) as totalPrinting,
        COALESCE(SUM(CASE WHEN payment_status IN ('paid', 'success') AND print_status IN ('queued', 'pending') THEN 1 ELSE 0 END), 0) as totalQueued,
        COALESCE(SUM(CASE WHEN payment_status IN ('paid', 'success') AND print_status = 'completed' THEN 1 ELSE 0 END), 0) as totalCompleted
      FROM orders
    `);
    const c = countsRows[0];

    // Strict requirement: Pending payments should not be shown or counted in the dashboard
    const conditions: string[] = [`payment_status IN ('paid', 'success')`];
    const params: any[] = [];

    if (status === 'printing') {
      conditions.push(`print_status = 'printing'`);
    } else if (status === 'queued') {
      conditions.push(`print_status IN ('queued', 'pending')`);
    } else if (status === 'completed') {
      conditions.push(`print_status = 'completed'`);
    }

    if (search.trim()) {
      conditions.push(`(id LIKE ? OR file_name LIKE ? OR print_status LIKE ?)`);
      const searchPattern = `%${search.trim()}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Total count for current filter
    const [totalRows]: any = await pool.query(
      `SELECT COUNT(*) as count FROM orders ${whereClause}`,
      params
    );
    const totalItems = totalRows[0]?.count || 0;
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    // Fetch paginated rows
    const querySql = `
      SELECT 
        o.id, 
        o.file_name as documentName, 
        o.file_size as fileSize,
        o.file_format as fileFormat, 
        o.doc_pages as docPages,
        o.total_pages as pages, 
        o.total_price as amount,
        o.rate_per_page as ratePerPage,
        o.payment_method as paymentMethod,
        o.payment_status as paymentStatus,
        o.print_status as printingStatus,
        o.current_page_printing as currentPagePrinting,
        o.print_progress as printProgress,
        o.queue_position as queuePosition,
        o.tray,
        o.printer_name as printerName,
        o.orientation,
        o.page_range as pageRange,
        o.paper_size as paperSize,
        o.paper_gsm as paperGsm,
        DATE_FORMAT(o.created_at, '%H:%i') as time,
        o.copies,
        o.color_mode as colorMode,
        o.is_duplex as isDuplex,
        o.txn_id as txnId,
        o.created_at as createdAt,
        o.completed_at as completedAt,
        MAX(CASE WHEN d.stored_name IS NOT NULL THEN CONCAT('/uploads/', d.stored_name) ELSE NULL END) as fileUrl
      FROM orders o
      LEFT JOIN documents d ON (d.order_id = o.id OR d.original_name = o.file_name)
      ${whereClause}
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [rows]: any = await pool.query(querySql, [...params, limit, offset]);

    // Normalize output format
    const orders = rows.map((r: any) => ({
      ...r,
      paymentStatus: r.paymentStatus === 'success' ? 'paid' : r.paymentStatus,
      printingStatus: r.printingStatus === 'pending' ? 'queued' : r.printingStatus,
      amount: Number(r.amount),
      pages: Number(r.pages),
      docPages: Number(r.docPages || Math.round(Number(r.pages) / Math.max(1, Number(r.copies)))),
      copies: Number(r.copies),
      isDuplex: Boolean(r.isDuplex),
    }));

    res.json({
      orders,
      pagination: {
        totalItems,
        totalPages,
        currentPage: page,
        itemsPerPage: limit,
      },
      counts: {
        all: Number(c?.totalAll || 0),
        paid: Number(c?.totalPaid || 0),
        printing: Number(c?.totalPrinting || 0),
        queued: Number(c?.totalQueued || 0),
        completed: Number(c?.totalCompleted || 0),
      },
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to retrieve orders' });
  }
});

/**
 * GET /api/dashboard/orders/:id
 * Returns detailed order specifications for the modal.
 */
router.get('/orders/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [rows]: any = await pool.query(
      `
      SELECT 
        o.id,
        o.terminal_id as terminalId,
        o.file_name as documentName,
        o.file_size as fileSize,
        o.file_format as fileFormat,
        o.doc_pages as docPages,
        o.total_pages as pages,
        o.copies,
        o.color_mode as colorMode,
        o.orientation,
        o.is_duplex as isDuplex,
        o.page_range as pageRange,
        o.paper_size as paperSize,
        o.paper_gsm as paperGsm,
        o.rate_per_page as ratePerPage,
        o.printer_name as printerName,
        o.total_price as amount,
        o.payment_method as paymentMethod,
        o.payment_status as paymentStatus,
        o.txn_id as txnId,
        o.print_status as printingStatus,
        o.current_page_printing as currentPagePrinting,
        o.print_progress as printProgress,
        o.queue_position as queuePosition,
        o.tray,
        o.created_at as createdAt,
        o.completed_at as completedAt,
        MAX(CASE WHEN d.stored_name IS NOT NULL THEN CONCAT('/uploads/', d.stored_name) ELSE NULL END) as fileUrl
      FROM orders o
      LEFT JOIN documents d ON (d.order_id = o.id OR d.original_name = o.file_name)
      WHERE o.id = ?
      GROUP BY o.id
      LIMIT 1
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = rows[0];
    res.json({
      ...order,
      paymentStatus: order.paymentStatus === 'success' ? 'paid' : order.paymentStatus,
      printingStatus: order.printingStatus === 'pending' ? 'queued' : order.printingStatus,
      amount: Number(order.amount),
      pages: Number(order.pages),
      docPages: Number(order.docPages || Math.round(Number(order.pages) / Math.max(1, Number(order.copies)))),
      copies: Number(order.copies),
      isDuplex: Boolean(order.isDuplex),
    });
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({ error: 'Failed to retrieve order' });
  }
});

/**
 * POST /api/dashboard/orders/:id/reprint
 * Restarts the print task by setting order status back to queued and triggering printQueueWorker.
 */
router.post('/orders/:id/reprint', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    // Reset order status to 'queued' so printQueueWorker restarts the task
    await pool.query(
      `
      UPDATE orders 
      SET print_status = 'queued',
          current_page_printing = 0,
          print_progress = 0,
          completed_at = NULL
      WHERE id = ?
      `,
      [id]
    );

    await pool.query(
      `
      INSERT INTO reprint_audit_logs (order_id, action_type, reason)
      VALUES (?, 'reprint_job', ?)
      `,
      [id, reason || 'Shopkeeper manual restart']
    );

    await pool.query(
      `
      INSERT INTO shopkeeper_notifications (terminal_id, type, title, message, is_read)
      VALUES ('#04', 'printing_started', ?, ?, FALSE)
      `,
      [`Restarted Print • ${id}`, `Print job restarted manually by shopkeeper`]
    );

    // Trigger immediate background worker tick
    processPrintQueueTick().catch((err) => console.warn('Error during restart tick:', err));

    res.json({
      success: true,
      message: `Print task restarted for ${id}`,
      orderId: id,
      action: 'reprint_job',
    });
  } catch (error) {
    console.error('Error restarting print task:', error);
    res.status(500).json({ error: 'Failed to restart print task' });
  }
});

/**
 * POST /api/dashboard/orders/:id/receipt
 * Records receipt generation into audit log.
 */
router.post('/orders/:id/receipt', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await pool.query(
      `
      INSERT INTO reprint_audit_logs (order_id, action_type, reason)
      VALUES (?, 'print_receipt', 'Customer receipt reprint')
      `,
      [id]
    );

    res.json({
      success: true,
      message: `Receipt printed for ${id}`,
      orderId: id,
      action: 'print_receipt',
    });
  } catch (error) {
    console.error('Error logging receipt:', error);
    res.status(500).json({ error: 'Failed to print receipt' });
  }
});

/**
 * GET /api/dashboard/notifications
 * Returns recent alerts for the notification bell dropdown.
 */
router.get('/notifications', async (_req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query(`
      SELECT id, type, title, message, is_read as isRead, created_at as createdAt
      FROM shopkeeper_notifications
      ORDER BY created_at DESC
      LIMIT 10
    `);

    res.json({ notifications: rows });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to retrieve notifications' });
  }
});

/**
 * TEST API: POST /api/dashboard/test/create-order
 * Allows user/developer to insert an order live and see the dashboard update immediately.
 */
router.post('/test/create-order', async (req: Request, res: Response) => {
  try {
    const orderNum = Math.floor(1000 + Math.random() * 9000);
    const newId = `#ORD-${orderNum}`;
    const fileName = req.body.fileName || `sample_doc_${orderNum}.pdf`;
    const pages = Number(req.body.pages) || 5;
    const colorMode = req.body.colorMode || 'bw';
    const rate = colorMode === 'bw' ? 2.0 : 10.0;
    const totalPrice = pages * rate;
    const printStatus = req.body.printStatus || 'queued';
    const txnId = `pay_test_${Math.random().toString(36).substring(2, 12)}`;

    await pool.query(
      `
      INSERT INTO orders (id, terminal_id, file_name, file_size, file_format, total_pages, color_mode, copies, is_duplex, rate_per_page, total_price, payment_method, payment_status, txn_id, print_status, queue_position, tray)
      VALUES (?, '#04', ?, '1.5 MB', 'PDF', ?, ?, 1, TRUE, ?, ?, 'upi', 'success', ?, ?, 1, 'Tray 1')
      `,
      [newId, fileName, pages, colorMode, rate, totalPrice, txnId, printStatus]
    );

    await pool.query(
      `
      INSERT INTO payments (id, order_id, razorpay_order_id, razorpay_payment_id, amount, currency, method, status)
      VALUES (?, ?, ?, ?, ?, 'INR', 'upi', 'captured')
      `,
      [txnId, newId, `order_${txnId}`, txnId, totalPrice]
    );

    // Also add notification
    await pool.query(
      `
      INSERT INTO shopkeeper_notifications (terminal_id, type, title, message, is_read)
      VALUES ('#04', 'order_paid', ?, ?, FALSE)
      `,
      [`New Order ${newId} Received`, `₹${totalPrice}.00 • ${fileName} (${pages} pgs)`]
    );

    res.json({
      success: true,
      message: `Test order ${newId} created successfully!`,
      order: {
        id: newId,
        fileName,
        pages,
        totalPrice,
        printStatus,
        txnId,
      },
    });
  } catch (error) {
    console.error('Error creating test order:', error);
    res.status(500).json({ error: 'Failed to create test order' });
  }
});

/**
 * TEST API: POST /api/dashboard/test/update-printer
 * Allows simulating printer status changes (toner, paper, error).
 */
router.post('/test/update-printer', async (req: Request, res: Response) => {
  try {
    const { tonerLevel, paperCount, status, activeTray } = req.body;

    const updates: string[] = [];
    const params: any[] = [];

    if (tonerLevel !== undefined) {
      updates.push('toner_level_pct = ?');
      params.push(Number(tonerLevel));
    }
    if (paperCount !== undefined) {
      updates.push('paper_count = ?');
      params.push(Number(paperCount));
    }
    if (status) {
      updates.push('status = ?');
      params.push(status);
    }
    if (activeTray) {
      updates.push('active_tray = ?');
      params.push(activeTray);
    }

    if (updates.length > 0) {
      params.push('#04');
      await pool.query(
        `UPDATE printer_hardware SET ${updates.join(', ')} WHERE terminal_id = ?`,
        params
      );
    }

    res.json({
      success: true,
      message: 'Printer hardware state updated successfully',
    });
  } catch (error) {
    console.error('Error updating printer:', error);
    res.status(500).json({ error: 'Failed to update printer state' });
  }
});

export default router;
