// Frontend API Service for Imprevo Smart Printing Kiosk
// Interfaces and HTTP client communicating with backend MySQL database

export interface TerminalData {
  id: string;
  name: string;
  location: string;
  status: 'Online' | 'Printing' | 'Ready' | 'Offline';
  mode: 'ready' | 'empty' | 'error';
  paper_count: number;
  paper_capacity: number;
  toner_level: number;
  language: string;
  last_heartbeat: string;
}

export interface PricingRule {
  id: number;
  color_mode: 'bw' | 'color';
  rate_per_page: number;
  description: string;
}

export interface CreateOrderPayload {
  id?: string;
  terminal_id?: string;
  fileName?: string;
  file_name?: string;
  fileSize?: string;
  file_size?: string;
  fileFormat?: string;
  file_format?: string;
  docPages?: number;
  doc_pages?: number;
  totalPages?: number;
  total_pages?: number;
  colorMode?: 'bw' | 'color';
  color_mode?: 'bw' | 'color';
  copies?: number;
  isDuplex?: boolean;
  is_duplex?: boolean | number;
  paperSize?: string;
  paper_size?: string;
  paperGsm?: string;
  paper_gsm?: string;
  ratePerPage?: number;
  rate_per_page?: number;
  totalPrice?: number;
  total_price?: number;
  paymentMethod?: 'upi' | 'card' | 'nb';
  payment_method?: 'upi' | 'card' | 'nb';
  paymentStatus?: 'idle' | 'processing' | 'success' | 'failed';
  payment_status?: 'idle' | 'processing' | 'success' | 'failed';
  orientation?: 'portrait' | 'landscape';
  pageRange?: string;
  page_range?: string;
}

export interface OrderData {
  id: string;
  terminal_id: string;
  file_name: string;
  file_size: string;
  file_format: string;
  doc_pages?: number;
  total_pages: number;
  orientation?: 'portrait' | 'landscape';
  page_range?: string;
  color_mode: 'bw' | 'color';
  copies: number;
  is_duplex: boolean | number;
  paper_size: string;
  paper_gsm: string;
  rate_per_page: number;
  total_price: number;
  payment_method: 'upi' | 'card' | 'nb';
  payment_status: 'idle' | 'processing' | 'success' | 'failed';
  txn_id?: string;
  printer_name?: string;
  print_status: 'pending' | 'queued' | 'printing' | 'completed' | 'cancelled';
  current_page_printing: number;
  print_progress: number;
  created_at?: string;
  updated_at?: string;
}

export const api = {
  // Health & connection status
  async checkHealth() {
    try {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error('Health check failed');
      return await res.json();
    } catch (err) {
      console.warn('API health check error:', err);
      return { status: 'offline', database: 'disconnected' };
    }
  },

  // Terminal telemetry
  async getTerminalStatus(): Promise<{ success: boolean; terminal: TerminalData; pricing: PricingRule[] }> {
    const res = await fetch('/api/terminal/status');
    if (!res.ok) throw new Error('Failed to load terminal status');
    return await res.json();
  },

  async updateTerminal(data: Partial<TerminalData>) {
    const res = await fetch('/api/terminal/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update terminal telemetry');
    return await res.json();
  },

  // Orders
  async createOrder(order: CreateOrderPayload): Promise<{ success: boolean; order: OrderData }> {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    });
    if (!res.ok) throw new Error('Failed to create order in database');
    return await res.json();
  },

  async getOrder(id: string): Promise<{ success: boolean; order: OrderData }> {
    const res = await fetch(`/api/orders/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error('Failed to fetch order');
    return await res.json();
  },

  async updatePayment(
    orderId: string,
    data: { paymentStatus: string; paymentMethod?: string; txnId?: string }
  ): Promise<{ success: boolean; order: OrderData }> {
    const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/payment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update payment status');
    return await res.json();
  },

  async updatePrintProgress(
    orderId: string,
    data: { printStatus?: string; currentPagePrinting?: number; printProgress?: number }
  ): Promise<{ success: boolean; order: OrderData }> {
    const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/print`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update print progress');
    return await res.json();
  },

  // Document Upload
  async uploadFile(file: File, pageCount = 1, orderId?: string) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('pageCount', pageCount.toString());
    if (orderId) formData.append('orderId', orderId);

    const res = await fetch('/api/documents/upload', {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to upload document');
    return await res.json();
  },

  // Razorpay Gateway
  async getRazorpayConfig(): Promise<{ configured: boolean; keyId: string }> {
    try {
      const res = await fetch('/api/orders/razorpay-config');
      if (!res.ok) throw new Error('Failed to get Razorpay config');
      return await res.json();
    } catch {
      return { configured: false, keyId: '' };
    }
  },

  async createRazorpayOrder(
    amount: number,
    receipt?: string,
    notes?: Record<string, string>
  ): Promise<{ success: boolean; keyId: string; order: any }> {
    const res = await fetch('/api/orders/create-razorpay-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, receipt, notes }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to create Razorpay order');
    }
    return await res.json();
  },

  async verifyRazorpayPayment(payload: {
    razorpayOrderId?: string;
    razorpayPaymentId: string;
    razorpaySignature?: string;
  }): Promise<{ success: boolean; verified: boolean }> {
    try {
      const res = await fetch('/api/orders/verify-razorpay-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return { success: false, verified: false };
      return await res.json();
    } catch {
      return { success: false, verified: false };
    }
  },

  // Support
  async callShopkeeper(issueType = 'Call Shopkeeper Button', message?: string) {
    const res = await fetch('/api/support/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issueType, message }),
    });
    if (!res.ok) throw new Error('Failed to request shopkeeper assistance');
    return await res.json();
  },
};
