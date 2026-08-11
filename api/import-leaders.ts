import type { IncomingMessage, ServerResponse } from 'http';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { dbRead, dbWrite } from './_db.js';
import { fetchAndEnrichFromWikidata } from './tracked.js';

type ApiReq = IncomingMessage & { query: Record<string, string>; body?: Record<string, unknown> };
type ApiRes = ServerResponse & { status: (c: number) => ApiRes; json: (d: unknown) => void; end: () => void };

interface Leader {
  id: string;
  fullname?: string;
  status?: string;
  vote_enabled?: boolean;
  block1_enabled?: boolean;
  block2_enabled?: boolean;
  addedAt?: string;
  importedVia?: string;
  country?: { id: string | null; name: string };
  [key: string]: unknown;
}

interface Country {
  id: string;
  flag?: string;
  name: string;
}

const KEY = 'africa_leaders';
const FILE = 'africa_leaders.json';
const COUNTRIES_FILE = 'african_countries.json';
const SPARQL_DIR = 'sparql';

// Map des choix de l'admin vers les fichiers SPARQL réels du projet
const TYPE_TO_SPARQL_FILE: Record<string, string> = {
  president:      'presidents.sparql',
  prime_minister: 'prime_ministers.sparql',
  minister:       'ministers.sparql',
  deputy:         'parliamentarians.sparql',
  senator:        'senators.sparql',
  military:       'presidents.sparql',
  business:       'politicians.sparql',
};

// Récupérer les Q-IDs des 50+ pays africains
function getAfricanCountryQids(): string[] {
  try {
    const filePath = path.join(process.cwd(), 'data', COUNTRIES_FILE);
    if (fs.existsSync(filePath)) {
      const countries = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Country[];
      return countries.map((c) => `wd:${c.id}`);
    }
  } catch (e) {}
  return ['wd:Q1009', 'wd:Q1028', 'wd:Q1033', 'wd:Q1044', 'wd:Q258', 'wd:Q948', 'wd:Q954', 'wd:Q1019'];
}

// Exécuter une requête SPARQL réelle du dossier sparql/
async function executeSparqlForType(type: string, countryQidsFormatted: string): Promise<string[]> {
  const fileName = TYPE_TO_SPARQL_FILE[type] || 'presidents.sparql';
  const filePath = path.join(process.cwd(), SPARQL_DIR, fileName);

  if (!fs.existsSync(filePath)) return [];

  const rawQuery = fs.readFileSync(filePath, 'utf-8');
  const query = rawQuery.replace(/\{\{COUNTRIES\}\}/g, countryQidsFormatted);

  try {
    const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`;
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'PolitiliBot/2.0 (politili.com)',
        Accept: 'application/sparql-results+json',
      },
      timeout: 30000,
    });
    const bindings: any[] = res.data?.results?.bindings || [];
    return bindings
      .map((b) => b.person?.value?.split('/').pop()?.toUpperCase())
      .filter(Boolean) as string[];
  } catch (e) {
    return [];
  }
}

export default async function handler(req: ApiReq, res: ApiRes): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, message: 'Méthode non autorisée.' });
    return;
  }

  const {
    includeDeceased = false,
    includeFormer = false,
    defaultStatus = 'Désactivé',
    types = ['president'],
    dryRun = false,
  } = req.body || {};

  try {
    const countryQidsFormatted = getAfricanCountryQids().join(' ');
    const collectedQidsSet = new Set<string>();

    // 1. Exécuter les requêtes SPARQL réelles pour chaque type sélectionné
    for (const type of types as string[]) {
      const qids = await executeSparqlForType(type, countryQidsFormatted);
      qids.forEach((qid) => collectedQidsSet.add(qid));
    }

    const allCandidateQids = Array.from(collectedQidsSet);

    // 2. Charger les dirigeants existants dans africa_leaders.json
    const existingLeaders: Leader[] = (await dbRead<Leader[]>(KEY, FILE)) || [];
    const existingQids = new Set(existingLeaders.map((l) => (l.id || '').toUpperCase()));

    // Q-IDs qui restent à importer
    const qidsToImport = allCandidateQids.filter((qid) => !existingQids.has(qid));

    if (dryRun) {
      res.status(200).json({
        success: true,
        dryRun: true,
        total_found: allCandidateQids.length,
        already_imported: existingLeaders.length,
        to_import: qidsToImport.length,
        message: `Scan SPARQL Wikidata réussi : ${qidsToImport.length} nouveaux dirigeants disponibles sur un total de ${allCandidateQids.length} identifiés.`,
      });
      return;
    }

    // 3. Importer par batch (max 10 à la fois pour la réponse HTTP API admin)
    const BATCH_LIMIT = 10;
    const batchToImport = qidsToImport.slice(0, BATCH_LIMIT);

    // Map des pays pour le nom FR
    const countriesList: Country[] = (await dbRead<Country[]>('countries', 'countries.json')) || [];
    const countriesMap: Record<string, string> = {};
    countriesList.forEach((c) => {
      if (c.id) countriesMap[c.id.toUpperCase()] = `${c.flag ? c.flag + ' ' : ''}${c.name}`;
    });

    const newlyEnriched: Leader[] = [];
    const errors: Array<{ qid: string; error: string }> = [];

    for (const qid of batchToImport) {
      try {
        const enriched = await fetchAndEnrichFromWikidata(qid, countriesMap);
        const newItem: Leader = {
          id: qid,
          ...enriched,
          status: defaultStatus as string,
          vote_enabled: true,
          block1_enabled: true,
          block2_enabled: true,
          addedAt: new Date().toISOString(),
          importedVia: 'admin_auto_import',
        };
        newlyEnriched.push(newItem);
      } catch (err) {
        errors.push({ qid, error: (err as Error).message });
      }
    }

    // Sauvegarder dans la BDD JSON
    if (newlyEnriched.length > 0) {
      const updatedList = [...existingLeaders, ...newlyEnriched];
      await dbWrite(KEY, updatedList, FILE);
    }

    res.status(200).json({
      success: true,
      dryRun: false,
      total_found: allCandidateQids.length,
      imported: newlyEnriched.length,
      to_import: Math.max(0, qidsToImport.length - newlyEnriched.length),
      imported_names: newlyEnriched.map((l) => ({
        id: l.id,
        name: l.fullname,
        country: (l.country as any)?.name || 'Afrique',
      })),
      errors,
      message: `✓ ${newlyEnriched.length} dirigeant(s) importé(s) avec succès ! (${Math.max(0, qidsToImport.length - newlyEnriched.length)} restants)`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: `Erreur d'importation : ${(err as Error).message}` });
  }
}
