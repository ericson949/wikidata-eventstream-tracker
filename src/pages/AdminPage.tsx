import React, { useState } from 'react';
import AdminNavbar from '@/components/admin/AdminNavbar';
import PoliticiansTab from '@/components/admin/PoliticiansTab';
import CountriesTab from '@/components/admin/CountriesTab';
import SurveysTab from '@/components/admin/SurveysTab';
import AddEntityModal from '@/components/admin/AddEntityModal';
import SettingsModal from '@/components/admin/SettingsModal';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { UserCheck, Globe, BarChart3, ChevronDown } from 'lucide-react';
import { useAdminData } from '@/hooks/useAdminData';

export default function AdminPage() {
  const [adminTab, setAdminTab] = useState<string>('politicians');

  const {
    politicians,
    countries,
    toastMsg,
    isAddOpen,
    setIsAddOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    loadData,
    handleToggleStatus,
    handleDeletePolitician,
    handleActivateAll,
  } = useAdminData();

  return (
    <div>
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-xl animate-in fade-in slide-in-from-bottom-5">
          {toastMsg}
        </div>
      )}

      <AdminNavbar
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAddModal={() => setIsAddOpen(true)}
      />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        <Tabs value={adminTab} onValueChange={setAdminTab} className="w-full space-y-6">
          <div className="sm:hidden">
            <div className="relative">
              <select
                value={adminTab}
                onChange={(e) => setAdminTab(e.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="politicians">👤 Gestion des Politiciens</option>
                <option value="countries">🌐 Gestion des Pays</option>
                <option value="surveys">📊 Sondages & Baromètre</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </div>
          </div>

          <TabsList className="hidden sm:flex w-full justify-start border-b border-slate-200 bg-white px-2 py-0">
            <TabsTrigger value="politicians" className="flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Gestion des Politiciens
            </TabsTrigger>
            <TabsTrigger value="countries" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Gestion des Pays
            </TabsTrigger>
            <TabsTrigger value="surveys" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Sondages & Baromètre
            </TabsTrigger>
          </TabsList>

          <TabsContent value="politicians" className="mt-0 outline-none">
            <PoliticiansTab
              politicians={politicians}
              countries={countries}
              onToggleStatus={handleToggleStatus}
              onDeletePolitician={handleDeletePolitician}
              onRefreshData={loadData}
              onActivateAll={handleActivateAll}
            />
          </TabsContent>

          <TabsContent value="countries" className="mt-0 outline-none">
            <CountriesTab countries={countries} onRefresh={loadData} />
          </TabsContent>

          <TabsContent value="surveys" className="mt-0 outline-none">
            <SurveysTab politicians={politicians} />
          </TabsContent>
        </Tabs>
      </main>

      <AddEntityModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onAdded={loadData}
        countries={countries}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
