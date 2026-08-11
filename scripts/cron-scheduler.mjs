import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Intervalle de 12 heures en millisecondes (2 fois par jour)
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

function runPipeline() {
  const timestamp = new Date().toISOString();
  console.log(`\n=================================================`);
  console.log(`⏰ [CRON AUTOMATIQUE] Lancement du pipeline : ${timestamp}`);
  console.log(`=================================================\n`);

  exec('npm run pipeline:all', { cwd: PROJECT_ROOT }, (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ [CRON ERROR] Échec du pipeline : ${error.message}`);
      return;
    }
    if (stderr) {
      console.warn(`⚠️ [CRON WARNING] : ${stderr}`);
    }
    console.log(stdout);
    console.log(`✅ [CRON COMPLETE] Pipeline exécuté avec succès à ${new Date().toISOString()}\n`);
  });
}

console.log("=================================================");
console.log("⏱️ PLANIFICATEUR CRON POLITILI (2 fois par jour)");
console.log("=================================================");
console.log(`ℹ️ Prochaine exécution automatique programmée dans 12 heures.`);

// 1. Exécution initiale au lancement du scheduler
runPipeline();

// 2. Planification récurrente toutes les 12h
setInterval(runPipeline, TWELVE_HOURS_MS);
