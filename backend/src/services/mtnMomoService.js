const axios = require('axios');

// MTN Mobile Money — Collections API ("Request to Pay")
// Docs: https://momodeveloper.mtn.com (Collections product)
//
// Flow:
//  1. Get an OAuth access token using your API user + API key + subscription key
//  2. POST a "request to pay" — this pushes a prompt to the customer's phone
//  3. MTN sends a webhook to your callback URL when the customer approves/declines
//  4. You can also poll the status endpoint as a fallback
//
// NOTE: MTN issues separate credentials per country/environment (sandbox vs
// production). Confirm the exact base URL and field names against the
// credentials MTN gives you when your merchant account is approved —
// the values below are the standard sandbox/production pattern.

const MTN_BASE_URL = process.env.MTN_MOMO_BASE_URL || 'https://sandbox.momodeveloper.mtn.com';
const MTN_SUBSCRIPTION_KEY = process.env.MTN_MOMO_SUBSCRIPTION_KEY;
const MTN_API_USER = process.env.MTN_MOMO_API_USER;
const MTN_API_KEY = process.env.MTN_MOMO_API_KEY;
const MTN_TARGET_ENV = process.env.MTN_MOMO_TARGET_ENVIRONMENT || 'sandbox'; // 'mtnliberia' in production per MTN's country config

async function getAccessToken() {
  const credentials = Buffer.from(`${MTN_API_USER}:${MTN_API_KEY}`).toString('base64');

  const response = await axios.post(
    `${MTN_BASE_URL}/collection/token/`,
    {},
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        'Ocp-Apim-Subscription-Key': MTN_SUBSCRIPTION_KEY,
      },
    }
  );

  return response.data.access_token;
}

/**
 * Initiates a "Request to Pay" — sends a payment prompt to the customer's phone.
 * @param {object} params
 * @param {number} params.amount - Amount to charge
 * @param {string} params.phone - Customer's MoMo phone number (MSISDN, e.g. 231770000000)
 * @param {string} params.externalId - Your internal order/payment ID for reconciliation
 * @param {string} params.payerMessage - Message shown to the customer
 * @returns {{ success: boolean, referenceId: string }}
 */
async function requestToPay({ amount, phone, externalId, payerMessage }) {
  const accessToken = await getAccessToken();
  const referenceId = require('crypto').randomUUID();

  await axios.post(
    `${MTN_BASE_URL}/collection/v1_0/requesttopay`,
    {
      amount: String(amount),
      currency: process.env.MTN_MOMO_CURRENCY || 'LRD',
      externalId,
      payer: {
        partyIdType: 'MSISDN',
        partyId: phone,
      },
      payerMessage: payerMessage || 'New Liberia Restaurant & Bar order',
      payeeNote: `Order ${externalId}`,
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Reference-Id': referenceId,
        'X-Target-Environment': MTN_TARGET_ENV,
        'Ocp-Apim-Subscription-Key': MTN_SUBSCRIPTION_KEY,
        'Content-Type': 'application/json',
      },
    }
  );

  // MTN returns 202 Accepted with no body — the referenceId is what you poll
  // or match against the webhook callback.
  return { success: true, referenceId };
}

/**
 * Polls the status of a previously-initiated request to pay.
 * Status is one of: PENDING, SUCCESSFUL, FAILED
 */
async function checkStatus(referenceId) {
  const accessToken = await getAccessToken();

  const response = await axios.get(
    `${MTN_BASE_URL}/collection/v1_0/requesttopay/${referenceId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Target-Environment': MTN_TARGET_ENV,
        'Ocp-Apim-Subscription-Key': MTN_SUBSCRIPTION_KEY,
      },
    }
  );

  return response.data; // { status: 'SUCCESSFUL' | 'PENDING' | 'FAILED', ... }
}

module.exports = { requestToPay, checkStatus };
