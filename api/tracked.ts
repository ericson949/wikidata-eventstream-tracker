import type { IncomingMessage, ServerResponse } from 'http';
import axios from 'axios';
import { dbRead, dbWrite } from './_db.js';

type ApiReq = IncomingMessage & {
  query: Record<string, string>;
  body?: Record<string, unknown>;
  url?: string;
};
type ApiRes = ServerResponse & { status: (c: number) => ApiRes; json: (d: unknown) => void; end: () => void };

interface Leader {
  id: string;
  fullname?: string;
  label?: string;
  description?: string;
  status?: string;
  vote_enabled?: boolean;
  block1_enabled?: boolean;
  block2_enabled?: boolean;
  addedAt?: string;
  enrichedAt?: string;
  [key: string]: unknown;
}

interface EnrichedData {
  fullname: string;
  label: string;
  first_name: string;
  last_name: string;
  job_title: string;
  biography: string;
  description: string;
  i18n: { fr: { label: string; description: string; wikipedia: string }; en: { label: string; description: string; wikipedia: string } };
  birth_date: string | null;
  death_date: string | null;
  actor_state: string;
  latest_end_year: number | null;
  is_older_than_20_years: boolean;
  country: { id: string | null; name: string; name_en: string };
  political_party: { id: string | null; name: string };
  position_held: { id: string | null; name: string; name_en: string };
  photo_url: string | null;
  source_url: string;
  wikipedia_fr: string;
  wikipedia_en: string;
  wikidata_url: string;
  enrichedAt: string;
}

const KEY = 'africa_leaders';
const FILE = 'africa_leaders.json';
const COUNTRIES_KEY = 'countries';
const COUNTRIES_FILE = 'countries.json';

async function readLeaders(): Promise<Leader[]> {
  return (await dbRead<Leader[]>(KEY, FILE)) || [];
}

async function saveLeaders(leaders: Leader[]): Promise<boolean> {
  return dbWrite(KEY, leaders, FILE);
}

async function getCountriesMap(): Promise<Record<string, string>> {
  const list = (await dbRead<Array<{ id: string; flag?: string; name: string }>>(COUNTRIES_KEY, COUNTRIES_FILE)) || [];
  const map: Record<string, string> = {};
  list.forEach((c) => { map[c.id.toUpperCase()] = `${c.flag ? c.flag + ' ' : ''}${c.name}`; });
  return map;
}

