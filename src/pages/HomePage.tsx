import React from 'react';
import { useNavigate } from 'react-router-dom';
import PublicNavbar from '@/components/public/PublicNavbar';
import PoliticianCard from '@/components/public/PoliticianCard';
import InputSelect from '@/components/ui/InputSelect';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
import { Politician, Country } from '@/types';

interface HomePageProps {
  loading: boolean;
  activePresidents: Politician[];
  formerPresidents: Politician[];
  filteredPublicPoliticians: Politician[];
  countries: Country[];
  publicSearch: string;
  setPublicSearch: (v: string) => void;
  publicCountry: string;
  setPublicCountry: (v: string) => void;
  onSelectPolitician: (p: Politician) => void;
}

export default function HomePage({
  loading,
  activePresidents,
  formerPresidents,
  filteredPublicPoliticians,
  countries,
  publicSearch,
  setPublicSearch,
  publicCountry,
  setPublicCountry,
  onSelectPolitician,
}: HomePageProps) {
  const navigate = useNavigate();

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
                    <PoliticianCard key={p.id} politician={p} onSelect={onSelectPolitician} />
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
                    <PoliticianCard key={p.id} politician={p} onSelect={onSelectPolitician} />
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
    </div>
  );
}
