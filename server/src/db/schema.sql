-- Imprevo Smart Printing Kiosk Database Schema

CREATE TABLE IF NOT EXISTS shopkeepers (
  id VARCHAR(50) PRIMARY KEY,
  shop_name VARCHAR(150) NOT NULL,
  owner_name VARCHAR(100) NOT NULL,
  initials VARCHAR(10) NOT NULL DEFAULT 'SG',
  email VARCHAR(150) UNIQUE,
  phone VARCHAR(20),
  password_hash VARCHAR(255),
  status ENUM('active', 'suspended') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS terminals (
  id VARCHAR(50) PRIMARY KEY,
  merchant_id VARCHAR(50) DEFAULT 'shop_01',
  name VARCHAR(100) NOT NULL DEFAULT 'Main Campus Kiosk',
  location VARCHAR(150) NOT NULL DEFAULT 'Library Ground Floor',
  status ENUM('Online', 'Printing', 'Ready', 'Offline') NOT NULL DEFAULT 'Online',
  api_status ENUM('online', 'degraded', 'offline') DEFAULT 'online',
  cloud_storage_status ENUM('live', 'syncing', 'error') DEFAULT 'live',
  mode ENUM('ready', 'empty', 'error') NOT NULL DEFAULT 'ready',
  paper_count INT NOT NULL DEFAULT 450,
  paper_capacity INT NOT NULL DEFAULT 500,
  toner_level INT NOT NULL DEFAULT 92,
  language VARCHAR(10) NOT NULL DEFAULT 'en',
  last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS printer_hardware (
  id VARCHAR(50) PRIMARY KEY,
  terminal_id VARCHAR(50) NOT NULL,
  model_name VARCHAR(100) NOT NULL DEFAULT 'Brother HL-L6400DW',
  connection_type ENUM('usb', 'network_ipp', 'wifi') DEFAULT 'network_ipp',
  toner_level_pct INT NOT NULL DEFAULT 92,
  paper_count INT NOT NULL DEFAULT 450,
  paper_capacity INT NOT NULL DEFAULT 500,
  active_tray VARCHAR(50) NOT NULL DEFAULT 'Tray 1',
  status ENUM('ready', 'printing', 'low_paper', 'jam', 'offline') DEFAULT 'ready',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (terminal_id) REFERENCES terminals(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS printer_configs (
  terminal_id VARCHAR(50) PRIMARY KEY,
  bw_printer_id VARCHAR(100) NOT NULL DEFAULT 'brother_hl_l6400dw',
  bw_printer_name VARCHAR(150) NOT NULL DEFAULT 'Brother HL-L6400DW (B&W Laser)',
  bw_connection_type VARCHAR(50) NOT NULL DEFAULT 'network_ipp',
  bw_device_uri VARCHAR(255) DEFAULT 'ipp://192.168.1.120/ipp/print',
  bw_status VARCHAR(50) NOT NULL DEFAULT 'ready',
  color_printer_id VARCHAR(100) NOT NULL DEFAULT 'canon_ir_adv_c3530i',
  color_printer_name VARCHAR(150) NOT NULL DEFAULT 'Canon imageRUNNER ADVANCE C3530i (Color Laser)',
  color_connection_type VARCHAR(50) NOT NULL DEFAULT 'network_ipp',
  color_device_uri VARCHAR(255) DEFAULT 'ipp://192.168.1.125/ipp/print',
  color_status VARCHAR(50) NOT NULL DEFAULT 'ready',
  use_same_printer_for_both BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (terminal_id) REFERENCES terminals(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pricing_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  color_mode ENUM('bw', 'color') NOT NULL UNIQUE,
  rate_per_page DECIMAL(6,2) NOT NULL,
  description VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(50) PRIMARY KEY,
  terminal_id VARCHAR(50) NOT NULL DEFAULT '#04',
  file_name VARCHAR(255) NOT NULL,
  file_size VARCHAR(50) NOT NULL,
  file_format VARCHAR(50) NOT NULL DEFAULT 'PDF v1.7',
  doc_pages INT DEFAULT 1,
  total_pages INT NOT NULL,
  color_mode ENUM('bw', 'color') NOT NULL DEFAULT 'bw',
  copies INT NOT NULL DEFAULT 1,
  is_duplex BOOLEAN NOT NULL DEFAULT TRUE,
  paper_size VARCHAR(20) NOT NULL DEFAULT 'A4',
  paper_gsm VARCHAR(50) NOT NULL DEFAULT '75 GSM High White',
  rate_per_page DECIMAL(6,2) NOT NULL DEFAULT 2.00,
  total_price DECIMAL(8,2) NOT NULL DEFAULT 24.00,
  payment_method VARCHAR(50) DEFAULT 'upi',
  payment_status ENUM('idle', 'processing', 'success', 'failed') NOT NULL DEFAULT 'idle',
  txn_id VARCHAR(100),
  print_status ENUM('pending', 'printing', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
  current_page_printing INT DEFAULT 0,
  print_progress INT DEFAULT 0,
  queue_position INT DEFAULT 0,
  tray VARCHAR(50) DEFAULT 'Tray 1',
  printer_name VARCHAR(150) NULL,
  orientation ENUM('portrait', 'landscape') DEFAULT 'portrait',
  page_range VARCHAR(50) DEFAULT 'all',
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (terminal_id) REFERENCES terminals(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payments (
  id VARCHAR(100) PRIMARY KEY,
  order_id VARCHAR(50) NOT NULL,
  razorpay_order_id VARCHAR(100),
  razorpay_payment_id VARCHAR(100),
  amount DECIMAL(8,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'INR',
  method VARCHAR(50) DEFAULT 'upi',
  status ENUM('created', 'authorized', 'captured', 'failed', 'refunded') DEFAULT 'captured',
  signature VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(50),
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  mime_type VARCHAR(100),
  page_count INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS daily_analytics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  terminal_id VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  total_orders INT DEFAULT 0,
  total_sales_inr DECIMAL(10,2) DEFAULT 0.00,
  total_pages_printed INT DEFAULT 0,
  bw_pages INT DEFAULT 0,
  color_pages INT DEFAULT 0,
  completed_orders INT DEFAULT 0,
  failed_orders INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_term_date (terminal_id, date),
  FOREIGN KEY (terminal_id) REFERENCES terminals(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS shopkeeper_notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  terminal_id VARCHAR(50) NOT NULL,
  type ENUM('order_paid', 'printing_started', 'printing_completed', 'low_paper', 'low_toner', 'jam', 'system') NOT NULL,
  title VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (terminal_id) REFERENCES terminals(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reprint_audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(50) NOT NULL,
  action_type ENUM('reprint_job', 'print_receipt') NOT NULL,
  reason VARCHAR(255) DEFAULT 'Shopkeeper manual request',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS support_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  terminal_id VARCHAR(50) NOT NULL DEFAULT '#04',
  issue_type VARCHAR(100) NOT NULL,
  message TEXT,
  status ENUM('open', 'in_progress', 'resolved') NOT NULL DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (terminal_id) REFERENCES terminals(id) ON DELETE CASCADE
);
