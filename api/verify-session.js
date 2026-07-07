const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Called from success.html: verifies the Stripe checkout session really was paid,
// then records the purchase in Supabase so it shows up in the member portal.
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const sessionId = req.query.session_id;
  if (!sessionId) return res.status(400).json({ error: 'session_id is required' });
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['line_items'] });
    if (session.payment_status !== 'paid') {
      return res.status(402).json({ error: 'Payment not completed' });
    }
    const email = session.customer_details && session.customer_details.email;
    const item = session.line_items && session.line_items.data[0];
    if (!email || !item) return res.status(422).json({ error: 'Missing purchase details' });

    const row = {
      email: email.toLowerCase(),
      price_id: item.price.id,
      product_name: item.description || 'Program',
      stripe_session_id: session.id,
      amount_total: session.amount_total,
    };
    const resp = await fetch(`${process.env.SUPABASE_URL}/rest/v1/purchases?on_conflict=stripe_session_id`, {
      method: 'POST',
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates',
      },
      body: JSON.stringify(row),
    });
    if (!resp.ok && resp.status !== 409) {
      const t = await resp.text();
      console.error('Supabase insert failed:', resp.status, t);
      return res.status(500).json({ error: 'Could not record purchase' });
    }
    res.json({ ok: true, email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
