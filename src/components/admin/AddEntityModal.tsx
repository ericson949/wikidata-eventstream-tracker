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
        // ── Politicien : opinion directe et questions activés par défaut ──
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
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-blue-950">
            <Plus className="h-6 w-6 text-blue-800" />
            Proposer / Ajouter une Entité Wikidata
          </DialogTitle>
          <DialogDescription>
            Interrogation en direct de la base de connaissances Wikidata
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Entity Type */}
          <div className="flex gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 cursor-pointer">
              <input type="radio" name="entityType" value="politician" checked={entityType === 'politician'} onChange={() => setEntityType('politician')} className="h-4 w-4 text-blue-900 focus:ring-blue-600" />
              <User className="h-4 w-4 text-blue-800" />
              Politicien / Dirigeant
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 cursor-pointer">
              <input type="radio" name="entityType" value="country" checked={entityType === 'country'} onChange={() => setEntityType('country')} className="h-4 w-4 text-blue-900 focus:ring-blue-600" />
              <Globe className="h-4 w-4 text-emerald-600" />
              Pays (Entité Étatique)
            </label>
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              type="text"
              placeholder={entityType === 'country'
                ? 'Nom du pays (ex: Sénégal, Cameroun)...'
                : 'Nom du dirigeant (ex: Ousmane Sonko, Patrice Talon)...'
              }
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            <Button type="submit" disabled={loading} className="bg-blue-900 hover:bg-blue-800 shrink-0">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </form>

          {/* Add result feedback */}
          {addResult && (
            <div className={`rounded-xl border p-4 ${addResult.success ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
              {addResult.success ? (
                <div className="flex items-start gap-3">
                  {addResult.entity?.photo_url ? (
                    <img src={addResult.entity.photo_url} alt="" className="h-14 w-14 rounded-xl object-cover object-[center_12%] border border-emerald-200 shrink-0" />
                  ) : (
                    <div className="h-14 w-14 rounded-xl bg-emerald-200 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="h-7 w-7 text-emerald-700" />
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-emerald-800 text-sm flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" /> Ajouté et enrichi depuis Wikidata
                    </p>
                    {addResult.entity?.fullname && (
                      <p className="text-base font-bold text-slate-900 mt-0.5">{addResult.entity.fullname}</p>
                    )}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                      {addResult.entity?.country?.name && (
                        <span className="text-xs text-slate-600">📍 {addResult.entity.country.name}</span>
                      )}
                      {(addResult.entity?.job_title || addResult.entity?.biography) && (
                        <span className="text-xs text-slate-500 italic">{addResult.entity.job_title || addResult.entity.biography}</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 text-red-700">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm">Erreur lors de l'ajout</p>
                    <p className="text-xs mt-0.5">{addResult.message}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Search Results */}
          <div className="max-h-64 overflow-y-auto space-y-2">
            {loading ? (
              <div className="py-8 text-center text-sm text-slate-500">Recherche sur Wikidata en cours...</div>
            ) : results.length === 0 && !addResult ? (
              <div className="py-8 text-center text-sm text-slate-400">
                Tapez un nom et appuyez sur Entrée pour rechercher.
              </div>
            ) : (
              results.map(item => {
                const isAdding = addingId === item.id;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${isAdding ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/30'}`}
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 text-sm">{item.label}</div>
                      <div className="text-xs text-slate-500 truncate">{item.description || 'Entité Wikidata'}</div>
                      <code className="text-[10px] font-mono text-blue-700">{item.id}</code>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleAdd(item)}
                      disabled={isAdding || addPhase === 'fetching'}
                      className="ml-3 shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white min-w-[90px]"
                    >
                      {isAdding ? (
                        <span className="flex items-center gap-1.5 text-xs">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          {addPhase === 'fetching' ? 'Wikidata...' : 'Ajout...'}
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

          {/* Info banner about auto-enabled voting & enrichment */}
          {entityType === 'politician' && addPhase === 'idle' && results.length > 0 && (
            <p className="text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400 inline-block" />
              Les votes d'opinion et questions d'actualité sont automatiquement activés à l'ajout.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
