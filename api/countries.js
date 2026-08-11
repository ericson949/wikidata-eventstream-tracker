import { dbRead, dbWrite } from './_db.js';

const KEY = 'countries';
const FILE = 'countries.json';

async function readCountries() {
  return (await dbRead(KEY, FILE)) || [];
}

async function saveCountries(countries) {
  return dbWrite(KEY, countries, FILE);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const idParam = req.query.id || null;

  if (req.method === 'GET') {
    const list = await readCountries();
    return res.status(200).json({ success: true, data: list });
  }

  if (req.method === 'POST') {
    const { id, name, flag, region } = req.body || {};
    if (!id || !name) {
      return res.status(400).json({ success: false, message: 'ID et Nom de pays requis.' });
    }

    const cleanId = id.toUpperCase().trim();
    const countries = await readCountries();

    if (countries.some(c => c.id.toUpperCase() === cleanId)) {
      return res.status(400).json({ success: false, message: `Le pays ${cleanId} existe déjà.` });
    }

    const newCountry = { id: cleanId, name: name.trim(), flag: flag || null, region: region || 'Afrique' };
    countries.push(newCountry);
    await saveCountries(countries);
    return res.status(201).json({ success: true, data: newCountry, message: 'Pays ajouté.' });
  }

  if (req.method === 'DELETE') {
    const cleanId = (idParam || req.body?.id || '').toUpperCase().trim();
    if (!cleanId) return res.status(400).json({ success: false, message: 'ID de pays manquant.' });

    let countries = await readCountries();
    const initialLen = countries.length;
    countries = countries.filter(c => c.id.toUpperCase() !== cleanId);

    if (countries.length < initialLen) {
      await saveCountries(countries);
      return res.status(200).json({ success: true, message: `Pays ${cleanId} supprimé.` });
    }
    return res.status(404).json({ success: false, message: `Pays ${cleanId} non trouvé.` });
  }

  return res.status(405).json({ success: false, message: 'Méthode non autorisée.' });
}
