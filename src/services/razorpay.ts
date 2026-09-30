// Razorpay Gateway Service
// Supports official Razorpay Checkout SDK (checkout.js) and Kiosk fallback
import { api } from './api';

export interface RazorpayPaymentSuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
}

export interface RazorpayCheckoutOptions {
  key?: string;
  amount: number; // in paise
  currency?: string;
  name: string;
  description?: string;
  image?: string;
  order_id?: string;
  handler: (response: RazorpayPaymentSuccessResponse) => void;
  modal?: {
    ondismiss?: () => void;
  };
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
    method?: 'upi' | 'card' | 'netbanking' | 'wallet';
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
    backdrop_color?: string;
  };
}

export function getRazorpayKeyId(): string {
  const envKey = import.meta.env.VITE_RAZORPAY_KEY_ID;
  if (envKey && envKey.trim().length > 0 && !envKey.includes('placeholder')) {
    return envKey.trim();
  }
  // User provided active Razorpay Test Key
  return 'rzp_test_TeVqnfeaUHrBLc';
}

export function isRazorpayKeyConfigured(): boolean {
  const key = getRazorpayKeyId();
  return Boolean(key && key.startsWith('rzp_'));
}

export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }

    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }

    // Check if script element already inserted
    const existing = document.querySelector('script[src*="checkout.razorpay.com"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.warn('Failed to load Razorpay checkout.js script');
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

export interface LaunchCheckoutParams {
  amount: number; // INR
  orderId: string;
  fileName: string;
  totalPages: number;
  onSuccess: (details: {
    razorpay_payment_id: string;
    razorpay_order_id?: string;
    payment_method: string;
    txn_id: string;
  }) => void;
  onDismiss?: () => void;
  onError?: (err: any) => void;
}

export async function launchRazorpayCheckout(params: LaunchCheckoutParams): Promise<boolean> {
  const { amount, orderId, fileName, totalPages, onSuccess, onDismiss, onError } = params;

  try {
    const loaded = await loadRazorpayScript();
    if (!loaded || !(window as any).Razorpay) {
      throw new Error('Razorpay checkout script not available');
    }

    const key = getRazorpayKeyId();
    if (!key) {
      throw new Error('No Razorpay Key ID found');
    }

    // Attempt to create official Razorpay Order on server
    let razorpayOrderId: string | undefined;
    try {
      const orderRes = await api.createRazorpayOrder(amount, orderId, {
        kiosk_terminal: '#04',
        file_name: fileName,
        total_pages: totalPages.toString(),
      });
      if (orderRes.success && orderRes.order?.id) {
        razorpayOrderId = orderRes.order.id;
      }
    } catch (orderErr) {
      console.warn('Could not create server Razorpay order, proceeding with standard checkout:', orderErr);
    }

    const options: any = {
      key,
      amount: Math.max(100, Math.round(amount * 100)), // paise
      currency: 'INR',
      name: 'Imprevo Smart Kiosk',
      description: `Printing Job: ${fileName.substring(0, 30)} (${totalPages} pages)`,
      image: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f5a8.png',
      order_id: razorpayOrderId,
      prefill: {
        name: 'Kiosk Customer',
        contact: '9876543210',
        email: 'customer@imprevo.in',
      },
      notes: {
        kiosk_terminal: '#04',
        order_receipt: orderId,
      },
      theme: {
        color: '#0037B0',
        backdrop_color: 'rgba(12, 35, 64, 0.75)',
      },
      handler: async (response: RazorpayPaymentSuccessResponse) => {
        // Optional verification with server
        if (response.razorpay_payment_id && response.razorpay_order_id) {
          api
            .verifyRazorpayPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            })
            .catch((err) => console.warn('Payment verification notice:', err));
        }

        onSuccess({
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id,
          payment_method: 'razorpay',
          txn_id: response.razorpay_payment_id,
        });
      },
      modal: {
        ondismiss: () => {
          if (onDismiss) onDismiss();
        },
      },
    };

    const rzp = new (window as any).Razorpay(options);

    rzp.on('payment.failed', function (resp: any) {
      console.warn('Razorpay payment failed:', resp.error);
      if (onError) onError(resp.error);
    });

    rzp.open();
    return true;
  } catch (err) {
    console.error('Error launching Razorpay checkout:', err);
    if (onError) onError(err);
    return false;
  }
}
