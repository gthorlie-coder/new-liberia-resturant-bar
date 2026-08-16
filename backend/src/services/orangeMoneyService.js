const axios = require('axios');

// Orange Money — Merchant Payment API
// Docs: https://developer.orange.com (Orange Money Web Payment / Orange Money API)
//
// Flow:
//  1. Get an OAuth2 access token using your client ID + client secret
//  2. Initiate a payment — Orange Money supports both a "web payment" redirect
//     flow and a direct "merchant push" flow depending on your contract type
//  3. Orange sends a webhook/notification to your callback URL on completion
//
// NOTE: Orange issues country-specific merchant credentials (merchant key,
// client ID/secret) once your business account is approved. Confirm the
// exact base URL, endpoint path, and required fields against the
// integration guide Orange gives you — Orange Money's API shape can differ
// slightly between countries. The structure below follows Orange's standard
// OAuth2 + payment-request pattern.

const ORANGE_BASE_URL = process.env.ORANGE_MONEY_BASE_URL || 'https://api.orange.com';
const ORANGE_CLIENT_ID = process.env.ORANGE_MONEY_CLIENT_ID;
const ORANGE_CLIENT_SECRET = process.env.ORANGE_MONEY_CLIENT_SECRET;
const ORANGE_MERCHANT_KEY = process.env.ORANGE_MONEY_MERCHANT_KEY;

async function getAccessToken() {
  const credentials = Buffer.from(`${ORANGE_CLIENT_ID}:${ORANGE_CLIENT_SECRET}`).toString('base64');

  const response = await axios.post(
    `${ORANGE_BASE_URL}/oauth/v3/token`,
    'grant_type=client_credentials',
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  return response.data.access_token;
}

/**
 * Initiates an Orange Money payment.
 * @param {object} params
 * @param {number} params.amount - Amount to charge
 * @param {string} params.phone - Customer's Orange Money phone number
 * @param {string} params.orderId - Your internal order ID
 * @param {string} params.returnUrl - Where to redirect after payment (if using web flow)
 * @returns {{ success: boolean, payToken: string, paymentUrl?: string }}
 */
async function initiatePayment({ amount, phone, orderId, returnUrl }) {
  const accessToken = await getAccessToken();

  const response = await axios.post(
    `${ORANGE_BASE_URL}/orange-money-webpay/dev/v1/webpayment`,
    {
      merchant_key: ORANGE_MERCHANT_KEY,
      currency: process.env.ORANGE_MONEY_CURRENCY || 'LRD',
      order_id: orderId,
      amount: amount,
      return_url: returnUrl || process.env.ORANGE_MONEY_RETURN_URL,
      cancel_url: process.env.ORANGE_MONEY_CANCEL_URL,
      notif_url: process.env.ORANGE_MONEY_WEBHOOK_URL,
      lang: 'en',
      reference: orderId,
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  // Orange returns a pay_token and a payment_url the customer completes
  // payment through (on their phone via USSD prompt or a web page).
  return {
    success: true,
    payToken: response.data.pay_token,
    paymentUrl: response.data.payment_url,
  };
}

/**
 * Checks the status of a previously-initiated payment.
 */
async function checkStatus(orderId, payToken) {
  const accessToken = await getAccessToken();

  const response = await axios.post(
    `${ORANGE_BASE_URL}/orange-money-webpay/dev/v1/transactionstatus`,
    {
      order_id: orderId,
      pay_token: payToken,
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data; // { status: 'SUCCESS' | 'PENDING' | 'FAILED', ... }
}

module.exports = { initiatePayment, checkStatus };
