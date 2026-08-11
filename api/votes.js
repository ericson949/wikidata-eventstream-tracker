import crypto from 'crypto';
import { dbRead, dbWrite } from './_db.js';

const KEY = 'votes';
const FILE = 'votes.json';

async function readVotes() {
  return (await dbRead(KEY, FILE)) || [];
}

async function saveVotes(votes) {
  return dbWrite(KEY, votes, FILE);
}

function buildFingerprint(req, cookieId) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  const ua = req.headers['user-agent'] || 'unknown';
  return crypto.createHash('sha256').update(`${cookieId}|${ip}|${ua}`).digest('hex');
}

function aggregateStats(votes, politician_id) {
  const filtered = votes.filter(v => v.politician_id === politician_id);
  const opinion  = filtered.filter(v => v.vote_type === 'opinion');
  const question = filtered.filter(v => v.vote_type === 'question');

  const opinionStats = {
    hearts:   opinion.filter(v => v.value === 'hearts').length,
    likes:    opinion.filter(v => v.value === 'likes').length,
    dislikes: opinion.filter(v => v.value === 'dislikes').length,
    horrors:  opinion.filter(v => v.value === 'horrors').length,
    total:    opinion.length,
  };

  const questionStats = {};
  question.forEach(v => {
    if (!v.question_id) return;
    if (!questionStats[v.question_id]) questionStats[v.question_id] = { yes: 0, no: 0, total: 0 };
    if (v.value === 'yes') questionStats[v.question_id].yes++;
    if (v.value === 'no')  questionStats[v.question_id].no++;
    questionStats[v.question_id].total++;
  });

  return { opinion: opinionStats, questions: questionStats };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    let votes = await readVotes();
    const { politician_id, period, age_range, region, gender, question_id } = req.query;

    if (politician_id && !period && !age_range && !region && !gender) {
      return res.status(200).json({ success: true, data: aggregateStats(votes, politician_id) });
    }

    if (period && period !== 'all') {
      const now = new Date();
      let limitMs = 0;
      if (period === 'day')   limitMs = 24 * 60 * 60 * 1000;
      if (period === 'week')  limitMs = 7 * 24 * 60 * 60 * 1000;
      if (period === 'month') limitMs = 30 * 24 * 60 * 60 * 1000;
      if (limitMs > 0) votes = votes.filter(v => v.timestamp && (now - new Date(v.timestamp)) <= limitMs);
    }

    if (politician_id) votes = votes.filter(v => v.politician_id === politician_id);
    if (question_id)   votes = votes.filter(v => v.question_id === question_id);
    if (age_range)     votes = votes.filter(v => v.age_range === age_range);
    if (region)        votes = votes.filter(v => v.region === region);
    if (gender)        votes = votes.filter(v => v.gender === gender);

    const byPolitician = {};
    votes.forEach(v => {
      if (!byPolitician[v.politician_id]) {
        byPolitician[v.politician_id] = { opinion: { hearts: 0, likes: 0, dislikes: 0, horrors: 0 }, questions: {} };
      }
      const p = byPolitician[v.politician_id];
      if (v.vote_type === 'opinion' && p.opinion[v.value] !== undefined) p.opinion[v.value]++;
      if (v.vote_type === 'question' && v.question_id) {
        if (!p.questions[v.question_id]) p.questions[v.question_id] = { yes: 0, no: 0 };
        if (v.value === 'yes') p.questions[v.question_id].yes++;
        if (v.value === 'no')  p.questions[v.question_id].no++;
      }
    });

    const totalVotes    = votes.length;
    const totalOpinion  = votes.filter(v => v.vote_type === 'opinion').length;
    const totalQuestion = votes.filter(v => v.vote_type === 'question').length;
    const positive      = votes.filter(v => v.vote_type === 'opinion' && (v.value === 'hearts' || v.value === 'likes')).length;
    const globalApproval = totalOpinion > 0 ? Math.round((positive / totalOpinion) * 100) : 0;

    return res.status(200).json({ success: true, byPolitician, kpis: { totalVotes, totalOpinion, totalQuestion, globalApproval } });
  }

  if (req.method === 'POST') {
    const { politician_id, vote_type, value, question_id, cookie_id, age_range, region, gender } = req.body || {};

    if (!politician_id || !vote_type || !value) {
      return res.status(400).json({ success: false, message: 'Paramètres manquants (politician_id, vote_type, value).' });
    }

    if (vote_type === 'opinion' && !['hearts','likes','dislikes','horrors'].includes(value)) {
      return res.status(400).json({ success: false, message: "Valeur d'opinion invalide." });
    }
    if (vote_type === 'question' && !['yes','no'].includes(value)) {
      return res.status(400).json({ success: false, message: 'Valeur de question invalide (yes/no).' });
    }

    const fingerprint = buildFingerprint(req, cookie_id || 'anonymous');
    const votes = await readVotes();

    const isDuplicate = votes.some(v =>
      v.fingerprint === fingerprint &&
      v.politician_id === politician_id &&
      v.vote_type === vote_type &&
      (vote_type !== 'question' || v.question_id === question_id)
    );

    if (isDuplicate) {
      return res.status(200).json({ success: false, already_voted: true, message: 'Vous avez déjà voté pour cette combinaison.' });
    }

    const newVote = {
      id: crypto.randomUUID(),
      politician_id, vote_type, value,
      question_id: vote_type === 'question' ? question_id : null,
      fingerprint,
      timestamp: new Date().toISOString(),
      age_range: age_range || null,
      region: region || null,
      gender: gender || null,
    };

    votes.push(newVote);
    const saved = await saveVotes(votes);

    if (!saved) {
      return res.status(500).json({ success: false, message: "Erreur d'écriture : activez Vercel KV dans le Dashboard." });
    }

    return res.status(200).json({ success: true, message: 'Vote enregistré.', stats: aggregateStats(votes, politician_id) });
  }

  return res.status(405).json({ success: false, message: 'Méthode non autorisée.' });
}
