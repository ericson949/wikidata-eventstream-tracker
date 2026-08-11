import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { dbRead, dbWrite } from './_db.js';
import { fetchAndEnrichFromWikidata } from './tracked.js';

const KEY           = 'africa_leaders';
const FILE          = 'africa_leaders.json';
const COUNTRIES_FILE = 'african_countries.json';
const SPARQL_DIR    = 'sparql';

const TYPE_TO_SPARQL_FILE = {
  president:      'presidents.sparql',
  prime_minister: 'prime_ministers.sparql',
  minister:       'ministers.sparql',
  deputy:         'parliamentarians.sparql',
  senator:        'senators.sparql',
  military:       'presidents.sparql',
  business:       'politicians.sparql',
};

function getAfricanCountryQids() {
  try {
    const filePath = path.join(process.cwd(), 'data', COUNTRIES_FILE);
    if (fs.existsSync(filePath)) {
      const countries = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return countries.map(c => `wd:${c.id}`);
    }
  } catch (e) {}
  return ['wd:Q1009', 'wd:Q1028', 'wd:Q1033', 'wd:Q1044', 'wd:Q258', 'wd:Q948', 'wd:Q954', 'wd:Q1019'];
}

async function executeSparqlForType(type, countryQidsFormatted) {
  const fileName = TYPE_TO_SPARQL_FILE[type] || 'presidents.sparql';
  const filePath = path.join(process.cwd(), SPARQL_DIR, fileName);
  if (!fs.existsSync(filePath)) return [];

  const rawQuery = fs.readFileSync(filePath, 'utf-8');
  const query    = rawQuery.replace(/\{\{COUNTRIES\}\}/g, countryQidsFormatted);

  try {
    const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`;
    const res = await axios.get(url, {
      headers: { 'User-Agent': 'PolitiliBot/2.0 (politili.com)', Accept: 'application/sparql-results+json' },
      timeout: 30000,
    });
    const bindings = res.data?.results?.bindings || [];
    return bindings.map(b => b.person?.value?.split('/').pop()?.toUpperCase()).filter(Boolean);
  } catch (e) {
    return [];
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Méthode non autorisée.' });
  }

  const {
    defaultStatus = 'Désactivé',
    types         = ['president'],
    dryRun        = false,
  } = req.body || {};

  try {
    const countryQidsFormatted = getAfricanCountryQids().join(' ');
    const collectedQidsSet     = new Set();

    for (const type of types) {
      const qids = await executeSparqlForType(type, countryQidsFormatted);
      qids.forEach(qid => collectedQidsSet.add(qid));
    }

    const allCandidateQids = Array.from(collectedQidsSet);

    // FIX: await obligatoire — dbRead est async
    const existingLeaders = (await dbRead(KEY, FILE)) || [];
    const existingQids    = new Set(existingLeaders.map(l => (l.id || '').toUpperCase()));
    const qidsToImport    = allCandidateQids.filter(qid => !existingQids.has(qid));

    if (dryRun) {
      return res.status(200).json({
        success: true, dryRun: true,
        total_found:      allCandidateQids.length,
        already_imported: existingLeaders.length,
        to_import:        qidsToImport.length,
        message: `Scan SPARQL réussi : ${qidsToImport.length} nouveaux dirigeants disponibles.`,
      });
    }

    const BATCH_LIMIT  = 10;
    const batchToImport = qidsToImport.slice(0, BATCH_LIMIT);

    // FIX: await obligatoire
    const countriesList = (await dbRead('countries', 'countries.json')) || [];
    const countriesMap  = {};
    countriesList.forEach(c => {
      if (c.id) countriesMap[c.id.toUpperCase()] = `${c.flag ? c.flag + ' ' : ''}${c.name}`;
    });

    const newlyEnriched = [];
    const errors        = [];

    for (const qid of batchToImport) {
      try {
        const enriched = await fetchAndEnrichFromWikidata(qid, countriesMap);
        newlyEnriched.push({
          id: qid, ...enriched,
          status: defaultStatus,
          vote_enabled: true, block1_enabled: true, block2_enabled: true,
          addedAt: new Date().toISOString(), importedVia: 'admin_auto_import',
        });
      } catch (err) {
        errors.push({ qid, error: err.message });
      }
    }

    if (newlyEnriched.length > 0) {
      // FIX: ordre correct des arguments dbWrite(key, data, fallbackFile)
      await dbWrite(KEY, [...existingLeaders, ...newlyEnriched], FILE);
    }

    return res.status(200).json({
      success: true, dryRun: false,
      total_found: allCandidateQids.length,
      imported:    newlyEnriched.length,
      to_import:   Math.max(0, qidsToImport.length - newlyEnriched.length),
      imported_names: newlyEnriched.map(l => ({ id: l.id, name: l.fullname, country: l.country?.name || 'Afrique' })),
      errors,
      message: `✓ ${newlyEnriched.length} dirigeant(s) importé(s) ! (${Math.max(0, qidsToImport.length - newlyEnriched.length)} restants)`,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: `Erreur d'importation : ${err.message}` });
  }
}
