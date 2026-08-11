import axios from 'axios';
import fs from 'fs';

const FILE = './data/africa_leaders.json';
const COUNTRIES_FILE = './data/african_countries.json';

async function main() {
  console.log("=================================================");
  console.log("🔧 RE-CALCUL EXACT DES ÉTATS (En exercice vs Ancien)");
  console.log("=================================================\n");

  if (!fs.existsSync(FILE)) {
    console.error(`❌ Fichier ${FILE} introuvable.`);
    process.exit(1);
  }

  // 1. Récupérer les pays africains
  let countryQids = [];
  if (fs.existsSync(COUNTRIES_FILE)) {
    const countries = JSON.parse(fs.readFileSync(COUNTRIES_FILE, 'utf-8'));
    countryQids = countries.map(c => `wd:${c.id}`);
  }

  const formattedCountries = countryQids.join(' ');

  // 2. SPARQL : Chefs d'État (P35) & Chefs de Gouvernement (P6) actuels
  const SPARQL_QUERY = `
  SELECT DISTINCT ?person WHERE {
    VALUES ?country { ${formattedCountries} }
    { ?country wdt:P35 ?person . }
    UNION
    { ?country wdt:P6 ?person . }
    FILTER NOT EXISTS { ?person wdt:P570 [] }
  }
  `;

  console.log("🔍 Récupération des Q-IDs des Dirigeants réellement en exercice via Wikidata...");
  const activeQids = new Set();
  
  try {
    const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(SPARQL_QUERY)}&format=json`;
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'PolitiliBot/2.0 (politili.com)',
        'Accept': 'application/sparql-results+json',
      },
      timeout: 25000,
    });
    const bindings = res.data?.results?.bindings || [];
    bindings.forEach(b => {
      const qid = b.person?.value?.split('/').pop();
      if (qid) activeQids.add(qid.toUpperCase());
    });
    console.log(`✅ ${activeQids.size} dirigeants identifiés comme réellement EN EXECICE.\n`);
  } catch (e) {
    console.error("❌ Erreur SPARQL :", e.message);
    process.exit(1);
  }

  // 3. Charger et corriger africa_leaders.json
  const leaders = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
  let activeCount = 0;
  let formerCount = 0;
  let deceasedCount = 0;

  const updatedLeaders = leaders.map(leader => {
    const qid = (leader.id || '').toUpperCase();
    let newState = 'Ancien';

    if (leader.death_date) {
      newState = 'Décédé';
      deceasedCount++;
    } else if (activeQids.has(qid)) {
      newState = 'En exercice';
      activeCount++;
    } else {
      newState = 'Ancien';
      formerCount++;
    }

    return {
      ...leader,
      actor_state: newState
    };
  });

  fs.writeFileSync(FILE, JSON.stringify(updatedLeaders, null, 2), 'utf-8');

  console.log("=================================================");
  console.log(`✅ MISE À JOUR TERMINÉE dans ${FILE} !`);
  console.log(`🟢 En exercice : ${activeCount}`);
  console.log(`⚪ Anciens      : ${formerCount}`);
  console.log(`⚰️  Décédés     : ${deceasedCount}`);
  console.log("=================================================\n");
}

main();
