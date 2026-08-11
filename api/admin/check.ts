import type { IncomingMessage, ServerResponse } from 'http';

type ApiReq = IncomingMessage & { headers: Record<string, string | string[] | undefined> };
type ApiRes = ServerResponse & { status: (c: number) => ApiRes; json: (d: unknown) => void; end: () => void };

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'politi_admin_secret_token_2026';

export default function handler(req: ApiReq, res: ApiRes): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const authHeader = req.headers['authorization'];
  const token =
    (req.headers['x-admin-token'] as string | undefined) ||
    (typeof authHeader === 'string' ? authHeader.replace('Bearer ', '') : undefined);

  if (token === ADMIN_TOKEN) {
    res.status(200).json({ success: true, authenticated: true });
    return;
  }

  res.status(401).json({ success: false, message: 'Accès non autorisé.' });
}
