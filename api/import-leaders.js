import axios from 'axios';
import { dbRead, dbWrite } from './_db.js';
import { fetchAndEnrichFromWikidata } from './tracked.js';

const KEY = 'africa_leaders';
const FILE = 'africa_leaders.json';
const COUNTRIES_KEY = 'countries';
const COUNTRIES_FILE = 'countries.json';

// ─── Requête SPARQL Wikidata (Optimisée pour l'Afrique) ────────────────────────
function buildSparqlQuery({ includeDeceased, includeFormer, types }) {
  const p39Qids = [];
  const p106Qids = [];

  if (types.includes('president')) {
    p39Qids.push('wd:Q30461', 'wd:Q18810062', 'wd:Q48352');
  }
  if (types.includes('prime_minister')) {
    p39Qids.push('wd:Q1006876');
  }
  if (types.includes('military')) {
    p39Qids.push('wd:Q17279032');
  }
  if (types.includes('minister')) {
    p39Qids.push('wd:Q83307', 'wd:Q1074044');
  }
  if (types.includes('deputy')) {
    p39Qids.push('wd:Q1541400', 'wd:Q486839');
  }
  if (types.includes('senator')) {
    p39Qids.push('wd:Q82955');
  }
  if (types.includes('business')) {
    p106Qids.push('wd:Q488205', 'wd:Q131524', 'wd:Q43845');
  }

  // Fallback si rien de coché
  if (p39Qids.length === 0 && p106Qids.length === 0) {
    p39Qids.push('wd:Q30461');
  }

  const roleClauses = [];
  if (p39Qids.length > 0) {
    roleClauses.push(`{ VALUES ?p39Role { ${p39Qids.join(' ')} } ?person wdt:P39 ?p39Role . }`);
  }
  if (p106Qids.length > 0) {
    roleClauses.push(`{ VALUES ?p106Role { ${p106Qids.join(' ')} } ?person wdt:P106 ?p106Role . }`);
  }

  const roleUnion = roleClauses.join(' UNION ');

  const deceasedFilter = includeDeceased
    ? ''
    : 'FILTER NOT EXISTS { ?person wdt:P570 [] }\n';

  const formerFilter = includeFormer
    ? ''
    : `OPTIONAL { ?person p:P39/pq:P582 ?endTime . }
  FILTER (!BOUND(?endTime) || ?endTime >= "2006-01-01T00:00:00Z"^^xsd:dateTime)`;

  return `
SELECT DISTINCT ?person WHERE {
  # 1. Restreindre d'abord aux pays d'Afrique (54 pays du continent Q15)
  ?country wdt:P30 wd:Q15 .
  
  # 2. Citoyenneté (P27) ou rattachement d'État (P17)
  { ?person wdt:P27 ?country . } UNION { ?person wdt:P17 ?country . }

  # 3. Filtrer par les rôles/professions sélectionnés
  ${roleUnion}

  ${formerFilter}
  ${deceasedFilter}
}
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
  console.log(`[import-leaders] Lancement de la requête SPARQL Wikidata (types: ${types.join(', ')})...`);
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
    console.log(`[import-leaders] SPARQL terminé : ${sparqlResults.length} résulat(s) retourné(s).`);
  } catch (e) {
    console.error(`[import-leaders] ERREUR SPARQL : ${e.message}`);
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
    console.log(`[import-leaders] Aucun Q-ID unique trouvé.`);
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

  console.log(`[import-leaders] total_trouvés=${qids.length} | à_importer=${toImport.length} | déjà_présents=${skipped}`);

  // ── 4. Mode simulation (dry run) ─────────────────────────────────────────
  if (dryRun) {
    console.log(`[import-leaders] Mode simulation terminé.`);
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

  console.log(`[import-leaders] Début de l'enrichissement Wikidata pour ${toImport.length} entités...`);

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
        console.log(`  [OK]   ${qid} => ${enriched.fullname} (${enriched.country?.name || 'Afrique'})`);
      } catch (e) {
        errors.push({ qid, error: e.message });
        console.error(`  [ERR]  ${qid} => ${e.message}`);
      }
    }));

    // Petite pause entre les batches pour respecter le rate limit Wikidata
    if (i + BATCH_SIZE < toImport.length) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  if (imported.length > 0) {
    const updatedLeaders = [...existingLeaders, ...imported];
    await dbWrite(KEY, updatedLeaders, FILE);
    console.log(`[import-leaders] Sauvegarde effectuée : +${imported.length} entités dans ${FILE}.`);
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
