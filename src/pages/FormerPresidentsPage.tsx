import React from 'react';
import { useNavigate } from 'react-router-dom';
import PublicNavbar from '@/components/public/PublicNavbar';
import PoliticianCard from '@/components/public/PoliticianCard';
import InputSelect from '@/components/ui/InputSelect';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, X, ArrowLeft } from 'lucide-react';
import { Politician, Country } from '@/types';
import PaginationControls from '@/components/ui/PaginationControls';

interface FormerPresidentsPageProps {
  loading: boolean;
  formerPresidents: Politician[];
  countries: Country[];
  publicSearch: string;
  setPublicSearch: (v: string) => void;
  publicCountry: string;
  setPublicCountry: (v: string) => void;
  publicPage: number;
  setPublicPage: (p: number) => void;
  publicPageSize: number;
  setPublicPageSize: (s: number) => void;
  onSelectPolitician: (p: Politician) => void;
}

export default function FormerPresidentsPage({
  loading,
  formerPresidents,
  countries,
  publicSearch,
  setPublicSearch,
  publicCountry,
  setPublicCountry,
  publicPage,
  setPublicPage,
  publicPageSize,
  setPublicPageSize,
  onSelectPolitician,
}: FormerPresidentsPageProps) {
  const navigate = useNavigate();

  return (
    <div>
      <PublicNavbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => navigate('/')}
            className="border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour à l'accueil
          </Button>

          <Badge variant="outline" className="bg-slate-100 text-slate-800 border-slate-300 text-xs px-3 py-1 font-semibold">
            {formerPresidents.length} Anciens Présidents
          </Badge>
        </div>

        <div className="border-b border-slate-200 pb-3">
          <h2 className="text-2xl font-bold font-serif text-slate-900 flex items-center gap-3">
            <span className="h-3.5 w-3.5 rounded-full bg-slate-400"></span>
            Tous les Anciens Présidents
          </h2>
          <p className="text-xs text-slate-500 mt-1">Liste complète des anciens chefs d'État d'Afrique, classés par votes puis par nom.</p>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative flex flex-1 items-center rounded-lg border border-slate-200 bg-white px-3 py-1 shadow-sm w-full md:w-auto">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher un ancien président..."
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

          <InputSelect
            value={publicCountry}
            onValueChange={setPublicCountry}
            options={countries.map(c => ({ value: c.id, label: c.name, icon: c.flag }))}
            placeholder="Tous les pays"
            className="w-full sm:w-48"
          />
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-500 font-medium">Chargement des dirigeants africains...</div>
        ) : formerPresidents.length === 0 ? (
          <div className="py-20 text-center text-slate-500 font-medium">Aucun ancien président trouvé pour cette recherche.</div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {formerPresidents
                .slice((publicPage - 1) * publicPageSize, publicPage * publicPageSize)
                .map((p) => (
                  <PoliticianCard key={p.id} politician={p} onSelect={onSelectPolitician} />
                ))}
            </div>

            <PaginationControls
              currentPage={publicPage}
              totalPages={Math.ceil(formerPresidents.length / publicPageSize) || 1}
              pageSize={publicPageSize}
              totalItems={formerPresidents.length}
              onPageChange={setPublicPage}
              onPageSizeChange={setPublicPageSize}
              pageSizeOptions={[16, 32, 64, 128]}
            />
          </div>
        )}
      </main>
    </div>
  );
}
