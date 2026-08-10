import axios from 'axios';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ success: false, message: 'Paramètre de recherche "q" manquant.' });
  }

  try {
    const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=fr&format=json&type=item&limit=12`;
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'PolitiliBot/2.0 (politili.com)' },
      timeout: 5000
    });

    const searchResults = response.data?.search || [];
    const results = searchResults.map(item => ({
      id: item.id,
      label: item.label,
      description: item.description || 'Entité Wikidata',
      url: item.concepturi
    }));

    return res.status(200).json({ success: true, data: results });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur lors de la recherche Wikidata: ' + error.message });
  }
}
