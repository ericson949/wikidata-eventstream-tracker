import React, { useState } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import {
  Download, Loader2, ChevronDown, ChevronUp, CheckCircle2,
  AlertCircle, Info, Users, Skull, Shield, Crown, Briefcase,
  Play, Eye
} from 'lucide-react';

interface ImportResult {
  success: boolean;
  dryRun?: boolean;
  total_found?: number;
  imported?: number;
  to_import?: number;
  skipped?: number;
  errors?: { qid: string; error: string }[];
  imported_names?: { id: string; name: string; country: string }[];
  message: string;
}

export default function ImportLeadersPanel({ onImportDone }: { onImportDone: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [includeDeceased, setIncludeDeceased] = useState(false);
  const [includeFormer, setIncludeFormer] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState<'Désactivé' | 'Activé'>('Désactivé');
  const [types, setTypes] = useState<string[]>(['president']);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'importing' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<ImportResult | null>(null);

  const toggleType = (t: string) => {
    setTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const runImport = async (dryRun = false) => {
    if (types.length === 0) return;
    setLoading(true);
    setResult(null);
    setPhase(dryRun ? 'scanning' : 'importing');

    try {
      const res = await axios.post('/api/import-leaders', {
        includeDeceased,
        includeFormer,
        defaultStatus,
        types,
        dryRun,
      });
      setResult(res.data);
      setPhase('done');
      if (!dryRun && res.data.imported > 0) {
        onImportDone();
      }
    } catch (err: any) {
      setResult({
        success: false,
        message: err.response?.data?.message || 'Erreur réseau ou Wikidata indisponible.',
      });
      setPhase('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/60 overflow-hidden">
      {/* ── Header cliquable ── */}
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
          : <ChevronDown className="h-4 w-4 text-blue-600 shrink-0" />
        }
      </button>

      {/* ── Panneau de configuration ── */}
      {isOpen && (
        <div className="border-t border-blue-200 bg-white px-4 pt-4 pb-5 space-y-5">

          {/* Types de dirigeants */}
          <div>
            <p className="text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">
              Types de dirigeants à importer
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'president', label: 'Présidents / Chefs d\'État', icon: Crown },
                { value: 'prime_minister', label: 'Premiers Ministres', icon: Briefcase },
                { value: 'military', label: 'Chefs militaires / Juntes', icon: Shield },
              ].map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => toggleType(value)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    types.includes(value)
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div>
            <p className="text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">Options</p>
            <div className="space-y-2.5">

              {/* Inclure décédés */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="mt-0.5">
                  <button
                    role="checkbox"
                    aria-checked={includeDeceased}
                    onClick={() => setIncludeDeceased(v => !v)}
                    className={`h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${
                      includeDeceased
                        ? 'border-red-500 bg-red-500'
                        : 'border-slate-300 bg-white group-hover:border-red-400'
                    }`}
                  >
                    {includeDeceased && <Skull className="h-3 w-3 text-white" />}
                  </button>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800 flex items-center gap-1.5">
                    <Skull className="h-3.5 w-3.5 text-red-500" />
                    Inclure les dirigeants décédés
                  </p>
                  <p className="text-xs text-slate-500">
                    Par défaut, seuls les dirigeants vivants sont importés. Activer pour inclure les anciens (ex-chefs d'État décédés).
                  </p>
                </div>
              </label>

              {/* Inclure anciens */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="mt-0.5">
                  <button
                    role="checkbox"
                    aria-checked={includeFormer}
                    onClick={() => setIncludeFormer(v => !v)}
                    className={`h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${
                      includeFormer
                        ? 'border-amber-500 bg-amber-500'
                        : 'border-slate-300 bg-white group-hover:border-amber-400'
                    }`}
                  >
                    {includeFormer && <Users className="h-3 w-3 text-white" />}
                  </button>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-amber-500" />
                    Inclure les anciens dirigeants
                  </p>
                  <p className="text-xs text-slate-500">
                    Importe également les ex-présidents et ex-premiers ministres (pas forcément décédés).
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Statut par défaut */}
          <div>
            <p className="text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">
              Statut des profils importés
            </p>
            <div className="flex gap-2">
              {(['Désactivé', 'Activé'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setDefaultStatus(s)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    defaultStatus === s
                      ? s === 'Activé'
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-600 bg-slate-600 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                  }`}
                >
                  {s === 'Désactivé' ? '🔒 Désactivé (relecture requise)' : '✅ Activé (publié directement)'}
                </button>
              ))}
            </div>
            {defaultStatus === 'Activé' && (
              <p className="mt-1.5 text-xs text-amber-600 flex items-center gap-1">
                <Info className="h-3 w-3 shrink-0" />
                Les profils seront publiés immédiatement sans validation manuelle.
              </p>
            )}
          </div>

          {/* Info bilingue */}
          <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5 flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              Les données sont récupérées en <strong>français et en anglais</strong> depuis Wikidata.
              Chaque profil inclut : nom, description, Wikipedia FR &amp; EN, photo, pays, parti et date de naissance.
            </p>
          </div>

          {/* Résultat */}
          {result && (
            <div className={`rounded-lg border p-3 ${
              result.success
                ? result.dryRun ? 'border-blue-200 bg-blue-50' : 'border-emerald-200 bg-emerald-50'
                : 'border-red-200 bg-red-50'
            }`}>
              <div className="flex items-start gap-2">
                {result.success
                  ? <CheckCircle2 className={`h-4 w-4 shrink-0 mt-0.5 ${result.dryRun ? 'text-blue-600' : 'text-emerald-600'}`} />
                  : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
                }
                <div className="min-w-0 flex-1">
                  <p className={`text-xs font-semibold ${result.success ? (result.dryRun ? 'text-blue-800' : 'text-emerald-800') : 'text-red-800'}`}>
                    {result.message}
                  </p>
                  {result.success && !result.dryRun && result.imported_names && result.imported_names.length > 0 && (
                    <div className="mt-2 max-h-36 overflow-y-auto space-y-0.5">
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
                    <div className="mt-1.5 text-xs text-red-600">
                      {result.errors.length} erreur(s) : {result.errors.slice(0, 3).map(e => e.qid).join(', ')}
                      {result.errors.length > 3 && ` +${result.errors.length - 3} autres`}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Boutons d'action */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => runImport(true)}
              disabled={loading || types.length === 0}
              className="gap-1.5 text-xs border-blue-300 text-blue-700 hover:bg-blue-50 justify-center"
            >
              {loading && phase === 'scanning'
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Eye className="h-3.5 w-3.5" />
              }
              Simuler (sans importer)
            </Button>

            <Button
              size="sm"
              onClick={() => runImport(false)}
              disabled={loading || types.length === 0}
              className="gap-1.5 text-xs bg-blue-700 hover:bg-blue-800 text-white justify-center"
            >
              {loading && phase === 'importing'
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Play className="h-3.5 w-3.5" />
              }
              {loading && phase === 'importing' ? 'Import en cours...' : "Lancer l'import"}
            </Button>

            {types.length === 0 && (
              <p className="text-xs text-red-500">Sélectionne au moins un type de dirigeant.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
