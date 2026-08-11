import { useState, useEffect } from 'react';
import axios from 'axios';
import { Politician, Country } from '@/types';

export function useAdminData() {
  const [politicians, setPoliticians] = useState<Politician[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState('');

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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

  return {
    politicians,
    countries,
    loading,
    toastMsg,
    isAddOpen,
    setIsAddOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    loadData,
    handleToggleStatus,
    handleDeletePolitician,
  };
}
