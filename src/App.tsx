import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Routes, Route, useLocation } from 'react-router-dom';
import HomePage from '@/pages/HomePage';
import ActivePresidentsPage from '@/pages/ActivePresidentsPage';
import FormerPresidentsPage from '@/pages/FormerPresidentsPage';
import AdminPage from '@/pages/AdminPage';
import PoliticianDetailModal from '@/components/public/PoliticianDetailModal';
import AddEntityModal from '@/components/admin/AddEntityModal';
import SettingsModal from '@/components/admin/SettingsModal';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Politician, Country } from '@/types';

export default function App() {
  const location = useLocation();

  const [politicians, setPoliticians] = useState<Politician[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState('');
  const [selectedPolitician, setSelectedPolitician] = useState<Politician | null>(null);

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Search & Filters state
  const [publicSearch, setPublicSearch] = useState('');
  const [publicCountry, setPublicCountry] = useState('');
  const [publicPage, setPublicPage] = useState(1);
  const [publicPageSize, setPublicPageSize] = useState(16);

  useEffect(() => {
    setPublicPage(1);
  }, [publicSearch, publicCountry, location.pathname]);

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

      if (polRes.data.success) setPoliticians(polRes.data.data || []);
      if (countRes.data.success) setCountries(countRes.data.data || []);
    } catch (err) {
      showToast('Erreur lors du chargement des données.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleStatus = async (id: string, newStatus: string) => {
    const prevPoliticians = [...politicians];
    setPoliticians(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
    try {
      const res = await axios.put(`/api/admin/politicians/${id}/status`, { status: newStatus });
      if (res.data.success) showToast(`✓ Statut de ${id} mis à jour : ${newStatus}`);
      else setPoliticians(prevPoliticians);
    } catch (e) {
      setPoliticians(prevPoliticians);
      showToast('Erreur réseau.');
    }
  };

  const handleDeletePolitician = async (id: string) => {
    if (!window.confirm(`Voulez-vous vraiment supprimer le politicien ${id} de la BDD ?`)) return;
    const prevPoliticians = [...politicians];
    setPoliticians(prev => prev.filter(p => p.id !== id));
    try {
      const res = await axios.delete(`/api/tracked/${id}`);
      if (res.data.success) showToast(`✓ Fiche ${id} supprimée de la base.`);
      else setPoliticians(prevPoliticians);
    } catch (e) {
      setPoliticians(prevPoliticians);
      showToast('Erreur réseau.');
    }
  };

  const getVoteCount = (p: Politician) => {
    if (!p.votes) return 0;
    return (p.votes.hearts || 0) + (p.votes.likes || 0) + (p.votes.dislikes || 0) + (p.votes.horrors || 0);
  };

  const filteredPublicPoliticians = politicians
    .filter(p => {
      if (p.status === 'Désactivé') return false;
      const q = publicSearch.toLowerCase().trim();
      const matchesSearch = !q || (p.fullname || '').toLowerCase().includes(q) || (p.job_title || '').toLowerCase().includes(q);
      const matchesCountry = !publicCountry || (p.country?.id || '').toUpperCase() === publicCountry.toUpperCase() || (p.country?.name || '').includes(publicCountry);
      return matchesSearch && matchesCountry;
    })
    .sort((a, b) => {
      const votesA = getVoteCount(a);
      const votesB = getVoteCount(b);
      if (votesB !== votesA) return votesB - votesA;
      return (a.fullname || '').localeCompare(b.fullname || '', 'fr', { sensitivity: 'base' });
    });

  const activePresidents = filteredPublicPoliticians.filter(p => 
    p.actor_state === 'En exercice' || !p.actor_state || (p.actor_state !== 'Ancien' && p.actor_state !== 'Ancien dirigeant' && p.actor_state !== 'Décédé')
  );

  const formerPresidents = filteredPublicPoliticians.filter(p => 
    p.actor_state === 'Ancien' || p.actor_state === 'Ancien dirigeant' || p.actor_state === 'Décédé'
  );

  const commonPublicProps = {
    loading,
    countries,
    publicSearch,
    setPublicSearch,
    publicCountry,
    setPublicCountry,
    publicPage,
    setPublicPage,
    publicPageSize,
    setPublicPageSize,
    onSelectPolitician: setSelectedPolitician,
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
        {toastMsg && (
          <div className="fixed bottom-5 right-5 z-50 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-xl animate-in fade-in slide-in-from-bottom-5">
            {toastMsg}
          </div>
        )}

        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                {...commonPublicProps}
                activePresidents={activePresidents}
                formerPresidents={formerPresidents}
                filteredPublicPoliticians={filteredPublicPoliticians}
              />
            }
          />
          <Route
            path="/presidents-en-exercice"
            element={
              <ActivePresidentsPage
                {...commonPublicProps}
                activePresidents={activePresidents}
              />
            }
          />
          <Route
            path="/anciens-presidents"
            element={
              <FormerPresidentsPage
                {...commonPublicProps}
                formerPresidents={formerPresidents}
              />
            }
          />
          <Route
            path="/admin"
            element={
              <AdminPage
                politicians={politicians}
                countries={countries}
                onToggleStatus={handleToggleStatus}
                onDeletePolitician={handleDeletePolitician}
                onRefreshData={loadData}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onOpenAddModal={() => setIsAddOpen(true)}
              />
            }
          />
        </Routes>

        {selectedPolitician && (
          <PoliticianDetailModal
            politician={selectedPolitician}
            onClose={() => setSelectedPolitician(null)}
          />
        )}

        <AddEntityModal
          isOpen={isAddOpen}
          onClose={() => setIsAddOpen(false)}
          onAdded={loadData}
          countries={countries}
        />

        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      </div>
    </TooltipProvider>
  );
}
