import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { dbRead, dbWrite } from './_db.js';
import { fetchAndEnrichFromWikidata } from './tracked.js';

const KEY = 'africa_leaders';
const FILE = 'africa_leaders.json';
const IDS_FILE = 'politician_ids.json';
const COUNTRIES_FILE = 'african_countries.json';

// Mapping des types frontend vers les clés du fichier politician_ids.json ou SPARQL
const TYPE_MAPPING = {
  president: ['presidents', 'president'],
  prime_minister: ['prime_ministers', 'prime_minister'],
  minister: ['ministers', 'minister'],
  deputy: ['parliamentarians', 'deputy'],
  senator: ['senators', 'senator'],
  military: ['military'],
  business: ['business'],
};

// Charge la liste des pays d'Afrique (Q-IDs)
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

// Requête SPARQL directe sur Wikidata si besoin
async function fetchQidsFromWikidata(types) {
  const countryQids = getAfricanCountryQids().join(' ');
  const p39Qids = ['wd:Q30461', 'wd:Q18810062', 'wd:Q48352', 'wd:Q1006876', 'wd:Q83307', 'wd:Q1074044', 'wd:Q1541400', 'wd:Q82955'];

  const sparql = `
  SELECT DISTINCT ?person WHERE {
    VALUES ?country { ${countryQids} }
    
    # 1. Chefs d'État actuels (P35) ou chefs de gouvernement (P6)
    { ?country wdt:P35 ?person . }
    UNION
    { ?country wdt:P6 ?person . }
    UNION
    # 2. Rôles et fonctions politiques principales des citoyens d'Afrique
    {
      ?person wdt:P27 ?country .
      ?person wdt:P39 ?office .
      VALUES ?office { ${p39Qids.join(' ')} }
    }
    FILTER NOT EXISTS { ?person wdt:P570 [] }
  }
  `;

  try {
    const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`;
    const res = await axios.get(url, {
      headers: { 'User-Agent': 'PolitiliBot/2.0', 'Accept': 'application/sparql-results+json' },
      timeout: 25000,
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
    includeDeceased = false,
    includeFormer = false,
    defaultStatus = 'Désactivé',
    types = ['president'],
    dryRun = false,
  } = req.body || {};

  try {
    // 1. Lire data/politician_ids.json s'il existe
    let candidateQids = new Set();
    const idsPath = path.join(process.cwd(), 'data', IDS_FILE);

    if (fs.existsSync(idsPath)) {
      try {
        const rawIdsData = JSON.parse(fs.readFileSync(idsPath, 'utf-8'));
        if (typeof rawIdsData === 'object' && !Array.isArray(rawIdsData)) {
          for (const userType of types) {
            const mappedKeys = TYPE_MAPPING[userType] || [userType];
            for (const key of mappedKeys) {
              if (rawIdsData[key] && Array.isArray(rawIdsData[key])) {
                rawIdsData[key].forEach(id => candidateQids.add(id.toUpperCase()));
              }
            }
          }
        } else if (Array.isArray(rawIdsData)) {
          rawIdsData.forEach(id => candidateQids.add(id.toUpperCase()));
        }
      } catch (e) {}
    }

    // Si la liste locale est vide, exécuter le scan Wikidata SPARQL
    if (candidateQids.size === 0) {
      const liveQids = await fetchQidsFromWikidata(types);
      liveQids.forEach(id => candidateQids.add(id.toUpperCase()));
    }

    const allCandidateQids = Array.from(candidateQids);

    // 2. Charger les dirigeants existants dans africa_leaders.json
    const existingLeaders = dbRead(KEY, FILE) || [];
    const existingQids = new Set(existingLeaders.map(l => (l.id || '').toUpperCase()));

    // Q-IDs qui restent à importer
    const qidsToImport = allCandidateQids.filter(qid => !existingQids.has(qid));

    if (dryRun) {
      return res.status(200).json({
        success: true,
        dryRun: true,
        total_found: allCandidateQids.length,
        already_imported: existingLeaders.length,
        to_import: qidsToImport.length,
        message: `Scan terminé : ${qidsToImport.length} nouveaux dirigeants disponibles sur un total de ${allCandidateQids.length} identifiés.`,
      });
    }

    // 3. Importer par batch (max 10 à la fois pour la réponse HTTP API admin)
    const BATCH_LIMIT = 10;
    const batchToImport = qidsToImport.slice(0, BATCH_LIMIT);

    // Map des pays pour le nom FR
    const countriesList = dbRead('countries', 'countries.json') || [];
    const countriesMap = {};
    countriesList.forEach(c => {
      if (c.id) countriesMap[c.id.toUpperCase()] = `${c.flag ? c.flag + ' ' : ''}${c.name}`;
    });

    const newlyEnriched = [];
    const errors = [];

    for (const qid of batchToImport) {
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
          importedVia: 'admin_auto_import',
        };
        newlyEnriched.push(newItem);
      } catch (err) {
        errors.push({ qid, error: err.message });
      }
    }

    // Sauvegarder dans la BDD JSON
    if (newlyEnriched.length > 0) {
      const updatedList = [...existingLeaders, ...newlyEnriched];
      dbWrite(KEY, FILE, updatedList);
    }

    return res.status(200).json({
      success: true,
      dryRun: false,
      total_found: allCandidateQids.length,
      imported: newlyEnriched.length,
      to_import: Math.max(0, qidsToImport.length - newlyEnriched.length),
      imported_names: newlyEnriched.map(l => ({ id: l.id, name: l.fullname, country: l.country?.name || 'Afrique' })),
      errors,
      message: `✓ ${newlyEnriched.length} dirigeant(s) importé(s) avec succès ! (${Math.max(0, qidsToImport.length - newlyEnriched.length)} restants)`,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: `Erreur d'importation : ${err.message}`,
    });
  }
}
