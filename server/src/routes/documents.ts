import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import pool from '../db/connection.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

const router = Router();

// Ensure upload directory exists
const uploadDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
});

// POST /api/documents/upload
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { originalname, filename, path: filePath, size, mimetype } = req.file;
    let pageCount = Number(req.body.pageCount) || 1;
    const orderId = req.body.orderId || null;

    // Detect actual page count from PDF bytes if it's a PDF
    if (mimetype === 'application/pdf' || originalname.toLowerCase().endsWith('.pdf')) {
      try {
        const fileBuffer = fs.readFileSync(filePath);
        const content = fileBuffer.toString('latin1');
        const matches = content.match(/\/Type\s*\/Page\b(?!\s*s)/g);
        if (matches && matches.length > 0) {
          pageCount = matches.length;
        } else {
          const countMatch = content.match(/\/Type\s*\/Pages[\s\S]*?\/Count\s+(\d+)/);
          if (countMatch && countMatch[1]) {
            pageCount = parseInt(countMatch[1], 10);
          }
        }
      } catch (err) {
        console.warn('Could not inspect PDF page count:', err);
      }
    }

    // Ensure order exists before referencing foreign key constraint
    let validOrderId = null;
    if (orderId) {
      const [orderRows] = await pool.query<RowDataPacket[]>('SELECT id FROM orders WHERE id = ?', [orderId]);
      if (orderRows.length > 0) {
        validOrderId = orderId;
      }
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO documents (
        order_id, original_name, stored_name, file_path, file_size_bytes, mime_type, page_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [validOrderId, originalname, filename, filePath, size, mimetype, pageCount]
    );

    const [docs] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM documents WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      document: {
        ...docs[0],
        url: `/uploads/${filename}`,
      },
    });
  } catch (error) {
    console.error('Error handling document upload:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

export default router;
