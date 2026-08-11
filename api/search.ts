import type { IncomingMessage, ServerResponse } from 'http';
import axios from 'axios';

interface WikidataSearchItem {
  id: string;
  label: string;
  description?: string;
  concepturi: string;
}

interface WikidataSearchResponse {
  search: WikidataSearchItem[];
}

export default async function handler(req: IncomingMessage & { query: Record<string, string> }, res: ServerResponse & { status: (c: number) => any; json: (d: unknown) => void; end: () => void }): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const query = (req as any).query?.q as string | undefined;
  if (!query) {
    res.status(400).json({ success: false, message: 'Paramètre de recherche "q" manquant.' });
    return;
  }

  try {
    const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=fr&format=json&type=item&limit=12`;
    const response = await axios.get<WikidataSearchResponse>(url, {
      headers: { 'User-Agent': 'PolitiliBot/2.0 (politili.com)' },
      timeout: 5000,
    });

    const searchResults = response.data?.search || [];
    const results = searchResults.map((item) => ({
      id: item.id,
      label: item.label,
      description: item.description || 'Entité Wikidata',
      url: item.concepturi,
    }));

    res.status(200).json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur lors de la recherche Wikidata: ' + (error as Error).message });
  }
}
