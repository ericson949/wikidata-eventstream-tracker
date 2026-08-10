import React from 'react';
import { Button } from '@/components/ui/button';
import { Settings, Plus, LogOut, ArrowLeft, Activity } from 'lucide-react';

interface AdminNavbarProps {
  onOpenSettings: () => void;
  onOpenAddModal: () => void;
  onLogout: () => void;
  onSwitchView: (view: 'public' | 'admin') => void;
}

export default function AdminNavbar({
  onOpenSettings,
  onOpenAddModal,
  onLogout,
  onSwitchView
}: AdminNavbarProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-900 font-serif text-xl font-bold text-white shadow-sm">
            P
          </div>
          <div>
            <div className="font-serif text-lg font-bold tracking-tight text-blue-950">POLITILI</div>
            <div className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Espace Administration</div>
          </div>
        </div>


        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onOpenSettings}>
            <Settings className="mr-2 h-4 w-4 text-slate-500" />
            Config Webhook
          </Button>
          <Button variant="default" size="sm" onClick={onOpenAddModal} className="bg-blue-900 hover:bg-blue-800">
            <Plus className="mr-2 h-4 w-4" />
            Ajouter (Wikidata)
          </Button>
          <Button variant="ghost" size="sm" onClick={onLogout} className="text-red-600 hover:bg-red-50 hover:text-red-700">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
