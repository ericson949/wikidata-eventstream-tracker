import crypto from 'crypto';
import { dbRead, dbWrite } from './_db.js';

const KEY = 'questions';
const FILE = 'questions.json';

async function readQuestions() {
  return (await dbRead(KEY, FILE)) || [];
}

async function saveQuestions(questions) {
  return await dbWrite(KEY, questions, FILE);
}

function isQuestionCurrentlyActive(q) {
  if (!q.active) return false;
  const now = new Date();
  if (q.start_date && new Date(q.start_date) > now) return false;
  if (q.end_date && new Date(q.end_date) < now) return false;
  return true;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const idParam = req.query.id || null;

  // ─── GET /api/questions ────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const questions = await readQuestions();
    const { active_only } = req.query;

    let filtered = questions;
    if (active_only === 'true') {
      filtered = filtered.filter(isQuestionCurrentlyActive);
    }

    return res.status(200).json({ success: true, data: filtered });
  }

  // ─── POST /api/questions ───────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { text, active, start_date, end_date, set_active } = req.body || {};

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Le texte de la question est requis.' });
    }

    let questions = await readQuestions();
    const makeActive = active !== false && set_active !== false;
    if (makeActive) {
      questions = questions.map(q => ({ ...q, active: false }));
    }

    const newQuestion = {
      id: crypto.randomUUID(),
      text: text.trim(),
      active: makeActive,
      start_date: start_date || new Date().toISOString().split('T')[0],
      end_date: end_date || null,
      created_at: new Date().toISOString()
    };

    questions.push(newQuestion);
    await saveQuestions(questions);

    return res.status(201).json({ success: true, data: newQuestion, message: 'Question créée avec succès.' });
  }

  // ─── PUT /api/questions/:id ────────────────────────────────────────────────
  if (req.method === 'PUT') {
    const cleanId = idParam;
    if (!cleanId) {
      return res.status(400).json({ success: false, message: 'ID de question manquant.' });
    }

    let questions = await readQuestions();
    const idx = questions.findIndex(q => q.id === cleanId);

    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'Question non trouvée.' });
    }

    const { text, active, start_date, end_date } = req.body || {};

    if (active === true) {
      questions = questions.map((q, i) => i === idx ? q : { ...q, active: false });
    }

    if (text !== undefined) questions[idx].text = text.trim();
    if (active !== undefined) questions[idx].active = Boolean(active);
    if (start_date !== undefined) questions[idx].start_date = start_date;
    if (end_date !== undefined) questions[idx].end_date = end_date || null;
    questions[idx].updated_at = new Date().toISOString();

    await saveQuestions(questions);
    return res.status(200).json({ success: true, data: questions[idx], message: 'Question mise à jour.' });
  }

  // ─── DELETE /api/questions/:id ──────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const cleanId = idParam;
    if (!cleanId) {
      return res.status(400).json({ success: false, message: 'ID de question manquant.' });
    }

    let questions = await readQuestions();
    const initial = questions.length;
    questions = questions.filter(q => q.id !== cleanId);

    if (questions.length < initial) {
      await saveQuestions(questions);
      return res.status(200).json({ success: true, message: 'Question supprimée.' });
    }

    return res.status(404).json({ success: false, message: 'Question non trouvée.' });
  }

  return res.status(405).json({ success: false, message: 'Méthode non autorisée.' });
}
