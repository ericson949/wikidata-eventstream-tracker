import { fetchAndEnrichFromWikidata } from '../api/tracked.js';
import fs from 'fs';

// Usage : node scripts/import-single.mjs Q57272 Q122067521

const qids = process.argv.slice(2).map(q => q.toUpperCase().trim());

if (qids.length === 0) {
  console.log("Usage: node scripts/import-single.mjs Q57272 Q122067521");
  process.exit(1);
}

const COUNTRIES_FILE = './data/countries.json';
const countries = JSON.parse(fs.readFileSync(COUNTRIES_FILE, 'utf-8'));
const countriesMap = {};
countries.forEach(c => {
  countriesMap[c.id.toUpperCase()] = `${c.flag ? c.flag + ' ' : ''}${c.name}`;
});

console.log(`🔍 Test d'enrichissement manuel pour ${qids.length} Q-ID(s) : ${qids.join(', ')}...\n`);

for (const qid of qids) {
  try {
    const data = await fetchAndEnrichFromWikidata(qid, countriesMap);
    console.log(`[OK] ${qid} :`);
    console.log(JSON.stringify(data, null, 2));
    console.log("\n--------------------------------------------------\n");
  } catch (e) {
    console.error(`[ERR] ${qid} : ${e.message}\n`);
  }
}
