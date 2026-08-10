import React, { useState, useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown, Activity, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Politician } from '@/types';

interface WikidataDrawerProps {
  politicians: Politician[];
}

interface SSELog {
  id: string;
  title: string;
  user: string;
  comment: string;
  time: string;
  matchedName?: string;
  refreshed?: boolean; // true si la BDD a été mise à jour
}

export default function WikidataDrawer({ politicians = [] }: WikidataDrawerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [tickerText, setTickerText] = useState('Écoute des modifications récentes sur wikidatawiki...');
  const [eventsPerSec, setEventsPerSec] = useState('0.0 ev/s');
  const [logs, setLogs] = useState<SSELog[]>([]);
  const refreshingRef = useRef<Set<string>>(new Set()); // anti-doublon refresh

  useEffect(() => {
    let eventCount = 0;
    const interval = setInterval(() => {
      setEventsPerSec(`${(eventCount / 2).toFixed(1)} ev/s`);
      eventCount = 0;
    }, 2000);

    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource('https://stream.wikimedia.org/v2/stream/recentchange');

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (!data || data.wiki !== 'wikidatawiki') return;

          eventCount++;
          const title = data.title || '';
          const user = data.user || 'Bot/Editeur';
          const comment = data.comment || 'Modification Wikidata';

          setTickerText(`⚡ Wikidata: ${title} par ${user}`);

          // Bulletproof safe string matching
          const cleanTitle = (title || '').toUpperCase();
          const safePoliticians = Array.isArray(politicians) ? politicians : [];

          const match = safePoliticians.find(p => {
            if (!p) return false;
            const qid = (p.id || '').toUpperCase();
            const name = (p.fullname || '').toLowerCase();
            return (qid && cleanTitle.includes(qid)) || (name && (title || '').toLowerCase().includes(name));
          });

          const isTrackedQid = safePoliticians.some(p => {
            const qid = (p?.id || '').toUpperCase();
            return qid && cleanTitle.includes(qid);
          });

          if (match || isTrackedQid) {
            const newLog: SSELog = {
              id: String(Date.now() + Math.random()),
              title,
              user,
              comment,
              time: new Date().toLocaleTimeString('fr-FR'),
              matchedName: match?.fullname || title,
              refreshed: false
            };
            setLogs(prev => [newLog, ...prev.slice(0, 40)]);

            // ─── Déclencher le refresh BDD automatiquement ───────────────────
            if (match?.id && !refreshingRef.current.has(match.id)) {
              refreshingRef.current.add(match.id);
              // Debounce : attendre 5s avant de refresher (évite les rafales)
              setTimeout(async () => {
                try {
                  const res = await fetch(`/api/tracked/${match.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refresh_wikidata: true })
                  });
                  const data = await res.json();
                  if (data.success) {
                    setLogs(prev => prev.map(l =>
                      l.id === newLog.id ? { ...l, refreshed: true } : l
                    ));
                    console.log(`[SSE] BDD mise à jour pour ${match.fullname} (${match.id})`);
                  }
                } catch (e) {
                  console.warn(`[SSE] Échec refresh ${match.id}:`, e);
                } finally {
                  // Permettre un nouveau refresh après 30s
                  setTimeout(() => refreshingRef.current.delete(match.id), 30000);
                }
              }, 5000);
            }
          }
        } catch (err) {
          // Swallow any parse error silently
        }
      };
    } catch (err) {
      console.warn('EventSource SSE initialization error:', err);
    }

    return () => {
      clearInterval(interval);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [politicians]);

  return (
    <div 
      style={{
        position: 'fixed',
        bottom: 0,
        right: '24px',
        zIndex: 999999,
        width: '380px',
        maxHeight: '90vh',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)'
      }}
      className={`rounded-t-xl border-2 border-blue-800 bg-slate-900 text-white transition-all duration-300 ${isExpanded ? 'h-96' : 'h-12'}`}
    >
      {/* Header Bar */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex h-12 cursor-pointer items-center justify-between px-4 bg-slate-900 hover:bg-slate-800 rounded-t-xl select-none"
      >
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span>
          </span>
          <strong className="text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
            Flux SSE Wikidata en direct
          </strong>
          <Badge className="border-none bg-blue-700/50 text-[10px] font-medium text-blue-200 px-2 py-0.5 ml-1">
            En direct
          </Badge>
        </div>

        <button className="flex items-center gap-1 text-sm font-medium text-slate-300 hover:text-white">
          {isExpanded ? (
            <>
              <ChevronDown className="h-4 w-4" /> Replier
            </>
          ) : (
            <>
              <ChevronUp className="h-4 w-4" /> Déplier
            </>
          )}
        </button>
      </div>

      {/* Body Content */}
      {isExpanded && (
        <div className="flex h-[calc(100%-3rem)] flex-col justify-between border-t border-slate-800 bg-white p-0">
          {/* Logs List */}
          <div className="flex-1 overflow-y-auto space-y-2 text-xs font-mono p-3 bg-slate-50">
            {logs.length === 0 ? (
              <div className="py-8 text-center text-slate-500">
                <div className="flex justify-center mb-2">
                  <Activity className="h-6 w-6 text-slate-400 animate-pulse" />
                </div>
                Aucune modification capturée sur les entités suivies.
              </div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="rounded border border-slate-200 bg-white p-2 space-y-1">
                  <div className="flex items-center justify-between font-bold text-blue-900">
                    <span>{log.matchedName}</span>
                    {log.refreshed && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                        <RefreshCw className="h-2.5 w-2.5" /> BDD mise à jour
                      </span>
                    )}
                  </div>
                  <div className="text-slate-600">
                    <span className="text-slate-400 mr-2">{log.time}</span> | {log.title} par {log.user} : "{log.comment}"
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
