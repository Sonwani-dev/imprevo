import { Router } from 'express';
import pool from '../db/connection.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

const router = Router();

// POST /api/support/call
router.post('/call', async (req, res) => {
  const { terminalId = '#04', issueType = 'Customer requested shopkeeper', message } = req.body;

  try {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO support_requests (terminal_id, issue_type, message, status)
       VALUES (?, ?, ?, 'open')`,
      [terminalId, issueType, message || 'User clicked Call Shopkeeper button on Kiosk']
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM support_requests WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      request: rows[0],
    });
  } catch (error) {
    console.error('Error logging support call:', error);
    res.status(500).json({ error: 'Failed to log support call' });
  }
});

// GET /api/support/calls
router.get('/calls', async (_req, res) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM support_requests ORDER BY created_at DESC LIMIT 20'
    );
    res.json({ success: true, calls: rows });
  } catch (error) {
    console.error('Error fetching support calls:', error);
    res.status(500).json({ error: 'Failed to fetch support calls' });
  }
});

export default router;
