import React, { useState, useEffect } from 'react';
import axios from 'axios';
import PublicNavbar from '@/components/public/PublicNavbar';
import PoliticianCard from '@/components/public/PoliticianCard';
import PoliticianDetailModal from '@/components/public/PoliticianDetailModal';
import AdminNavbar from '@/components/admin/AdminNavbar';
import PoliticiansTab from '@/components/admin/PoliticiansTab';
import CountriesTab from '@/components/admin/CountriesTab';
import SurveysTab from '@/components/admin/SurveysTab';
import AddEntityModal from '@/components/admin/AddEntityModal';
import SettingsModal from '@/components/admin/SettingsModal';
import WikidataDrawer from '@/components/admin/WikidataDrawer';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import InputSelect from '@/components/ui/InputSelect';
import { Button } from '@/components/ui/button';
import { Search, X, UserCheck, Globe, BarChart3, RefreshCw, ChevronDown } from 'lucide-react';
import { Politician, Country } from '@/types';

export default function App() {
  const [view, setView] = useState<'public' | 'admin'>(() => {
    if (typeof window !== 'undefined' && window.location.pathname.includes('admin')) {
      return 'admin';
    }
    return 'public';
  });
  const [adminTab, setAdminTab] = useState<string>('politicians');
  const [politicians, setPoliticians] = useState<Politician[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState('');
  const [selectedPolitician, setSelectedPolitician] = useState<Politician | null>(null);

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Search & Filters on Public View
  const [publicSearch, setPublicSearch] = useState('');
  const [publicCountry, setPublicCountry] = useState('');
  const [publicState, setPublicState] = useState('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [polRes, countRes] = await Promise.all([
        axios.get('/api/politicians?admin=true'),
        axios.get('/api/countries')
      ]);

      if (polRes.data.success) {
        setPoliticians(polRes.data.data || []);
      }
      if (countRes.data.success) {
        setCountries(countRes.data.data || []);
      }
    } catch (err) {
      showToast('Erreur lors du chargement des données.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Optimistic Toggle Status Handler
  const handleToggleStatus = async (id: string, newStatus: string) => {
    const prevPoliticians = [...politicians];
    setPoliticians(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));

    try {
      const res = await axios.put(`/api/admin/politicians/${id}/status`, { status: newStatus });
      if (res.data.success) {
        showToast(`✓ Statut de ${id} mis à jour : ${newStatus}`);
      } else {
        setPoliticians(prevPoliticians);
        showToast('Erreur lors du changement de statut.');
      }
    } catch (e) {
      setPoliticians(prevPoliticians);
      showToast('Erreur réseau.');
    }
  };

  // Optimistic Delete Handler
  const handleDeletePolitician = async (id: string) => {
    if (!window.confirm(`Voulez-vous vraiment supprimer le politicien ${id} de la BDD ?`)) return;

    const prevPoliticians = [...politicians];
    setPoliticians(prev => prev.filter(p => p.id !== id));

    try {
      const res = await axios.delete(`/api/tracked/${id}`);
      if (res.data.success) {
        showToast(`✓ Fiche ${id} supprimée de la base.`);
      } else {
        setPoliticians(prevPoliticians);
        showToast('Erreur lors de la suppression.');
      }
    } catch (e) {
      setPoliticians(prevPoliticians);
      showToast('Erreur réseau.');
    }
  };

  // Filtered Public Politicians
  const filteredPublicPoliticians = politicians.filter(p => {
    if (p.status === 'Désactivé') return false;
    const q = publicSearch.toLowerCase().trim();
    const matchesSearch = !q || (p.fullname || '').toLowerCase().includes(q) || (p.job_title || '').toLowerCase().includes(q);
    const matchesCountry = !publicCountry || (p.country?.id || '').toUpperCase() === publicCountry.toUpperCase() || (p.country?.name || '').includes(publicCountry);
    const matchesState = !publicState || p.actor_state === publicState;
    return matchesSearch && matchesCountry && matchesState;
  });

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-xl animate-in fade-in slide-in-from-bottom-5">
          {toastMsg}
        </div>
      )}

      {/* VIEW SWITCHER: PUBLIC SITE vs ADMIN CONSOLE */}
      {view === 'public' ? (
        <div>
          <PublicNavbar onOpenAdmin={() => setView('admin')} />

          <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
            {/* Header Hero Banner */}
            <div className="rounded-2xl bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 p-8 text-white shadow-lg">
              <h1 className="font-serif text-3xl font-bold sm:text-4xl">
                Annuaire & Baromètre des Dirigeants d'Afrique
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-blue-100/90">
                Suivi officiel en temps réel des personnalités politiques d'Afrique de l'Ouest et Centrale connectées aux données de Wikidata.
              </p>
            </div>

            {/* Filter Toolbar with Clear Cross Buttons */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="relative flex flex-1 items-center rounded-lg border border-slate-200 bg-white px-3 py-1 shadow-sm w-full md:w-auto">
                <Search className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher une personnalité, une fonction, un pays..."
                  value={publicSearch}
                  onChange={(e) => setPublicSearch(e.target.value)}
                  className="w-full bg-transparent px-3 py-1.5 text-sm outline-none placeholder:text-slate-400 min-w-0"
                />
                {publicSearch && (
                  <button onClick={() => setPublicSearch('')} className="mr-2 text-slate-400 hover:text-red-600 shrink-0">
                    <X className="h-4 w-4" />
                  </button>
                )}
                <Button size="sm" className="bg-blue-900 text-white hover:bg-blue-800 shrink-0">
                  Rechercher
                </Button>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
                <InputSelect
                  value={publicCountry}
                  onValueChange={setPublicCountry}
                  options={countries.map(c => ({
                    value: c.id,
                    label: c.name,
                    icon: c.flag
                  }))}
                  placeholder="Tous les pays"
                  className="w-full sm:w-48"
                />

                <InputSelect
                  value={publicState}
                  onValueChange={setPublicState}
                  options={[
                    { value: 'En exercice', label: 'En exercice' },
                    { value: 'Ancien', label: 'Ancien dirigeant' },
                    { value: 'Décédé', label: 'Décédé' }
                  ]}
                  placeholder="Tous les statuts"
                  className="w-full sm:w-44"
                />
              </div>
            </div>

            {/* Public Politicians Cards Grid */}
            {loading ? (
              <div className="py-20 text-center text-slate-500 font-medium">Chargement des dirigeants africains...</div>
            ) : filteredPublicPoliticians.length === 0 ? (
              <div className="py-20 text-center text-slate-500 font-medium">Aucun dirigeant trouvé.</div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredPublicPoliticians.map((p) => (
                  <PoliticianCard key={p.id} politician={p} onSelect={setSelectedPolitician} />
                ))}
              </div>
            )}
          </main>
        </div>
      ) : (
        /* ADMIN CONSOLE VIEW */
        <div>
          <AdminNavbar
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenAddModal={() => setIsAddOpen(true)}
            onLogout={() => setView('public')}
            onSwitchView={setView}
          />

          <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
            {/* Header Banner */}
            <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-blue-950 via-slate-900 to-blue-900 p-6 text-white shadow-md">
              <div>
                <h1 className="font-serif text-2xl font-bold">Console d'Administration Politili</h1>
                <p className="text-xs text-blue-200 mt-1">Gérez la publication, modifiez la BDD des pays et consultez les sondages d'opinion.</p>
              </div>
              <Button variant="outline" size="sm" onClick={loadData} className="bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white">
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                Actualiser
              </Button>
            </div>

            {/* SHADCN TABS FOR STRICT SECTION ISOLATION */}
            <Tabs value={adminTab} onValueChange={setAdminTab} className="w-full space-y-6">
              {/* Mobile Select Dropdown (No scroll, clean dropdown) */}
              <div className="sm:hidden">
                <div className="relative">
                  <select
                    value={adminTab}
                    onChange={(e) => setAdminTab(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="politicians">👤 Gestion des Politiciens</option>
                    <option value="countries">🌐 Gestion des Pays</option>
                    <option value="surveys">📊 Sondages & Baromètre</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
              </div>

              {/* Desktop TabsBar */}
              <TabsList className="hidden sm:flex w-full justify-start border-b border-slate-200 bg-white px-2 py-0">
                <TabsTrigger value="politicians" className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4" />
                  Gestion des Politiciens
                </TabsTrigger>
                <TabsTrigger value="countries" className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Gestion des Pays
                </TabsTrigger>
                <TabsTrigger value="surveys" className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Sondages & Baromètre
                </TabsTrigger>
              </TabsList>

              {/* STRICTLY ISOLATED TAB CONTENT 1: POLITICIANS */}
              <TabsContent value="politicians">
                <PoliticiansTab
                  politicians={politicians}
                  countries={countries}
                  onToggleStatus={handleToggleStatus}
                  onDeletePolitician={handleDeletePolitician}
                  onRefreshData={loadData}
                />
              </TabsContent>

              {/* STRICTLY ISOLATED TAB CONTENT 2: COUNTRIES */}
              <TabsContent value="countries">
                <CountriesTab countries={countries} />
              </TabsContent>

              {/* STRICTLY ISOLATED TAB CONTENT 3: SURVEYS */}
              <TabsContent value="surveys">
                <SurveysTab politicians={politicians} />
              </TabsContent>
            </Tabs>
          </main>
        </div>
      )}

      {/* Floating Wikidata Drawer (Admin View) */}
      {view === 'admin' && <WikidataDrawer politicians={politicians} />}

      {/* Politician Detail Modal (Public View) */}
      <PoliticianDetailModal
        politician={selectedPolitician}
        onClose={() => setSelectedPolitician(null)}
      />

      {/* Modals */}
      <AddEntityModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onAddSuccess={(msg) => {
          showToast(msg);
          loadData();
        }}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
    </TooltipProvider>
  );
}
