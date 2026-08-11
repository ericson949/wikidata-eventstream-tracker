import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Script principal du pipeline : exécute chaque fichier .sparql dans sparql/
// et fusionne tous les Q-IDs uniques dans data/politician_ids.json

const ENDPOINT = 'https://query.wikidata.org/sparql';
const SPARQL_DIR = './sparql';
const COUNTRIES_FILE = './data/african_countries.json';
const OUTPUT_FILE = './data/politician_ids.json';

const queryFiles = [
  'presidents.sparql',
  'prime_ministers.sparql',
  'ministers.sparql',
  'parliamentarians.sparql',
  'senators.sparql',
  'mayors.sparql',
  'governors.sparql',
  'party_leaders.sparql',
  'opposition_leaders.sparql',
  'candidates.sparql',
  'activists.sparql',
  'politicians_part1.sparql',
  'politicians_part2.sparql',
  'political_offices.sparql',
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 1. Charger la liste des pays d'Afrique
let countryQids = [];
if (fs.existsSync(COUNTRIES_FILE)) {
  const countries = JSON.parse(fs.readFileSync(COUNTRIES_FILE, 'utf-8'));
  countryQids = countries.map(c => `wd:${c.id}`);
}

// Fallback si african_countries.json n'est pas prêt
if (countryQids.length === 0) {
  countryQids = [
    'wd:Q1009', 'wd:Q1028', 'wd:Q1033', 'wd:Q1044', 'wd:Q258', 'wd:Q948',
    'wd:Q954', 'wd:Q1019', 'wd:Q1025', 'wd:Q1030', 'wd:Q1032', 'wd:Q1036',
    'wd:Q1037', 'wd:Q1041', 'wd:Q1042', 'wd:Q1049', 'wd:Q1050', 'wd:Q1056',
    'wd:Q1057', 'wd:Q1058', 'wd:Q974', 'wd:Q1000', 'wd:Q657', 'wd:Q929', 'wd:Q962'
  ];
}

const midPoint = Math.ceil(countryQids.length / 2);
const formattedCountries = countryQids.join(' ');
const formattedCountriesPart1 = countryQids.slice(0, midPoint).join(' ');
const formattedCountriesPart2 = countryQids.slice(midPoint).join(' ');

async function executeQuery(sparqlQuery) {
  const url = `${ENDPOINT}?query=${encodeURIComponent(sparqlQuery)}&format=json`;
  const res = await axios.get(url, {
    headers: {
      'Accept': 'application/sparql-results+json',
      'User-Agent': 'PolitiliBot/2.0 (politili.com)'
    },
    timeout: 35000
  });

  const bindings = res.data?.results?.bindings || [];
  return bindings
    .map(b => b.person?.value?.split('/').pop()?.toUpperCase())
    .filter(id => id && id.startsWith('Q'));
}

async function main() {
  console.log("=================================================");
  console.log("🚀 COLLECTE SPARQL DES IDENTIFIANTS POLITIQUES");
  console.log("=================================================\n");

  // Structure des IDs regroupés par catégorie
  const groupedIds = {};
  const allUniqueIds = new Set();

  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      const existingData = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
      if (typeof existingData === 'object' && !Array.isArray(existingData)) {
        Object.assign(groupedIds, existingData);
        Object.values(existingData).flat().forEach(id => allUniqueIds.add(id));
      } else if (Array.isArray(existingData)) {
        groupedIds.uncategorized = existingData;
        existingData.forEach(id => allUniqueIds.add(id));
      }
      console.log(`📌 Charge de ${allUniqueIds.size} Q-IDs pré-existants dans ${OUTPUT_FILE}\n`);
    } catch (e) {}
  }

  for (const fileName of queryFiles) {
    const filePath = path.join(SPARQL_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ Fichier introuvable: ${filePath}, ignoré.`);
      continue;
    }

    // Déterminer la catégorie (clé JSON)
    let categoryKey = fileName.replace('.sparql', '');
    if (categoryKey.startsWith('politicians_part')) {
      categoryKey = 'politicians';
    }

    if (!groupedIds[categoryKey]) {
      groupedIds[categoryKey] = [];
    }

    const categorySet = new Set(groupedIds[categoryKey]);

    console.log(`→ Exécution de [${fileName}] (catégorie: ${categoryKey})...`);
    let query = fs.readFileSync(filePath, 'utf-8');
    query = query
      .replace('{{COUNTRIES}}', formattedCountries)
      .replace('{{COUNTRIES_PART1}}', formattedCountriesPart1)
      .replace('{{COUNTRIES_PART2}}', formattedCountriesPart2);

    try {
      const ids = await executeQuery(query);
      const prevCatSize = categorySet.size;
      const prevTotalSize = allUniqueIds.size;

      ids.forEach(id => {
        categorySet.add(id);
        allUniqueIds.add(id);
      });

      groupedIds[categoryKey] = [...categorySet].sort();

      const newCatAdded = categorySet.size - prevCatSize;
      const newTotalAdded = allUniqueIds.size - prevTotalSize;

      console.log(`   ✓ ${ids.length} résultats | +${newCatAdded} dans [${categoryKey}] (Total catégorie: ${categorySet.size} | Total global: ${allUniqueIds.size})`);
    } catch (err) {
      console.error(`   ❌ ERREUR sur ${fileName} : ${err.message}`);
    }

    // Pause de 1.5s entre chaque requête pour éviter le bombardement SPARQL
    await sleep(1500);
  }

  const dataDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(groupedIds, null, 2), 'utf-8');

  console.log("\n=================================================");
  console.log(`✅ COLLECTE TERMINÉE : ${allUniqueIds.size} Q-IDs uniques structurés par catégories dans ${OUTPUT_FILE}`);
  console.log("=================================================\n");
}

main().catch(console.error);
