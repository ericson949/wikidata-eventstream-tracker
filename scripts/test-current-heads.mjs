import axios from 'axios';
import fs from 'fs';

// Charger les pays africains
const countries = JSON.parse(fs.readFileSync('./data/african_countries.json', 'utf-8'));
const countryQids = countries.map(c => `wd:${c.id}`).join(' ');

// SPARQL pour récupérer UNIQUEMENT les Chefs d'État (P35) et Chefs de Gouvernement (P6) ACTUELS des pays d'Afrique
const SPARQL_QUERY = `
SELECT DISTINCT ?person ?personLabel ?countryLabel ?role WHERE {
  VALUES ?country { ${countryQids} }
  
  {
    ?country wdt:P35 ?person .
    BIND("Chef d'État" AS ?role)
  }
  UNION
  {
    ?country wdt:P6 ?person .
    BIND("Chef de Gouvernement" AS ?role)
  }

  FILTER NOT EXISTS { ?person wdt:P570 [] }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en" }
}
`;

console.log("🔍 Récupération des Présidents et Chefs de Gouvernement ACTUELS d'Afrique...\n");

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

  console.log(`✅ ${bindings.length} Dirigeants ACTUELS en exercice trouvés en ${duration} ms !\n`);
  console.log("--------------------------------------------------");
  bindings.forEach((b, i) => {
    const qid = b.person?.value?.split('/').pop();
    const name = b.personLabel?.value || qid;
    const country = b.countryLabel?.value || '';
    const role = b.role?.value || '';
    console.log(`${(i + 1).toString().padStart(2, ' ')}. [${qid}] ${name} (${role} - ${country})`);
  });
  console.log("--------------------------------------------------");
} catch (e) {
  console.error("❌ Erreur :", e.message);
}
