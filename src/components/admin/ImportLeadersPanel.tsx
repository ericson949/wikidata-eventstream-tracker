import React, { useState, useRef } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import {
  Download, Loader2, ChevronDown, ChevronUp, CheckCircle2,
  AlertCircle, Info, Users, Skull, Shield, Crown, Briefcase,
  Play, Eye, Landmark, Building2, UserCheck, StopCircle, RefreshCw,
} from 'lucide-react';

interface ImportResult {
  success: boolean;
  dryRun?: boolean;
  total_found?: number;
  imported?: number;
  to_import?: number;
  errors?: { qid: string; error: string }[];
  imported_names?: { id: string; name: string; country: string }[];
  message: string;
}

const ALL_CATEGORY_OPTIONS = [
  { value: 'president',      label: "Présidents / Chefs d'État", icon: Crown },
  { value: 'prime_minister', label: 'Premiers Ministres',         icon: Briefcase },
  { value: 'military',       label: 'Chefs militaires / Juntes',  icon: Shield },
  { value: 'minister',       label: 'Ministres',                  icon: Landmark },
  { value: 'deputy',         label: 'Députés / Assemblée',        icon: UserCheck },
  { value: 'senator',        label: 'Sénateurs',                  icon: Landmark },
  { value: 'business',       label: "Chefs d'entreprise",         icon: Building2 },
];

