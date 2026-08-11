import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Script de collecte Wikimedia Commons : parcourt Category:Politicians of Africa
// et ses sous-catégories pour résoudre les Q-IDs Wikidata associés.

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const OUTPUT_FILE = './data/politician_ids.json';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getCategoryMembers(categoryTitle, cmcontinue) {
  const params = {
    action: 'query',
    list: 'categorymembers',
    cmtitle: categoryTitle,
    cmlimit: '500',
    format: 'json',
    origin: '*'
  };
  if (cmcontinue) params.cmcontinue = cmcontinue;

  const res = await axios.get(COMMONS_API, { params, timeout: 15000 });
  return res.data;
}

// Convertit les titres de catégories ou pages Commons en Q-IDs Wikidata
async function getWikidataIdsFromTitles(titles) {
  if (titles.length === 0) return [];
  const qids = [];
  const BATCH_SIZE = 50;

  for (let i = 0; i < titles.length; i += BATCH_SIZE) {
    const batch = titles.slice(i, i + BATCH_SIZE);
    try {
      const res = await axios.get(WIKIDATA_API, {
        params: {
          action: 'wbgetentities',
          sites: 'commonswiki',
          titles: batch.join('|'),
          props: 'id',
          format: 'json'
        },
        timeout: 15000
      });
      const entities = res.data?.entities || {};
      Object.values(entities).forEach((ent) => {
        if (ent.id && ent.id.startsWith('Q')) {
          qids.push(ent.id.toUpperCase());
        }
      });
    } catch (e) {}
    await sleep(300);
  }

  return qids;
}

async function crawlCategory(categoryTitle, visited = new Set(), maxDepth = 2, currentDepth = 0) {
  if (visited.has(categoryTitle) || currentDepth > maxDepth) {
    return [];
  }
  visited.add(categoryTitle);

  console.log(` → [Commons Depth ${currentDepth}] Exploration : ${categoryTitle}`);
  const members = [];
  let continuation = undefined;

  try {
    do {
      const data = await getCategoryMembers(categoryTitle, continuation);
      const catMembers = data.query?.categorymembers || [];
      members.push(...catMembers);
      continuation = data.continue?.cmcontinue;
      if (continuation) await sleep(400);
    } while (continuation);
  } catch (e) {
    console.warn(`   ⚠️ Erreur sur la catégorie ${categoryTitle}: ${e.message}`);
    return [];
  }

  const subcategories = members.filter(m => m.ns === 14); // ns 14 = Subcategories
  const pages = members.filter(m => m.ns === 0 || m.ns === 14);

  // Parcourir les sous-catégories jusqu'à la profondeur max
  for (const subcat of subcategories.slice(0, 10)) { // Limite 10 sous-catégories par niveau
    const children = await crawlCategory(subcat.title, visited, maxDepth, currentDepth + 1);
    pages.push(...children);
  }

  return pages;
}

async function main() {
  console.log("=================================================");
  console.log("📷 COLLECTE WIKIMEDIA COMMONS (Politicians of Africa)");
  console.log("=================================================\n");

  const visited = new Set();
  const rawPages = await crawlCategory('Category:Politicians of Africa', visited, 2, 0);

  console.log(`\n📦 Total d'éléments Commons trouvés : ${rawPages.length}`);

  const pageTitles = [...new Set(rawPages.map(p => p.title))];
  console.log(`🔄 Résolution des Q-IDs Wikidata pour ${pageTitles.length} pages Commons...`);

  const fetchedQids = await getWikidataIdsFromTitles(pageTitles);
  console.log(`✨ ${fetchedQids.length} Q-IDs Wikidata résolus depuis Commons !`);

  // Fusionner avec politician_ids.json
  let groupedData = {};
  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      const existing = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
      if (typeof existing === 'object' && !Array.isArray(existing)) {
        groupedData = existing;
      }
    } catch (e) {}
  }

  const commonsSet = new Set(groupedData.commons || []);
  const initialCount = commonsSet.size;
  fetchedQids.forEach(qid => commonsSet.add(qid));
  const newCount = commonsSet.size - initialCount;

  groupedData.commons = [...commonsSet].sort();

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(groupedData, null, 2), 'utf-8');

  console.log("\n=================================================");
  console.log(`✅ FUSION COMMONS TERMINÉE : +${newCount} nouveaux Q-IDs enregistrés sous la clé "commons" !`);
  console.log("=================================================\n");
}

main().catch(console.error);
