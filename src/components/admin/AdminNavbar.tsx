import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Settings, Plus, LogOut, ArrowLeft } from 'lucide-react';

interface AdminNavbarProps {
  onOpenSettings: () => void;
  onOpenAddModal: () => void;
}

export default function AdminNavbar({
  onOpenSettings,
  onOpenAddModal,
}: AdminNavbarProps) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3 select-none group">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-900 font-serif text-xl font-bold text-white shadow-sm group-hover:bg-blue-800 transition-colors">
            P
          </div>
          <div>
            <div className="font-serif text-lg font-bold tracking-tight text-blue-950 group-hover:text-blue-800 transition-colors">POLITILI</div>
            <div className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Espace Administration</div>
          </div>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate('/')} className="border-slate-300 text-slate-700 hover:bg-slate-100 px-2 sm:px-3">
            <ArrowLeft className="h-4 w-4 text-slate-500 sm:mr-1.5" />
            <span className="hidden sm:inline">Site Public</span>
          </Button>

          <Button variant="outline" size="sm" onClick={onOpenSettings} className="px-2 sm:px-3">
            <Settings className="h-4 w-4 text-slate-500 sm:mr-1.5" />
            <span className="hidden sm:inline">Webhook</span>
          </Button>

          <Button variant="default" size="sm" onClick={onOpenAddModal} className="bg-blue-900 hover:bg-blue-800 px-2 sm:px-3">
            <Plus className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Ajouter (Wikidata)</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
