import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const VOTES_FILE = path.join(process.cwd(), 'data', 'votes.json');

function readVotes() {
  try {
    const raw = fs.readFileSync(VOTES_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveVotes(votes) {
  try {
    fs.writeFileSync(VOTES_FILE, JSON.stringify(votes, null, 2), 'utf-8');
    return true;
  } catch (e) {
    return false;
  }
}

function buildFingerprint(req, cookieId) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  const ua = req.headers['user-agent'] || 'unknown';
  const raw = `${cookieId}|${ip}|${ua}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function aggregateStats(votes, politician_id) {
  const filtered = votes.filter(v => v.politician_id === politician_id);
  const opinion = filtered.filter(v => v.vote_type === 'opinion');
  const question = filtered.filter(v => v.vote_type === 'question');

  const opinionStats = {
    hearts: opinion.filter(v => v.value === 'hearts').length,
    likes: opinion.filter(v => v.value === 'likes').length,
    dislikes: opinion.filter(v => v.value === 'dislikes').length,
    horrors: opinion.filter(v => v.value === 'horrors').length,
    total: opinion.length
  };

  // Group question stats per question_id
  const questionMap = {};
  question.forEach(v => {
    if (!questionMap[v.question_id]) {
      questionMap[v.question_id] = { yes: 0, no: 0, total: 0 };
    }
    if (v.value === 'yes') questionMap[v.question_id].yes++;
    else if (v.value === 'no') questionMap[v.question_id].no++;
    questionMap[v.question_id].total++;
  });

  return { opinion: opinionStats, questions: questionMap };
}

function filterVotesByPeriod(votes, period) {
  if (!period || period === 'all') return votes;
  const now = new Date();
  let cutoff = new Date();
  if (period === 'day') cutoff.setDate(now.getDate() - 1);
  else if (period === 'week') cutoff.setDate(now.getDate() - 7);
  else if (period === 'month') cutoff.setMonth(now.getMonth() - 1);
  return votes.filter(v => new Date(v.timestamp) >= cutoff);
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-vote-cookie');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ─── GET /api/votes → stats agrégées ───────────────────────────────────────
  if (req.method === 'GET') {
    const { politician_id, period, question_id, age_range, region, gender } = req.query;
    let votes = readVotes();

    // Period filter
    votes = filterVotesByPeriod(votes, period);

    // Politician filter
    if (politician_id) {
      votes = votes.filter(v => v.politician_id === politician_id);
    }

    // Question filter
    if (question_id) {
      votes = votes.filter(v => v.question_id === question_id || v.vote_type !== 'question');
    }

    // Demographic filters
    if (age_range) votes = votes.filter(v => v.age_range === age_range);
    if (region) votes = votes.filter(v => v.region === region);
    if (gender) votes = votes.filter(v => v.gender === gender);

    if (politician_id) {
      // Return stats for one politician
      return res.status(200).json({ success: true, data: aggregateStats(votes, politician_id) });
    }

    // Return aggregated stats for all politicians
    const politicianIds = [...new Set(votes.map(v => v.politician_id))];
    const allStats = {};
    politicianIds.forEach(pid => {
      allStats[pid] = aggregateStats(votes, pid);
    });

    // Global KPIs
    const totalVotes = votes.length;
    const totalOpinion = votes.filter(v => v.vote_type === 'opinion').length;
    const totalQuestion = votes.filter(v => v.vote_type === 'question').length;
    const positiveOpinion = votes.filter(v => v.vote_type === 'opinion' && (v.value === 'hearts' || v.value === 'likes')).length;
    const globalApproval = totalOpinion > 0 ? Math.round((positiveOpinion / totalOpinion) * 100) : 0;

    return res.status(200).json({
      success: true,
      kpis: { totalVotes, totalOpinion, totalQuestion, globalApproval },
      byPolitician: allStats
    });
  }

  // ─── POST /api/votes → enregistrer un vote ─────────────────────────────────
  if (req.method === 'POST') {
    const {
      politician_id,
      vote_type,   // 'opinion' | 'question'
      value,       // 'hearts' | 'likes' | 'dislikes' | 'horrors' | 'yes' | 'no'
      question_id, // required if vote_type === 'question'
      cookie_id,   // UUID côté client
      age_range,   // optional demographic
      region,      // optional demographic
      gender       // optional demographic
    } = req.body || {};

    if (!politician_id || !vote_type || !value) {
      return res.status(400).json({ success: false, message: 'politician_id, vote_type et value sont requis.' });
    }

    if (vote_type === 'question' && !question_id) {
      return res.status(400).json({ success: false, message: 'question_id requis pour un vote de type question.' });
    }

    const validOpinionValues = ['hearts', 'likes', 'dislikes', 'horrors'];
    const validQuestionValues = ['yes', 'no'];
    if (vote_type === 'opinion' && !validOpinionValues.includes(value)) {
      return res.status(400).json({ success: false, message: 'Valeur d\'opinion invalide.' });
    }
    if (vote_type === 'question' && !validQuestionValues.includes(value)) {
      return res.status(400).json({ success: false, message: 'Valeur de question invalide (oui/non).' });
    }

    const fingerprint = buildFingerprint(req, cookie_id || 'anonymous');
    const votes = readVotes();

    // Anti-fraude: check doublon (politician_id + vote_type + [question_id si type=question])
    const isDuplicate = votes.some(v => {
      if (v.fingerprint !== fingerprint) return false;
      if (v.politician_id !== politician_id) return false;
      if (v.vote_type !== vote_type) return false;
      if (vote_type === 'question' && v.question_id !== question_id) return false;
      return true;
    });

    if (isDuplicate) {
      return res.status(200).json({ success: false, already_voted: true, message: 'Vous avez déjà voté pour cette combinaison.' });
    }

    const newVote = {
      id: crypto.randomUUID(),
      politician_id,
      vote_type,
      value,
      question_id: vote_type === 'question' ? question_id : null,
      fingerprint,
      timestamp: new Date().toISOString(),
      age_range: age_range || null,
      region: region || null,
      gender: gender || null
    };

    votes.push(newVote);
    saveVotes(votes);

    // Return updated stats for this politician
    const updatedStats = aggregateStats(votes, politician_id);
    return res.status(200).json({
      success: true,
      message: 'Vote enregistré.',
      stats: updatedStats
    });
  }

  return res.status(405).json({ success: false, message: 'Méthode non autorisée.' });
}
