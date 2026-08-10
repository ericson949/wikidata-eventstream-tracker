import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'africa_leaders.json');
const VOTES_FILE = path.join(process.cwd(), 'data', 'votes.json');

function getRealVoteStats(politician_id) {
  try {
    const votes = JSON.parse(fs.readFileSync(VOTES_FILE, 'utf-8'));
    const opinion = votes.filter(v => v.politician_id === politician_id && v.vote_type === 'opinion');
    return {
      hearts:   opinion.filter(v => v.value === 'hearts').length,
      likes:    opinion.filter(v => v.value === 'likes').length,
      dislikes: opinion.filter(v => v.value === 'dislikes').length,
      horrors:  opinion.filter(v => v.value === 'horrors').length
    };
  } catch (e) {
    return { hearts: 0, likes: 0, dislikes: 0, horrors: 0 };
  }
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Méthode non autorisée.' });
  }

  try {
    // ✅ Lecture directe depuis africa_leaders.json — 0 appel Wikidata
    let items = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));

    const isAdmin = req.query.admin === 'true';
    if (!isAdmin) {
      items = items.filter(i => i.status !== 'Désactivé');
    }

    const results = items.map(item => ({
      // Identité
      id:               item.id,
      fullname:         item.fullname || item.label || item.id,
      first_name:       item.first_name || (item.fullname || item.label || '').split(' ')[0],
      last_name:        item.last_name  || (item.fullname || item.label || '').split(' ').slice(1).join(' '),
      job_title:        item.job_title  || item.description || 'Dirigeant Politique',
      biography:        item.biography  || item.description || '',
      description:      item.description || item.job_title || '',
      // Données Wikidata enrichies (stockées en BDD)
      birth_date:       item.birth_date  || null,
      death_date:       item.death_date  || null,
      actor_state:      item.actor_state || 'En exercice',
      country:          item.country     || { id: null, name: 'Afrique' },
      political_party:  item.political_party || { id: null, name: 'Indépendant' },
      position_held:    item.position_held   || null,
      photo_url:        item.photo_url   || null,
      source_url:       item.source_url  || `https://www.wikidata.org/wiki/${item.id}`,
      wikidata_url:     item.wikidata_url || `https://www.wikidata.org/wiki/${item.id}`,
      enrichedAt:       item.enrichedAt  || null,
      // Flags admin
      status:           item.status        || 'Activé',
      vote_enabled:     item.vote_enabled  !== false,
      block1_enabled:   item.block1_enabled !== false,
      block2_enabled:   item.block2_enabled !== false,
      // Votes en temps réel
      votes:            getRealVoteStats(item.id)
    }));

    // Header de diagnostic : combien d'entrées sont enrichies vs brutes
    const enrichedCount = items.filter(i => i.enrichedAt).length;
    res.setHeader('X-Enriched', `${enrichedCount}/${items.length}`);

    return res.status(200).json({ success: true, data: results });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
