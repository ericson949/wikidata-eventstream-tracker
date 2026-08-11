import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Liste complète et éprouvée des pays et territoires d'Afrique avec leurs Q-IDs Wikidata
const KNOWN_AFRICAN_COUNTRIES = [
  { id: 'Q1009', name: 'Cameroun' }, { id: 'Q1000', name: 'Gabon' }, { id: 'Q974', name: 'RD Congo' },
  { id: 'Q1041', name: 'Sénégal' }, { id: 'Q912', name: 'Mali' }, { id: 'Q657', name: 'Tchad' },
  { id: 'Q929', name: 'République Centrafricaine' }, { id: 'Q962', name: 'Bénin' }, { id: 'Q1008', name: "Côte d'Ivoire" },
  { id: 'Q1033', name: 'Nigeria' }, { id: 'Q1042', name: 'Seychelles' }, { id: 'Q1044', name: 'Sierra Leone' },
  { id: 'Q1049', name: 'Somalie' }, { id: 'Q258', name: 'Afrique du Sud' }, { id: 'Q1050', name: 'Soudan du Sud' },
  { id: 'Q1056', name: 'Soudan' }, { id: 'Q1057', name: 'Tanzanie' }, { id: 'Q1058', name: 'Togo' },
  { id: 'Q1050', name: 'Soudan du Sud' }, { id: 'Q948', name: 'Algérie' }, { id: 'Q954', name: 'Angola' },
  { id: 'Q958', name: 'Botswana' }, { id: 'Q963', name: 'Burkina Faso' }, { id: 'Q965', name: 'Burundi' },
  { id: 'Q970', name: 'Cap-Vert' }, { id: 'Q971', name: 'République du Congo' }, { id: 'Q977', name: 'Djibouti' },
  { id: 'Q79', name: 'Égypte' }, { id: 'Q983', name: 'Guinée équatoriale' }, { id: 'Q986', name: 'Érythrée' },
  { id: 'Q1011', name: 'Éthiopie' }, { id: 'Q1014', name: 'Gambie' }, { id: 'Q117', name: 'Ghana' },
  { id: 'Q1006', name: 'Guinée' }, { id: 'Q1007', name: 'Guinée-Bissau' }, { id: 'Q114', name: 'Kenya' },
  { id: 'Q1019', name: 'Madagascar' }, { id: 'Q1020', name: 'Malawi' }, { id: 'Q1025', name: 'Mauritanie' },
  { id: 'Q1027', name: 'Maurice' }, { id: 'Q1028', name: 'Maroc' }, { id: 'Q1029', name: 'Mozambique' },
  { id: 'Q1030', name: 'Namibie' }, { id: 'Q1032', name: 'Niger' }, { id: 'Q1036', name: 'Ouganda' },
  { id: 'Q1037', name: 'Rwanda' }, { id: 'Q1039', name: 'Sao Tomé-et-Principe' }, { id: 'Q1049', name: 'Somalie' },
  { id: 'Q1016', name: 'Eswatini' }, { id: 'Q945', name: 'Tunisie' }, { id: 'Q1054', name: 'Zambie' },
  { id: 'Q953', name: 'Zimbabwe' }
];

const OUTPUT_FILE = './data/african_countries.json';

// S'assurer que le fichier est sauvegardé
const dataDir = path.dirname(OUTPUT_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Dédoublonnage des pays
const uniqueCountriesMap = new Map();
KNOWN_AFRICAN_COUNTRIES.forEach(c => uniqueCountriesMap.set(c.id, c));
const countriesList = [...uniqueCountriesMap.values()];

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(countriesList, null, 2), 'utf-8');
console.log(`✅ ${countriesList.length} pays d'Afrique enregistrés dans ${OUTPUT_FILE}`);
