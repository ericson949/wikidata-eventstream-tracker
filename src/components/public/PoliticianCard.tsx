import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Heart, ThumbsUp, ThumbsDown, AlertCircle, Vote } from 'lucide-react';
import { Politician } from '@/types';

interface PoliticianCardProps {
  politician: Politician;
  onSelect: (p: Politician) => void;
}

export default function PoliticianCard({ politician, onSelect }: PoliticianCardProps) {
  const votes = politician.votes || { hearts: 0, likes: 0, dislikes: 0, horrors: 0 };
  const totalVotes = votes.hearts + votes.likes + votes.dislikes + votes.horrors;
  const approvalPct = totalVotes > 0
    ? Math.round(((votes.hearts + votes.likes) / totalVotes) * 100)
    : null;

  return (
    <Card
      onClick={() => onSelect(politician)}
      className="group cursor-pointer overflow-hidden border-slate-200 bg-white transition-all hover:-translate-y-1 hover:border-blue-300 hover:shadow-lg"
    >
      <div className="relative h-56 w-full overflow-hidden bg-slate-100">
        {politician.photo_url ? (
          <img
            src={politician.photo_url}
            alt={politician.fullname}
            className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-slate-200 font-serif text-5xl font-bold text-slate-400">
            {politician.fullname.charAt(0)}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />

        {/* Approval badge */}
        {approvalPct !== null && (
          <div className={`absolute top-3 right-3 rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow ${approvalPct >= 50 ? 'bg-emerald-600' : 'bg-red-600'}`}>
            {approvalPct}%
          </div>
        )}

        <div className="absolute bottom-3 left-4 right-4 text-white">
          <Badge className="mb-1 border-none bg-blue-900/90 text-[10px] text-white">
            {politician.country?.name || 'Afrique'}
          </Badge>
          <h3 className="font-serif text-lg font-bold leading-snug">{politician.fullname}</h3>
        </div>
      </div>

      <CardContent className="p-4 space-y-3">
        <p className="line-clamp-2 text-xs font-medium text-slate-600">
          {politician.job_title || politician.biography || 'Dirigeant Politique'}
        </p>

        {/* Vote stats or "vote available" indicator */}
        {politician.vote_enabled ? (
          totalVotes > 0 ? (
            <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-bold">
              <span className="flex items-center gap-1 text-red-500">
                <Heart className="h-3.5 w-3.5 fill-red-500" />
                {votes.hearts.toLocaleString('fr-FR')}
              </span>
              <span className="flex items-center gap-1 text-blue-600">
                <ThumbsUp className="h-3.5 w-3.5 fill-blue-600" />
                {votes.likes.toLocaleString('fr-FR')}
              </span>
              <span className="flex items-center gap-1 text-slate-500">
                <ThumbsDown className="h-3.5 w-3.5" />
                {votes.dislikes.toLocaleString('fr-FR')}
              </span>
              <span className="flex items-center gap-1 text-amber-600">
                <AlertCircle className="h-3.5 w-3.5" />
                {votes.horrors.toLocaleString('fr-FR')}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 border-t border-slate-100 pt-3 text-xs font-medium text-blue-700">
              <Vote className="h-3.5 w-3.5" />
              Donnez votre avis — cliquez pour voter
            </div>
          )
        ) : (
          <div className="border-t border-slate-100 pt-3 text-xs text-slate-400 italic">
            Vote non disponible
          </div>
        )}
      </CardContent>
    </Card>
  );
}
