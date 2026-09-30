import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import terminalRouter from './routes/terminal.js';
import ordersRouter from './routes/orders.js';
import documentsRouter from './routes/documents.js';
import supportRouter from './routes/support.js';
import dashboardRouter from './routes/dashboard.js';
import printersRouter from './routes/printers.js';
import { testConnection } from './db/connection.js';
import { initializeDatabase } from './db/init.js';
import { initPrintQueueWorker } from './services/printQueueWorker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

import fs from 'fs';

// Serve uploaded documents
const uploadDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// Healthcheck endpoint
app.get('/api/health', async (_req, res) => {
  const dbConnected = await testConnection();
  res.json({
    status: 'ok',
    service: 'imprevo-kiosk-backend',
    database: dbConnected ? 'connected' : 'disconnected',
    databaseName: process.env.DB_NAME || 'imprevo_db',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/terminal', terminalRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/support', supportRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/printers', printersRouter);
app.use('/api/dashboard/printers', printersRouter);

// Serve frontend in production (Render or container deployment)
const distDir = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      return res.sendFile(path.join(distDir, 'index.html'));
    }
    next();
  });
}

// Start server
async function startServer() {
  const maxRetries = 3;
  let dbReady = false;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🚀 Starting Imprevo Kiosk API Server (attempt ${attempt}/${maxRetries})...`);
      await initializeDatabase();
      initPrintQueueWorker();
      dbReady = true;
      break;
    } catch (error) {
      console.warn(`⚠️ Attempt ${attempt} failed to connect to database:`, error);
      if (attempt < maxRetries) {
        console.log('⏳ Retrying database connection in 2 seconds...');
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }

  if (!dbReady) {
    console.warn('⚠️ Starting server without active database connection. Running with memory/fallback.');
    try { initPrintQueueWorker(); } catch {}
  }

  app.listen(PORT, () => {
    console.log(`✨ Server ready at http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    if (fs.existsSync(distDir)) {
      console.log(`🌐 Serving production frontend from ${distDir}`);
    }
  });
}

startServer();
