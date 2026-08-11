const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'politi_admin_secret_token_2026';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = req.headers['x-admin-token'] || req.headers['authorization']?.replace('Bearer ', '');
  if (token === ADMIN_TOKEN) return res.status(200).json({ success: true, authenticated: true });
  return res.status(401).json({ success: false, message: 'Accès non autorisé.' });
}
