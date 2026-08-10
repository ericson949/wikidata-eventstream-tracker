import React, { useState } from 'react';
import axios from 'axios';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Search, X, Trash2, ExternalLink, RefreshCw, Vote, ToggleLeft, ToggleRight, ChevronDown, ChevronUp } from 'lucide-react';
import InputSelect from '@/components/ui/InputSelect';
import { Politician, Country } from '@/types';

interface PoliticiansTabProps {
  politicians: Politician[];
  countries: Country[];
  onToggleStatus: (id: string, newStatus: string) => void;
  onDeletePolitician: (id: string) => void;
  onRefreshData: () => void;
}

// ─── Vote settings inline panel ──────────────────────────────────────────────
function VoteSettingsPanel({ politician, onSaved }: { politician: Politician; onSaved: () => void }) {
  const [voteEnabled, setVoteEnabled] = useState(politician.vote_enabled !== false);
  const [block1Enabled, setBlock1Enabled] = useState(politician.block1_enabled !== false);
  const [block2Enabled, setBlock2Enabled] = useState(politician.block2_enabled !== false);
  const [saving, setSaving] = useState(false);

  const hasChanges = voteEnabled !== (politician.vote_enabled !== false)
    || block1Enabled !== (politician.block1_enabled !== false)
    || block2Enabled !== (politician.block2_enabled !== false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`/api/admin/politicians/${politician.id}/vote-settings`, {
        vote_enabled: voteEnabled,
        block1_enabled: block1Enabled,
        block2_enabled: block2Enabled,
      });
      onSaved();
    } catch { }
    setSaving(false);
  };

  const Toggle = ({ value, onChange, label, sub }: { value: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) => (
    <div className={`flex items-center justify-between rounded-lg border px-3 py-2.5 ${value ? 'border-blue-200 bg-blue-50/50' : 'border-slate-200 bg-white'}`}>
      <div>
        <div className="text-xs font-semibold text-slate-800">{label}</div>
        {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
      </div>
      <button type="button" onClick={() => onChange(!value)} className="focus:outline-none ml-3">
        {value
          ? <ToggleRight className="h-6 w-6 text-blue-600" />
          : <ToggleLeft className="h-6 w-6 text-slate-400" />
        }
      </button>
    </div>
  );

  return (
    <div className="space-y-2 pt-1">
      <Toggle
        value={voteEnabled}
        onChange={setVoteEnabled}
        label="Activer les votes"
        sub="Le visiteur peut voter sur ce profil"
      />
      {voteEnabled && (
        <div className="ml-4 space-y-2 border-l-2 border-blue-200 pl-3">
          <Toggle
            value={block1Enabled}
            onChange={setBlock1Enabled}
            label="Bloc 1 — Opinion"
            sub="❤️ Adoration / 👍 Soutien / 👎 Désapprobation / 😱 Indignation"
          />
          <Toggle
            value={block2Enabled}
            onChange={setBlock2Enabled}
            label="Bloc 2 — Question d'actualité"
            sub="Affiche une question Oui/Non liée à ce politicien"
          />
        </div>
      )}
      {hasChanges && (
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-blue-900 text-white hover:bg-blue-800 text-xs"
        >
          {saving ? 'Enregistrement...' : 'Sauvegarder les paramètres de vote'}
        </Button>
      )}
    </div>
  );
}

export default function PoliticiansTab({
  politicians,
  countries,
  onToggleStatus,
  onDeletePolitician,
  onRefreshData
}: PoliticiansTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [expandedVotePanel, setExpandedVotePanel] = useState<string | null>(null);

  const filteredPoliticians = politicians.filter(p => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      (p.fullname || '').toLowerCase().includes(q) ||
      (p.id || '').toLowerCase().includes(q) ||
      (p.job_title || '').toLowerCase().includes(q) ||
      (p.country?.name || '').toLowerCase().includes(q);

    const matchesCountry = !selectedCountry || (p.country?.id || '').toUpperCase() === selectedCountry.toUpperCase() || (p.country?.name || '').includes(selectedCountry);
    const matchesStatus = !selectedStatus || p.status === selectedStatus;

    return matchesSearch && matchesCountry && matchesStatus;
  });

  const totalCount = politicians.length;
  const activeCount = politicians.filter(p => p.status === 'Activé').length;
  const disabledCount = politicians.filter(p => p.status === 'Désactivé').length;
  const voteEnabledCount = politicians.filter(p => p.vote_enabled !== false).length;

  return (
    <div className="space-y-6">
      {/* Stats Cards Row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="border-slate-200">
          <CardContent className="p-5">
            <div className="text-3xl font-extrabold text-blue-950">{totalCount}</div>
            <div className="mt-1 text-xs font-medium text-slate-500">Total dans la BDD</div>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardContent className="p-5">
            <div className="text-3xl font-extrabold text-emerald-600">{activeCount}</div>
            <div className="mt-1 text-xs font-medium text-emerald-700">Profils Actifs (Publiés)</div>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50/40">
          <CardContent className="p-5">
            <div className="text-3xl font-extrabold text-red-600">{disabledCount}</div>
            <div className="mt-1 text-xs font-medium text-red-700">Profils Masqués</div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/40">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-3xl font-extrabold text-blue-800">
              <Vote className="h-6 w-6" />
              {voteEnabledCount}
            </div>
            <div className="mt-1 text-xs font-medium text-blue-700">Vote activé</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex flex-1 items-center rounded-lg border border-slate-200 bg-white px-3 py-1 shadow-sm focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, Q-ID, fonction, pays..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent px-3 py-1.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="mr-2 text-slate-400 hover:text-red-600 focus:outline-none"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <Button size="sm" className="bg-blue-900 text-white hover:bg-blue-800">
            Rechercher
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <InputSelect
            value={selectedCountry}
            onValueChange={setSelectedCountry}
            options={countries.map(c => ({
              value: c.id,
              label: c.name,
              icon: c.flag
            }))}
            placeholder="Tous les pays"
            className="w-48"
          />

          <InputSelect
            value={selectedStatus}
            onValueChange={setSelectedStatus}
            options={[
              { value: 'Activé', label: 'Activé (Publié)' },
              { value: 'Désactivé', label: 'Désactivé (Masqué)' }
            ]}
            placeholder="Tous les statuts"
            className="w-44"
          />

          <Button variant="ghost" size="sm" onClick={onRefreshData} title="Actualiser la liste">
            <RefreshCw className="h-4 w-4 text-slate-500" />
          </Button>
        </div>
      </div>

      {/* Politicians Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Politicien / Dirigeant</TableHead>
            <TableHead>Identifiant Wikidata</TableHead>
            <TableHead>Fonction Officielle</TableHead>
            <TableHead>Pays</TableHead>
            <TableHead>Statut Publication</TableHead>
            <TableHead>Votes</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredPoliticians.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-32 text-center text-slate-500">
                Aucun politicien trouvé pour cette recherche.
              </TableCell>
            </TableRow>
          ) : (
            filteredPoliticians.map((p) => (
              <React.Fragment key={p.id}>
                <TableRow>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {p.photo_url ? (
                        <img src={p.photo_url} alt={p.fullname} className="h-10 w-10 rounded-full object-cover border border-slate-200" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-600 border border-slate-200">
                          {p.fullname.charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="font-semibold text-slate-900">{p.fullname}</div>
                        <div className="text-xs text-slate-500">{p.political_party?.name || 'Indépendant'}</div>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <code className="rounded bg-slate-100 px-2 py-1 text-xs font-mono text-slate-800">{p.id}</code>
                  </TableCell>

                  <TableCell className="max-w-xs truncate text-slate-600 text-xs font-medium">
                    {p.job_title || p.biography || 'Dirigeant Politique'}
                  </TableCell>

                  <TableCell className="font-medium text-slate-800 text-sm">
                    {p.country?.name || 'Afrique'}
                  </TableCell>

                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => onToggleStatus(p.id, p.status === 'Activé' ? 'Désactivé' : 'Activé')}
                          className="focus:outline-none"
                        >
                          <Badge variant={p.status === 'Activé' ? 'success' : 'destructive'} className="cursor-pointer">
                            {p.status === 'Activé' ? 'Activé (Publié)' : 'Désactivé (Masqué)'}
                          </Badge>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {p.status === 'Activé' ? 'Cliquer pour masquer cette fiche' : 'Cliquer pour publier cette fiche'}
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>

                  {/* Vote toggle column */}
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setExpandedVotePanel(expandedVotePanel === p.id ? null : p.id)}
                          className="flex items-center gap-1.5 focus:outline-none"
                        >
                          <Badge
                            variant={p.vote_enabled !== false ? 'success' : 'secondary'}
                            className="cursor-pointer gap-1 font-medium"
                          >
                            <Vote className="h-3 w-3" />
                            {p.vote_enabled !== false ? 'Activé' : 'Désactivé'}
                          </Badge>
                          {expandedVotePanel === p.id
                            ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
                            : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                          }
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">Configurer les blocs de vote</TooltipContent>
                    </Tooltip>
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.open(`https://www.wikidata.org/wiki/${p.id}`, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4 text-slate-500" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Ouvrir sur Wikidata</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDeletePolitician(p.id)}
                            className="text-red-500 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Supprimer la fiche</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>

                {/* Expanded vote settings panel */}
                {expandedVotePanel === p.id && (
                  <TableRow>
                    <TableCell colSpan={7} className="bg-blue-50/30 px-6 py-3">
                      <VoteSettingsPanel
                        politician={p}
                        onSaved={() => { setExpandedVotePanel(null); onRefreshData(); }}
                      />
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
