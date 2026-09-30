import { Router } from 'express';
import crypto from 'crypto';
import pool from '../db/connection.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

const router = Router();

// GET /api/orders/razorpay-config - Get public Razorpay Key ID
router.get('/razorpay-config', (_req, res) => {
  const keyId = process.env.RAZORPAY_KEY_ID || '';
  res.json({
    configured: Boolean(keyId && !keyId.includes('YOUR_KEY')),
    keyId: keyId.includes('YOUR_KEY') ? '' : keyId,
  });
});

// POST /api/orders/create-razorpay-order - Create Razorpay order via REST API
router.post('/create-razorpay-order', async (req, res) => {
  const { amount, receipt, notes } = req.body;

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret || keyId.includes('YOUR_KEY')) {
    return res.status(400).json({
      success: false,
      error: 'Razorpay credentials not configured on server',
    });
  }

  try {
    // amount in paise (min 100 paise = 1 INR)
    const amountInPaise = Math.max(100, Math.round(Number(amount || 2) * 100));
    const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    const razorpayRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: 'INR',
        receipt: receipt || `rec_${Date.now()}`,
        notes: notes || {},
      }),
    });

    const data = await razorpayRes.json();

    if (!razorpayRes.ok) {
      console.error('Razorpay API error response:', data);
      return res.status(razorpayRes.status).json({
        success: false,
        error: data.error?.description || 'Failed to create Razorpay order',
        details: data,
      });
    }

    res.json({
      success: true,
      keyId,
      order: data,
    });
  } catch (error: any) {
    console.error('Error contacting Razorpay API:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal error creating Razorpay order',
    });
  }
});

