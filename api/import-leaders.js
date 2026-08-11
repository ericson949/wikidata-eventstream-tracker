import axios from 'axios';
import { dbRead, dbWrite } from './_db.js';
import { fetchAndEnrichFromWikidata } from './tracked.js';

const KEY = 'africa_leaders';
const FILE = 'africa_leaders.json';
const COUNTRIES_KEY = 'countries';
const COUNTRIES_FILE = 'countries.json';

// ─── Requête SPARQL Wikidata ──────────────────────────────────────────────────
function buildSparqlQuery({ includeDeceased, includeFormer, types }) {
  const positionFilters = [];

  if (types.includes('president')) {
    // Chef d'État / Président de la République
    positionFilters.push(`{ ?person wdt:P39 wd:Q30461 }`);           // président
    positionFilters.push(`{ ?person wdt:P39 wd:Q18810062 }`);        // chef d'État
    positionFilters.push(`{ ?person wdt:P39 wd:Q48352 }`);           // chef de gouvernement
  }
  if (types.includes('prime_minister')) {
    positionFilters.push(`{ ?person wdt:P39 wd:Q1006876 }`);         // premier ministre
  }
  if (types.includes('military')) {
    // Dirigeants de juntes / conseils militaires
    positionFilters.push(`{ ?person wdt:P39 wd:Q17279032 }`);        // chef de junta
  }
  if (types.includes('minister')) {
    // Ministres
    positionFilters.push(`{ ?person wdt:P39 wd:Q83307 }`);           // ministre
    positionFilters.push(`{ ?person wdt:P39 wd:Q1074044 }`);        // cabinet minister
  }
  if (types.includes('deputy')) {
    // Députés / Membres de l'Assemblée nationale
    positionFilters.push(`{ ?person wdt:P39 wd:Q1541400 }`);        // membre du parlement
    positionFilters.push(`{ ?person wdt:P39 wd:Q486839 }`);         // membre de l'assemblée nationale
  }
  if (types.includes('senator')) {
    // Sénateurs
    positionFilters.push(`{ ?person wdt:P39 wd:Q82955 }`);          // sénateur
  }
  if (types.includes('business')) {
    // Chefs d'entreprise / Business executives / Entrepreneurs
    positionFilters.push(`{ ?person wdt:P106 wd:Q488205 }`);        // businessperson
    positionFilters.push(`{ ?person wdt:P106 wd:Q131524 }`);        // entrepreneur
    positionFilters.push(`{ ?person wdt:P106 wd:Q43845 }`);         // CEO / business executive
  }

  // Si aucun type sélectionné, prendre tous les chefs d'État
  const positionClause = positionFilters.length > 0
    ? positionFilters.join('\n  UNION\n  ')
    : `{ ?person wdt:P39 wd:Q30461 }`;

  const deceasedFilter = includeDeceased
    ? ''
    : '  FILTER NOT EXISTS { ?person wdt:P570 [] }\n';

  return `
SELECT DISTINCT ?person WHERE {
  ${positionClause}

  # Le pays de citoyenneté (P27) ou pays associé (P17) doit être en Afrique (Q15)
  {
    ?person wdt:P27 ?country .
    ?country wdt:P30 wd:Q15 .
  } UNION {
    ?person wdt:P17 ?country .
    ?country wdt:P30 wd:Q15 .
  }

${deceasedFilter}}
LIMIT 300
`.trim();
}

