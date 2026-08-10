import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import InputSelect from '@/components/ui/InputSelect';
import QuestionsManager from '@/components/admin/QuestionsManager';
import { BarChart3, Heart, ThumbsUp, ThumbsDown, AlertCircle, HelpCircle, Loader2, RefreshCw, Users, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Politician, VotePeriod } from '@/types';

interface SurveysTabProps {
  politicians: Politician[];
}

// ─── Mini progress bar ───────────────────────────────────────────────────────
function MiniBar({ value, total, color }: { value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-slate-100">
        <div className={`h-2 rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-slate-700 w-10 text-right">{pct}%</span>
    </div>
  );
}

// ─── Crossed stats section ───────────────────────────────────────────────────
function CrossedStats({ politicians }: { politicians: Politician[] }) {
  const [period, setPeriod] = useState<VotePeriod>('all');
  const [filterPolitician, setFilterPolitician] = useState('');
  const [filterQuestion, setFilterQuestion] = useState('');
  const [filterAge, setFilterAge] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadStats = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (period && period !== 'all') params.period = period;
      if (filterPolitician) params.politician_id = filterPolitician;
      if (filterQuestion) params.question_id = filterQuestion;
      if (filterAge) params.age_range = filterAge;
      if (filterRegion) params.region = filterRegion;
      if (filterGender) params.gender = filterGender;

      const [voteRes, qRes] = await Promise.all([
        axios.get('/api/votes', { params }),
        axios.get('/api/questions')
      ]);
      if (voteRes.data.success) setStats(voteRes.data);
      if (qRes.data.success) setQuestions(qRes.data.data || []);
    } catch { }
    finally { setLoading(false); }
  };

  useEffect(() => { loadStats(); }, [period, filterPolitician, filterQuestion, filterAge, filterRegion, filterGender]);

  const byPolitician = stats?.byPolitician || {};
  const kpis = stats?.kpis || {};

  const displayPoliticians = filterPolitician
    ? politicians.filter(p => p.id === filterPolitician)
    : politicians;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Total votes', value: kpis.totalVotes?.toLocaleString('fr-FR') || '0', color: 'text-slate-900', icon: <BarChart3 className="h-4 w-4 text-slate-400" /> },
          { label: 'Votes Opinion', value: kpis.totalOpinion?.toLocaleString('fr-FR') || '0', color: 'text-blue-700', icon: <Heart className="h-4 w-4 text-blue-400" /> },
          { label: 'Réponses Questions', value: kpis.totalQuestion?.toLocaleString('fr-FR') || '0', color: 'text-indigo-700', icon: <HelpCircle className="h-4 w-4 text-indigo-400" /> },
          { label: 'Approbation globale', value: `${kpis.globalApproval || 0}%`, color: kpis.globalApproval >= 50 ? 'text-emerald-600' : 'text-red-600', icon: <TrendingUp className="h-4 w-4 text-emerald-400" /> },
        ].map(k => (
          <Card key={k.label} className="border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                {k.icon}
              </div>
              <div className={`text-2xl font-extrabold ${k.color}`}>{k.value}</div>
              <div className="text-xs text-slate-500 mt-0.5 font-medium">{k.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" /> Filtres croisés
        </p>
        <div className="flex flex-wrap gap-3">
          <InputSelect
            value={period}
            onValueChange={v => setPeriod(v as VotePeriod)}
            options={[
              { value: 'all', label: 'Toute la période' },
              { value: 'day', label: 'Dernières 24h' },
              { value: 'week', label: 'Cette semaine' },
              { value: 'month', label: 'Ce mois' },
            ]}
            placeholder="Période"
            className="w-full sm:w-44"
          />
          <InputSelect
            value={filterPolitician}
            onValueChange={setFilterPolitician}
            options={politicians.map(p => ({ value: p.id, label: p.fullname }))}
            placeholder="Tous les politiciens"
            className="w-full sm:w-52"
          />
          <InputSelect
            value={filterQuestion}
            onValueChange={setFilterQuestion}
            options={questions.map(q => ({ value: q.id, label: q.text.substring(0, 50) + (q.text.length > 50 ? '...' : '') }))}
            placeholder="Toutes les questions"
            className="w-full sm:w-64"
          />
          <InputSelect
            value={filterAge}
            onValueChange={setFilterAge}
            options={[
              { value: '18-24', label: '18-24 ans' },
              { value: '25-34', label: '25-34 ans' },
              { value: '35-44', label: '35-44 ans' },
              { value: '45-54', label: '45-54 ans' },
              { value: '55-64', label: '55-64 ans' },
              { value: '65+', label: '65+ ans' },
            ]}
            placeholder="Tous les âges"
            className="w-full sm:w-36"
          />
          <InputSelect
            value={filterGender}
            onValueChange={setFilterGender}
            options={[
              { value: 'M', label: 'Hommes' },
              { value: 'F', label: 'Femmes' },
              { value: 'NB', label: 'Autre / NB' },
            ]}
            placeholder="Tous les genres"
            className="w-full sm:w-36"
          />
          <Button variant="ghost" size="sm" onClick={loadStats} title="Actualiser" className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Per-politician stats table */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement des statistiques...
        </div>
      ) : displayPoliticians.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-8">Aucune donnée pour les filtres sélectionnés.</p>
      ) : (
        <div className="space-y-4">
          {displayPoliticians.map(p => {
            const pStats = byPolitician[p.id];
            const opinion = pStats?.opinion;
            const opTotal = opinion ? opinion.hearts + opinion.likes + opinion.dislikes + opinion.horrors : 0;
            const approval = opTotal > 0 ? Math.round(((opinion.hearts + opinion.likes) / opTotal) * 100) : null;

            // The active global question applies to all politicians
            const activeQ = questions.find(q => q.active);
            const linkedQs = activeQ ? [activeQ] : [];

            return (
              <Card key={p.id} className="border-slate-200 overflow-hidden">
                <div className="flex items-center gap-4 border-b border-slate-100 bg-slate-50/50 px-5 py-3">
                  {p.photo_url ? (
                    <img src={p.photo_url} alt={p.fullname} className="h-10 w-10 rounded-full object-cover border border-slate-200 shrink-0" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500 shrink-0">{p.fullname.charAt(0)}</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900">{p.fullname}</div>
                    <div className="text-xs text-slate-500">{p.country?.name || 'Afrique'}</div>
                  </div>
                  {approval !== null && (
                    <div className={`rounded-full px-3 py-1 text-sm font-bold ${approval >= 50 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {approval}% de faveur
                    </div>
                  )}
                  <div className="text-xs text-slate-400">{opTotal.toLocaleString('fr-FR')} vote{opTotal > 1 ? 's' : ''}</div>
                </div>
                <CardContent className="p-5 space-y-5">
                  {/* Opinion block */}
                  {p.block1_enabled && (
                    <div>
                      <p className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1.5">
                        <Heart className="h-3.5 w-3.5 text-red-400" /> Bloc 1 — Opinion directe
                      </p>
                      {opTotal === 0 ? (
                        <p className="text-xs text-slate-400 italic">Aucun vote d'opinion enregistré.</p>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs w-32 text-slate-600">❤️ Adoration</span>
                            <MiniBar value={opinion?.hearts || 0} total={opTotal} color="bg-red-400" />
                            <span className="text-xs text-slate-500 w-12 text-right">{(opinion?.hearts || 0).toLocaleString('fr-FR')}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs w-32 text-slate-600">👍 Soutien</span>
                            <MiniBar value={opinion?.likes || 0} total={opTotal} color="bg-blue-500" />
                            <span className="text-xs text-slate-500 w-12 text-right">{(opinion?.likes || 0).toLocaleString('fr-FR')}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs w-32 text-slate-600">👎 Désapprobation</span>
                            <MiniBar value={opinion?.dislikes || 0} total={opTotal} color="bg-slate-400" />
                            <span className="text-xs text-slate-500 w-12 text-right">{(opinion?.dislikes || 0).toLocaleString('fr-FR')}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs w-32 text-slate-600">😱 Indignation</span>
                            <MiniBar value={opinion?.horrors || 0} total={opTotal} color="bg-amber-400" />
                            <span className="text-xs text-slate-500 w-12 text-right">{(opinion?.horrors || 0).toLocaleString('fr-FR')}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Question block — active global question */}
                  {p.block2_enabled && linkedQs.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1.5">
                        <HelpCircle className="h-3.5 w-3.5 text-indigo-500" /> Bloc 2 — Questions d'actualité
                      </p>
                      <div className="space-y-4">
                        {linkedQs.map(q => {
                          const qStats = pStats?.questions?.[q.id];
                          const qTotal = (qStats?.yes || 0) + (qStats?.no || 0);
                          return (
                            <div key={q.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                              <p className="text-xs font-semibold text-slate-700 mb-2 leading-snug">{q.text}</p>
                              {qTotal === 0 ? (
                                <p className="text-xs text-slate-400 italic">Aucune réponse enregistrée.</p>
                              ) : (
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs w-8 text-slate-600">✅ Oui</span>
                                    <MiniBar value={qStats?.yes || 0} total={qTotal} color="bg-emerald-500" />
                                    <span className="text-xs text-slate-500 w-12 text-right">{(qStats?.yes || 0).toLocaleString('fr-FR')}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs w-8 text-slate-600">❌ Non</span>
                                    <MiniBar value={qStats?.no || 0} total={qTotal} color="bg-red-400" />
                                    <span className="text-xs text-slate-500 w-12 text-right">{(qStats?.no || 0).toLocaleString('fr-FR')}</span>
                                  </div>
                                  <p className="text-right text-xs text-slate-400">{qTotal} réponse{qTotal > 1 ? 's' : ''}</p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {!p.vote_enabled && (
                    <p className="text-xs text-slate-400 italic">Vote désactivé pour ce politicien.</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main SurveysTab ─────────────────────────────────────────────────────────
export default function SurveysTab({ politicians }: SurveysTabProps) {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="stats" className="w-full space-y-5">
        <TabsList className="flex w-full border border-slate-200 bg-slate-50 p-1 rounded-lg h-auto">
          <TabsTrigger value="stats" className="flex-1 flex items-center justify-center gap-2 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <BarChart3 className="h-4 w-4 shrink-0" />
            <span className="truncate">Statistiques<span className="hidden sm:inline"> croisées</span></span>
          </TabsTrigger>
          <TabsTrigger value="questions" className="flex-1 flex items-center justify-center gap-2 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <HelpCircle className="h-4 w-4 shrink-0" />
            <span className="truncate"><span className="hidden sm:inline">Gestion des </span>Questions</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stats">
          <CrossedStats politicians={politicians} />
        </TabsContent>

        <TabsContent value="questions">
          <QuestionsManager politicians={politicians} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