// POST /api/orders/verify-razorpay-payment - Verify payment signature
router.post('/verify-razorpay-payment', async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keySecret) {
    return res.status(400).json({ success: false, error: 'Razorpay secret not configured' });
  }

  try {
    if (razorpayOrderId && razorpaySignature) {
      const generatedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      if (generatedSignature !== razorpaySignature) {
        return res.status(400).json({ success: false, error: 'Invalid payment signature' });
      }
    }

    res.json({ success: true, verified: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/orders - Create a new print order
router.post('/', async (req, res) => {
  const {
    id,
    fileName,
    fileSize,
    fileFormat = 'PDF v1.7',
    totalPages,
    colorMode = 'bw',
    copies = 1,
    isDuplex = false,
    paperSize = 'A4',
    paperGsm = '75 GSM High White',
    ratePerPage,
    totalPrice,
    paymentMethod = 'upi',
    orientation = 'portrait',
    pageRange = 'all',
  } = req.body;

  try {
    const orderId = id || `#ORD-${Math.floor(10000 + Math.random() * 90000)}`;
    const finalCopies = Math.max(1, Number(copies) || 1);
    const finalDocPages = Math.max(1, Number(req.body.docPages || req.body.doc_pages || totalPages) || 1);
    // Number of pages = finalize number of pages * number of copies
    const finalTotalPages = Number(totalPages) && Number(totalPages) === finalDocPages * finalCopies 
      ? Number(totalPages) 
      : finalDocPages * finalCopies;

    const calculatedRate = ratePerPage ?? (colorMode === 'bw' ? 2.0 : 10.0);
    const calculatedTotal = totalPrice ?? (finalTotalPages * calculatedRate);

    const rawPaymentStatus = req.body.paymentStatus || req.body.payment_status || 'idle';
    const finalPaymentStatus = rawPaymentStatus === 'paid' ? 'success' : rawPaymentStatus;
    const finalPrintStatus = req.body.printStatus || req.body.print_status || (finalPaymentStatus === 'success' ? 'queued' : 'pending');
    const finalTxnId = req.body.txnId || req.body.txn_id || (finalPaymentStatus === 'success' ? `pay_${Math.random().toString(36).substring(2, 12)}` : null);

    // Strict requirement: Do NOT store pending/unpaid orders into database
    if (finalPaymentStatus !== 'success' && finalPaymentStatus !== 'paid') {
      return res.status(200).json({
        success: true,
        message: 'Order received in memory, not persisted to DB until payment is completed',
        order: {
          id: orderId,
          fileName,
          totalPrice: calculatedTotal,
          paymentStatus: 'pending',
        },
      });
    }

    await pool.query<ResultSetHeader>(
      `INSERT INTO orders (
        id, terminal_id, file_name, file_size, file_format, doc_pages, total_pages, 
        color_mode, copies, is_duplex, paper_size, paper_gsm, 
        rate_per_page, total_price, payment_method, payment_status, txn_id, print_status,
        orientation, page_range, queue_position, tray
      ) VALUES (?, '#04', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'Tray 1')
      ON DUPLICATE KEY UPDATE
        file_name = VALUES(file_name),
        file_size = VALUES(file_size),
        doc_pages = VALUES(doc_pages),
        total_pages = VALUES(total_pages),
        color_mode = VALUES(color_mode),
        copies = VALUES(copies),
        is_duplex = VALUES(is_duplex),
        rate_per_page = VALUES(rate_per_page),
        total_price = VALUES(total_price),
        payment_method = VALUES(payment_method),
        payment_status = VALUES(payment_status),
        txn_id = COALESCE(VALUES(txn_id), txn_id),
        print_status = VALUES(print_status),
        orientation = VALUES(orientation),
        page_range = VALUES(page_range)`,
      [
        orderId,
        fileName || 'document.pdf',
        fileSize || '1.0 MB',
        fileFormat,
        finalDocPages,
        finalTotalPages,
        colorMode,
        finalCopies,
        isDuplex ? 1 : 0,
        paperSize,
        paperGsm,
        calculatedRate,
        calculatedTotal,
        paymentMethod,
        finalPaymentStatus,
        finalTxnId,
        finalPrintStatus,
        orientation,
        pageRange,
      ]
    );

    // Link uploaded document with this order so print worker has the exact file path
    try {
      await pool.query(
        `UPDATE documents 
         SET order_id = ? 
         WHERE (order_id IS NULL OR order_id = ?) AND original_name = ?
         ORDER BY id DESC LIMIT 1`,
        [orderId, orderId, fileName]
      );
    } catch (e) {
      console.warn('Could not link document to order:', e);
    }

    // If order is created in paid state, immediately record payment and shopkeeper notification
    if (finalPaymentStatus === 'success' || finalPaymentStatus === 'paid') {
      try {
        await pool.query(
          `INSERT INTO payments (id, order_id, razorpay_order_id, razorpay_payment_id, amount, currency, method, status)
           VALUES (?, ?, ?, ?, ?, 'INR', ?, 'captured')
           ON DUPLICATE KEY UPDATE status = 'captured'`,
          [finalTxnId, orderId, `order_${finalTxnId}`, finalTxnId, calculatedTotal, paymentMethod || 'upi']
        );

        await pool.query(
          `INSERT INTO shopkeeper_notifications (terminal_id, type, title, message, is_read)
           VALUES ('#04', 'order_paid', ?, ?, FALSE)`,
          [`Order ${orderId} Paid`, `Rs. ${calculatedTotal}.00 via Razorpay - ${fileName || 'document.pdf'}`]
        );

        // Link uploaded document to this order if one exists
        if (fileName) {
          await pool.query(
            `UPDATE documents SET order_id = ? WHERE original_name = ? AND (order_id IS NULL OR order_id = '') ORDER BY created_at DESC LIMIT 1`,
            [orderId, fileName]
          );
        }
      } catch (err) {
        console.warn('Error recording payment ledger on order creation:', err);
      }
    }

    const [orders] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM orders WHERE id = ?',
      [orderId]
    );

    res.status(201).json({
      success: true,
      order: orders[0],
    });
  } catch (error) {
    console.error('Error creating order in MySQL:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// GET /api/orders - List all orders
router.get('/', async (_req, res) => {
  try {
    const [orders] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM orders ORDER BY created_at DESC LIMIT 50'
    );
    res.json({ success: true, orders });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// GET /api/orders/:id - Get specific order
router.get('/:id', async (req, res) => {
  try {
    const [orders] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM orders WHERE id = ?',
      [req.params.id]
    );

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ success: true, order: orders[0] });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// PATCH /api/orders/:id/payment - Update payment details
router.patch('/:id/payment', async (req, res) => {
  const { paymentStatus, paymentMethod, txnId } = req.body;

  try {
    const transactionId =
      txnId ||
      `TXN-${Math.floor(100000000 + Math.random() * 900000000)}`;

    await pool.query(
      `UPDATE orders 
       SET payment_status = ?, payment_method = COALESCE(?, payment_method), txn_id = ? 
       WHERE id = ?`,
      [paymentStatus || 'success', paymentMethod, transactionId, req.params.id]
    );

    const [orders] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM orders WHERE id = ?',
      [req.params.id]
    );
    const order = orders[0];

    // Record in payments table ledger
    if (order && (paymentStatus === 'success' || paymentStatus === 'paid')) {
      try {
        await pool.query(
          `INSERT INTO payments (id, order_id, razorpay_order_id, razorpay_payment_id, amount, currency, method, status)
           VALUES (?, ?, ?, ?, ?, 'INR', ?, 'captured')
           ON DUPLICATE KEY UPDATE status = 'captured'`,
          [transactionId, req.params.id, `order_${transactionId}`, transactionId, order.total_price, paymentMethod || 'upi']
        );

        // Add real notification for shopkeeper
        await pool.query(
          `INSERT INTO shopkeeper_notifications (terminal_id, type, title, message, is_read)
           VALUES ('#04', 'order_paid', ?, ?, FALSE)`,
          [`Order ${req.params.id} Paid`, `₹${order.total_price}.00 via Razorpay • ${order.file_name}`]
        );

        // Ensure order enters print queue if pending
        await pool.query(
          `UPDATE orders SET print_status = 'queued' WHERE id = ? AND print_status = 'pending'`,
          [req.params.id]
        );

        // Link document if not linked yet
        if (order.file_name) {
          await pool.query(
            `UPDATE documents SET order_id = ? WHERE original_name = ? AND (order_id IS NULL OR order_id = '') ORDER BY created_at DESC LIMIT 1`,
            [req.params.id, order.file_name]
          );
        }
      } catch (err) {
        console.warn('Could not record payment ledger or notification:', err);
      }
    }

    res.json({ success: true, order });
  } catch (error) {
    console.error('Error updating order payment:', error);
    res.status(500).json({ error: 'Failed to update payment' });
  }
});

// PATCH /api/orders/:id/print - Update printing execution status
router.patch('/:id/print', async (req, res) => {
  const { printStatus, currentPagePrinting, printProgress } = req.body;

  try {
    await pool.query(
      `UPDATE orders 
       SET print_status = COALESCE(?, print_status),
           current_page_printing = COALESCE(?, current_page_printing),
           print_progress = COALESCE(?, print_progress)
       WHERE id = ?`,
      [printStatus, currentPagePrinting, printProgress, req.params.id]
    );

    // If print completed, decrement terminal & printer hardware paper count
    if (printStatus === 'completed') {
      const [orderRows] = await pool.query<RowDataPacket[]>(
        'SELECT total_pages, copies, is_duplex, file_name FROM orders WHERE id = ?',
        [req.params.id]
      );
      if (orderRows.length > 0) {
        const o = orderRows[0];
        const sheetsUsed = o.is_duplex
          ? Math.ceil(o.total_pages / 2) * o.copies
          : o.total_pages * o.copies;

        await pool.query(
          'UPDATE terminals SET paper_count = GREATEST(0, paper_count - ?) WHERE id = "#04"',
          [sheetsUsed]
        );
        await pool.query(
          'UPDATE printer_hardware SET paper_count = GREATEST(0, paper_count - ?) WHERE terminal_id = "#04"',
          [sheetsUsed]
        );

        // Add notification for print completion
        await pool.query(
          `INSERT INTO shopkeeper_notifications (terminal_id, type, title, message, is_read)
           VALUES ('#04', 'printing_completed', ?, ?, FALSE)`,
          [`Print Completed • ${req.params.id}`, `${sheetsUsed} sheet(s) printed • ${o.file_name}`]
        );
      }
    }

    const [orders] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM orders WHERE id = ?',
      [req.params.id]
    );

    res.json({ success: true, order: orders[0] });
  } catch (error) {
    console.error('Error updating print progress:', error);
    res.status(500).json({ error: 'Failed to update print progress' });
  }
});

export default router;