// ─── Handler principal ────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Méthode non autorisée.' });
  }

  const {
    includeDeceased = false,
    includeFormer = false,
    defaultStatus = 'Désactivé',
    types = ['president', 'prime_minister', 'military', 'minister', 'deputy', 'senator', 'business'],
    dryRun = false,
  } = req.body || {};

  // ── 1. Requête SPARQL ────────────────────────────────────────────────────
  let sparqlResults = [];
  try {
    const query = buildSparqlQuery({ includeDeceased, includeFormer, types });
    const sparqlUrl = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`;

    const sparqlRes = await axios.get(sparqlUrl, {
      headers: {
        'User-Agent': 'PolitiliBot/2.0 (politili.com)',
        'Accept': 'application/sparql-results+json',
      },
      timeout: 45000,
    });

    sparqlResults = sparqlRes.data?.results?.bindings || [];
  } catch (e) {
    return res.status(500).json({
      success: false,
      message: `Erreur lors de la requête SPARQL Wikidata : ${e.message}`,
    });
  }

  // ── 2. Extraire les Q-IDs uniques ────────────────────────────────────────
  const seenQids = new Set();
  for (const b of sparqlResults) {
    const qid = b.person?.value?.split('/').pop()?.toUpperCase();
    if (qid && !seenQids.has(qid)) {
      seenQids.add(qid);
    }
  }

  const qids = [...seenQids];

  if (qids.length === 0) {
    return res.status(200).json({
      success: true,
      imported: 0,
      skipped: 0,
      errors: [],
      message: 'Aucun dirigeant trouvé via SPARQL.',
    });
  }

  // ── 3. Comparer avec la base existante ───────────────────────────────────
  const existingLeaders = await dbRead(KEY, FILE) || [];
  const existingIds = new Set(existingLeaders.map(l => l.id.toUpperCase()));

  const toImport = qids.filter(qid => !existingIds.has(qid));
  const skipped = qids.length - toImport.length;

  // ── 4. Mode simulation (dry run) ─────────────────────────────────────────
  if (dryRun) {
    return res.status(200).json({
      success: true,
      dryRun: true,
      total_found: qids.length,
      to_import: toImport.length,
      skipped,
      qids_preview: toImport.slice(0, 20),
      message: `Simulation : ${toImport.length} nouveaux dirigeants à importer, ${skipped} déjà présents.`,
    });
  }

  // ── 5. Charger la map des pays ───────────────────────────────────────────
  const countriesList = await dbRead(COUNTRIES_KEY, COUNTRIES_FILE) || [];
  const countriesMap = {};
  countriesList.forEach(c => {
    countriesMap[c.id.toUpperCase()] = `${c.flag ? c.flag + ' ' : ''}${c.name}`;
  });

  // ── 6. Enrichir et importer en série (éviter le rate limiting Wikidata) ──
  const imported = [];
  const errors = [];
  const BATCH_SIZE = 5;
  const DELAY_MS = 500;

  for (let i = 0; i < toImport.length; i += BATCH_SIZE) {
    const batch = toImport.slice(i, i + BATCH_SIZE);

    await Promise.all(batch.map(async (qid) => {
      try {
        const enriched = await fetchAndEnrichFromWikidata(qid, countriesMap);
        const newItem = {
          id: qid,
          ...enriched,
          status: defaultStatus,
          vote_enabled: true,
          block1_enabled: true,
          block2_enabled: true,
          addedAt: new Date().toISOString(),
          importedVia: 'sparql_auto',
        };
        imported.push(newItem);
      } catch (e) {
        errors.push({ qid, error: e.message });
      }
    }));

    // Petite pause entre les batches pour respecter le rate limit Wikidata
    if (i + BATCH_SIZE < toImport.length) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  // ── 7. Sauvegarder ──────────────────────────────────────────────────────
  if (imported.length > 0) {
    const updatedLeaders = [...existingLeaders, ...imported];
    await dbWrite(KEY, updatedLeaders, FILE);
  }

  return res.status(200).json({
    success: true,
    total_found: qids.length,
    imported: imported.length,
    skipped,
    errors,
    imported_names: imported.map(p => ({ id: p.id, name: p.fullname, country: p.country?.name })),
    message: `Import terminé : ${imported.length} nouveaux dirigeants ajoutés (${skipped} déjà présents, ${errors.length} erreurs).`,
  });
}
