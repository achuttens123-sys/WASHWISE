declare global {
  interface Window {
    Razorpay: any;
  }
}

export const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export interface RazorpayCheckoutOptions {
  amount: number;
  description: string;
  type: 'booking' | 'subscription' | 'wallet_topup';
  userId: string;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  bookingData?: any;
  onSuccess?: (response: any) => void;
  onError?: (error: string) => void;
  onDismiss?: () => void;
}

export const initiateRazorpayPayment = async (options: RazorpayCheckoutOptions) => {
  try {
    // 1. Load Razorpay JS SDK
    const isLoaded = await loadRazorpayScript();
    if (!isLoaded) {
      throw new Error('Razorpay SDK failed to load. Please check your internet connection.');
    }

    // 2. Create Order on Backend
    const orderRes = await fetch('/api/razorpay/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: options.amount,
        notes: {
          type: options.type,
          userId: options.userId,
        }
      })
    });

    const orderData = await orderRes.json();
    if (!orderRes.ok || !orderData.orderId) {
      throw new Error(orderData.error || 'Failed to create payment order.');
    }

    // 3. Configure Razorpay Popup Options
    const razorpayOptions = {
      key: orderData.keyId,
      amount: orderData.amount,
      currency: orderData.currency || 'INR',
      name: 'WASHWISE Laundry',
      description: options.description,
      image: 'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?q=80&w=200&auto=format&fit=crop',
      order_id: orderData.orderId,
      handler: async function (response: any) {
        try {
          // Verify Payment Signature on Backend
          const verifyRes = await fetch('/api/razorpay/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              type: options.type,
              bookingData: options.bookingData,
              userId: options.userId,
              amount: options.amount
            })
          });

          const verifyData = await verifyRes.json();
          if (!verifyRes.ok || !verifyData.success) {
            throw new Error(verifyData.error || 'Payment signature verification failed.');
          }

          if (options.onSuccess) {
            options.onSuccess(verifyData);
          }
        } catch (err: any) {
          console.error('Razorpay Verification Error:', err);
          if (options.onError) {
            options.onError(err.message || 'Payment verification failed.');
          }
        }
      },
      prefill: {
        name: options.userName || '',
        email: options.userEmail || '',
        contact: options.userPhone || ''
      },
      theme: {
        color: '#2563eb'
      },
      modal: {
        ondismiss: function () {
          if (options.onDismiss) {
            options.onDismiss();
          }
        }
      }
    };

    const rzp = new window.Razorpay(razorpayOptions);
    rzp.on('payment.failed', function (response: any) {
      console.error('Razorpay Payment Failed:', response.error);
      if (options.onError) {
        options.onError(response.error?.description || 'Payment transaction failed.');
      }
    });

    rzp.open();
  } catch (err: any) {
    console.error('Razorpay Checkout Exception:', err);
    if (options.onError) {
      options.onError(err.message || 'Payment initialization failed.');
    }
  }
};
