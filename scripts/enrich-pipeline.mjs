import { fetchAndEnrichFromWikidata } from '../api/tracked.js';
import fs from 'fs';
import path from 'path';

// Script principal d'enrichissement par lots (Batches)
// Lit data/politician_ids.json -> enrichit -> sauve data/africa_leaders.json

const IDS_FILE = './data/politician_ids.json';
const OUTPUT_FILE = './data/africa_leaders.json';
const COUNTRIES_FILE = './data/countries.json';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Analyse des arguments CLI (npm run enrich presidents / node enrich-pipeline.mjs ministers) ───
const args = process.argv.slice(2);
let targetType = 'all';

for (const arg of args) {
  const cleanArg = arg.replace(/^--?/, '').replace(/^type=/, '').trim();
  if (cleanArg && cleanArg !== 'all') {
    targetType = cleanArg;
    break;
  }
}

async function main() {
  console.log("=================================================");
  console.log("💎 ENRICHISSEMENT BILINGUE DES POLITICIENS (Batches)");
  console.log("=================================================\n");

  if (!fs.existsSync(IDS_FILE)) {
    console.error(`❌ Fichier ${IDS_FILE} introuvable ! Lancez d'abord "npm run collect:ids".`);
    process.exit(1);
  }

  const rawData = JSON.parse(fs.readFileSync(IDS_FILE, 'utf-8'));
  let idsToProcess = [];

  if (typeof rawData === 'object' && !Array.isArray(rawData)) {
    const availableCategories = Object.keys(rawData);
    if (targetType === 'all') {
      idsToProcess = [...new Set(Object.values(rawData).flat())];
      console.log(`📌 Mode GLOBAL : Tous les types (${availableCategories.join(', ')})`);
    } else if (rawData[targetType]) {
      idsToProcess = rawData[targetType];
      console.log(`🎯 Mode CIBLÉ : Catégorie [${targetType}] (${idsToProcess.length} Q-IDs)`);
    } else {
      console.warn(`⚠️ Catégorie "${targetType}" introuvable dans ${IDS_FILE}.`);
      console.warn(`👉 Catégories disponibles : ${availableCategories.join(', ')}`);
      process.exit(1);
    }
  } else if (Array.isArray(rawData)) {
    idsToProcess = rawData;
  }

  console.log(`📌 ${idsToProcess.length} Q-IDs à traiter.`);

  // Charger les leaders existants s'il y en a
  const existingMap = new Map();
  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      const currentLeaders = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
      currentLeaders.forEach(l => {
        if (l.id) existingMap.set(l.id.toUpperCase(), l);
      });
      console.log(`ℹ️ ${existingMap.size} profils déjà enrichis présents dans ${OUTPUT_FILE}.`);
    } catch (e) {}
  }

  // Map des pays
  let countriesMap = {};
  if (fs.existsSync(COUNTRIES_FILE)) {
    const countries = JSON.parse(fs.readFileSync(COUNTRIES_FILE, 'utf-8'));
    countries.forEach(c => {
      countriesMap[c.id.toUpperCase()] = `${c.flag ? c.flag + ' ' : ''}${c.name}`;
    });
  }

  const BATCH_SIZE = 5;
  const DELAY_BETWEEN_BATCHES_MS = 1200;

  // Filtrer les Q-IDs qui ne sont pas encore enrichis (ou forcer le refresh si besoin)
  const remainingIds = idsToProcess.filter(id => !existingMap.has(id.toUpperCase()));
  console.log(`🎯 ${remainingIds.length} nouveaux Q-IDs nécessitent un enrichissement.\n`);

  let countSuccess = 0;
  let countError = 0;

  for (let i = 0; i < remainingIds.length; i += BATCH_SIZE) {
    const batch = remainingIds.slice(i, i + BATCH_SIZE);
    const progress = Math.min(i + BATCH_SIZE, remainingIds.length);
    console.log(`📦 Batch [${progress}/${remainingIds.length}] (${batch.join(', ')})`);

    await Promise.all(batch.map(async (qid) => {
      try {
        const enriched = await fetchAndEnrichFromWikidata(qid, countriesMap);
        if (enriched.is_older_than_20_years) {
          console.log(`   ⏩ [IGNORÉ - Poste > 20 ans] ${qid} => ${enriched.fullname} (Fin: ${enriched.latest_end_year})`);
          return;
        }
        const newItem = {
          id: qid,
          ...enriched,
          status: 'Activé',
          vote_enabled: true,
          block1_enabled: true,
          block2_enabled: true,
          addedAt: new Date().toISOString(),
          importedVia: 'pipeline_batch',
        };
        existingMap.set(qid, newItem);
        countSuccess++;
        console.log(`   ✓ [OK] ${qid} => ${enriched.fullname} (${enriched.country?.name || 'Afrique'})`);
      } catch (err) {
        countError++;
        console.error(`   ❌ [ERR] ${qid} => ${err.message}`);
      }
    }));

    // Sauvegarde intermédiaire à chaque batch pour éviter tout risque de perte de données
    const updatedArray = [...existingMap.values()];
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(updatedArray, null, 2), 'utf-8');

    if (i + BATCH_SIZE < remainingIds.length) {
      await sleep(DELAY_BETWEEN_BATCHES_MS);
    }
  }

  console.log("\n=================================================");
  console.log(`✅ ENRICHISSEMENT TERMINÉ !`);
  console.log(`📊 Nouveaux enrichis : ${countSuccess} | Erreurs : ${countError}`);
  console.log(`💾 Base totale dans ${OUTPUT_FILE} : ${existingMap.size} profils.`);
  console.log("=================================================\n");
}

main().catch(console.error);
