import React, { useState, useEffect, useRef } from 'react';
import { ConjunctionEvent } from '../../types/orbital';
import { InvestigationStatus } from '../../types/common';
import { useOrbitalIntelligence } from '../../context/OrbitalIntelligenceContext';
import { isSameSatellite } from '../../api/adapters';
import { formatDistance, formatVelocity, formatUTC, formatTimeRemaining } from '../../utils/formatters';
import { formatEnum } from '../../utils/textFormatters';
import { PHYSICAL_SEVERITY_THRESHOLDS } from '../../constants/screeningConfig';
import { StatusDropdown } from './StatusDropdown';
import { ConjunctionDossierDrawer } from './ConjunctionDossierDrawer';
import { 
  Bell, 
  ShieldAlert, 
  AlertTriangle, 
  Clock, 
  Eye, 
  Info, 
  ArrowUpDown,
  Search,
  CheckCircle2
} from 'lucide-react';

export type AlertSortOption = 'soonest_tca' | 'smallest_distance' | 'highest_criticality';

interface AlertsCentreProps {
  conjunctions: ConjunctionEvent[];
  selectedConjunction?: ConjunctionEvent | null;
  onSelectConjunction: (event: ConjunctionEvent) => void;
  onUpdateStatus: (conjunctionId: string, status: InvestigationStatus) => void;
  onNavigateToRisk?: (event: ConjunctionEvent) => void;
  onNavigateToContinuity?: (event: ConjunctionEvent) => void;
}

const LOCAL_STORAGE_STATUS_KEY = 'astravigil_conjunction_statuses';