// ─── HTTP GET avec Retry automatique sur 429 / 503 (Rate Limit) ───────────────
async function fetchWithRetry(url: string, options: object = {}, retries = 4, backoff = 2000): Promise<any> {
  try {
    return await axios.get(url, options);
  } catch (error: any) {
    const status = error.response?.status;
    if ((status === 429 || status === 503 || error.code === 'ECONNRESET') && retries > 0) {
      console.warn(`  ⚠️ Wikidata Rate Limit (${status || error.code}). Pause de ${backoff}ms avant retry (${retries} restant(s))...`);
      await new Promise((r) => setTimeout(r, backoff));
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    throw error;
  }
}

// ─── Fetch + enrich depuis Wikidata ──────────────────────────────────────────
export async function fetchAndEnrichFromWikidata(qid: string, countriesMap: Record<string, string>): Promise<EnrichedData> {
  const url = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
  const res = await fetchWithRetry(url, {
    headers: { 'User-Agent': 'PolitiliBot/2.0 (politili.com)' },
    timeout: 12000,
  });
  const entity = res.data?.entities?.[qid];
  if (!entity) throw new Error(`Entité ${qid} introuvable sur Wikidata`);

  const getClaimVal = (pId: string): string | null =>
    entity.claims?.[pId]?.[0]?.mainsnak?.datavalue?.value?.id || null;
  const getClaimStr = (pId: string): any =>
    entity.claims?.[pId]?.[0]?.mainsnak?.datavalue?.value || null;

  // ── Labels bilingues ─────────────────────────────────────────────────────
  const labelFr: string = entity.labels?.fr?.value || entity.labels?.en?.value || qid;
  const labelEn: string = entity.labels?.en?.value || entity.labels?.fr?.value || qid;

  const descFr: string = entity.descriptions?.fr?.value || entity.descriptions?.en?.value || "Homme d'État (Afrique)";
  const descEn: string = entity.descriptions?.en?.value || entity.descriptions?.fr?.value || 'African Head of State';

  const countryQid = getClaimVal('P27') || getClaimVal('P17');
  const partyQid = getClaimVal('P102');
  const positionQid = getClaimVal('P39');
  const birthStr: string | null = getClaimStr('P569')?.time ? getClaimStr('P569').time.substring(1, 11) : null;
  const deathStr: string | null = getClaimStr('P570')?.time ? getClaimStr('P570').time.substring(1, 11) : null;

  // ── Analyse de la fin du dernier poste politique (P39 -> qualifiers P582) ──
  let latestEndTimeYear: number | null = null;
  let hasExplicitEndTime = false;
  const p39Claims: any[] = entity.claims?.P39 || [];
  for (const claim of p39Claims) {
    const endTimeStr: string | undefined = claim.qualifiers?.P582?.[0]?.datavalue?.value?.time;
    if (endTimeStr) {
      hasExplicitEndTime = true;
      const year = parseInt(endTimeStr.substring(1, 5), 10);
      if (!isNaN(year) && (latestEndTimeYear === null || year > latestEndTimeYear)) {
        latestEndTimeYear = year;
      }
    }
  }

  const descLower = (descFr + ' ' + descEn).toLowerCase();
  const isFormerByText = descLower.includes('ancien') || descLower.includes('former') || descLower.includes('ex-');
  const isCurrentlyActive = !hasExplicitEndTime && !isFormerByText && !deathStr;

  const currentYear = new Date().getFullYear();
  const cutoffYear = currentYear - 20;
  const isOlderThan20Years = latestEndTimeYear !== null && latestEndTimeYear < cutoffYear;

  const imageFilename = getClaimStr('P18');
  const photoUrl: string | null = imageFilename
    ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(imageFilename)}`
    : null;

  // ── Pays (nom FR + EN) ───────────────────────────────────────────────────
  let countryName = 'Afrique';
  let countryNameEn = 'Africa';
  if (countryQid) {
    const cleanQid = countryQid.toUpperCase();
    if (countriesMap && countriesMap[cleanQid]) {
      countryName = countriesMap[cleanQid];
      countryNameEn = countriesMap[cleanQid];
    } else {
      try {
        const cRes = await fetchWithRetry(`https://www.wikidata.org/wiki/Special:EntityData/${countryQid}.json`, {
          headers: { 'User-Agent': 'PolitiliBot/2.0' },
          timeout: 6000,
        });
        const cEntity = cRes.data?.entities?.[countryQid];
        countryName = cEntity?.labels?.fr?.value || cEntity?.labels?.en?.value || 'Afrique';
        countryNameEn = cEntity?.labels?.en?.value || cEntity?.labels?.fr?.value || 'Africa';
      } catch (e) {}
    }
  }

  // ── URLs Wikipedia FR + EN ───────────────────────────────────────────────
  const frWikiTitle: string | undefined = entity.sitelinks?.frwiki?.title;
  const enWikiTitle: string | undefined = entity.sitelinks?.enwiki?.title;

  const wikipediaFr = frWikiTitle
    ? `https://fr.wikipedia.org/wiki/${encodeURIComponent(frWikiTitle.replace(/ /g, '_'))}`
    : `https://fr.wikipedia.org/w/index.php?search=${encodeURIComponent(labelFr)}`;

  const wikipediaEn = enWikiTitle
    ? `https://en.wikipedia.org/wiki/${encodeURIComponent(enWikiTitle.replace(/ /g, '_'))}`
    : `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(labelEn)}`;

  const wikipediaUrl = frWikiTitle ? wikipediaFr : (enWikiTitle ? wikipediaEn : wikipediaFr);

  return {
    fullname: labelFr,
    label: labelFr,
    first_name: labelFr.split(' ')[0] || labelFr,
    last_name: labelFr.split(' ').slice(1).join(' ') || '',
    job_title: descFr,
    biography: descFr,
    description: descFr,
    i18n: {
      fr: { label: labelFr, description: descFr, wikipedia: wikipediaFr },
      en: { label: labelEn, description: descEn, wikipedia: wikipediaEn },
    },
    birth_date: birthStr,
    death_date: deathStr,
    actor_state: deathStr ? 'Décédé' : (isCurrentlyActive ? 'En exercice' : 'Ancien'),
    latest_end_year: latestEndTimeYear,
    is_older_than_20_years: isOlderThan20Years,
    country: { id: countryQid, name: countryName, name_en: countryNameEn },
    political_party: { id: partyQid, name: partyQid ? 'Parti officiel' : 'Indépendant' },
    position_held: { id: positionQid, name: descFr, name_en: descEn },
    photo_url: photoUrl,
    source_url: wikipediaUrl,
    wikipedia_fr: wikipediaFr,
    wikipedia_en: wikipediaEn,
    wikidata_url: `https://www.wikidata.org/wiki/${qid}`,
    enrichedAt: new Date().toISOString(),
  };
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req: ApiReq, res: ApiRes): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const idParam =
    req.query.id || req.url?.split('/').filter(Boolean).pop()?.split('?')[0];

  // ─── POST : Ajouter un politicien ──────────────────────────────────────────
  if (req.method === 'POST') {
    const { entityId, vote_enabled, block1_enabled, block2_enabled } = req.body || {};
    const cleanId = ((entityId as string) || '').toUpperCase().trim();

    if (!cleanId) {
      res.status(400).json({ success: false, message: 'Identifiant Q-ID manquant.' });
      return;
    }

    const leaders = await readLeaders();
    if (leaders.some((l) => l.id.toUpperCase() === cleanId)) {
      res.status(400).json({ success: false, message: `L'entité ${cleanId} existe déjà dans la base.` });
      return;
    }

    let enriched: Partial<EnrichedData> = {};
    try {
      const countriesMap = await getCountriesMap();
      enriched = await fetchAndEnrichFromWikidata(cleanId, countriesMap);
    } catch (e) {
      console.warn(`[tracked] Impossible d'enrichir ${cleanId} depuis Wikidata:`, (e as Error).message);
      enriched = { label: cleanId, fullname: cleanId, description: 'Dirigeant Politique (Afrique)' };
    }

    const newItem: Leader = {
      id: cleanId,
      ...enriched,
      status: 'Activé',
      vote_enabled: vote_enabled !== false,
      block1_enabled: block1_enabled !== false,
      block2_enabled: block2_enabled !== false,
      addedAt: new Date().toISOString(),
    };

    leaders.push(newItem);
    await saveLeaders(leaders);
    res.status(200).json({
      success: true,
      entity: newItem,
      message: `Politicien ${enriched.fullname || cleanId} ajouté et enrichi.`,
    });
    return;
  }

  // ─── DELETE : Supprimer ────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const cleanId = ((idParam || (req.body?.entityId as string)) || '').toUpperCase().trim();
    if (!cleanId) { res.status(400).json({ success: false, message: 'Identifiant Q-ID manquant.' }); return; }

    let leaders = await readLeaders();
    const initialLen = leaders.length;
    leaders = leaders.filter((l) => l.id.toUpperCase() !== cleanId);

    if (leaders.length < initialLen) {
      await saveLeaders(leaders);
      res.status(200).json({ success: true, message: `Politicien ${cleanId} supprimé.` });
      return;
    }
    res.status(404).json({ success: false, message: `Entité ${cleanId} non trouvée.` });
    return;
  }

  // ─── PUT : Modifier ────────────────────────────────────────────────────────
  if (req.method === 'PUT') {
    const cleanId = ((idParam || (req.body?.entityId as string)) || '').toUpperCase().trim();
    const { status, vote_enabled, block1_enabled, block2_enabled, refresh_wikidata } = req.body || {};

    const leaders = await readLeaders();
    const item = leaders.find((l) => l.id.toUpperCase() === cleanId);
    if (!item) { res.status(404).json({ success: false, message: `Entité ${cleanId} non trouvée.` }); return; }

    if (status !== undefined) item.status = status as string;
    if (vote_enabled !== undefined) item.vote_enabled = Boolean(vote_enabled);
    if (block1_enabled !== undefined) item.block1_enabled = Boolean(block1_enabled);
    if (block2_enabled !== undefined) item.block2_enabled = Boolean(block2_enabled);

    if (refresh_wikidata) {
      try {
        const countriesMap = await getCountriesMap();
        const freshData = await fetchAndEnrichFromWikidata(cleanId, countriesMap);
        Object.assign(item, freshData);
      } catch (e) {
        res.status(500).json({ success: false, message: `Erreur Wikidata: ${(e as Error).message}` });
        return;
      }
    }

    await saveLeaders(leaders);
    res.status(200).json({ success: true, entity: item, message: 'Politicien mis à jour.' });
    return;
  }

  res.status(405).json({ success: false, message: 'Méthode non autorisée.' });
}
