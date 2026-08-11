import { fetchAndEnrichFromWikidata } from '../api/tracked.js';
import fs from 'fs';

const DATA_FILE = './data/africa_leaders.json';
const COUNTRIES_FILE = './data/countries.json';

const items = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
const countries = JSON.parse(fs.readFileSync(COUNTRIES_FILE, 'utf-8'));
const countriesMap = {};
countries.forEach(c => {
  countriesMap[c.id.toUpperCase()] = `${c.flag ? c.flag + ' ' : ''}${c.name}`;
});

console.log(`Enrichissement de ${items.length} politiciens depuis Wikidata (parallele)...`);

const results = await Promise.all(items.map(async (item) => {
  try {
    const enriched = await fetchAndEnrichFromWikidata(item.id, countriesMap);
    console.log(`  [OK]   ${item.id} => ${enriched.fullname} | Wiki: ${enriched.source_url}`);
    return {
      id: item.id,
      ...enriched,
      status: item.status || 'Active',
      vote_enabled: item.vote_enabled !== false,
      block1_enabled: item.block1_enabled !== false,
      block2_enabled: item.block2_enabled !== false,
      addedAt: item.addedAt || new Date().toISOString()
    };
  } catch (e) {
    console.warn(`  [ERR]  ${item.id} => ${e.message}`);
    return item;
  }
}));

fs.writeFileSync(DATA_FILE, JSON.stringify(results, null, 2), 'utf-8');
const enrichedCount = results.filter(r => r.enrichedAt).length;
console.log(`\nDone! BDD mise a jour: ${enrichedCount}/${results.length} entrees enrichies.`);
