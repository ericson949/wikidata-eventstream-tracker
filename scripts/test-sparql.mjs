import axios from 'axios';
import fs from 'fs';

// Charger les pays africains
const countries = JSON.parse(fs.readFileSync('./data/african_countries.json', 'utf-8'));
const countryQids = countries.map(c => `wd:${c.id}`).join(' ');

const SPARQL_QUERY = `
SELECT DISTINCT ?person WHERE {
  VALUES ?country { ${countryQids} }
  
  # 1. Chefs d'État actuels (P35) ou chefs de gouvernement actuels (P6)
  { ?country wdt:P35 ?person . }
  UNION
  { ?country wdt:P6 ?person . }
  UNION
  # 2. Titulaires de postes officiels de Présidents / Chefs d'État d'Afrique
  {
    ?person wdt:P27 ?country .
    ?person wdt:P39 ?office .
    VALUES ?office {
      wd:Q30461 wd:Q18810062 wd:Q19158709 wd:Q48352 wd:Q17279032
      wd:Q19158914 wd:Q19109718 wd:Q21295979 wd:Q19116034 wd:Q19125297
      wd:Q113669206 wd:Q19056637 wd:Q19056087 wd:Q273884 wd:Q28003132
      wd:Q16773091 wd:Q134311805 wd:Q19114674 wd:Q28003132
    }
  }

  FILTER NOT EXISTS { ?person wdt:P570 [] }
}
LIMIT 200
`;

console.log("🔍 Test de la requête SPARQL ultra-rapide des Présidents d'Afrique...\n");

try {
  const start = Date.now();
  const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(SPARQL_QUERY)}&format=json`;
  
  const res = await axios.get(url, {
    headers: {
      'User-Agent': 'PolitiliBot/2.0 (politili.com)',
      'Accept': 'application/sparql-results+json',
    },
    timeout: 15000,
  });

  const duration = Date.now() - start;
  const bindings = res.data?.results?.bindings || [];

  console.log(`✅ ${bindings.length} Présidents / Chefs d'État réels trouvés en ${duration} ms !\n`);
  console.log("Q-IDs des 20 premiers :");
  console.log("--------------------------------------------------");

  bindings.slice(0, 20).forEach((b, i) => {
    const qid = b.person?.value?.split('/').pop();
    console.log(`${(i + 1).toString().padStart(2, ' ')}. [${qid}] https://www.wikidata.org/wiki/${qid}`);
  });

  console.log("--------------------------------------------------");
} catch (e) {
  console.error("❌ Erreur :", e.message);
}
