import type { IncomingMessage, ServerResponse } from 'http';

type ApiReq = IncomingMessage & { body?: Record<string, unknown> };
type ApiRes = ServerResponse & { status: (c: number) => ApiRes; json: (d: unknown) => void; end: () => void };

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'politi1234';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'politi_admin_secret_token_2026';

export default function handler(req: ApiReq, res: ApiRes): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, message: 'Méthode non autorisée.' });
    return;
  }

  const { username, password } = req.body || {};

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    res.status(200).json({ success: true, token: ADMIN_TOKEN, message: 'Connexion réussie.' });
    return;
  }

  res.status(401).json({ success: false, message: "Nom d'utilisateur ou mot de passe incorrect." });
}
