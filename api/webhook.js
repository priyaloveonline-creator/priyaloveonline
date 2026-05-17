// ============================================================
// api/webhook.js — Cashfree Payment Webhook Handler
// When user pays on Cashfree, this auto-adds credits to their account
// ============================================================

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const body = req.body;
    const event = body?.type || body?.event;
    const data = body?.data || body;

    // Verify it's a successful payment
    const isSuccess = 
      event === 'PAYMENT_SUCCESS_WEBHOOK' ||
      event === 'payment.success' ||
      data?.payment?.payment_status === 'SUCCESS' ||
      data?.order?.order_status === 'PAID';

    if (!isSuccess) {
      return res.status(200).json({ status: 'ignored', event });
    }

    const orderId = data?.order?.order_id || data?.payment?.cf_payment_id || '';
    const orderAmount = data?.order?.order_amount || data?.payment?.payment_amount || 0;
    const customerEmail = data?.customer_details?.customer_email || '';
    const customerPhone = data?.customer_details?.customer_phone || '';

    // Determine what was purchased from order ID / amount
    let credits = 0;
    let plan = null;

    // Credit packs (by order ID prefix from Cashfree form codes)
    if (orderId.includes('500coinsrecharge') || orderAmount == 49) {
      credits = 500;
    } else if (orderId.includes('2000coinsrecharge') || orderAmount == 149) {
      credits = 2000;
    } else if (orderId.includes('5000coinsrecharge') || orderAmount == 349) {
      credits = 5000;
    }
    // Feature plans (by order ID)
    else if (orderId.includes('likerecharge') || orderAmount == 99) {
      plan = 'like';
    } else if (orderId.includes('bondrecharge') || orderAmount == 499) {
      plan = 'bond';
    } else if (orderId.includes('loverecharge') || orderAmount == 999) {
      plan = 'love';
    }

    console.log('Webhook received:', { orderId, orderAmount, credits, plan, customerEmail, customerPhone });

    // Return success with the data — frontend polls or uses this
    return res.status(200).json({
      success: true,
      orderId,
      credits,
      plan,
      customerEmail,
      customerPhone,
      message: credits > 0 
        ? `${credits} credits added` 
        : plan 
          ? `${plan} plan activated` 
          : 'Payment recorded'
    });

  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(200).json({ status: 'error', message: err.message });
  }
}
