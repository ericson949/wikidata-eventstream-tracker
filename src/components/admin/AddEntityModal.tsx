import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Search, Loader2, Plus, User, Globe, CheckCircle2, AlertCircle
} from 'lucide-react';
import axios from 'axios';
import { WikidataSearchResult, EntityType } from '@/types';

interface AddEntityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSuccess: (msg: string) => void;
}

interface AddResult {
  success: boolean;
  entity?: {
    fullname: string;
    photo_url?: string;
    country?: { name: string };
    job_title?: string;
    biography?: string;
  };
  message: string;
}

export default function AddEntityModal({ isOpen, onClose, onAddSuccess }: AddEntityModalProps) {
  const [entityType, setEntityType] = useState<EntityType>('politician');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WikidataSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addPhase, setAddPhase] = useState<'idle' | 'fetching' | 'done' | 'error'>('idle');
  const [addResult, setAddResult] = useState<AddResult | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setAddResult(null);
    setAddPhase('idle');
    try {
      const res = await axios.get(`/api/search?q=${encodeURIComponent(query)}`);
      if (res.data.success) {
        setResults(res.data.data || []);
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (item: WikidataSearchResult) => {
    setAddingId(item.id);
    setAddResult(null);

    try {
      if (entityType === 'country') {
        setAddPhase('fetching');
        const res = await axios.post('/api/countries', {
          id: item.id,
          name: item.label,
          region: item.description || 'Afrique'
        });
        if (res.data.success) {
          setAddPhase('done');
          setAddResult({ success: true, message: `Pays "${item.label}" ajouté.` });
          onAddSuccess(`✓ Pays "${item.label}" (${item.id}) ajouté à la BDD !`);
        }
      } else {
        setAddPhase('fetching');
        const res = await axios.post('/api/tracked', {
          entityId: item.id,
          vote_enabled: true,
          block1_enabled: true,
          block2_enabled: true,
        });
        if (res.data.success) {
          setAddPhase('done');
          setAddResult({
            success: true,
            entity: res.data.entity,
            message: res.data.message || `${item.label} ajouté et enrichi.`
          });
          onAddSuccess(`✓ "${res.data.entity?.fullname || item.label}" (${item.id}) ajouté avec toutes ses données Wikidata !`);
        } else {
          setAddPhase('error');
          setAddResult({ success: false, message: res.data.message || 'Erreur lors de l\'ajout.' });
        }
      }
    } catch (err: any) {
      setAddPhase('error');
      setAddResult({
        success: false,
        message: err.response?.data?.message || 'Erreur réseau ou Wikidata indisponible.'
      });
    } finally {
      setAddingId(null);
    }
  };

  const handleClose = () => {
    setQuery('');
    setResults([]);
    setAddPhase('idle');
    setAddResult(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-xl p-3.5 sm:p-6 overflow-hidden rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-xl font-bold text-blue-950 pr-6">
            <Plus className="h-5 w-5 sm:h-6 sm:w-6 text-blue-800 shrink-0" />
            <span className="truncate">Proposer / Ajouter une Entité</span>
          </DialogTitle>
          <DialogDescription className="text-[11px] sm:text-sm">
            Interrogation en direct de la base de connaissances Wikidata
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4 py-1 min-w-0 max-w-full">
          {/* Entity Type Selector */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 rounded-lg border border-slate-200 bg-slate-50 p-2 sm:p-3">
            <label className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-800 cursor-pointer select-none">
              <input type="radio" name="entityType" value="politician" checked={entityType === 'politician'} onChange={() => setEntityType('politician')} className="h-4 w-4 text-blue-900 focus:ring-blue-600" />
              <User className="h-4 w-4 text-blue-800 shrink-0" />
              Politicien / Dirigeant
            </label>
            <label className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-800 cursor-pointer select-none">
              <input type="radio" name="entityType" value="country" checked={entityType === 'country'} onChange={() => setEntityType('country')} className="h-4 w-4 text-blue-900 focus:ring-blue-600" />
              <Globe className="h-4 w-4 text-emerald-600 shrink-0" />
              Pays (Entité Étatique)
            </label>
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="flex items-center gap-2 w-full min-w-0">
            <div className="flex-1 min-w-0">
              <Input
                type="text"
                placeholder={entityType === 'country'
                  ? 'Nom du pays (ex: Sénégal)...'
                  : 'Nom du dirigeant (ex: Ousmane Sonko)...'
                }
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-full text-xs sm:text-sm h-9 sm:h-10"
              />
            </div>
            <Button type="submit" disabled={loading} className="bg-blue-900 hover:bg-blue-800 shrink-0 h-9 sm:h-10 px-3">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </form>

          {/* Add result feedback */}
          {addResult && (
            <div className={`rounded-xl border p-2.5 sm:p-4 min-w-0 ${addResult.success ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
              {addResult.success ? (
                <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
                  {addResult.entity?.photo_url ? (
                    <img src={addResult.entity.photo_url} alt="" className="h-11 w-11 sm:h-14 sm:w-14 rounded-xl object-cover object-[center_12%] border border-emerald-200 shrink-0" />
                  ) : (
                    <div className="h-11 w-11 sm:h-14 sm:w-14 rounded-xl bg-emerald-200 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="h-5 w-5 sm:h-7 sm:w-7 text-emerald-700" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-emerald-800 text-xs sm:text-sm flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" /> Ajouté et enrichi
                    </p>
                    {addResult.entity?.fullname && (
                      <p className="text-xs sm:text-base font-bold text-slate-900 mt-0.5 truncate">{addResult.entity.fullname}</p>
                    )}
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5 text-[11px] sm:text-xs">
                      {addResult.entity?.country?.name && (
                        <span className="text-slate-600">📍 {addResult.entity.country.name}</span>
                      )}
                      {(addResult.entity?.job_title || addResult.entity?.biography) && (
                        <span className="text-slate-500 italic truncate max-w-full">{addResult.entity.job_title || addResult.entity.biography}</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 text-red-700">
                  <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-semibold text-xs sm:text-sm">Erreur lors de l'ajout</p>
                    <p className="text-[11px] sm:text-xs mt-0.5">{addResult.message}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Search Results */}
          <div className="max-h-56 sm:max-h-72 overflow-y-auto space-y-2 pr-0.5 min-w-0">
            {loading ? (
              <div className="py-6 text-center text-xs sm:text-sm text-slate-500">Recherche sur Wikidata en cours...</div>
            ) : results.length === 0 && !addResult ? (
              <div className="py-6 text-center text-xs sm:text-sm text-slate-400">
                Tapez un nom et appuyez sur Entrée pour rechercher.
              </div>
            ) : (
              results.map(item => {
                const isAdding = addingId === item.id;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between gap-2 sm:gap-3 rounded-lg border p-2 sm:p-3 transition-colors min-w-0 ${isAdding ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/30'}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-900 text-xs sm:text-sm truncate">{item.label}</div>
                      <div className="text-[10px] sm:text-xs text-slate-500 truncate">{item.description || 'Entité Wikidata'}</div>
                      <code className="text-[10px] font-mono text-blue-700">{item.id}</code>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleAdd(item)}
                      disabled={isAdding || addPhase === 'fetching'}
                      className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3"
                    >
                      {isAdding ? (
                        <span className="flex items-center gap-1 text-[10px] sm:text-[11px]">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {addPhase === 'fetching' ? 'Enrichissement...' : 'Ajout...'}
                        </span>
                      ) : (
                        '+ Ajouter'
                      )}
                    </Button>
                  </div>
                );
              })
            )}
          </div>

          {/* Info banner */}
          {entityType === 'politician' && addPhase === 'idle' && results.length > 0 && (
            <p className="text-center text-[10px] sm:text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0 inline-block" />
              Votes et questions activés par défaut à l'ajout.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
