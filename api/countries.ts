import type { IncomingMessage, ServerResponse } from 'http';
import { dbRead, dbWrite } from './_db.js';

type ApiReq = IncomingMessage & { query: Record<string, string>; body?: Record<string, unknown> };
type ApiRes = ServerResponse & { status: (c: number) => ApiRes; json: (d: unknown) => void; end: () => void };

interface Country {
  id: string;
  name: string;
  flag?: string | null;
  region?: string;
}

const KEY = 'countries';
const FILE = 'countries.json';

async function readCountries(): Promise<Country[]> {
  return (await dbRead<Country[]>(KEY, FILE)) || [];
}

async function saveCountries(countries: Country[]): Promise<boolean> {
  return dbWrite(KEY, countries, FILE);
}

export default async function handler(req: ApiReq, res: ApiRes): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const idParam = req.query.id || null;

  if (req.method === 'GET') {
    const list = await readCountries();
    res.status(200).json({ success: true, data: list });
    return;
  }

  if (req.method === 'POST') {
    const { id, name, flag, region } = req.body || {};
    if (!id || !name) {
      res.status(400).json({ success: false, message: 'ID et Nom de pays requis.' });
      return;
    }

    const cleanId = (id as string).toUpperCase().trim();
    const countries = await readCountries();

    if (countries.some((c) => c.id.toUpperCase() === cleanId)) {
      res.status(400).json({ success: false, message: `Le pays ${cleanId} existe déjà.` });
      return;
    }

    const newCountry: Country = {
      id: cleanId,
      name: (name as string).trim(),
      flag: (flag as string) || null,
      region: (region as string) || 'Afrique',
    };

    countries.push(newCountry);
    await saveCountries(countries);
    res.status(201).json({ success: true, data: newCountry, message: 'Pays ajouté.' });
    return;
  }

  if (req.method === 'DELETE') {
    const cleanId = (idParam || (req.body?.id as string) || '').toUpperCase().trim();
    if (!cleanId) { res.status(400).json({ success: false, message: 'ID de pays manquant.' }); return; }

    let countries = await readCountries();
    const initialLen = countries.length;
    countries = countries.filter((c) => c.id.toUpperCase() !== cleanId);

    if (countries.length < initialLen) {
      await saveCountries(countries);
      res.status(200).json({ success: true, message: `Pays ${cleanId} supprimé.` });
      return;
    }
    res.status(404).json({ success: false, message: `Pays ${cleanId} non trouvé.` });
    return;
  }

  res.status(405).json({ success: false, message: 'Méthode non autorisée.' });
}
