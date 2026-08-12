import axios from 'axios';
import { dbRead, dbWrite } from './_db.js';

const KEY           = 'africa_leaders';
const FILE          = 'africa_leaders.json';
const COUNTRIES_KEY = 'countries';
const COUNTRIES_FILE = 'countries.json';

async function readLeaders() {
  return (await dbRead(KEY, FILE)) || [];
}

async function saveLeaders(leaders) {
  return dbWrite(KEY, leaders, FILE);
}

async function getCountriesMap() {
  const list = (await dbRead(COUNTRIES_KEY, COUNTRIES_FILE)) || [];
  const map = {};
  list.forEach(c => { map[c.id.toUpperCase()] = `${c.flag ? c.flag + ' ' : ''}${c.name}`; });
  return map;
}

async function fetchWithRetry(url, options = {}, retries = 4, backoff = 2000) {
  try {
    return await axios.get(url, options);
  } catch (error) {
    const status = error.response?.status;
    if ((status === 429 || status === 503 || error.code === 'ECONNRESET') && retries > 0) {
      console.warn(`  ⚠️ Wikidata Rate Limit (${status || error.code}). Pause de ${backoff}ms avant retry (${retries} restant(s))...`);
      await new Promise(r => setTimeout(r, backoff));
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    throw error;
  }
}

export async function fetchAndEnrichFromWikidata(qid, countriesMap) {
  const url = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
  const res = await fetchWithRetry(url, {
    headers: { 'User-Agent': 'PolitiliBot/2.0 (politili.com)' },
    timeout: 12000,
  });
  const entity = res.data?.entities?.[qid];
  if (!entity) throw new Error(`Entité ${qid} introuvable sur Wikidata`);

  const getClaimVal = (pId) => entity.claims?.[pId]?.[0]?.mainsnak?.datavalue?.value?.id || null;
  const getClaimStr = (pId) => entity.claims?.[pId]?.[0]?.mainsnak?.datavalue?.value || null;

  const labelFr = entity.labels?.fr?.value || entity.labels?.en?.value || qid;
  const labelEn = entity.labels?.en?.value || entity.labels?.fr?.value || qid;
  const descFr  = entity.descriptions?.fr?.value || entity.descriptions?.en?.value || "Homme d'État (Afrique)";
  const descEn  = entity.descriptions?.en?.value || entity.descriptions?.fr?.value || 'African Head of State';

  const countryQid  = getClaimVal('P27') || getClaimVal('P17');
  const partyQid    = getClaimVal('P102');
  const positionQid = getClaimVal('P39');
  const birthStr    = getClaimStr('P569')?.time ? getClaimStr('P569').time.substring(1, 11) : null;
  const deathStr    = getClaimStr('P570')?.time ? getClaimStr('P570').time.substring(1, 11) : null;

  let latestEndTimeYear  = null;
  let hasExplicitEndTime = false;
  const p39Claims = entity.claims?.P39 || [];
  for (const claim of p39Claims) {
    const endTimeStr = claim.qualifiers?.P582?.[0]?.datavalue?.value?.time;
    if (endTimeStr) {
      hasExplicitEndTime = true;
      const year = parseInt(endTimeStr.substring(1, 5), 10);
      if (!isNaN(year) && (latestEndTimeYear === null || year > latestEndTimeYear)) latestEndTimeYear = year;
    }
  }

  const descLower       = (descFr + ' ' + descEn).toLowerCase();
  const isFormerByText  = descLower.includes('ancien') || descLower.includes('former') || descLower.includes('ex-');
  const isCurrentlyActive = !hasExplicitEndTime && !isFormerByText && !deathStr;
  const cutoffYear        = new Date().getFullYear() - 20;
  const isOlderThan20Years = latestEndTimeYear !== null && latestEndTimeYear < cutoffYear;

  const imageFilename = getClaimStr('P18');
  const photoUrl = imageFilename
    ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(imageFilename)}`
    : null;

  let countryName = 'Afrique', countryNameEn = 'Africa';
  if (countryQid) {
    const cleanQid = countryQid.toUpperCase();
    if (countriesMap?.[cleanQid]) {
      countryName = countryNameEn = countriesMap[cleanQid];
    } else {
      try {
        const cRes = await fetchWithRetry(`https://www.wikidata.org/wiki/Special:EntityData/${countryQid}.json`, {
          headers: { 'User-Agent': 'PolitiliBot/2.0' }, timeout: 6000,
        });
        const cEntity = cRes.data?.entities?.[countryQid];
        countryName   = cEntity?.labels?.fr?.value || cEntity?.labels?.en?.value || 'Afrique';
        countryNameEn = cEntity?.labels?.en?.value || cEntity?.labels?.fr?.value || 'Africa';
      } catch (e) {}
    }
  }

  const frWikiTitle = entity.sitelinks?.frwiki?.title;
  const enWikiTitle = entity.sitelinks?.enwiki?.title;
  const wikipediaFr = frWikiTitle
    ? `https://fr.wikipedia.org/wiki/${encodeURIComponent(frWikiTitle.replace(/ /g, '_'))}`
    : `https://fr.wikipedia.org/w/index.php?search=${encodeURIComponent(labelFr)}`;
  const wikipediaEn = enWikiTitle
    ? `https://en.wikipedia.org/wiki/${encodeURIComponent(enWikiTitle.replace(/ /g, '_'))}`
    : `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(labelEn)}`;
  const wikipediaUrl = frWikiTitle ? wikipediaFr : (enWikiTitle ? wikipediaEn : wikipediaFr);

  // Vérification stricte P35 (Head of State) si fourni dans options ou via data/active_presidents.json
  let activeSet = options?.activeHeadsSet;
  if (!activeSet) {
    try {
      const filePath = path.join(process.cwd(), 'data', 'active_presidents.json');
      if (fs.existsSync(filePath)) {
        activeSet = new Set(JSON.parse(fs.readFileSync(filePath, 'utf-8')).map(id => id.toUpperCase()));
      }
    } catch (e) {}
  }
  const isHeadOfStateP35 = activeSet ? activeSet.has(qid.toUpperCase()) : isCurrentlyActive;
  const computedState = deathStr ? 'Décédé' : (isHeadOfStateP35 ? 'En exercice' : 'Ancien');

  return {
    fullname: labelFr, label: labelFr,
    first_name: labelFr.split(' ')[0] || labelFr,
    last_name:  labelFr.split(' ').slice(1).join(' ') || '',
    job_title: descFr, biography: descFr, description: descFr,
    i18n: {
      fr: { label: labelFr, description: descFr, wikipedia: wikipediaFr },
      en: { label: labelEn, description: descEn, wikipedia: wikipediaEn },
    },
    birth_date: birthStr, death_date: deathStr,
    actor_state: computedState,
    latest_end_year: latestEndTimeYear,
    is_older_than_20_years: isOlderThan20Years,
    country:         { id: countryQid, name: countryName, name_en: countryNameEn },
    political_party: { id: partyQid,   name: partyQid ? 'Parti officiel' : 'Indépendant' },
    position_held:   { id: positionQid, name: descFr, name_en: descEn },
    photo_url: photoUrl, source_url: wikipediaUrl,
    wikipedia_fr: wikipediaFr, wikipedia_en: wikipediaEn,
    wikidata_url: `https://www.wikidata.org/wiki/${qid}`,
    enrichedAt: new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const idParam = req.query.id || req.url.split('/').filter(Boolean).pop()?.split('?')[0];

  if (req.method === 'POST') {
    const { entityId, vote_enabled, block1_enabled, block2_enabled } = req.body || {};
    const cleanId = (entityId || '').toUpperCase().trim();
    if (!cleanId) return res.status(400).json({ success: false, message: 'Identifiant Q-ID manquant.' });

    const leaders = await readLeaders();
    if (leaders.some(l => l.id.toUpperCase() === cleanId)) {
      return res.status(400).json({ success: false, message: `L'entité ${cleanId} existe déjà dans la base.` });
    }

    let enriched = {};
    try {
      const countriesMap = await getCountriesMap();
      enriched = await fetchAndEnrichFromWikidata(cleanId, countriesMap);
    } catch (e) {
      console.warn(`[tracked] Impossible d'enrichir ${cleanId}:`, e.message);
      enriched = { label: cleanId, fullname: cleanId, description: 'Dirigeant Politique (Afrique)' };
    }

    const newItem = {
      id: cleanId, ...enriched, status: 'Activé',
      vote_enabled: vote_enabled !== false,
      block1_enabled: block1_enabled !== false,
      block2_enabled: block2_enabled !== false,
      addedAt: new Date().toISOString(),
    };
    leaders.push(newItem);
    await saveLeaders(leaders);
    return res.status(200).json({ success: true, entity: newItem, message: `Politicien ${enriched.fullname || cleanId} ajouté et enrichi.` });
  }

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

  if (req.method === 'PUT') {
    const { activate_all, activate_ids, status, vote_enabled, block1_enabled, block2_enabled, refresh_wikidata } = req.body || {};
    const leaders = await readLeaders();

    // ── Option A: Activation globale de tous les profils ──
    if (activate_all) {
      let updatedCount = 0;
      leaders.forEach(l => {
        if (l.status !== 'Activé') {
          l.status = 'Activé';
          updatedCount++;
        }
      });
      await saveLeaders(leaders);
      return res.status(200).json({ success: true, count: updatedCount, message: `✓ ${updatedCount} politicien(s) activé(s) avec succès !` });
    }

    // ── Option B: Activation d'une liste spécifique de Q-IDs ──
    if (Array.isArray(activate_ids) && activate_ids.length > 0) {
      const qidSet = new Set(activate_ids.map(id => id.toUpperCase().trim()));
      let updatedCount = 0;
      leaders.forEach(l => {
        if (qidSet.has((l.id || '').toUpperCase())) {
          l.status = 'Activé';
          updatedCount++;
        }
      });
      await saveLeaders(leaders);
      return res.status(200).json({ success: true, count: updatedCount, message: `✓ ${updatedCount} politicien(s) activé(s) avec succès !` });
    }

    // ── Option C: Recalcul strict des Présidents en exercice (Chefs d'État P35 actuels) ──
    if (req.body?.fix_actor_states) {
      let activeHeadsSet = new Set();

      // 1. Essayer de charger data/active_presidents.json
      try {
        const filePath = path.join(process.cwd(), 'data', 'active_presidents.json');
        if (fs.existsSync(filePath)) {
          const list = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          list.forEach(id => activeHeadsSet.add(id.toUpperCase()));
        }
      } catch (e) {}

      // 2. Si le fichier statique n'a rien renvoyé, interroger Wikidata SPARQL
      if (activeHeadsSet.size === 0) {
        try {
          const countriesList = await readCountries();
          const countryQids = countriesList.map(c => `wd:${c.id}`).join(' ');
          const query = `SELECT DISTINCT ?person WHERE { VALUES ?country { ${countryQids} } ?country wdt:P35 ?person . FILTER NOT EXISTS { ?person wdt:P570 [] } }`;
          const resSparql = await axios.get(`https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`, {
            headers: { 'User-Agent': 'PolitiliBot/2.0', 'Accept': 'application/sparql-results+json' },
            timeout: 25000,
          });
          const bindings = resSparql.data?.results?.bindings || [];
          bindings.forEach(b => {
            const qid = b.person?.value?.split('/').pop();
            if (qid) activeHeadsSet.add(qid.toUpperCase());
          });
        } catch (e) {}
      }

      // Si SPARQL et le fichier statique ont échoué, sécurité pour ne pas tout effacer
      if (activeHeadsSet.size === 0) {
        return res.status(500).json({
          success: false,
          message: "Impossible de récupérer la liste des Chefs d'État actuels depuis Wikidata. Réessayez."
        });
      }

      let activeCount = 0, formerCount = 0;
      leaders.forEach(l => {
        const qid = (l.id || '').toUpperCase();
        if (l.death_date) {
          l.actor_state = 'Décédé';
        } else if (activeHeadsSet.has(qid)) {
          l.actor_state = 'En exercice';
          activeCount++;
        } else {
          l.actor_state = 'Ancien';
          formerCount++;
        }
      });
      await saveLeaders(leaders);
      return res.status(200).json({
        success: true,
        activeCount,
        formerCount,
        message: `✓ Nettoyage réussi : ${activeCount} Présidents en exercice officiels et ${formerCount} Anciens.`
      });
    }

    // ── Option C: Modification d'une fiche spécifique par ID ──
    const cleanId = (idParam || req.body?.entityId || '').toUpperCase().trim();
    const item = leaders.find(l => l.id.toUpperCase() === cleanId);
    if (!item) return res.status(404).json({ success: false, message: `Entité ${cleanId} non trouvée.` });

    if (status !== undefined)        item.status        = status;
    if (vote_enabled !== undefined)  item.vote_enabled  = Boolean(vote_enabled);
    if (block1_enabled !== undefined) item.block1_enabled = Boolean(block1_enabled);
    if (block2_enabled !== undefined) item.block2_enabled = Boolean(block2_enabled);

    if (refresh_wikidata) {
      try {
        const countriesMap = await getCountriesMap();
        Object.assign(item, await fetchAndEnrichFromWikidata(cleanId, countriesMap));
      } catch (e) {
        return res.status(500).json({ success: false, message: `Erreur Wikidata: ${e.message}` });
      }
    }

    await saveLeaders(leaders);
    return res.status(200).json({ success: true, entity: item, message: 'Politicien mis à jour.' });
  }

  return res.status(405).json({ success: false, message: 'Méthode non autorisée.' });
}
