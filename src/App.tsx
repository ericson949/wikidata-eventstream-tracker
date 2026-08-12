import React from 'react';
import { Routes, Route } from 'react-router-dom';
import HomePage from '@/pages/HomePage';
import ActivePresidentsPage from '@/pages/ActivePresidentsPage';
import FormerPresidentsPage from '@/pages/FormerPresidentsPage';
import AdminPage from '@/pages/AdminPage';
import SurveyPage from '@/pages/SurveyPage';
import { TooltipProvider } from '@/components/ui/tooltip';

export default function App() {
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/sondage" element={<SurveyPage />} />
          <Route path="/presidents-en-exercice" element={<ActivePresidentsPage />} />
          <Route path="/anciens-presidents" element={<FormerPresidentsPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </div>
    </TooltipProvider>
  );
}
