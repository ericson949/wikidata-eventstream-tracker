import React from 'react';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';

interface PublicNavbarProps {
  onOpenAdmin: () => void;
}

export default function PublicNavbar({ onOpenAdmin }: PublicNavbarProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-900 font-serif text-xl font-bold text-white shadow-sm">
            P
          </div>
          <div>
            <div className="font-serif text-lg font-bold tracking-tight text-blue-950">POLITILI</div>
            <div className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Afrique de l'Ouest & Centrale</div>
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={onOpenAdmin} className="border-slate-300 text-slate-700 hover:bg-slate-100">
          <Lock className="mr-2 h-4 w-4 text-slate-500" />
          Espace Admin
        </Button>
      </div>
    </header>
  );
}
