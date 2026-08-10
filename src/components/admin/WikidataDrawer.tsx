import React, { useState, useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown, Activity, RefreshCw, Filter, Zap, Radio } from 'lucide-react';
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
  isMatched: boolean;
  matchedName?: string;
  matchedId?: string;
  refreshed?: boolean; // true si la BDD a été mise à jour
}

export default function WikidataDrawer({ politicians = [] }: WikidataDrawerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [tickerText, setTickerText] = useState('Écoute des modifications récentes sur wikidatawiki...');
  const [eventsPerSec, setEventsPerSec] = useState('0.0 ev/s');
  const [logs, setLogs] = useState<SSELog[]>([]);
  const [filterMode, setFilterMode] = useState<'all' | 'tracked'>('all');
  const refreshingRef = useRef<Set<string>>(new Set());

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
          const user = data.user || 'Éditeur Wikidata';
          const comment = data.comment || 'Modification';

          setTickerText(`${title} par ${user}`);

          // Matching logic against tracked politicians
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

          const isMatched = Boolean(match || isTrackedQid);

          const newLog: SSELog = {
            id: String(Date.now() + Math.random()),
            title,
            user,
            comment,
            time: new Date().toLocaleTimeString('fr-FR'),
            isMatched,
            matchedName: match?.fullname || (isMatched ? title : undefined),
            matchedId: match?.id,
            refreshed: false
          };

          // Append ALL logs (up to 50 items) so the feed scrolls continuously
          setLogs(prev => [newLog, ...prev.slice(0, 49)]);

          // ─── Trigger DB refresh if tracked entity matched ─────────────────
          if (match?.id && !refreshingRef.current.has(match.id)) {
            refreshingRef.current.add(match.id);
            setTimeout(async () => {
              try {
                const res = await fetch(`/api/tracked/${match.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ refresh_wikidata: true })
                });
                const responseData = await res.json();
                if (responseData.success) {
                  setLogs(prev => prev.map(l =>
                    l.id === newLog.id ? { ...l, refreshed: true } : l
                  ));
                  console.log(`[SSE] BDD mise à jour pour ${match.fullname} (${match.id})`);
                }
              } catch (e) {
                console.warn(`[SSE] Échec refresh ${match.id}:`, e);
              } finally {
                setTimeout(() => refreshingRef.current.delete(match.id), 30000);
              }
            }, 5000);
          }
        } catch {
          // Ignore parse errors
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

  const matchedCount = logs.filter(l => l.isMatched).length;
  const displayedLogs = filterMode === 'tracked' ? logs.filter(l => l.isMatched) : logs;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        right: '24px',
        zIndex: 999999,
        width: '420px',
        maxHeight: '90vh',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)'
      }}
      className={`rounded-t-xl border-2 border-blue-800 bg-slate-900 text-white transition-all duration-300 ${isExpanded ? 'h-[450px]' : 'h-14'}`}
    >
      {/* Header Bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex h-14 cursor-pointer items-center justify-between px-4 bg-slate-900 hover:bg-slate-850 rounded-t-xl select-none border-b border-slate-800"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span>
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <strong className="text-xs font-bold text-white tracking-wide">
                Flux SSE Wikidata
              </strong>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-800/60">
                {eventsPerSec}
              </span>
              {matchedCount > 0 && (
                <span className="text-[10px] font-bold text-amber-300 bg-amber-950/80 px-1.5 py-0.2 rounded border border-amber-700/60">
                  {matchedCount} ping{matchedCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 truncate font-mono mt-0.5">
              ⚡ {tickerText}
            </div>
          </div>
        </div>

        <button className="flex items-center gap-1 text-xs font-medium text-slate-300 hover:text-white shrink-0">
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

      {/* Body Content when Expanded */}
      {isExpanded && (
        <div className="flex h-[calc(100%-3.5rem)] flex-col border-t border-slate-800 bg-white">
          {/* Toolbar / Filters */}
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-3 py-2 text-xs">
            <div className="flex items-center gap-1 font-semibold text-slate-700">
              <Filter className="h-3.5 w-3.5 text-slate-500" /> Filter par :
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setFilterMode('all')}
                className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${filterMode === 'all' ? 'bg-blue-900 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-200'}`}
              >
                Tous les flux ({logs.length})
              </button>
              <button
                onClick={() => setFilterMode('tracked')}
                className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors flex items-center gap-1 ${filterMode === 'tracked' ? 'bg-amber-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-200'}`}
              >
                <Zap className="h-3 w-3" />
                Pings suivis ({matchedCount})
              </button>
            </div>
          </div>

          {/* Logs List */}
          <div className="flex-1 overflow-y-auto space-y-2 text-xs font-mono p-3 bg-slate-50">
            {displayedLogs.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <div className="flex justify-center mb-2">
                  <Activity className="h-6 w-6 text-slate-400 animate-pulse" />
                </div>
                {filterMode === 'tracked'
                  ? 'Aucune modification capturée sur les entités suivies pour le moment.'
                  : 'En attente d\'événements Wikidata en direct...'}
              </div>
            ) : (
              displayedLogs.map((log) => (
                <div
                  key={log.id}
                  className={`rounded-lg border p-2.5 space-y-1 transition-all ${
                    log.isMatched
                      ? 'border-amber-400 bg-amber-50/90 shadow-sm'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    {log.isMatched ? (
                      <span className="flex items-center gap-1.5 text-amber-900 text-xs">
                        <Zap className="h-3.5 w-3.5 fill-amber-500 text-amber-600" />
                        PING : {log.matchedName}
                      </span>
                    ) : (
                      <span className="text-slate-800 text-xs font-semibold truncate max-w-[240px]">
                        {log.title}
                      </span>
                    )}

                    <div className="flex items-center gap-1">
                      {log.refreshed && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                          <RefreshCw className="h-2.5 w-2.5 animate-spin" /> BDD mise à jour
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 font-mono">{log.time}</span>
                    </div>
                  </div>

                  <div className="text-slate-600 text-[11px] leading-snug">
                    <span className="font-semibold text-slate-700">{log.user}</span> : "{log.comment}"
                  </div>

                  {log.isMatched && log.matchedId && (
                    <div className="pt-0.5 text-[10px] font-mono text-amber-700">
                      Entité : <code className="bg-amber-100/80 px-1 py-0.5 rounded">{log.matchedId}</code>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
