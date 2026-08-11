import type { IncomingMessage, ServerResponse } from 'http';

type ApiReq = IncomingMessage & { body?: { entityId?: string; voteType?: string } };
type ApiRes = ServerResponse & { status: (c: number) => ApiRes; json: (d: unknown) => void; end: () => void };

export default function handler(req: ApiReq, res: ApiRes): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { entityId, voteType } = req.body || {};
  if (!entityId || !voteType) {
    res.status(400).json({ success: false, message: 'entityId et voteType requis.' });
    return;
  }

  // Vote is acknowledged and stored in client-side localStorage + session
  res.status(200).json({
    success: true,
    entityId,
    voteType,
    message: 'Vote enregistré.',
  });
}
