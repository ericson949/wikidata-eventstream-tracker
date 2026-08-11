import axios from 'axios';
import fs from 'fs';

const LEADERS_FILE = './data/africa_leaders.json';
const COUNTRIES_FILE = './data/african_countries.json';

async function main() {
  console.log("=================================================");
  console.log("🎯 DÉTERMINATION STRICTE : 1 PRÉSIDENT / CHEF D'ÉTAT PAR PAYS");
  console.log("=================================================\n");

  if (!fs.existsSync(LEADERS_FILE) || !fs.existsSync(COUNTRIES_FILE)) {
    console.error("❌ Fichiers de données introuvables.");
    process.exit(1);
  }

  const countries = JSON.parse(fs.readFileSync(COUNTRIES_FILE, 'utf-8'));
  const countryQids = countries.map(c => `wd:${c.id}`).join(' ');

  // SPARQL : Récupération des Chefs d'État (P35) officiels actuels des pays africains
  const SPARQL_QUERY = `
  SELECT DISTINCT ?country ?person WHERE {
    VALUES ?country { ${countryQids} }
    
    # 1. Chef d'État officiel du pays (P35)
    ?country wdt:P35 ?person .
    
    # Vivants uniquement
    FILTER NOT EXISTS { ?person wdt:P570 [] }
  }
  `;

  console.log("🔍 Récupération en 1 seule passe des Chefs d'État actuels via Wikidata...");
  const activePresidentsSet = new Set();
  
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
      if (qid) activePresidentsSet.add(qid.toUpperCase());
    });
    
    console.log(`✅ ${activePresidentsSet.size} Chefs d'État uniques actuels identifiés sur l'ensemble des pays d'Afrique !\n`);
  } catch (e) {
    console.error("❌ Erreur SPARQL :", e.message);
    process.exit(1);
  }

  // Mettre à jour africa_leaders.json
  const leaders = JSON.parse(fs.readFileSync(LEADERS_FILE, 'utf-8'));
  let countActive = 0;
  let countFormer = 0;
  let countDeceased = 0;

  const updatedLeaders = leaders.map(l => {
    const qid = (l.id || '').toUpperCase();
    let state = 'Ancien';

    if (l.death_date) {
      state = 'Décédé';
      countDeceased++;
    } else if (activePresidentsSet.has(qid)) {
      state = 'En exercice';
      countActive++;
    } else {
      state = 'Ancien';
      countFormer++;
    }

    return {
      ...l,
      actor_state: state
    };
  });

  fs.writeFileSync(LEADERS_FILE, JSON.stringify(updatedLeaders, null, 2), 'utf-8');

  console.log("=================================================");
  console.log(`✅ BASE DE DONNÉES MISE À JOUR : ${LEADERS_FILE}`);
  console.log(`🟢 Présidents en exercice : ${countActive} (exactement les Chefs d'État actuels)`);
  console.log(`⚪ Anciens Présidents/Dirigeants : ${countFormer}`);
  console.log(`⚰️  Décédés : ${countDeceased}`);
  console.log("=================================================\n");
}

main();