export const AlertsCentre: React.FC<AlertsCentreProps> = ({
  conjunctions,
  selectedConjunction,
  onSelectConjunction,
  onUpdateStatus,
  onNavigateToRisk,
  onNavigateToContinuity,
}) => {
  const { satellites, overallFidelity } = useOrbitalIntelligence();
  const [statusFilter, setStatusFilter] = useState<'ALL' | InvestigationStatus>('ALL');
  const [sortBy, setSortBy] = useState<AlertSortOption>('soonest_tca');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeDossierEvent, setActiveDossierEvent] = useState<ConjunctionEvent | null>(null);
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [timerTick, setTimerTick] = useState<number>(0);

  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // 1. Live Countdown ticker: refresh countdown every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setTimerTick(prev => prev + 1);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // 2. Load persisted statuses from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_STATUS_KEY);
      if (saved) {
        const parsed: Record<string, InvestigationStatus> = JSON.parse(saved);
        Object.entries(parsed).forEach(([id, st]) => {
          const current = conjunctions.find(c => c.conjunction_id === id);
          if (current && current.investigation_status !== st) {
            onUpdateStatus(id, st);
          }
        });
      }
    } catch {
      // LocalStorage access may fail in restricted sandboxes
    }
  }, []);

  // 3. Deep link support: inspect ?event=CONJ-xxxx
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const eventParam = params.get('event');
      const targetId = eventParam || selectedConjunction?.conjunction_id;

      if (targetId) {
        const found = conjunctions.find(c => c.conjunction_id === targetId);
        if (found) {
          setHighlightedEventId(targetId);
          setActiveDossierEvent(found);

          // Scroll target row into view
          setTimeout(() => {
            const el = rowRefs.current[targetId];
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 150);

          // Remove glow pulse after 3 seconds
          const timer = setTimeout(() => {
            setHighlightedEventId(null);
          }, 3000);
          return () => clearTimeout(timer);
        }
      }
    }
  }, [conjunctions, selectedConjunction]);

  // Handle status change with toast and persistence
  const handleStatusChange = (eventId: string, newStatus: InvestigationStatus) => {
    onUpdateStatus(eventId, newStatus);

    // Save in localStorage
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_STATUS_KEY);
      const currentMap: Record<string, InvestigationStatus> = saved ? JSON.parse(saved) : {};
      currentMap[eventId] = newStatus;
      localStorage.setItem(LOCAL_STORAGE_STATUS_KEY, JSON.stringify(currentMap));
    } catch {
      // Ignore storage errors
    }

    // Trigger toast notification
    const formatted = formatEnum(newStatus);
    setToastMessage(`${eventId} set to ${formatted}`);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Helper to get criticality score for a conjunction
  const getCriticality = (noradId: number) => {
    const sat = satellites.find(s => isSameSatellite(s.noradId, noradId));
    return sat ? sat.criticality.score : 50;
  };

  const getCriticalityTier = (noradId: number) => {
    const sat = satellites.find(s => isSameSatellite(s.noradId, noradId));
    return sat ? sat.criticality.tier : 'Tier 3 Moderate';
  };

  // Filter conjunctions
  const filteredEvents = conjunctions.filter(c => {
    if (statusFilter !== 'ALL' && c.investigation_status !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = c.primary_object.name.toLowerCase().includes(q) ||
        c.secondary_object.name.toLowerCase().includes(q) ||
        c.conjunction_id.toLowerCase().includes(q);
      if (!matchName) return false;
    }
    return true;
  });

  // Sort conjunctions
  const sortedEvents = [...filteredEvents].sort((a, b) => {
    if (sortBy === 'soonest_tca') {
      return new Date(a.tca).getTime() - new Date(b.tca).getTime();
    }
    if (sortBy === 'smallest_distance') {
      return a.miss_distance_km - b.miss_distance_km;
    }
    if (sortBy === 'highest_criticality') {
      return getCriticality(b.primary_object.norad_id) - getCriticality(a.primary_object.norad_id);
    }
    return 0;
  });

  // Calculate status counts
  const statusCounts = {
    ALL: conjunctions.length,
    UNREVIEWED: conjunctions.filter(c => c.investigation_status === 'UNREVIEWED').length,
    UNDER_EVALUATION: conjunctions.filter(c => c.investigation_status === 'UNDER_EVALUATION').length,
    MONITORING: conjunctions.filter(c => c.investigation_status === 'MONITORING').length,
    DISMISSED: conjunctions.filter(c => c.investigation_status === 'DISMISSED').length,
  };

  // Helper for tier chip styling
  const getCriticalityChip = (noradId: number) => {
    const score = getCriticality(noradId);
    const tier = getCriticalityTier(noradId);
    const formattedTier = formatEnum(tier);

    let chipClasses = 'bg-slate-800/80 border-slate-700 text-slate-300';
    if (tier === 'TIER_1_CRITICAL') {
      chipClasses = 'bg-rose-950/70 border-rose-500/50 text-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.3)]';
    } else if (tier === 'TIER_2_HIGH') {
      chipClasses = 'bg-orange-950/70 border-orange-500/50 text-orange-300';
    } else if (tier === 'TIER_3_MODERATE') {
      chipClasses = 'bg-amber-950/70 border-amber-500/50 text-amber-300';
    }

    return (
      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border tracking-wide whitespace-nowrap ${chipClasses}`}>
        Mission criticality {score} · {formattedTier}
      </span>
    );
  };

  return (
    <div className="w-full space-y-6 select-none animate-in fade-in duration-300 relative">
      {/* ======================================================== */}
      {/* FLOATING TOAST NOTIFICATION                              */}
      {/* ======================================================== */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 bg-slate-950/95 backdrop-blur-xl border border-cyan-400/50 text-cyan-300 text-xs font-mono px-4 py-3 rounded-2xl shadow-[0_8px_32px_rgba(6,182,212,0.4)] flex items-center space-x-2.5 animate-in slide-in-from-bottom-4 duration-200"
        >
          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* MAIN ALERTS CARD                                         */}
      {/* ======================================================== */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-cyan-500/20 rounded-2xl sm:rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden">
        {/* Header Section */}
        <div className="p-5 sm:p-6 border-b border-slate-800/80 flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Title & Count */}
            <div>
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-950/70 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)]">
                  <Bell className="w-4 h-4" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-mono">
                  Orbital Risk Alerts Centre
                </h1>
                <span
                  aria-live="polite"
                  className="px-2.5 py-0.5 text-xs font-mono font-bold rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300"
                >
                  {filteredEvents.length} Events
                </span>
                {overallFidelity !== 'Live' && (
                  <span className="text-[10px] text-slate-400 font-mono italic hidden sm:inline">
                    Mock data. Illustrative values.
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 font-sans">
                Operational triage dashboard for conjunction investigation and alert dispositioning.
              </p>
            </div>

            {/* Sort & Search Controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter name or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 font-mono w-40 sm:w-48 transition-all"
                />
              </div>

              {/* Sort Pill Dropdown */}
              <div className="flex items-center space-x-1.5 bg-slate-950/80 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-mono text-slate-300">
                <ArrowUpDown className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as AlertSortOption)}
                  aria-label="Sort conjunction events"
                  className="bg-transparent text-slate-200 text-xs font-mono focus:outline-none cursor-pointer"
                >
                  <option value="soonest_tca" className="bg-slate-950 text-slate-200">Soonest TCA</option>
                  <option value="smallest_distance" className="bg-slate-950 text-slate-200">Smallest miss distance</option>
                  <option value="highest_criticality" className="bg-slate-950 text-slate-200">Highest criticality</option>
                </select>
              </div>
            </div>
          </div>

          {/* Filter Pills with Counts */}
          <div className="flex items-center overflow-x-auto pb-1 pt-1">
            <div
              role="tablist"
              aria-label="Conjunction status filters"
              className="flex items-center bg-[#0c1322]/90 backdrop-blur-xl border border-slate-800/90 rounded-full p-1 shadow-2xl shrink-0 gap-1"
            >
              {(['ALL', 'UNREVIEWED', 'UNDER_EVALUATION', 'MONITORING', 'DISMISSED'] as const).map((st) => {
                const isActive = statusFilter === st;
                const count = statusCounts[st];
                const label = st === 'ALL' ? 'All' : formatEnum(st);

                return (
                  <button
                    key={st}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setStatusFilter(st)}
                    className={`relative flex items-center space-x-1.5 px-3 sm:px-3.5 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap focus:outline-none ${
                      isActive
                        ? 'border border-cyan-400/60 bg-cyan-950/50 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.35)] font-semibold'
                        : 'border border-transparent text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span>{label}</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                      isActive ? 'bg-cyan-900/60 text-cyan-200 font-bold' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Scientific Rule #1 Note Strip */}
        <div className="bg-slate-950/80 border-b border-slate-800 px-5 sm:px-6 py-2.5 text-xs text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 font-mono">
          <div className="flex items-start sm:items-center space-x-2">
            <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5 sm:mt-0" />
            <span className="text-[11px] leading-relaxed">
              <strong className="text-slate-200 font-semibold">Scientific Rule #1:</strong> Preliminary close-approach screening is based on public SGP4 mean elements and does not constitute a certified Conjunction Data Message (CDM).
            </span>
          </div>
          <span className="text-[11px] text-slate-400 shrink-0">
            TLE uncertainty ~1-3 km in LEO
          </span>
        </div>

        {/* Legend strip: Physical Miss Distance vs Mission Criticality */}
        <div className="bg-slate-950/40 border-b border-slate-800/60 px-5 sm:px-6 py-2 text-[11px] text-slate-400 font-mono flex items-center justify-between">
          <span className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 shrink-0" />
            <span>Left edge = physical miss distance.</span>
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shrink-0 ml-2" />
            <span>Chip = mission criticality.</span>
            <span className="text-slate-400 font-bold ml-1">Assessed independently.</span>
          </span>
        </div>

        {/* ======================================================== */}
        {/* EVENT ROWS LIST                                          */}
        {/* ======================================================== */}
        <div className="divide-y divide-slate-800/80">
          {sortedEvents.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs font-mono space-y-2">
              <p>No conjunction events match the selected filter criteria.</p>
              <button
                onClick={() => {
                  setStatusFilter('ALL');
                  setSearchQuery('');
                }}
                className="text-cyan-400 hover:underline text-xs"
              >
                Reset filters
              </button>
            </div>
          ) : (
            sortedEvents.map((event) => {
              const isUrgent = event.miss_distance_km < PHYSICAL_SEVERITY_THRESHOLDS.URGENT_KM;
              const isCaution = !isUrgent && event.miss_distance_km <= PHYSICAL_SEVERITY_THRESHOLDS.CAUTION_KM;
              const isDismissed = event.investigation_status === 'DISMISSED';

              // Colored left edge indicator (3px)
              let leftEdgeClass = 'border-l-[3px] border-l-slate-700';
              if (isUrgent) {
                leftEdgeClass = 'border-l-[3px] border-l-rose-500 shadow-[-4px_0_14px_rgba(244,63,94,0.35)]';
              } else if (isCaution) {
                leftEdgeClass = 'border-l-[3px] border-l-amber-500 shadow-[-4px_0_14px_rgba(245,158,11,0.35)]';
              }

              const isHighlighted = highlightedEventId === event.conjunction_id;
              const formattedUtc = formatUTC(event.tca).substring(0, 16) + ' UTC';
              const timeRemaining = formatTimeRemaining(event.tca);

              return (
                <div
                  key={event.conjunction_id}
                  ref={(el) => (rowRefs.current[event.conjunction_id] = el)}
                  className={`p-4 sm:p-5 transition-all duration-200 ${leftEdgeClass} ${
                    isDismissed ? 'opacity-60 bg-slate-950/20' : 'bg-transparent'
                  } ${
                    isHighlighted
                      ? 'ring-2 ring-cyan-400 bg-cyan-950/40 motion-reduce:animate-none animate-pulse'
                      : 'hover:bg-slate-800/40 hover:border-cyan-500/30'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Physical Icon & Incident Telemetry */}
                    <div className="flex items-start space-x-3.5 flex-1">
                      {/* Physical severity icon based on miss distance */}
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border mt-0.5 ${
                          isUrgent
                            ? 'bg-rose-950/70 border-rose-500/50 text-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.4)]'
                            : isCaution
                            ? 'bg-amber-950/70 border-amber-500/50 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                            : 'bg-slate-800/80 border-slate-700 text-slate-300'
                        }`}
                      >
                        {isUrgent ? (
                          <ShieldAlert className="w-4 h-4" />
                        ) : isCaution ? (
                          <AlertTriangle className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </div>

                      {/* Details block */}
                      <div className="space-y-1.5 flex-1">
                        {/* Line 1: Primary vs Secondary + ID + Criticality Chip */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-white text-sm sm:text-base font-mono">
                            {event.primary_object.name}
                          </span>
                          <span className="text-xs text-slate-400 font-sans">vs.</span>
                          <span className="text-xs sm:text-sm font-semibold font-mono text-slate-300 uppercase">
                            {event.secondary_object.name}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800/90 text-slate-300 border border-slate-700">
                            {event.conjunction_id}
                          </span>
                          {/* Distinct Mission Criticality Chip */}
                          {getCriticalityChip(event.primary_object.norad_id)}
                        </div>

                        {/* Line 2: Separation, Relative Speed, TCA with Live Countdown */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-slate-300">
                          <div>
                            Separation:{' '}
                            <strong className={isUrgent ? 'text-rose-400 font-bold' : 'text-cyan-300 font-bold'}>
                              {formatDistance(event.miss_distance_km)}
                            </strong>
                          </div>
                          <div>
                            Relative speed:{' '}
                            <strong className="text-white">{formatVelocity(event.relative_velocity_km_s)}</strong>
                          </div>
                          <div className="flex items-center space-x-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              TCA: {formattedUtc}{' '}
                              <span className="text-amber-400 font-bold">({timeRemaining})</span>
                            </span>
                          </div>
                        </div>

                        {/* Line 3: Secondary object description & altitude */}
                        <div className="text-[11px] text-slate-400 font-sans">
                          {event.secondary_object.origin_debris_event || 'Catalogued orbital fragmentation debris'} •{' '}
                          <span className="font-mono">Altitude: {event.altitude_at_tca_km} km</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Custom Status Dropdown + Inspect Dossier Button */}
                    <div className="flex items-center space-x-3 self-end lg:self-center shrink-0 pt-2 lg:pt-0">
                      <StatusDropdown
                        status={event.investigation_status}
                        onChange={(newStatus) => handleStatusChange(event.conjunction_id, newStatus)}
                      />

                      <button
                        type="button"
                        onClick={() => {
                          setActiveDossierEvent(event);
                          onSelectConjunction(event);
                        }}
                        className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-cyan-400 text-xs font-mono font-medium text-slate-200 hover:text-white shadow-sm transition-all focus:outline-none focus:ring-1 focus:ring-cyan-400"
                      >
                        <Eye className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Inspect Dossier</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* COMPACT FOOTER DISCLAIMER                                 */}
      {/* ======================================================== */}
      <div className="bg-slate-900/60 backdrop-blur-md border border-cyan-500/20 rounded-xl p-3 flex items-start sm:items-center space-x-2.5 text-xs text-slate-400 shadow-md">
        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5 sm:mt-0" />
        <p className="text-[11px] leading-relaxed">
          <strong className="text-slate-200">ASTRAVIGIL Scientific Disclaimer:</strong> Conjunction screening reflects coarse mean orbital elements. Alerts do not constitute certified probability calculations or guaranteed collision trajectories.
        </p>
      </div>

      {/* ======================================================== */}
      {/* RIGHT-SIDE GLASS DOSSIER DRAWER                          */}
      {/* ======================================================== */}
      <ConjunctionDossierDrawer
        conjunction={activeDossierEvent}
        isOpen={Boolean(activeDossierEvent)}
        onClose={() => setActiveDossierEvent(null)}
        onNavigateToRisk={(event) => {
          setActiveDossierEvent(null);
          onNavigateToRisk?.(event);
        }}
        onNavigateToContinuity={(event) => {
          setActiveDossierEvent(null);
          onNavigateToContinuity?.(event);
        }}
      />
    </div>
  );
};
