const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const SUBSCRIPTION_PRICES = new Set(['price_1TD74ME0ePNbtD9wojBjZQre']);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { priceId } = req.body;
  if (!priceId) return res.status(400).json({ error: 'priceId is required' });
  try {
    const origin = req.headers.origin || `https://${req.headers.host}`;
    const mode = SUBSCRIPTION_PRICES.has(priceId) ? 'subscription' : 'payment';
    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      line_items: [{ price: priceId, quantity: 1 }],
      mode,
      return_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
    });
    res.json({ clientSecret: session.client_secret });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
