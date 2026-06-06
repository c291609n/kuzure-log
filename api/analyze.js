module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    console.log('API response status:', response.status);
    console.log('API response:', JSON.stringify(data).slice(0, 200));
    res.status(200).json(data);
  } catch (e) {
    console.error('Error:', e.message);
    res.status(500).json({ error: e.message });
  }
}