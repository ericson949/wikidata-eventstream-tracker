const ADMIN_USER  = process.env.ADMIN_USER  || 'admin';
const ADMIN_PASS  = process.env.ADMIN_PASS  || 'politi1234';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'politi_admin_secret_token_2026';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Méthode non autorisée.' });

  const { username, password } = req.body || {};
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    return res.status(200).json({ success: true, token: ADMIN_TOKEN, message: 'Connexion réussie.' });
  }
  return res.status(401).json({ success: false, message: "Nom d'utilisateur ou mot de passe incorrect." });
}
