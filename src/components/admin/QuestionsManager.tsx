import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Plus, Pencil, Trash2, Loader2, CalendarDays, HelpCircle, CheckCircle2,
  Zap, Radio
} from 'lucide-react';
import { Question } from '@/types';

interface QuestionsManagerProps {
  politicians?: never[]; // kept for API compat but unused
}

// ─── Question Form Modal ──────────────────────────────────────────────────────
function QuestionFormModal({
  isOpen, onClose, onSave, initial
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (q: Partial<Question>) => Promise<void>;
  initial?: Question | null;
}) {
  const [text, setText] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initial) {
      setText(initial.text);
      setStartDate(initial.start_date || '');
      setEndDate(initial.end_date || '');
    } else {
      setText('');
      setStartDate(new Date().toISOString().split('T')[0]);
      setEndDate('');
    }
  }, [initial, isOpen]);

  const handleSave = async () => {
    if (!text.trim()) return;
    setSaving(true);
    await onSave({ text, start_date: startDate, end_date: endDate || undefined });
    setSaving(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-blue-950">
            <HelpCircle className="h-5 w-5 text-blue-700" />
            {initial ? 'Modifier la question' : 'Nouvelle question d\'actualité'}
          </DialogTitle>
          <DialogDescription>
            Cette question s'affichera automatiquement sur la fiche de tous les dirigeants actifs une fois activée.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Question Text */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Texte de la question <span className="text-red-500">*</span>
            </label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={3}
              placeholder="Ex : Faites-vous confiance à ce dirigeant pour gérer la crise économique ?"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 resize-none focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                <CalendarDays className="inline h-3.5 w-3.5 mr-1" />
                Début
              </label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                <CalendarDays className="inline h-3.5 w-3.5 mr-1" />
                Fin (optionnel)
              </label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button
            onClick={handleSave}
            disabled={saving || !text.trim()}
            className="bg-blue-900 text-white hover:bg-blue-800"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {initial ? 'Enregistrer' : 'Créer la question'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function QuestionsManager(_props: QuestionsManagerProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [toastMsg, setToastMsg] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/questions');
      if (res.data.success) setQuestions(res.data.data || []);
    } catch { }
    finally { setLoading(false); }
  };

  useEffect(() => { loadQuestions(); }, []);

  const handleSave = async (data: Partial<Question>) => {
    try {
      if (editingQuestion) {
        const res = await axios.put(`/api/questions/${editingQuestion.id}`, data);
        if (res.data.success) {
          setQuestions(prev => prev.map(q => q.id === editingQuestion.id ? res.data.data : q));
          showToast('✓ Question mise à jour.');
        }
      } else {
        // New question: ask if it should be activated immediately
        const res = await axios.post('/api/questions', { ...data, set_active: true });
        if (res.data.success) {
          // Since creating activates it, deactivate others locally
          setQuestions(prev => [...prev.map(q => ({ ...q, active: false })), res.data.data]);
          showToast('✓ Question créée et activée pour tous les dirigeants.');
        }
      }
    } catch {
      showToast('Erreur lors de la sauvegarde.');
    }
    setFormOpen(false);
    setEditingQuestion(null);
  };

  // Activate this question (deactivates all others)
  const handleActivate = async (q: Question) => {
    if (q.active) return; // already active
    setActivatingId(q.id);
    // Optimistic update
    setQuestions(prev => prev.map(x => ({ ...x, active: x.id === q.id })));
    try {
      await axios.put(`/api/questions/${q.id}`, { active: true });
      showToast(`✓ "${q.text.substring(0, 50)}..." est maintenant la question active.`);
    } catch {
      setQuestions(prev => prev.map(x => ({ ...x, active: x.id === q.id ? false : x.active })));
      showToast('Erreur réseau.');
    }
    setActivatingId(null);
  };

  // Deactivate (no active question)
  const handleDeactivate = async (q: Question) => {
    setQuestions(prev => prev.map(x => x.id === q.id ? { ...x, active: false } : x));
    try {
      await axios.put(`/api/questions/${q.id}`, { active: false });
      showToast('✓ Question désactivée — aucune question active en ce moment.');
    } catch {
      setQuestions(prev => prev.map(x => x.id === q.id ? { ...x, active: true } : x));
      showToast('Erreur réseau.');
    }
  };

  const handleDelete = async (q: Question) => {
    if (!window.confirm(`Supprimer cette question ?\n"${q.text.substring(0, 80)}..."`)) return;
    setDeletingId(q.id);
    try {
      const res = await axios.delete(`/api/questions/${q.id}`);
      if (res.data.success) {
        setQuestions(prev => prev.filter(x => x.id !== q.id));
        showToast('✓ Question supprimée.');
      }
    } catch {
      showToast('Erreur lors de la suppression.');
    }
    setDeletingId(null);
  };

  const openCreate = () => { setEditingQuestion(null); setFormOpen(true); };
  const openEdit = (q: Question) => { setEditingQuestion(q); setFormOpen(true); };

  const activeQuestion = questions.find(q => q.active);

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-xl animate-in fade-in slide-in-from-bottom-5">
          {toastMsg}
        </div>
      )}

      {/* Current active question banner */}
      <div className={`rounded-xl border-2 p-5 ${activeQuestion ? 'border-emerald-300 bg-emerald-50/50' : 'border-dashed border-slate-300 bg-slate-50'}`}>
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${activeQuestion ? 'bg-emerald-100' : 'bg-slate-200'}`}>
            {activeQuestion ? <Radio className="h-4 w-4 text-emerald-600" /> : <HelpCircle className="h-4 w-4 text-slate-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Question active en ce moment</span>
              {activeQuestion && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                  En ligne
                </span>
              )}
            </div>
            {activeQuestion ? (
              <p className="text-base font-semibold text-slate-900 leading-snug">{activeQuestion.text}</p>
            ) : (
              <p className="text-sm text-slate-400 italic">Aucune question active — le Bloc 2 est masqué sur toutes les fiches.</p>
            )}
            {activeQuestion?.end_date && (
              <p className="mt-1 text-xs text-slate-500">
                Valide jusqu'au {new Date(activeQuestion.end_date).toLocaleDateString('fr-FR')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-900">Toutes les questions</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {questions.length} question{questions.length > 1 ? 's' : ''} — une seule peut être active à la fois
          </p>
        </div>
        <Button onClick={openCreate} className="bg-blue-900 text-white hover:bg-blue-800 gap-2">
          <Plus className="h-4 w-4" />
          Nouvelle question
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement...
        </div>
      ) : questions.length === 0 ? (
        <Card className="border-dashed border-slate-300">
          <CardContent className="py-12 text-center">
            <HelpCircle className="mx-auto h-10 w-10 text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-500">Aucune question créée.</p>
            <p className="text-xs text-slate-400 mt-1">Créez une question pour l'afficher sur la fiche de chaque dirigeant.</p>
            <Button onClick={openCreate} variant="outline" className="mt-4 gap-2">
              <Plus className="h-4 w-4" /> Créer une question
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-[55%]">Question</TableHead>
                <TableHead>Validité</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {questions.map(q => {
                const isExpired = q.end_date && new Date(q.end_date) < new Date();
                const isActive = q.active && !isExpired;
                return (
                  <TableRow key={q.id} className={isActive ? 'bg-emerald-50/40' : ''}>
                    <TableCell>
                      <div className="flex items-start gap-2.5">
                        {isActive && (
                          <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                        )}
                        <p className="text-sm font-medium text-slate-800 leading-snug line-clamp-2">{q.text}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-slate-600 space-y-0.5">
                        {q.start_date && <div>Dès le {new Date(q.start_date).toLocaleDateString('fr-FR')}</div>}
                        {q.end_date ? (
                          <div className={isExpired ? 'text-red-500 font-semibold' : ''}>
                            Jusqu'au {new Date(q.end_date).toLocaleDateString('fr-FR')}
                            {isExpired && ' — expirée'}
                          </div>
                        ) : (
                          <div className="text-slate-400 italic">Sans limite</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {isActive ? (
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          <span className="text-xs font-bold text-emerald-700">Active</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">{isExpired ? 'Expirée' : 'Inactive'}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Activate / Deactivate */}
                        {isActive ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeactivate(q)}
                            className="text-slate-500 hover:text-slate-700 text-xs h-7 px-2"
                          >
                            Désactiver
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleActivate(q)}
                            disabled={activatingId === q.id || !!isExpired}
                            className="text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 text-xs h-7 px-2 gap-1"
                          >
                            {activatingId === q.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <Zap className="h-3 w-3" />
                            }
                            Activer
                          </Button>
                        )}

                        <Button variant="ghost" size="icon" onClick={() => openEdit(q)} title="Modifier" className="h-7 w-7">
                          <Pencil className="h-3.5 w-3.5 text-slate-500" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(q)}
                          disabled={deletingId === q.id}
                          className="text-red-400 hover:bg-red-50 hover:text-red-600 h-7 w-7"
                          title="Supprimer"
                        >
                          {deletingId === q.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Trash2 className="h-3.5 w-3.5" />
                          }
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Form modal */}
      <QuestionFormModal
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setEditingQuestion(null); }}
        onSave={handleSave}
        initial={editingQuestion}
      />
    </div>
  );
}
