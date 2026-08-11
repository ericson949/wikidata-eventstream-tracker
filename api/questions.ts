import type { IncomingMessage, ServerResponse } from 'http';
import * as crypto from 'crypto';
import { dbRead, dbWrite } from './_db.js';

type ApiReq = IncomingMessage & { query: Record<string, string>; body?: Record<string, unknown> };
type ApiRes = ServerResponse & { status: (c: number) => ApiRes; json: (d: unknown) => void; end: () => void };

interface Question {
  id: string;
  text: string;
  active: boolean;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at?: string;
}

const KEY = 'questions';
const FILE = 'questions.json';

async function readQuestions(): Promise<Question[]> {
  return (await dbRead<Question[]>(KEY, FILE)) || [];
}

async function saveQuestions(questions: Question[]): Promise<boolean> {
  return dbWrite(KEY, questions, FILE);
}

function isQuestionCurrentlyActive(q: Question): boolean {
  if (!q.active) return false;
  const now = new Date();
  if (q.start_date && new Date(q.start_date) > now) return false;
  if (q.end_date && new Date(q.end_date) < now) return false;
  return true;
}

export default async function handler(req: ApiReq, res: ApiRes): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const idParam = req.query.id || null;

  // ─── GET /api/questions ────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const questions = await readQuestions();
    const { active_only } = req.query;
    const filtered = active_only === 'true' ? questions.filter(isQuestionCurrentlyActive) : questions;
    res.status(200).json({ success: true, data: filtered });
    return;
  }

  // ─── POST /api/questions ───────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { text, active, start_date, end_date, set_active } = req.body || {};

    if (!text || !(text as string).trim()) {
      res.status(400).json({ success: false, message: 'Le texte de la question est requis.' });
      return;
    }

    let questions = await readQuestions();
    const makeActive = active !== false && set_active !== false;
    if (makeActive) {
      questions = questions.map((q) => ({ ...q, active: false }));
    }

    const newQuestion: Question = {
      id: crypto.randomUUID(),
      text: (text as string).trim(),
      active: makeActive,
      start_date: (start_date as string) || new Date().toISOString().split('T')[0],
      end_date: (end_date as string) || null,
      created_at: new Date().toISOString(),
    };

    questions.push(newQuestion);
    await saveQuestions(questions);
    res.status(201).json({ success: true, data: newQuestion, message: 'Question créée avec succès.' });
    return;
  }

  // ─── PUT /api/questions/:id ────────────────────────────────────────────────
  if (req.method === 'PUT') {
    if (!idParam) { res.status(400).json({ success: false, message: 'ID de question manquant.' }); return; }

    let questions = await readQuestions();
    const idx = questions.findIndex((q) => q.id === idParam);

    if (idx === -1) { res.status(404).json({ success: false, message: 'Question non trouvée.' }); return; }

    const { text, active, start_date, end_date } = req.body || {};

    if (active === true) {
      questions = questions.map((q, i) => (i === idx ? q : { ...q, active: false }));
    }

    if (text !== undefined) questions[idx].text = (text as string).trim();
    if (active !== undefined) questions[idx].active = Boolean(active);
    if (start_date !== undefined) questions[idx].start_date = start_date as string;
    if (end_date !== undefined) questions[idx].end_date = (end_date as string) || null;
    questions[idx].updated_at = new Date().toISOString();

    await saveQuestions(questions);
    res.status(200).json({ success: true, data: questions[idx], message: 'Question mise à jour.' });
    return;
  }

  // ─── DELETE /api/questions/:id ──────────────────────────────────────────────
  if (req.method === 'DELETE') {
    if (!idParam) { res.status(400).json({ success: false, message: 'ID de question manquant.' }); return; }

    let questions = await readQuestions();
    const initial = questions.length;
    questions = questions.filter((q) => q.id !== idParam);

    if (questions.length < initial) {
      await saveQuestions(questions);
      res.status(200).json({ success: true, message: 'Question supprimée.' });
      return;
    }
    res.status(404).json({ success: false, message: 'Question non trouvée.' });
    return;
  }

  res.status(405).json({ success: false, message: 'Méthode non autorisée.' });
}
