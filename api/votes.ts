import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';
import { dbRead, dbWrite } from './_db.js';

type ApiReq = IncomingMessage & {
  query: Record<string, string>;
  body?: Record<string, unknown>;
  socket?: { remoteAddress?: string };
};
type ApiRes = ServerResponse & { status: (c: number) => ApiRes; json: (d: unknown) => void; end: () => void };

interface Vote {
  id: string;
  politician_id: string;
  vote_type: 'opinion' | 'question';
  value: string;
  question_id: string | null;
  fingerprint: string;
  timestamp: string;
  age_range: string | null;
  region: string | null;
  gender: string | null;
}

interface OpinionStats {
  hearts: number;
  likes: number;
  dislikes: number;
  horrors: number;
  total: number;
}

interface QuestionStats {
  yes: number;
  no: number;
  total: number;
}

const KEY = 'votes';
const FILE = 'votes.json';

async function readVotes(): Promise<Vote[]> {
  return (await dbRead<Vote[]>(KEY, FILE)) || [];
}

async function saveVotes(votes: Vote[]): Promise<boolean> {
  return dbWrite(KEY, votes, FILE);
}

function buildFingerprint(req: ApiReq, cookieId: string): string {
  const ip =
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown';
  const ua = req.headers['user-agent'] || 'unknown';
  const raw = `${cookieId}|${ip}|${ua}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function aggregateStats(votes: Vote[], politician_id: string): { opinion: OpinionStats; questions: Record<string, QuestionStats> } {
  const filtered = votes.filter((v) => v.politician_id === politician_id);
  const opinion = filtered.filter((v) => v.vote_type === 'opinion');
  const question = filtered.filter((v) => v.vote_type === 'question');

  const opinionStats: OpinionStats = {
    hearts: opinion.filter((v) => v.value === 'hearts').length,
    likes: opinion.filter((v) => v.value === 'likes').length,
    dislikes: opinion.filter((v) => v.value === 'dislikes').length,
    horrors: opinion.filter((v) => v.value === 'horrors').length,
    total: opinion.length,
  };

  const questionStats: Record<string, QuestionStats> = {};
  question.forEach((v) => {
    if (!v.question_id) return;
    if (!questionStats[v.question_id]) {
      questionStats[v.question_id] = { yes: 0, no: 0, total: 0 };
    }
    if (v.value === 'yes') questionStats[v.question_id].yes++;
    if (v.value === 'no') questionStats[v.question_id].no++;
    questionStats[v.question_id].total++;
  });

  return { opinion: opinionStats, questions: questionStats };
}

export default async function handler(req: ApiReq, res: ApiRes): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // ─── GET /api/votes ────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    let votes = await readVotes();
    const { politician_id, period, age_range, region, gender, question_id } = req.query;

    // Direct stats for single politician
    if (politician_id && !period && !age_range && !region && !gender) {
      const stats = aggregateStats(votes, politician_id);
      res.status(200).json({ success: true, data: stats });
      return;
    }

    // Filter by period
    if (period && period !== 'all') {
      const now = new Date();
      let limitMs = 0;
      if (period === 'day')   limitMs = 24 * 60 * 60 * 1000;
      if (period === 'week')  limitMs = 7 * 24 * 60 * 60 * 1000;
      if (period === 'month') limitMs = 30 * 24 * 60 * 60 * 1000;
      if (limitMs > 0) {
        votes = votes.filter(
          (v) => v.timestamp && now.getTime() - new Date(v.timestamp).getTime() <= limitMs,
        );
      }
    }

    if (politician_id) votes = votes.filter((v) => v.politician_id === politician_id);
    if (question_id)   votes = votes.filter((v) => v.question_id === question_id);
    if (age_range)     votes = votes.filter((v) => v.age_range === age_range);
    if (region)        votes = votes.filter((v) => v.region === region);
    if (gender)        votes = votes.filter((v) => v.gender === gender);

    // Group stats per politician
    const byPolitician: Record<string, { opinion: Record<string, number>; questions: Record<string, { yes: number; no: number }> }> = {};
    votes.forEach((v) => {
      if (!byPolitician[v.politician_id]) {
        byPolitician[v.politician_id] = {
          opinion: { hearts: 0, likes: 0, dislikes: 0, horrors: 0 },
          questions: {},
        };
      }
      const pStats = byPolitician[v.politician_id];
      if (v.vote_type === 'opinion') {
        if (pStats.opinion[v.value] !== undefined) pStats.opinion[v.value]++;
      }
      if (v.vote_type === 'question' && v.question_id) {
        if (!pStats.questions[v.question_id]) {
          pStats.questions[v.question_id] = { yes: 0, no: 0 };
        }
        if (v.value === 'yes') pStats.questions[v.question_id].yes++;
        if (v.value === 'no')  pStats.questions[v.question_id].no++;
      }
    });

    const totalVotes = votes.length;
    const totalOpinion = votes.filter((v) => v.vote_type === 'opinion').length;
    const totalQuestion = votes.filter((v) => v.vote_type === 'question').length;
    const positiveOpinion = votes.filter(
      (v) => v.vote_type === 'opinion' && (v.value === 'hearts' || v.value === 'likes'),
    ).length;
    const globalApproval = totalOpinion > 0 ? Math.round((positiveOpinion / totalOpinion) * 100) : 0;

    res.status(200).json({
      success: true,
      byPolitician,
      kpis: { totalVotes, totalOpinion, totalQuestion, globalApproval },
    });
    return;
  }

  // ─── POST /api/votes → Soumettre un vote ───────────────────────────────────
  if (req.method === 'POST') {
    const { politician_id, vote_type, value, question_id, cookie_id, age_range, region, gender } =
      req.body || {};

    if (!politician_id || !vote_type || !value) {
      res.status(400).json({ success: false, message: 'Paramètres manquants (politician_id, vote_type, value).' });
      return;
    }

    const validOpinionValues = ['hearts', 'likes', 'dislikes', 'horrors'];
    const validQuestionValues = ['yes', 'no'];

    if (vote_type === 'opinion' && !validOpinionValues.includes(value as string)) {
      res.status(400).json({ success: false, message: "Valeur d'opinion invalide." });
      return;
    }
    if (vote_type === 'question' && !validQuestionValues.includes(value as string)) {
      res.status(400).json({ success: false, message: 'Valeur de question invalide (yes/no).' });
      return;
    }

    const fingerprint = buildFingerprint(req, (cookie_id as string) || 'anonymous');
    const votes = await readVotes();

    // Anti-fraude: check doublon
    const isDuplicate = votes.some((v) => {
      if (v.fingerprint !== fingerprint) return false;
      if (v.politician_id !== politician_id) return false;
      if (v.vote_type !== vote_type) return false;
      if (vote_type === 'question' && v.question_id !== question_id) return false;
      return true;
    });

    if (isDuplicate) {
      res.status(200).json({ success: false, already_voted: true, message: 'Vous avez déjà voté pour cette combinaison.' });
      return;
    }

    const newVote: Vote = {
      id: crypto.randomUUID(),
      politician_id: politician_id as string,
      vote_type: vote_type as 'opinion' | 'question',
      value: value as string,
      question_id: vote_type === 'question' ? (question_id as string) : null,
      fingerprint,
      timestamp: new Date().toISOString(),
      age_range: (age_range as string) || null,
      region: (region as string) || null,
      gender: (gender as string) || null,
    };

    votes.push(newVote);
    const saved = await saveVotes(votes);

    if (!saved) {
      res.status(500).json({
        success: false,
        message: "Erreur d'écriture : système de fichiers en lecture seule (Vercel Serverless). Activer Vercel KV dans le Dashboard.",
      });
      return;
    }

    const updatedStats = aggregateStats(votes, politician_id as string);
    res.status(200).json({ success: true, message: 'Vote enregistré.', stats: updatedStats });
    return;
  }

  res.status(405).json({ success: false, message: 'Méthode non autorisée.' });
}
