// AI analysis is a login-only feature. We:
//  1) restrict to the models this app uses + cap output tokens (limit blast radius)
//  2) only accept requests from this app's own pages (cheap first filter)
//  3) require a valid Supabase login token (the real gate)
const SUPABASE_URL = 'https://cybzsefzvkqanwkwghqs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_a_cAz3Zrlsr0EMJH9Wr_zQ_tZYKJn8w';

const ALLOWED_MODELS = new Set(["claude-sonnet-4-6"]);
const MAX_TOKENS_CAP = 1200;

function isAllowedOrigin(req) {
  const o = req.headers.origin || req.headers.referer || "";
  return /^https?:\/\/(localhost(:\d+)?|kuzure[a-z0-9-]*\.vercel\.app)/i.test(o);
}

// Validate the Supabase access token by asking Supabase who it belongs to.
async function isLoggedIn(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return false;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
    });
    return r.ok;
  } catch {
    return false;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!isAllowedOrigin(req)) return res.status(403).json({ error: 'forbidden' });
  if (!(await isLoggedIn(req))) return res.status(401).json({ error: 'login required' });

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
