import { useState, useEffect } from 'react';
import axios from 'axios';
import { Politician, Question } from '@/types';

export function useSurveyData() {
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);
  const [politicians, setPoliticians] = useState<Politician[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedPolitician, setSelectedPolitician] = useState<Politician | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    Promise.all([
      axios.get('/api/questions?active_only=true'),
      axios.get('/api/politicians?admin=true')
    ]).then(([qRes, polRes]) => {
      if (!isMounted) return;
      if (qRes.data.success && qRes.data.data.length > 0) {
        setActiveQuestion(qRes.data.data[0]);
      }
      if (polRes.data.success) {
        setPoliticians(polRes.data.data.filter((p: Politician) => p.status !== 'Désactivé'));
      }
    }).catch(() => {}).finally(() => {
      if (isMounted) setLoading(false);
    });

    return () => { isMounted = false; };
  }, []);

  const filteredPoliticians = politicians.filter(p => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || (p.fullname || '').toLowerCase().includes(q) || (p.job_title || '').toLowerCase().includes(q);
    const matchesCountry = !selectedCountry || (p.country?.id || '').toUpperCase() === selectedCountry.toUpperCase() || (p.country?.name || '').includes(selectedCountry);
    return matchesSearch && matchesCountry;
  });

  return {
    loading,
    activeQuestion,
    politicians: filteredPoliticians,
    searchQuery,
    setSearchQuery,
    selectedCountry,
    setSelectedCountry,
    selectedPolitician,
    setSelectedPolitician,
  };
}
