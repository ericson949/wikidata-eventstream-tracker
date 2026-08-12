import React from 'react';
import { useNavigate } from 'react-router-dom';
import PublicNavbar from '@/components/public/PublicNavbar';
import PoliticianCard from '@/components/public/PoliticianCard';
import PoliticianDetailModal from '@/components/public/PoliticianDetailModal';
import InputSelect from '@/components/ui/InputSelect';
import { Button } from '@/components/ui/button';
import { Search, X, Sparkles, HelpCircle } from 'lucide-react';
import { usePoliticiansData } from '@/hooks/usePoliticiansData';
import axios from 'axios';
import { Question } from '@/types';

export default function HomePage() {
  const navigate = useNavigate();
  const [activeQuestion, setActiveQuestion] = React.useState<Question | null>(null);

  React.useEffect(() => {
    axios.get('/api/questions?active_only=true').then(res => {
      if (res.data.success && res.data.data.length > 0) {
        setActiveQuestion(res.data.data[0]);
      }
    }).catch(() => {});
  }, []);

  const {
    loading,
    countries,
    publicSearch,
    setPublicSearch,
    publicCountry,
    setPublicCountry,
    selectedPolitician,
    setSelectedPolitician,
    updatePoliticianVotes,
    activePresidents,
    formerPresidents,
    filteredPublicPoliticians,
  } = usePoliticiansData();

  return (
    <div>
      <PublicNavbar />
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

        {/* Banner Question du Moment / Sondage en cours */}
        {activeQuestion && (
          <div
            onClick={() => navigate('/sondage')}
            className="group relative cursor-pointer overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/70 p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:border-amber-300 hover:bg-amber-50"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1.5 min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-extrabold text-amber-800">
                  <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                  QUESTION DU MOMENT (SONDAGE EN COURS)
                </div>
                <h3 className="font-serif text-lg sm:text-xl font-bold text-slate-900 group-hover:text-amber-900 transition-colors">
                  « {activeQuestion.text} »
                </h3>
                <p className="text-xs text-slate-600">
                  Participez au sondage national et exprimez votre avis pour chaque dirigeant.
                </p>
              </div>
              <Button className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shrink-0 shadow">
                Participer au sondage →
              </Button>
            </div>
          </div>
        )}

        {/* Filter Toolbar */}
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
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            <InputSelect
              value={publicCountry}
              onValueChange={setPublicCountry}
              options={countries.map(c => ({ value: c.id, label: c.name, icon: c.flag }))}
              placeholder="Tous les pays"
              className="w-full sm:w-48"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-500 font-medium">Chargement des dirigeants africains...</div>
        ) : filteredPublicPoliticians.length === 0 ? (
          <div className="py-20 text-center text-slate-500 font-medium">Aucun dirigeant trouvé pour cette recherche.</div>
        ) : (
          <div className="space-y-12">
            {/* Section 1 : Présidents en fonction (5 premiers) */}
            {activePresidents.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse"></div>
                    <h2 className="text-xl font-bold text-slate-900 font-serif">
                      Présidents en fonction ({activePresidents.length})
                    </h2>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">Classés par votes & nom</span>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {activePresidents.slice(0, 5).map((p) => (
                    <PoliticianCard key={p.id} politician={p} onSelect={setSelectedPolitician} />
                  ))}
                </div>

                {activePresidents.length > 5 && (
                  <div className="text-center pt-2">
                    <Button
                      onClick={() => navigate('/presidents-en-exercice')}
                      className="bg-blue-900 hover:bg-blue-800 text-white font-semibold shadow-sm px-6 py-2"
                    >
                      Voir tout ({activePresidents.length} présidents en fonction) →
                    </Button>
                  </div>
                )}
              </section>
            )}

            {/* Section 2 : Anciens Présidents (5 premiers) */}
            {formerPresidents.length > 0 && (
              <section className="space-y-4 pt-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-slate-400"></div>
                    <h2 className="text-xl font-bold text-slate-900 font-serif">
                      Anciens Présidents ({formerPresidents.length})
                    </h2>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">Classés par votes & nom</span>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {formerPresidents.slice(0, 5).map((p) => (
                    <PoliticianCard key={p.id} politician={p} onSelect={setSelectedPolitician} />
                  ))}
                </div>

                {formerPresidents.length > 5 && (
                  <div className="text-center pt-2">
                    <Button
                      onClick={() => navigate('/anciens-presidents')}
                      className="bg-blue-900 hover:bg-blue-800 text-white font-semibold shadow-sm px-6 py-2"
                    >
                      Voir tout ({formerPresidents.length} anciens présidents) →
                    </Button>
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </main>

      {selectedPolitician && (
        <PoliticianDetailModal
          politician={selectedPolitician}
          onClose={() => setSelectedPolitician(null)}
          onVoteSuccess={updatePoliticianVotes}
        />
      )}
    </div>
  );
}