export default function ImportLeadersPanel({ onImportDone }: { onImportDone: () => void }) {
  const [isOpen,          setIsOpen]          = useState(false);
  const [includeDeceased, setIncludeDeceased] = useState(false);
  const [includeFormer,   setIncludeFormer]   = useState(false);
  const [defaultStatus,   setDefaultStatus]   = useState<'Désactivé' | 'Activé'>('Désactivé');
  const [types,           setTypes]           = useState<string[]>(ALL_CATEGORY_OPTIONS.map(o => o.value));
  const [loading,         setLoading]         = useState(false);
  const [phase,           setPhase]           = useState<'idle' | 'scanning' | 'importing' | 'auto' | 'done' | 'error'>('idle');
  const [result,          setResult]          = useState<ImportResult | null>(null);
  const [autoProgress,    setAutoProgress]    = useState({ imported: 0, remaining: -1, batches: 0 });

  const stopRef = useRef(false);

  const toggleType = (t: string) =>
    setTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  const callApi = (dryRun = false) =>
    axios.post('/api/import-leaders', {
      includeDeceased, includeFormer, defaultStatus, types, dryRun, batchSize: 20,
    });

  /* ── Import simple (1 batch) ─────────────────────────────────── */
  const runImport = async (dryRun = false) => {
    if (!types.length) return;
    setLoading(true); setResult(null); setPhase(dryRun ? 'scanning' : 'importing');
    try {
      const res = await callApi(dryRun);
      setResult(res.data);
      setPhase('done');
      if (!dryRun && res.data.imported > 0) onImportDone();
    } catch (err: any) {
      setResult({ success: false, message: err.response?.data?.message || 'Erreur réseau.' });
      setPhase('error');
    } finally { setLoading(false); }
  };

  /* ── Import automatique total ────────────────────────────────── */
  const runAutoImport = async () => {
    if (!types.length) return;
    stopRef.current = false;
    setLoading(true); setPhase('auto'); setResult(null);
    setAutoProgress({ imported: 0, remaining: -1, batches: 0 });

    let totalImported = 0;
    let batches = 0;
    let remaining = 1;

    try {
      while (remaining > 0 && !stopRef.current) {
        const res = await callApi(false);
        const data: ImportResult = res.data;

        const batchN   = data.imported ?? 0;
        remaining      = data.to_import ?? 0;
        totalImported += batchN;
        batches++;

        setAutoProgress({ imported: totalImported, remaining, batches });
        if (batchN > 0) onImportDone();
        if (batchN === 0) break; // plus rien à importer

        if (remaining > 0 && !stopRef.current)
          await new Promise(r => setTimeout(r, 1500));
      }

      setResult({
        success: true,
        imported: totalImported,
        to_import: remaining,
        message: stopRef.current
          ? `Import arrêté — ${totalImported} dirigeant(s) importé(s), ${remaining} restant(s).`
          : `✓ Import terminé ! ${totalImported} dirigeant(s) importé(s) en ${batches} batch(es).`,
      });
      setPhase('done');
    } catch (err: any) {
      setResult({ success: false, message: err.response?.data?.message || 'Erreur réseau.' });
      setPhase('error');
    } finally { setLoading(false); }
  };

  const stopAutoImport = () => { stopRef.current = true; };

  const pct = autoProgress.remaining >= 0 && autoProgress.imported + autoProgress.remaining > 0
    ? Math.round((autoProgress.imported / (autoProgress.imported + autoProgress.remaining)) * 100)
    : 0;

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/60 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-100/60 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Download className="h-5 w-5 text-blue-700 shrink-0" />
          <div className="text-left">
            <p className="text-sm font-bold text-blue-900">Import automatique depuis Wikidata</p>
            <p className="text-xs text-blue-600">Récupérer tous les dirigeants africains via SPARQL</p>
          </div>
        </div>
        {isOpen
          ? <ChevronUp className="h-4 w-4 text-blue-600 shrink-0" />
          : <ChevronDown className="h-4 w-4 text-blue-600 shrink-0" />}
      </button>

      {isOpen && (
        <div className="border-t border-blue-200 bg-white px-4 pt-4 pb-5 space-y-5">

          {/* Types */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                Types ({types.length}/{ALL_CATEGORY_OPTIONS.length})
              </p>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-blue-800 select-none">
                <input
                  type="checkbox"
                  checked={types.length === ALL_CATEGORY_OPTIONS.length}
                  onChange={() => setTypes(
                    types.length === ALL_CATEGORY_OPTIONS.length ? [] : ALL_CATEGORY_OPTIONS.map(o => o.value)
                  )}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 cursor-pointer"
                />
                Tout cocher
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              {ALL_CATEGORY_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value} type="button" onClick={() => toggleType(value)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    types.includes(value)
                      ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-300'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />{label}
                </button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2 cursor-pointer group">
              <button
                role="checkbox" aria-checked={includeDeceased}
                onClick={() => setIncludeDeceased(v => !v)}
                className={`h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${
                  includeDeceased ? 'border-red-500 bg-red-500' : 'border-slate-300 bg-white group-hover:border-red-400'
                }`}
              >
                {includeDeceased && <Skull className="h-3 w-3 text-white" />}
              </button>
              <span className="text-xs font-medium text-slate-700">Inclure décédés</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group">
              <button
                role="checkbox" aria-checked={includeFormer}
                onClick={() => setIncludeFormer(v => !v)}
                className={`h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${
                  includeFormer ? 'border-amber-500 bg-amber-500' : 'border-slate-300 bg-white group-hover:border-amber-400'
                }`}
              >
                {includeFormer && <Users className="h-3 w-3 text-white" />}
              </button>
              <span className="text-xs font-medium text-slate-700">Inclure anciens dirigeants</span>
            </label>
          </div>

          {/* Statut par défaut */}
          <div>
            <p className="text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">Statut des profils importés</p>
            <div className="flex gap-2">
              {(['Désactivé', 'Activé'] as const).map(s => (
                <button key={s} onClick={() => setDefaultStatus(s)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    defaultStatus === s
                      ? s === 'Activé' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-600 bg-slate-600 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                  }`}
                >
                  {s === 'Désactivé' ? '🔒 Désactivé (relecture)' : '✅ Activé (direct)'}
                </button>
              ))}
            </div>
            {defaultStatus === 'Activé' && (
              <p className="mt-1.5 text-xs text-amber-600 flex items-center gap-1">
                <Info className="h-3 w-3 shrink-0" />
                Profils publiés immédiatement sans validation.
              </p>
            )}
          </div>

          {/* Barre de progression auto */}
          {phase === 'auto' && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-blue-800 flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Batch #{autoProgress.batches} en cours…
                </span>
                <span className="text-blue-600 tabular-nums font-mono">
                  {autoProgress.imported} importé(s)
                  {autoProgress.remaining >= 0 && ` · ${autoProgress.remaining} restant(s)`}
                </span>
              </div>
              {pct > 0 && (
                <div className="w-full bg-blue-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-700"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
              <p className="text-[10px] text-blue-500 text-right">{pct}% completé</p>
            </div>
          )}

          {/* Résultat */}
          {result && phase !== 'auto' && (
            <div className={`rounded-lg border p-3 ${
              result.success
                ? result.dryRun ? 'border-blue-200 bg-blue-50' : 'border-emerald-200 bg-emerald-50'
                : 'border-red-200 bg-red-50'
            }`}>
              <div className="flex items-start gap-2">
                {result.success
                  ? <CheckCircle2 className={`h-4 w-4 shrink-0 mt-0.5 ${result.dryRun ? 'text-blue-600' : 'text-emerald-600'}`} />
                  : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />}
                <div className="min-w-0 flex-1">
                  <p className={`text-xs font-semibold ${result.success ? (result.dryRun ? 'text-blue-800' : 'text-emerald-800') : 'text-red-800'}`}>
                    {result.message}
                  </p>
                  {result.imported_names && result.imported_names.length > 0 && (
                    <div className="mt-2 max-h-28 overflow-y-auto space-y-0.5">
                      {result.imported_names.map(p => (
                        <div key={p.id} className="text-xs text-slate-600 flex items-center gap-1.5">
                          <span className="text-emerald-500">+</span>
                          <span className="font-medium">{p.name}</span>
                          {p.country && <span className="text-slate-400">— {p.country}</span>}
                          <code className="text-[10px] text-slate-400 font-mono">{p.id}</code>
                        </div>
                      ))}
                    </div>
                  )}
                  {result.errors && result.errors.length > 0 && (
                    <p className="mt-1.5 text-xs text-red-600">
                      {result.errors.length} erreur(s) : {result.errors.slice(0, 3).map(e => e.qid).join(', ')}
                      {result.errors.length > 3 && ` +${result.errors.length - 3} autres`}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Boutons d'action */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
            <Button
              size="sm" variant="outline"
              onClick={() => runImport(true)}
              disabled={loading || !types.length}
              className="gap-1.5 text-xs border-blue-300 text-blue-700 hover:bg-blue-50 justify-center"
            >
              {loading && phase === 'scanning' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
              Simuler
            </Button>

            <Button
              size="sm"
              onClick={() => runImport(false)}
              disabled={loading || !types.length}
              className="gap-1.5 text-xs bg-blue-700 hover:bg-blue-800 text-white justify-center"
            >
              {loading && phase === 'importing' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              {loading && phase === 'importing' ? 'Import…' : '1 batch (20)'}
            </Button>

            {phase === 'auto'
              ? (
                <Button size="sm" onClick={stopAutoImport}
                  className="gap-1.5 text-xs bg-red-600 hover:bg-red-700 text-white justify-center"
                >
                  <StopCircle className="h-3.5 w-3.5" /> Arrêter
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={runAutoImport}
                  disabled={loading || !types.length}
                  className="gap-1.5 text-xs bg-emerald-700 hover:bg-emerald-800 text-white justify-center font-semibold"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Tout importer (auto)
                </Button>
              )
            }

            {!types.length && <p className="text-xs text-red-500">Sélectionne au moins un type.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
