import React from 'react';
import { useNavigate } from 'react-router-dom';
import PublicNavbar from '@/components/public/PublicNavbar';
import PoliticianCard from '@/components/public/PoliticianCard';
import PoliticianDetailModal from '@/components/public/PoliticianDetailModal';
import InputSelect from '@/components/ui/InputSelect';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, X, ArrowLeft, HelpCircle, Sparkles, CheckCircle2, Vote } from 'lucide-react';
import { useSurveyData } from '@/hooks/useSurveyData';

export default function SurveyPage() {
  const navigate = useNavigate();
  const {
    loading,
    activeQuestion,
    politicians,
    searchQuery,
    setSearchQuery,
    selectedCountry,
    setSelectedCountry,
    selectedPolitician,
    setSelectedPolitician,
  } = useSurveyData();

  return (
    <div>
      <PublicNavbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Navigation retour */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => navigate('/')}
            className="border-slate-300 text-slate-700 hover:bg-slate-100 shadow-sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour à l'accueil
          </Button>

          <Badge className="bg-amber-500 text-white font-bold text-xs px-3 py-1 animate-pulse">
            🔥 SONDAGE PUBLIC EN COURS
          </Badge>
        </div>

        {/* Hero Card Question Active */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950 p-8 text-white shadow-xl border border-blue-900/50">
          <div className="absolute top-0 right-0 -mr-12 -mt-12 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="relative space-y-4 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/20 px-3 py-1 text-xs font-bold text-blue-300 border border-blue-400/30">
              <Sparkles className="h-3.5 w-3.5" />
              Question officielle du Baromètre
            </div>

            <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight text-white">
              « {activeQuestion ? activeQuestion.text : "Faites-vous confiance à ce dirigeant pour stabiliser son pays ?" } »
            </h1>

            <p className="text-sm text-blue-200/90 leading-relaxed">
              Sélectionnez ci-dessous les personnalités politiques d'Afrique sur lesquelles vous souhaitez donner votre avis. Votre vote est comptabilisé instantanément.
            </p>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between pt-2">
          <div className="relative flex flex-1 items-center rounded-lg border border-slate-200 bg-white px-3 py-1 shadow-sm w-full md:w-auto">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher une personnalité pour ce sondage..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent px-3 py-1.5 text-sm outline-none placeholder:text-slate-400 min-w-0"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="mr-2 text-slate-400 hover:text-red-600 shrink-0">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Grille des personnalités pour le sondage */}
        {loading ? (
          <div className="py-20 text-center text-slate-500 font-medium">Chargement des personnalités du sondage...</div>
        ) : politicians.length === 0 ? (
          <div className="py-20 text-center text-slate-500 font-medium">Aucune personnalité trouvée pour ce sondage.</div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-xl font-bold font-serif text-slate-900 flex items-center gap-2">
                <Vote className="h-5 w-5 text-blue-900" />
                Personnalités disponibles pour ce sondage ({politicians.length})
              </h2>
              <span className="text-xs font-semibold text-slate-500">Cliquez sur une fiche pour voter</span>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {politicians.map((p) => (
                <PoliticianCard key={p.id} politician={p} onSelect={setSelectedPolitician} />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Modal de vote détaillé */}
      {selectedPolitician && (
        <PoliticianDetailModal
          politician={selectedPolitician}
          onClose={() => setSelectedPolitician(null)}
        />
      )}
    </div>
  );
}
