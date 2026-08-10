import fs from 'fs';
import path from 'path';

const COUNTRIES_FILE = path.join(process.cwd(), 'data', 'countries.json');

function readCountries() {
  try {
    const raw = fs.readFileSync(COUNTRIES_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveCountries(list) {
  try {
    fs.writeFileSync(COUNTRIES_FILE, JSON.stringify(list, null, 2), 'utf-8');
    return true;
  } catch (e) {
    return false;
  }
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');

  if (req.method === 'OPTIONS') return res.status(200).end();

  let countries = readCountries();

  if (req.method === 'GET') {
    return res.status(200).json({ success: true, data: countries });
  }

  if (req.method === 'POST') {
    const { id, name, flag, region } = req.body || {};
    const cleanId = (id || '').toUpperCase().trim();

    if (!cleanId || !name) {
      return res.status(400).json({ success: false, message: 'Identifiant Q-ID et nom de pays requis.' });
    }

    if (countries.some(c => c.id.toUpperCase() === cleanId)) {
      return res.status(400).json({ success: false, message: `Le pays ${name} (${cleanId}) existe déjà.` });
    }

    const newCountry = {
      id: cleanId,
      name,
      flag: flag || '🌍',
      region: region || 'Afrique'
    };

    countries.push(newCountry);
    saveCountries(countries);
    return res.status(200).json({ success: true, country: newCountry, message: `Pays ${name} ajouté avec succès.` });
  }

  return res.status(405).json({ success: false, message: 'Méthode non autorisée.' });
}
