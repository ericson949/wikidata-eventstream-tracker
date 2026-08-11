import type { IncomingMessage, ServerResponse } from 'http';
import { dbRead } from './_db.js';

type ApiReq = IncomingMessage & { query: Record<string, string> };
type ApiRes = ServerResponse & { status: (c: number) => ApiRes; json: (d: unknown) => void; end: () => void };

interface Vote {
  politician_id: string;
  vote_type: string;
  value: string;
}

interface Leader {
  id: string;
  fullname?: string;
  label?: string;
  first_name?: string;
  last_name?: string;
  job_title?: string;
  biography?: string;
  description?: string;
  birth_date?: string | null;
  death_date?: string | null;
  actor_state?: string;
  country?: { id: string | null; name: string };
  political_party?: { id: string | null; name: string };
  position_held?: unknown;
  photo_url?: string | null;
  source_url?: string;
  wikidata_url?: string;
  enrichedAt?: string | null;
  status?: string;
  vote_enabled?: boolean;
  block1_enabled?: boolean;
  block2_enabled?: boolean;
}

const LEADERS_KEY = 'africa_leaders';
const LEADERS_FILE = 'africa_leaders.json';
const VOTES_KEY = 'votes';
const VOTES_FILE = 'votes.json';

function getRealVoteStats(votes: Vote[], politician_id: string) {
  const opinion = votes.filter((v) => v.politician_id === politician_id && v.vote_type === 'opinion');
  return {
    hearts:   opinion.filter((v) => v.value === 'hearts').length,
    likes:    opinion.filter((v) => v.value === 'likes').length,
    dislikes: opinion.filter((v) => v.value === 'dislikes').length,
    horrors:  opinion.filter((v) => v.value === 'horrors').length,
  };
}

export default async function handler(req: ApiReq, res: ApiRes): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  if (req.method !== 'GET') {
    res.status(405).json({ success: false, message: 'Méthode non autorisée.' });
    return;
  }

  try {
    const [items, votes] = await Promise.all([
      dbRead<Leader[]>(LEADERS_KEY, LEADERS_FILE),
      dbRead<Vote[]>(VOTES_KEY, VOTES_FILE),
    ]);

    let list: Leader[] = items || [];
    const isAdmin = req.query.admin === 'true';
    if (!isAdmin) {
      list = list.filter((i) => i.status !== 'Désactivé');
    }

    const votesList: Vote[] = votes || [];

    const results = list.map((item) => ({
      id:               item.id,
      fullname:         item.fullname || item.label || item.id,
      first_name:       item.first_name || (item.fullname || item.label || '').split(' ')[0],
      last_name:        item.last_name  || (item.fullname || item.label || '').split(' ').slice(1).join(' '),
      job_title:        item.job_title  || item.description || 'Dirigeant Politique',
      biography:        item.biography  || item.description || '',
      description:      item.description || item.job_title || '',
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
      status:           item.status        || 'Activé',
      vote_enabled:     item.vote_enabled  !== false,
      block1_enabled:   item.block1_enabled !== false,
      block2_enabled:   item.block2_enabled !== false,
      votes:            getRealVoteStats(votesList, item.id),
    }));

    if (!isAdmin) {
      results.sort((a, b) => {
        const totalA = a.votes.hearts + a.votes.likes + a.votes.dislikes + a.votes.horrors;
        const totalB = b.votes.hearts + b.votes.likes + b.votes.dislikes + b.votes.horrors;
        if (totalB !== totalA) return totalB - totalA;
        return a.fullname.localeCompare(b.fullname, 'fr', { sensitivity: 'base' });
      });
    } else {
      results.sort((a, b) => a.fullname.localeCompare(b.fullname, 'fr', { sensitivity: 'base' }));
    }

    res.status(200).json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
}
