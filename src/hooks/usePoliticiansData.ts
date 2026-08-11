import { useState, useEffect } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import { Politician, Country } from '@/types';

export function usePoliticiansData() {
  const location = useLocation();

  const [politicians, setPoliticians] = useState<Politician[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPolitician, setSelectedPolitician] = useState<Politician | null>(null);

  // Search & Filters state
  const [publicSearch, setPublicSearch] = useState('');
  const [publicCountry, setPublicCountry] = useState('');
  const [publicPage, setPublicPage] = useState(1);
  const [publicPageSize, setPublicPageSize] = useState(16);

  useEffect(() => {
    setPublicPage(1);
  }, [publicSearch, publicCountry, location.pathname]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    Promise.all([
      axios.get('/api/politicians?admin=true'),
      axios.get('/api/countries')
    ]).then(([polRes, countRes]) => {
      if (!isMounted) return;
      if (polRes.data.success) setPoliticians(polRes.data.data || []);
      if (countRes.data.success) setCountries(countRes.data.data || []);
    }).catch(() => {}).finally(() => {
      if (isMounted) setLoading(false);
    });

    return () => { isMounted = false; };
  }, []);

  const updatePoliticianVotes = (id: string, newVotes: { hearts: number; likes: number; dislikes: number; horrors: number }) => {
    setPoliticians(prev => prev.map(p => {
      if (p.id === id) {
        return { ...p, votes: newVotes };
      }
      return p;
    }));
    if (selectedPolitician && selectedPolitician.id === id) {
      setSelectedPolitician(prev => prev ? { ...prev, votes: newVotes } : null);
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

  return {
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
    selectedPolitician,
    setSelectedPolitician,
    updatePoliticianVotes,
    activePresidents,
    formerPresidents,
    filteredPublicPoliticians,
  };
}
