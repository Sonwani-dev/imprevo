import { Router } from 'express';
import pool from '../db/connection.js';
import type { RowDataPacket } from 'mysql2';

const router = Router();

// GET /api/terminal/status
router.get('/status', async (_req, res) => {
  try {
    const [terminals] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM terminals WHERE id = ?',
      ['#04']
    );

    const [pricing] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM pricing_rules'
    );

    if (terminals.length === 0) {
      return res.status(404).json({ error: 'Terminal not found' });
    }

    res.json({
      success: true,
      terminal: terminals[0],
      pricing,
    });
  } catch (error) {
    console.error('Error fetching terminal status:', error);
    res.status(500).json({ error: 'Failed to fetch terminal status' });
  }
});

// PATCH /api/terminal/status
router.patch('/status', async (req, res) => {
  const { mode, status, paper_count, toner_level, language } = req.body;

  try {
    const updates: string[] = [];
    const values: any[] = [];

    if (mode !== undefined) {
      updates.push('mode = ?');
      values.push(mode);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }
    if (paper_count !== undefined) {
      updates.push('paper_count = ?');
      values.push(paper_count);
    }
    if (toner_level !== undefined) {
      updates.push('toner_level = ?');
      values.push(toner_level);
    }
    if (language !== undefined) {
      updates.push('language = ?');
      values.push(language);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push('#04');
    await pool.query(
      `UPDATE terminals SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const [updated] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM terminals WHERE id = ?',
      ['#04']
    );

    res.json({
      success: true,
      terminal: updated[0],
    });
  } catch (error) {
    console.error('Error updating terminal status:', error);
    res.status(500).json({ error: 'Failed to update terminal status' });
  }
});

export default router;
