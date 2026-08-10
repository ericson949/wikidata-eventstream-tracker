import axios from 'axios';
import { dbRead, dbWrite } from './_db.js';

const KEY = 'africa_leaders';
const FILE = 'africa_leaders.json';
const COUNTRIES_KEY = 'countries';
const COUNTRIES_FILE = 'countries.json';

async function readLeaders() {
  return (await dbRead(KEY, FILE)) || [];
}

async function saveLeaders(leaders) {
  return await dbWrite(KEY, leaders, FILE);
}

async function getCountriesMap() {
  const list = (await dbRead(COUNTRIES_KEY, COUNTRIES_FILE)) || [];
  const map = {};
  list.forEach(c => { map[c.id.toUpperCase()] = `${c.flag ? c.flag + ' ' : ''}${c.name}`; });
  return map;
}

// ─── Fetch + enrich depuis Wikidata ──────────────────────────────────────────
export async function fetchAndEnrichFromWikidata(qid, countriesMap) {
  const url = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
  const res = await axios.get(url, {
    headers: { 'User-Agent': 'PolitiliBot/2.0 (politili.com)' },
    timeout: 8000
  });
  const entity = res.data?.entities?.[qid];
  if (!entity) throw new Error(`Entité ${qid} introuvable sur Wikidata`);

  const getClaimVal = (pId) => entity.claims?.[pId]?.[0]?.mainsnak?.datavalue?.value?.id || null;
  const getClaimStr = (pId) => entity.claims?.[pId]?.[0]?.mainsnak?.datavalue?.value || null;

  const labelFr = entity.labels?.fr?.value || entity.labels?.en?.value || qid;
  const descFr = entity.descriptions?.fr?.value || entity.descriptions?.en?.value || 'Homme d\'État (Afrique)';

  const countryQid = getClaimVal('P27') || getClaimVal('P17');
  const partyQid = getClaimVal('P102');
  const positionQid = getClaimVal('P39');
  const birthStr = getClaimStr('P569')?.time ? getClaimStr('P569').time.substring(1, 11) : null;
  const deathStr = getClaimStr('P570')?.time ? getClaimStr('P570').time.substring(1, 11) : null;
  const imageFilename = getClaimStr('P18');
  const photoUrl = imageFilename
    ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(imageFilename)}`
    : null;

  let countryName = 'Afrique';
  if (countryQid) {
    const cleanQid = countryQid.toUpperCase();
    if (countriesMap && countriesMap[cleanQid]) {
      countryName = countriesMap[cleanQid];
    } else {
      try {
        const cRes = await axios.get(`https://www.wikidata.org/wiki/Special:EntityData/${countryQid}.json`, {
          headers: { 'User-Agent': 'PolitiliBot/2.0' }, timeout: 4000
        });
        const cEntity = cRes.data?.entities?.[countryQid];
        countryName = cEntity?.labels?.fr?.value || cEntity?.labels?.en?.value || 'Afrique';
      } catch (e) {}
    }
  }

  return {
    fullname: labelFr,
    label: labelFr,
    first_name: labelFr.split(' ')[0] || labelFr,
    last_name: labelFr.split(' ').slice(1).join(' ') || '',
    job_title: descFr,
    biography: descFr,
    description: descFr,
    birth_date: birthStr,
    death_date: deathStr,
    actor_state: deathStr ? 'Décédé' : 'En exercice',
    country: { id: countryQid, name: countryName },
    political_party: { id: partyQid, name: partyQid ? 'Parti officiel' : 'Indépendant' },
    position_held: { id: positionQid, name: descFr },
    photo_url: photoUrl,
    source_url: entity.sitelinks?.frwiki?.url || `https://www.wikidata.org/wiki/${qid}`,
    wikidata_url: `https://www.wikidata.org/wiki/${qid}`,
    enrichedAt: new Date().toISOString()
  };
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const idParam = req.query.id || req.url.split('/').filter(Boolean).pop()?.split('?')[0];

  // ─── POST : Ajouter un politicien ──────────────────────────────────────────
  if (req.method === 'POST') {
    const { entityId, vote_enabled, block1_enabled, block2_enabled } = req.body || {};
    const cleanId = (entityId || '').toUpperCase().trim();

    if (!cleanId) {
      return res.status(400).json({ success: false, message: 'Identifiant Q-ID manquant.' });
    }

    let leaders = await readLeaders();
    if (leaders.some(l => l.id.toUpperCase() === cleanId)) {
      return res.status(400).json({ success: false, message: `L'entité ${cleanId} existe déjà dans la base.` });
    }

    let enriched = {};
    try {
      const countriesMap = await getCountriesMap();
      enriched = await fetchAndEnrichFromWikidata(cleanId, countriesMap);
    } catch (e) {
      console.warn(`[tracked] Impossible d'enrichir ${cleanId} depuis Wikidata:`, e.message);
      enriched = { label: cleanId, fullname: cleanId, description: 'Dirigeant Politique (Afrique)' };
    }

    const newItem = {
      id: cleanId,
      ...enriched,
      status: 'Activé',
      vote_enabled: vote_enabled !== false,
      block1_enabled: block1_enabled !== false,
      block2_enabled: block2_enabled !== false,
      addedAt: new Date().toISOString()
    };

    leaders.push(newItem);
    await saveLeaders(leaders);
    return res.status(200).json({
      success: true,
      entity: newItem,
      message: `Politicien ${enriched.fullname || cleanId} ajouté et enrichi.`
    });
  }

  // ─── DELETE : Supprimer ────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const cleanId = (idParam || req.body?.entityId || '').toUpperCase().trim();
    if (!cleanId) return res.status(400).json({ success: false, message: 'Identifiant Q-ID manquant.' });

    let leaders = await readLeaders();
    const initialLen = leaders.length;
    leaders = leaders.filter(l => l.id.toUpperCase() !== cleanId);

    if (leaders.length < initialLen) {
      await saveLeaders(leaders);
      return res.status(200).json({ success: true, message: `Politicien ${cleanId} supprimé.` });
    }
    return res.status(404).json({ success: false, message: `Entité ${cleanId} non trouvée.` });
  }

  // ─── PUT : Modifier ────────────────────────────────────────────────────────
  if (req.method === 'PUT') {
    const cleanId = (idParam || req.body?.entityId || '').toUpperCase().trim();
    const { status, vote_enabled, block1_enabled, block2_enabled, refresh_wikidata } = req.body || {};

    let leaders = await readLeaders();
    const item = leaders.find(l => l.id.toUpperCase() === cleanId);
    if (!item) return res.status(404).json({ success: false, message: `Entité ${cleanId} non trouvée.` });

    if (status !== undefined) item.status = status;
    if (vote_enabled !== undefined) item.vote_enabled = Boolean(vote_enabled);
    if (block1_enabled !== undefined) item.block1_enabled = Boolean(block1_enabled);
    if (block2_enabled !== undefined) item.block2_enabled = Boolean(block2_enabled);

    if (refresh_wikidata) {
      try {
        const countriesMap = await getCountriesMap();
        const freshData = await fetchAndEnrichFromWikidata(cleanId, countriesMap);
        Object.assign(item, freshData);
      } catch (e) {
        return res.status(500).json({ success: false, message: `Erreur Wikidata: ${e.message}` });
      }
    }

    await saveLeaders(leaders);
    return res.status(200).json({ success: true, entity: item, message: 'Politicien mis à jour.' });
  }

  return res.status(405).json({ success: false, message: 'Méthode non autorisée.' });
}
