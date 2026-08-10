import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { X, Heart, ThumbsUp, ThumbsDown, AlertCircle, CheckCircle2, XCircle, HelpCircle, ExternalLink, Calendar, MapPin, Briefcase, Loader2 } from 'lucide-react';
import { Politician, Question, PoliticianVoteData, DemographicData, VoteEmotion, VoteAnswer } from '@/types';

// ─── Cookie helpers ──────────────────────────────────────────────────────────

function getCookieId(): string {
  const KEY = 'politili_fp';
  const match = document.cookie.match(new RegExp(`(?:^|; )${KEY}=([^;]*)`));
  if (match) return decodeURIComponent(match[1]);
  const uuid = crypto.randomUUID();
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${KEY}=${uuid}; expires=${expires}; path=/; SameSite=Lax`;
  return uuid;
}

function getLocalVoted(): Record<string, Record<string, boolean>> {
  try {
    return JSON.parse(localStorage.getItem('politili_voted') || '{}');
  } catch { return {}; }
}

function setLocalVoted(key: string, type: string) {
  const data = getLocalVoted();
  if (!data[key]) data[key] = {};
  data[key][type] = true;
  localStorage.setItem('politili_voted', JSON.stringify(data));
}

function hasVotedLocally(politicianId: string, voteType: string, questionId?: string): boolean {
  const data = getLocalVoted();
  const key = politicianId;
  const type = voteType === 'question' ? `question_${questionId}` : 'opinion';
  return !!data[key]?.[type];
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function StatBar({ value, total, color, label }: { value: number; total: number; color: string; label: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-medium text-slate-600">
        <span>{label}</span>
        <span className="font-bold text-slate-800">{pct}% <span className="font-normal text-slate-400">({value.toLocaleString('fr-FR')})</span></span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100">
        <div
          className={`h-2 rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function DemographicModal({ onSubmit, onSkip }: { onSubmit: (data: DemographicData) => void; onSkip: () => void }) {
  const [ageRange, setAgeRange] = useState('');
  const [region, setRegion] = useState('');
  const [gender, setGender] = useState('');

  const handleSubmit = () => {
    onSubmit({ age_range: ageRange || undefined, region: region || undefined, gender: gender || undefined });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95">
        <div className="bg-gradient-to-r from-blue-900 to-indigo-900 px-6 py-4 text-white">
          <h3 className="font-bold text-base">📊 Affinez le baromètre</h3>
          <p className="text-xs text-blue-200 mt-0.5">Renseignez vos données pour une représentation plus précise — <span className="font-semibold">100% optionnel</span></p>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tranche d'âge</label>
            <select
              value={ageRange}
              onChange={e => setAgeRange(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Préfère ne pas répondre</option>
              <option value="18-24">18 – 24 ans</option>
              <option value="25-34">25 – 34 ans</option>
              <option value="35-44">35 – 44 ans</option>
              <option value="45-54">45 – 54 ans</option>
              <option value="55-64">55 – 64 ans</option>
              <option value="65+">65 ans et plus</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Pays / Région</label>
            <input
              type="text"
              placeholder="Ex : Sénégal, Cameroun, France..."
              value={region}
              onChange={e => setRegion(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Genre</label>
            <div className="flex gap-3">
              {[{ v: 'M', label: 'Homme' }, { v: 'F', label: 'Femme' }, { v: 'NB', label: 'Autre / NB' }].map(g => (
                <button
                  key={g.v}
                  onClick={() => setGender(prev => prev === g.v ? '' : g.v)}
                  className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-all ${gender === g.v ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
          <button
            onClick={onSkip}
            className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors"
          >
            Passer
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 rounded-lg bg-blue-900 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 transition-colors"
          >
            Valider
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Modal ──────────────────────────────────────────────────────────────

interface Props {
  politician: Politician | null;
  onClose: () => void;
}

export default function PoliticianDetailModal({ politician, onClose }: Props) {
  const [voteData, setVoteData] = useState<PoliticianVoteData | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [loadingVotes, setLoadingVotes] = useState(true);

  // Vote UI state
  const [votingOpinion, setVotingOpinion] = useState(false);
  const [votingQuestion, setVotingQuestion] = useState(false);
  const [opinionFeedback, setOpinionFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [questionFeedback, setQuestionFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Local vote state (from localStorage)
  const [hasVotedOpinion, setHasVotedOpinion] = useState(false);
  const [hasVotedQuestion, setHasVotedQuestion] = useState(false);

  // Demographic modal
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [pendingVote, setPendingVote] = useState<{ type: 'opinion' | 'question'; value: string } | null>(null);

  const cookieId = getCookieId();

  const loadData = useCallback(async () => {
    if (!politician) return;
    setLoadingVotes(true);
    try {
      const [voteRes, qRes] = await Promise.all([
        axios.get(`/api/votes?politician_id=${politician.id}`),
        axios.get(`/api/questions?active_only=true`)  // question globale, pas filtrée par politicien
      ]);
      if (voteRes.data.success) setVoteData(voteRes.data.data);
      if (qRes.data.success && qRes.data.data.length > 0) {
        setQuestion(qRes.data.data[0]);
      } else {
        setQuestion(null);
      }
    } catch (e) {}
    finally { setLoadingVotes(false); }
  }, [politician]);

  useEffect(() => {
    if (!politician) {
      setQuestion(null);
      setVoteData(null);
      return;
    }
    loadData();
    setHasVotedOpinion(hasVotedLocally(politician.id, 'opinion'));
    setOpinionFeedback(null);
    setQuestionFeedback(null);
  }, [politician, loadData]);

  useEffect(() => {
    if (question && politician) {
      setHasVotedQuestion(hasVotedLocally(politician.id, 'question', question.id));
    }
  }, [question, politician]);

  if (!politician) return null;

  const opinionTotal = (voteData?.opinion?.hearts || 0) + (voteData?.opinion?.likes || 0) + (voteData?.opinion?.dislikes || 0) + (voteData?.opinion?.horrors || 0);
  const questionStats = question ? voteData?.questions?.[question.id] : null;
  const questionTotal = (questionStats?.yes || 0) + (questionStats?.no || 0);

  const doVote = async (voteType: 'opinion' | 'question', value: string, demographic?: DemographicData) => {
    if (!politician) return;
    const setVoting = voteType === 'opinion' ? setVotingOpinion : setVotingQuestion;
    const setFeedback = voteType === 'opinion' ? setOpinionFeedback : setQuestionFeedback;
    setVoting(true);
    try {
      const payload: any = {
        politician_id: politician.id,
        vote_type: voteType,
        value,
        cookie_id: cookieId,
        ...demographic
      };
      if (voteType === 'question' && question) payload.question_id = question.id;

      const res = await axios.post('/api/votes', payload);
      if (res.data.success) {
        setFeedback({ type: 'success', msg: '✓ Vote enregistré !' });
        const key = voteType === 'question' ? `question_${question?.id}` : 'opinion';
        setLocalVoted(politician.id, key);
        if (voteType === 'opinion') setHasVotedOpinion(true);
        else setHasVotedQuestion(true);
        if (res.data.stats) setVoteData(res.data.stats);
      } else if (res.data.already_voted) {
        setFeedback({ type: 'error', msg: '⚠️ Vous avez déjà voté.' });
      }
    } catch (e) {
      setFeedback({ type: 'error', msg: 'Erreur réseau, veuillez réessayer.' });
    } finally {
      setVoting(false);
    }
  };

  const handleOpinionVote = (emotion: VoteEmotion) => {
    if (hasVotedOpinion || votingOpinion) return;
    // Show demographic modal first (only once per session via sessionStorage)
    const shownDemo = sessionStorage.getItem('politili_demo_shown');
    if (!shownDemo) {
      setPendingVote({ type: 'opinion', value: emotion });
      setShowDemoModal(true);
    } else {
      doVote('opinion', emotion);
    }
  };

  const handleQuestionVote = (answer: VoteAnswer) => {
    if (hasVotedQuestion || votingQuestion) return;
    const shownDemo = sessionStorage.getItem('politili_demo_shown');
    if (!shownDemo) {
      setPendingVote({ type: 'question', value: answer });
      setShowDemoModal(true);
    } else {
      doVote('question', answer);
    }
  };

  const handleDemoSubmit = (demo: DemographicData) => {
    sessionStorage.setItem('politili_demo_shown', '1');
    setShowDemoModal(false);
    if (pendingVote) {
      doVote(pendingVote.type, pendingVote.value, demo);
      setPendingVote(null);
    }
  };

  const handleDemoSkip = () => {
    sessionStorage.setItem('politili_demo_shown', '1');
    setShowDemoModal(false);
    if (pendingVote) {
      doVote(pendingVote.type, pendingVote.value);
      setPendingVote(null);
    }
  };

  const EMOTIONS = [
    { key: 'hearts' as VoteEmotion, emoji: '❤️', label: 'Adoration', color: 'bg-red-400', textColor: 'text-red-600', hoverBg: 'hover:bg-red-50 hover:border-red-300' },
    { key: 'likes' as VoteEmotion, emoji: '👍', label: 'Soutien', color: 'bg-blue-500', textColor: 'text-blue-600', hoverBg: 'hover:bg-blue-50 hover:border-blue-300' },
    { key: 'dislikes' as VoteEmotion, emoji: '👎', label: 'Désapprobation', color: 'bg-slate-400', textColor: 'text-slate-600', hoverBg: 'hover:bg-slate-100 hover:border-slate-400' },
    { key: 'horrors' as VoteEmotion, emoji: '😱', label: 'Indignation', color: 'bg-amber-500', textColor: 'text-amber-600', hoverBg: 'hover:bg-amber-50 hover:border-amber-300' },
  ];

  const approvalRate = opinionTotal > 0
    ? Math.round(((voteData?.opinion?.hearts || 0) + (voteData?.opinion?.likes || 0)) / opinionTotal * 100)
    : 0;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/70 backdrop-blur-sm p-4 py-8">
        <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95">

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 z-10 rounded-full bg-white/80 p-1.5 text-slate-500 shadow hover:bg-white hover:text-slate-900 transition-all"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Hero Header */}
          <div className="relative h-48 bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950 overflow-hidden">
            {politician.photo_url && (
              <img
                src={politician.photo_url}
                alt={politician.fullname}
                className="absolute inset-0 h-full w-full object-cover object-[center_65%] opacity-30"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/50 to-transparent" />
            <div className="absolute bottom-4 sm:bottom-5 left-4 right-4 sm:left-6 sm:right-6 flex items-end gap-3 sm:gap-4">
              {politician.photo_url ? (
                <img
                  src={politician.photo_url}
                  alt={politician.fullname}
                  className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl object-cover object-[center_65%] border-2 border-white/20 shadow-lg shrink-0"
                />
              ) : (
                <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl bg-white/10 border-2 border-white/20 flex items-center justify-center font-serif text-2xl sm:text-3xl font-bold text-white shrink-0">
                  {politician.fullname.charAt(0)}
                </div>
              )}
              <div className="text-white min-w-0">
                <h2 className="font-serif text-xl sm:text-2xl font-bold leading-tight truncate">{politician.fullname}</h2>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                  {politician.country?.name && (
                    <span className="flex items-center gap-1 text-xs text-blue-200">
                      <MapPin className="h-3 w-3" />
                      {politician.country.name}
                    </span>
                  )}
                  {politician.actor_state && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${politician.actor_state === 'En exercice' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-500/20 text-slate-300'}`}>
                      {politician.actor_state}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">

            {/* Bio */}
            <div className="flex flex-wrap gap-3 text-xs text-slate-500">
              {politician.job_title && (
                <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-600">
                  <Briefcase className="h-3 w-3" />
                  {politician.job_title}
                </span>
              )}
              {politician.political_party?.name && politician.political_party.name !== 'Indépendant' && (
                <span className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 font-medium text-blue-700">
                  {politician.political_party.name}
                </span>
              )}
              {politician.birth_date && (
                <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-600">
                  <Calendar className="h-3 w-3" />
                  {politician.birth_date}
                </span>
              )}
              {politician.source_url && (
                <a
                  href={politician.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-full bg-blue-900/10 px-3 py-1.5 font-medium text-blue-800 hover:bg-blue-900/20 transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  Fiche Wikipedia
                </a>
              )}
            </div>

            {/* ── BLOC 1 : OPINION ─────────────────────────────────────────── */}
            {politician.vote_enabled && politician.block1_enabled && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-sm">💬 Votre opinion sur ce dirigeant</h3>
                  {opinionTotal > 0 && (
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${approvalRate >= 50 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {approvalRate}% de faveur
                    </span>
                  )}
                </div>

                {/* Stats bars */}
                {loadingVotes ? (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Chargement des statistiques...
                  </div>
                ) : opinionTotal > 0 ? (
                  <div className="space-y-2">
                    {EMOTIONS.map(e => (
                      <StatBar
                        key={e.key}
                        value={voteData?.opinion?.[e.key] || 0}
                        total={opinionTotal}
                        color={e.color}
                        label={`${e.emoji} ${e.label}`}
                      />
                    ))}
                    <p className="text-right text-xs text-slate-400">{opinionTotal.toLocaleString('fr-FR')} vote{opinionTotal > 1 ? 's' : ''} au total</p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Aucun vote enregistré pour ce dirigeant. Soyez le premier !</p>
                )}

                {/* Vote buttons */}
                {hasVotedOpinion ? (
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span className="text-xs font-medium text-emerald-700">Votre opinion a été enregistrée. Merci !</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {EMOTIONS.map(e => (
                      <button
                        key={e.key}
                        onClick={() => handleOpinionVote(e.key)}
                        disabled={votingOpinion}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border-2 border-slate-200 bg-white px-2 py-3 text-center transition-all ${e.hoverBg} disabled:opacity-60 disabled:cursor-not-allowed active:scale-95`}
                      >
                        {votingOpinion ? (
                          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                        ) : (
                          <span className="text-2xl">{e.emoji}</span>
                        )}
                        <span className={`text-xs font-semibold ${e.textColor}`}>{e.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {opinionFeedback && (
                  <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${opinionFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                    {opinionFeedback.type === 'success' ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <HelpCircle className="h-3.5 w-3.5 shrink-0" />}
                    {opinionFeedback.msg}
                  </div>
                )}
              </div>
            )}

            {/* ── BLOC 2 : QUESTION D'ACTUALITÉ ───────────────────────────── */}
            {politician.vote_enabled && politician.block2_enabled && question && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-7 w-7 rounded-full bg-blue-900 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-white">?</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Question d'actualité</h3>
                    <p className="mt-1 text-sm text-slate-700 font-medium leading-snug">
                      {question.text}
                    </p>
                  </div>
                </div>

                {/* Question stats */}
                {!loadingVotes && questionTotal > 0 && (
                  <div className="space-y-2">
                    <StatBar value={questionStats?.yes || 0} total={questionTotal} color="bg-emerald-500" label="✅ Oui" />
                    <StatBar value={questionStats?.no || 0} total={questionTotal} color="bg-red-400" label="❌ Non" />
                    <p className="text-right text-xs text-slate-400">{questionTotal.toLocaleString('fr-FR')} réponse{questionTotal > 1 ? 's' : ''}</p>
                  </div>
                )}

                {/* Vote buttons */}
                {hasVotedQuestion ? (
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span className="text-xs font-medium text-emerald-700">Votre réponse a été enregistrée. Merci !</span>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleQuestionVote('yes')}
                      disabled={votingQuestion}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl border-2 border-emerald-200 bg-white py-3 font-bold text-emerald-700 transition-all hover:bg-emerald-50 hover:border-emerald-400 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {votingQuestion ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Oui
                    </button>
                    <button
                      onClick={() => handleQuestionVote('no')}
                      disabled={votingQuestion}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl border-2 border-red-200 bg-white py-3 font-bold text-red-600 transition-all hover:bg-red-50 hover:border-red-400 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {votingQuestion ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                      Non
                    </button>
                  </div>
                )}

                {questionFeedback && (
                  <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${questionFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                    {questionFeedback.type === 'success' ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <HelpCircle className="h-3.5 w-3.5 shrink-0" />}
                    {questionFeedback.msg}
                  </div>
                )}
              </div>
            )}

            {/* No vote blocks active */}
            {(!politician.vote_enabled || (!politician.block1_enabled && !politician.block2_enabled)) && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-6 text-center text-sm text-slate-500">
                Le vote est désactivé pour ce dirigeant.
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Demographic modal */}
      {showDemoModal && (
        <DemographicModal onSubmit={handleDemoSubmit} onSkip={handleDemoSkip} />
      )}
    </>
  );
}
