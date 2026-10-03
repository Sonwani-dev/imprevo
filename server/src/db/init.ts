import pool from './connection.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initializeDatabase(): Promise<void> {
  const connection = await pool.getConnection();
  try {
    console.log('🔄 Initializing database schema...');
    const schemaPath = path.resolve(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

    // Split statements safely
    const statements = schemaSql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      await connection.query(statement);
    }

    // 1. Seed Shopkeeper Profile (Real profile)
    await connection.query(`
      INSERT INTO shopkeepers (id, shop_name, owner_name, initials, email, phone, status)
      VALUES ('shop_01', 'Imprevo Print Hub', 'Dev Sonwani', 'DS', 'dev.sonwani@imprevo.io', '+91 98765 43210', 'active')
      ON DUPLICATE KEY UPDATE shop_name = VALUES(shop_name), owner_name = VALUES(owner_name), initials = VALUES(initials);
    `);

    // 2. Seed default terminal #04 if not exists
    await connection.query(`
      INSERT INTO terminals (id, merchant_id, name, location, status, api_status, cloud_storage_status, mode, paper_count, paper_capacity, toner_level, language)
      VALUES ('#04', 'shop_01', 'Kiosk Terminal #04', 'Main Academic Concourse', 'Online', 'online', 'live', 'ready', 458, 500, 94, 'en')
      ON DUPLICATE KEY UPDATE 
        merchant_id = VALUES(merchant_id),
        name = VALUES(name),
        location = VALUES(location),
        api_status = VALUES(api_status),
        cloud_storage_status = VALUES(cloud_storage_status),
        last_heartbeat = CURRENT_TIMESTAMP;
    `);

    // 3. Seed Printer Hardware status
    await connection.query(`
      INSERT INTO printer_hardware (id, terminal_id, model_name, connection_type, toner_level_pct, paper_count, paper_capacity, active_tray, status)
      VALUES ('prn_01', '#04', 'Brother HL-L6400DW', 'network_ipp', 94, 458, 500, 'Tray 1', 'ready')
      ON DUPLICATE KEY UPDATE 
        toner_level_pct = VALUES(toner_level_pct),
        paper_count = VALUES(paper_count),
        status = VALUES(status);
    `);

    // 3b. Ensure default printer columns exist and columns are nullable if table was previously created
    try {
      await connection.query(`
        ALTER TABLE printer_configs 
        ADD COLUMN default_printer_id VARCHAR(100) NULL,
        ADD COLUMN default_printer_name VARCHAR(150) NULL,
        ADD COLUMN default_connection_type VARCHAR(50) NULL,
        ADD COLUMN default_device_uri VARCHAR(255) NULL,
        ADD COLUMN default_status VARCHAR(50) DEFAULT 'ready';
      `);
    } catch {}

    try {
      await connection.query(`
        ALTER TABLE printer_configs 
        MODIFY COLUMN bw_printer_id VARCHAR(100) NULL,
        MODIFY COLUMN bw_printer_name VARCHAR(150) NULL,
        MODIFY COLUMN color_printer_id VARCHAR(100) NULL,
        MODIFY COLUMN color_printer_name VARCHAR(150) NULL;
      `);
    } catch {}

    // Ensure printer config row exists for terminal #04 without hardcoding specific printer models
    await connection.query(`
      INSERT INTO printer_configs (
        terminal_id, 
        default_printer_id, default_printer_name, default_connection_type, default_device_uri, default_status,
        bw_printer_id, bw_printer_name, bw_connection_type, bw_device_uri, bw_status,
        color_printer_id, color_printer_name, color_connection_type, color_device_uri, color_status,
        use_same_printer_for_both
      ) VALUES (
        '#04',
        NULL, NULL, 'usb', NULL, 'ready',
        NULL, NULL, 'usb', NULL, 'ready',
        NULL, NULL, 'usb', NULL, 'ready',
        TRUE
      ) ON DUPLICATE KEY UPDATE 
        terminal_id = terminal_id;
    `);

    // 4. Seed default pricing rules
    await connection.query(`
      INSERT INTO pricing_rules (color_mode, rate_per_page, description)
      VALUES 
        ('bw', 2.00, 'Black & White Standard Laser Print'),
        ('color', 10.00, 'High-Resolution Color Laser Print')
      ON DUPLICATE KEY UPDATE rate_per_page = VALUES(rate_per_page);
    `);

    // 5. Ensure real-time daily analytics summary exists from genuine orders
    await connection.query(`
      INSERT INTO daily_analytics (terminal_id, date, total_orders, total_sales_inr, total_pages_printed, bw_pages, color_pages, completed_orders, failed_orders)
      SELECT 
        '#04',
        CURRENT_DATE(),
        COUNT(*),
        COALESCE(SUM(CASE WHEN payment_status IN ('paid', 'success') THEN total_price ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN print_status = 'completed' THEN total_pages * copies ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN print_status = 'completed' AND color_mode = 'bw' THEN total_pages * copies ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN print_status = 'completed' AND color_mode = 'color' THEN total_pages * copies ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN print_status = 'completed' THEN 1 ELSE 0 END), 0),
        0
      FROM orders
      ON DUPLICATE KEY UPDATE 
        total_orders = VALUES(total_orders), 
        total_sales_inr = VALUES(total_sales_inr),
        total_pages_printed = VALUES(total_pages_printed),
        completed_orders = VALUES(completed_orders);
    `);

    console.log('✅ Database schema and real merchant telemetry initialized.');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error;
  } finally {
    connection.release();
  }
}
