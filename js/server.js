const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

const consumerKey = process.env.MPESA_CONSUMER_KEY;
const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
const shortcode = process.env.MPESA_SHORTCODE || '400200';
const passkey = process.env.MPESA_PASSKEY;
const callbackURL = process.env.MPESA_CALLBACK_URL || 'https://yourdomain.com/callback';

if (!consumerKey || !consumerSecret || !passkey) {
  console.warn('Warning: MPESA credentials are not fully configured in .env');
}

async function getAccessToken() {
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const response = await axios.get(
    'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    { headers: { Authorization: `Basic ${auth}` } }
  );
  return response.data.access_token;
}

app.post('/stkpush', async (req, res) => {
  try {
    const { phone, amount, account } = req.body;
    const token = await getAccessToken();
    const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    const password = Buffer.from(shortcode + passkey + timestamp).toString('base64');

    const stkRequest = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phone,
      PartyB: shortcode,
      PhoneNumber: phone,
      CallBackURL: callbackURL,
      AccountReference: account || 'Tithe/Offering',
      TransactionDesc: 'Church Giving'
    };

    const response = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      stkRequest,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    res.json({ message: 'STK Push initiated', data: response.data });
  } catch (error) {
    console.error(error.response?.data || error.message || error);
    res.status(500).json({ error: 'Failed to initiate STK Push' });
  }
});

app.post('/dpo-pay', (req, res) => {
  console.log('DPO Pay request:', JSON.stringify(req.body, null, 2));
  res.json({ success: true, message: 'DPO Pay placeholder endpoint received the request.' });
});

app.post('/callback', (req, res) => {
  console.log('M-Pesa Callback:', JSON.stringify(req.body, null, 2));
  res.json({ message: 'Callback received' });
});

app.listen(3000, () => console.log('Server running on port 3000'));
