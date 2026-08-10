import fs from 'fs';
import path from 'path';
import axios from 'axios';

const DATA_FILE = path.join(process.cwd(), 'data', 'africa_leaders.json');
const COUNTRIES_FILE = path.join(process.cwd(), 'data', 'countries.json');
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'politi_admin_secret_token_2026';

function readLeaders() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch (e) { return []; }
}

function saveLeaders(leaders) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(leaders, null, 2), 'utf-8');
    return true;
  } catch (e) { return false; }
}

function getCountriesMap() {
  try {
    const list = JSON.parse(fs.readFileSync(COUNTRIES_FILE, 'utf-8'));
    const map = {};
    list.forEach(c => { map[c.id.toUpperCase()] = `${c.flag ? c.flag + ' ' : ''}${c.name}`; });
    return map;
  } catch (e) { return {}; }
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

  // Résolution du pays
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

  // ─── POST : Ajouter un politicien + fetch Wikidata immédiat ──────────────
  if (req.method === 'POST') {
    const { entityId, vote_enabled, block1_enabled, block2_enabled } = req.body || {};
    const cleanId = (entityId || '').toUpperCase().trim();

    if (!cleanId) {
      return res.status(400).json({ success: false, message: 'Identifiant Q-ID manquant.' });
    }

    let leaders = readLeaders();
    if (leaders.some(l => l.id.toUpperCase() === cleanId)) {
      return res.status(400).json({ success: false, message: `L'entité ${cleanId} existe déjà dans la base.` });
    }

    // Fetch immédiat depuis Wikidata pour enrichir la BDD dès l'ajout
    let enriched = {};
    try {
      const countriesMap = getCountriesMap();
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
    saveLeaders(leaders);
    return res.status(200).json({
      success: true,
      entity: newItem,
      message: `Politicien ${enriched.fullname || cleanId} ajouté et enrichi depuis Wikidata.`
    });
  }

  // ─── DELETE : Supprimer ───────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const cleanId = (idParam || req.body?.entityId || '').toUpperCase().trim();
    if (!cleanId) return res.status(400).json({ success: false, message: 'Identifiant Q-ID manquant.' });

    let leaders = readLeaders();
    const initialLen = leaders.length;
    leaders = leaders.filter(l => l.id.toUpperCase() !== cleanId);

    if (leaders.length < initialLen) {
      saveLeaders(leaders);
      return res.status(200).json({ success: true, message: `Politicien ${cleanId} supprimé.` });
    }
    return res.status(404).json({ success: false, message: `Entité ${cleanId} non trouvée.` });
  }

  // ─── PUT : Modifier statut / flags de vote / refresh Wikidata ────────────
  if (req.method === 'PUT') {
    const cleanId = (idParam || req.body?.entityId || '').toUpperCase().trim();
    const { status, vote_enabled, block1_enabled, block2_enabled, refresh_wikidata } = req.body || {};

    let leaders = readLeaders();
    const item = leaders.find(l => l.id.toUpperCase() === cleanId);
    if (!item) return res.status(404).json({ success: false, message: `Entité ${cleanId} non trouvée.` });

    // Mise à jour des flags
    if (status !== undefined) item.status = status;
    if (vote_enabled !== undefined) item.vote_enabled = Boolean(vote_enabled);
    if (block1_enabled !== undefined) item.block1_enabled = Boolean(block1_enabled);
    if (block2_enabled !== undefined) item.block2_enabled = Boolean(block2_enabled);

    // Re-fetch Wikidata si demandé (déclenché par SSE ou manuellement)
    if (refresh_wikidata) {
      try {
        const countriesMap = getCountriesMap();
        const freshData = await fetchAndEnrichFromWikidata(cleanId, countriesMap);
        // Fusionner les nouvelles données Wikidata en préservant les flags admin
        Object.assign(item, freshData);
        console.log(`[tracked] ✓ ${cleanId} (${item.fullname}) mis à jour depuis Wikidata via SSE/refresh`);
      } catch (e) {
        console.warn(`[tracked] Impossible de rafraîchir ${cleanId}:`, e.message);
        return res.status(500).json({ success: false, message: `Erreur Wikidata: ${e.message}` });
      }
    }

    saveLeaders(leaders);
    return res.status(200).json({ success: true, entity: item, message: 'Politicien mis à jour.' });
  }

  return res.status(405).json({ success: false, message: 'Méthode non autorisée.' });
}
