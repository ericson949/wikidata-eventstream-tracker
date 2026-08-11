export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { entityId, voteType } = req.body || {};
  if (!entityId || !voteType) {
    return res.status(400).json({ success: false, message: 'entityId et voteType requis.' });
  }

  return res.status(200).json({ success: true, entityId, voteType, message: 'Vote enregistré.' });
}
