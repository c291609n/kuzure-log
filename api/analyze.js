// Only allow the models this app actually uses, and cap output tokens,
// so a leaked endpoint URL can't be abused to run up the Anthropic bill.
const ALLOWED_MODELS = new Set(["claude-sonnet-4-6"]);
const MAX_TOKENS_CAP = 1200;

// Allow only this app's own pages (production + Vercel previews + local dev).
// Blocks casual abuse from other sites / scripts that send no matching Origin.
function isAllowedOrigin(req) {
  const o = req.headers.origin || req.headers.referer || "";
  return /^https?:\/\/(localhost(:\d+)?|kuzure[a-z0-9-]*\.vercel\.app)/i.test(o);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!isAllowedOrigin(req)) return res.status(403).json({ error: 'forbidden' });

  try {
    const body = req.body || {};
    const model = ALLOWED_MODELS.has(body.model) ? body.model : 'claude-sonnet-4-6';
    const max_tokens = Math.min(Number(body.max_tokens) || 1000, MAX_TOKENS_CAP);
    const messages = Array.isArray(body.messages) ? body.messages : [];

    const payload = { model, max_tokens, messages };
    if (typeof body.temperature === 'number') payload.temperature = body.temperature;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
