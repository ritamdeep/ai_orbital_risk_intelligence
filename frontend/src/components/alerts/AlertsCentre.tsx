import React, { useState, useEffect, useRef } from 'react';
import { ConjunctionEvent } from '../../types/orbital';
import { InvestigationStatus } from '../../types/common';
import { useOrbitalIntelligence } from '../../context/OrbitalIntelligenceContext';
import { isSameSatellite } from '../../api/adapters';
import {
  formatDistance,
  formatVelocity,
  formatUTC,
  formatTimeRemaining,
} from '../../utils/formatters';
import { formatEnum } from '../../utils/textFormatters';
import { PHYSICAL_SEVERITY_THRESHOLDS } from '../../constants/screeningConfig';
import { StatusDropdown } from './StatusDropdown';
import { ConjunctionDossierDrawer } from './ConjunctionDossierDrawer';
import { GlassCard } from '../common/GlassCard';
import {
  Bell,
  ShieldAlert,
  AlertTriangle,
  Clock,
  Eye,
  Info,
  ArrowUpDown,
  Search,
  CheckCircle2,
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
  const [, setTimerTick] = useState<number>(0);

  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const interval = setInterval(() => {
      setTimerTick((prev) => prev + 1);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_STATUS_KEY);
      if (saved) {
        const parsed: Record<string, InvestigationStatus> = JSON.parse(saved);
        Object.entries(parsed).forEach(([id, st]) => {
          const current = conjunctions.find((c) => c.conjunction_id === id);
          if (current && current.investigation_status !== st) {
            onUpdateStatus(id, st);
          }
        });
      }
    } catch {
      // Ignore restricted storage environments
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const eventParam = params.get('event');
      const targetId = eventParam || selectedConjunction?.conjunction_id;

      if (targetId) {
        const found = conjunctions.find((c) => c.conjunction_id === targetId);
        if (found) {
          setHighlightedEventId(targetId);
          setActiveDossierEvent(found);

          setTimeout(() => {
            const el = rowRefs.current[targetId];
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 150);

          const timer = setTimeout(() => {
            setHighlightedEventId(null);
          }, 3000);
          return () => clearTimeout(timer);
        }
      }
    }
  }, [conjunctions, selectedConjunction]);

  const handleStatusChange = (eventId: string, newStatus: InvestigationStatus) => {
    onUpdateStatus(eventId, newStatus);

    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_STATUS_KEY);
      const currentMap: Record<string, InvestigationStatus> = saved ? JSON.parse(saved) : {};
      currentMap[eventId] = newStatus;
      localStorage.setItem(LOCAL_STORAGE_STATUS_KEY, JSON.stringify(currentMap));
    } catch {
      // Ignore storage errors
    }

    const formatted = formatEnum(newStatus);
    setToastMessage(`${eventId} set to ${formatted}`);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const getCriticality = (noradId: number) => {
    const sat = satellites.find((s) => isSameSatellite(s.noradId, noradId));
    return sat ? sat.criticality.score : 50;
  };

  const getCriticalityTier = (noradId: number) => {
    const sat = satellites.find((s) => isSameSatellite(s.noradId, noradId));
    return sat ? sat.criticality.tier : 'Tier 3 Moderate';
  };

  const filteredEvents = conjunctions.filter((c) => {
    if (statusFilter !== 'ALL' && c.investigation_status !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName =
        c.primary_object.name.toLowerCase().includes(q) ||
        c.secondary_object.name.toLowerCase().includes(q) ||
        c.conjunction_id.toLowerCase().includes(q);
      if (!matchName) return false;
    }
    return true;
  });

  const sortedEvents = [...filteredEvents].sort((a, b) => {
    if (sortBy === 'soonest_tca') {
      return new Date(a.tca).getTime() - new Date(b.tca).getTime();
    }
    if (sortBy === 'smallest_distance') {
      return a.miss_distance_km - b.miss_distance_km;
    }
    if (sortBy === 'highest_criticality') {
      return (
        getCriticality(b.primary_object.norad_id) - getCriticality(a.primary_object.norad_id)
      );
    }
    return 0;
  });

  const statusCounts = {
    ALL: conjunctions.length,
    UNREVIEWED: conjunctions.filter((c) => c.investigation_status === 'UNREVIEWED').length,
    UNDER_EVALUATION: conjunctions.filter((c) => c.investigation_status === 'UNDER_EVALUATION')
      .length,
    MONITORING: conjunctions.filter((c) => c.investigation_status === 'MONITORING').length,
    DISMISSED: conjunctions.filter((c) => c.investigation_status === 'DISMISSED').length,
  };

  const getCriticalityChip = (noradId: number) => {
    const score = getCriticality(noradId);
    const tier = getCriticalityTier(noradId);
    const formattedTier = formatEnum(tier);
    const isTier1 = tier === 'TIER_1_CRITICAL' || score >= 85;
    const isTier2 = !isTier1 && (tier === 'TIER_2_HIGH' || score >= 70);

    let chipClasses = 'bg-violet-500/15 border-violet-400/40 text-violet-200 shadow-glow-violet';
    if (isTier1) {
      chipClasses = 'bg-rose-500/15 border-rose-400/45 text-rose-200 shadow-glow-red';
    } else if (isTier2) {
      chipClasses = 'bg-amber-500/15 border-amber-400/45 text-amber-200 shadow-glow-amber';
    }

    return (
      <span
        className={`px-2.5 py-0.5 rounded-full text-[11px] font-sans font-semibold border tracking-wide whitespace-nowrap ${chipClasses}`}
      >
        Mission criticality <span className="font-data">{score}</span> · {formattedTier}
      </span>
    );
  };

  return (
    <div className="w-full space-y-5 select-none relative">
      {/* Floating Toast Notification */}
      {toastMessage && (
        <GlassCard
          variant="chip"
          glow="cyan"
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 px-4 py-3 text-xs font-sans font-medium text-cyan-200 flex items-center space-x-2.5"
        >
          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{toastMessage}</span>
        </GlassCard>
      )}

      {/* Top Page Header (Consistent Across All Pages) */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-glow-cyan shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <h1 className="type-page-title">Orbital Risk Alerts Centre</h1>
            <span
              aria-live="polite"
              className="px-3 py-1 text-xs font-sans font-semibold rounded-full bg-cyan-500/15 border border-cyan-400/40 text-cyan-200 shadow-glow-cyan"
            >
              <span className="font-data">{filteredEvents.length}</span> Events
            </span>
            {overallFidelity !== 'Live' && (
              <span className="text-xs text-[#94adc9] font-sans italic hidden sm:inline">
                Mock data. Illustrative values.
              </span>
            )}
          </div>
          <p className="text-sm text-[#b4c6dc] mt-1.5 font-sans">
            Operational triage dashboard for conjunction investigation and alert dispositioning.
          </p>
        </div>

        {/* Sort & Search Glass Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <GlassCard variant="chip" className="relative flex items-center px-3 py-1.5">
            <Search className="w-4 h-4 text-[#94adc9] mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Filter name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs sm:text-sm text-white placeholder-[#94adc9] focus:outline-none font-sans w-40 sm:w-48"
            />
          </GlassCard>

          <GlassCard
            variant="chip"
            className="flex items-center space-x-2 px-3 py-1.5 text-xs sm:text-sm font-sans text-slate-200"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as AlertSortOption)}
              aria-label="Sort conjunction events"
              className="bg-transparent text-slate-100 text-xs sm:text-sm font-sans focus:outline-none cursor-pointer"
            >
              <option value="soonest_tca" className="bg-[#0b1325] text-slate-100">
                Soonest TCA
              </option>
              <option value="smallest_distance" className="bg-[#0b1325] text-slate-100">
                Smallest miss distance
              </option>
              <option value="highest_criticality" className="bg-[#0b1325] text-slate-100">
                Highest criticality
              </option>
            </select>
          </GlassCard>
        </div>
      </div>

      {/* Filter Pills Bar */}
      <div className="flex items-center overflow-x-auto pb-1">
        <GlassCard
          variant="pill"
          role="tablist"
          aria-label="Conjunction status filters"
          className="flex items-center p-1.5 shrink-0 gap-1"
        >
          {(['ALL', 'UNREVIEWED', 'UNDER_EVALUATION', 'MONITORING', 'DISMISSED'] as const).map(
            (st) => {
              const isActive = statusFilter === st;
              const count = statusCounts[st];
              const label = st === 'ALL' ? 'All' : formatEnum(st);

              return (
                <button
                  key={st}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setStatusFilter(st)}
                  className={`relative flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-sans font-medium transition-all duration-200 whitespace-nowrap ${
                    isActive
                      ? 'glass-selected bg-cyan-500/20 text-cyan-200 font-semibold'
                      : 'border border-transparent text-[#b4c6dc] hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <span>{label}</span>
                  <span
                    className={`text-[11px] font-data px-1.5 py-0.2 rounded-full ${
                      isActive
                        ? 'bg-cyan-400/25 text-cyan-100 font-semibold'
                        : 'bg-white/[0.08] text-[#94adc9]'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            }
          )}
        </GlassCard>
      </div>

      {/* MAIN ALERTS CONTAINER — ONE SINGLE GlassCard (NO backdrop-filter on individual rows!) */}
      <GlassCard className="overflow-hidden">
        {/* Scientific Rule #1 Note Strip */}
        <div className="bg-white/[0.03] border-b border-white/[0.08] px-5 sm:px-6 py-3 text-xs text-[#b4c6dc] flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-sans">
          <div className="flex items-start sm:items-center space-x-2">
            <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5 sm:mt-0" />
            <span className="leading-relaxed">
              <strong className="text-slate-100 font-semibold">Scientific Rule #1:</strong> Preliminary close-approach screening is based on public SGP4 mean elements and does not constitute a certified Conjunction Data Message (CDM).
            </span>
          </div>
          <span className="text-xs text-[#94adc9] shrink-0">
            TLE uncertainty <span className="font-data text-slate-200">~1-3 km</span> in LEO
          </span>
        </div>

        {/* Legend strip */}
        <div className="bg-white/[0.015] border-b border-white/[0.08] px-5 sm:px-6 py-2.5 text-xs text-[#94adc9] font-sans flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)] shrink-0" />
            <span>Left edge = physical miss distance.</span>
          </span>
          <span className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.7)] shrink-0" />
            <span>Chip = mission criticality.</span>
          </span>
          <span className="text-slate-200 font-semibold">Assessed independently.</span>
        </div>

        {/* SMOOTH-SCROLLING EVENT ROWS LIST (Plain translucent rows, hairline dividers, hover glow only) */}
        <div className="divide-y divide-white/[0.08] max-h-[68vh] overflow-y-auto scroll-smooth">
          {sortedEvents.length === 0 ? (
            <div className="p-12 text-center text-[#b4c6dc] text-sm font-sans space-y-2.5">
              <p>No conjunction events match the selected filter criteria.</p>
              <button
                onClick={() => {
                  setStatusFilter('ALL');
                  setSearchQuery('');
                }}
                className="text-cyan-300 hover:underline text-sm font-medium"
              >
                Reset filters
              </button>
            </div>
          ) : (
            sortedEvents.map((event) => {
              const isUrgent = event.miss_distance_km < PHYSICAL_SEVERITY_THRESHOLDS.URGENT_KM;
              const isCaution =
                !isUrgent && event.miss_distance_km <= PHYSICAL_SEVERITY_THRESHOLDS.CAUTION_KM;
              const isDismissed = event.investigation_status === 'DISMISSED';
              const isSelectedRow =
                selectedConjunction?.conjunction_id === event.conjunction_id ||
                highlightedEventId === event.conjunction_id;

              let leftEdgeClass = 'border-l-[3px] border-l-sky-400/50';
              if (isUrgent) {
                leftEdgeClass =
                  'border-l-[3px] border-l-rose-500 shadow-[inset_4px_0_16px_-6px_rgba(244,63,94,0.45)]';
              } else if (isCaution) {
                leftEdgeClass =
                  'border-l-[3px] border-l-amber-400 shadow-[inset_4px_0_16px_-6px_rgba(245,158,11,0.38)]';
              }

              const formattedUtc = formatUTC(event.tca).substring(0, 16) + ' UTC';
              const timeRemaining = formatTimeRemaining(event.tca);

              return (
                <div
                  key={event.conjunction_id}
                  ref={(el) => {
                    rowRefs.current[event.conjunction_id] = el;
                  }}
                  className={`px-5 py-4 sm:px-6 sm:py-5 transition-all duration-200 ${leftEdgeClass} ${
                    isDismissed ? 'opacity-60 bg-white/[0.005]' : 'bg-white/[0.015]'
                  } ${
                    isSelectedRow
                      ? 'bg-cyan-500/[0.09] shadow-[inset_0_0_24px_rgba(34,211,238,0.16)]'
                      : 'hover:bg-white/[0.045] hover:shadow-[inset_0_0_24px_rgba(34,211,238,0.08)]'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start space-x-4 flex-1 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border mt-0.5 ${
                          isUrgent
                            ? 'bg-rose-500/15 border-rose-400/50 text-rose-300 shadow-glow-red'
                            : isCaution
                            ? 'bg-amber-500/15 border-amber-400/50 text-amber-300 shadow-glow-amber'
                            : 'bg-cyan-500/10 border-cyan-400/30 text-cyan-300 shadow-glow-cyan'
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

                      <div className="space-y-2 flex-1 min-w-0">
                        {/* Line 1: Primary vs Secondary + ID + Criticality Chip */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-display font-semibold text-white text-base tracking-[-0.01em]">
                            {event.primary_object.name}
                          </span>
                          <span className="text-xs text-[#94adc9] font-sans">vs.</span>
                          <span className="text-sm font-sans font-medium text-slate-200">
                            {event.secondary_object.name}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-data font-medium bg-white/[0.07] text-[#b4c6dc] border border-white/10">
                            {event.conjunction_id}
                          </span>
                          {getCriticalityChip(event.primary_object.norad_id)}
                        </div>

                        {/* Line 2: Separation, Relative Speed, TCA with Live Countdown */}
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs sm:text-[13px] font-sans text-[#b4c6dc]">
                          <div>
                            Separation:{' '}
                            <strong
                              className={`font-data font-semibold ${
                                isUrgent ? 'text-rose-300 text-glow-red' : 'text-cyan-300'
                              }`}
                            >
                              {formatDistance(event.miss_distance_km)}
                            </strong>
                          </div>
                          <div>
                            Relative speed:{' '}
                            <strong className="font-data font-semibold text-white">
                              {formatVelocity(event.relative_velocity_km_s)}
                            </strong>
                          </div>
                          <div className="flex items-center space-x-1.5">
                            <Clock className="w-3.5 h-3.5 text-[#94adc9]" />
                            <span>
                              TCA: <span className="font-data text-slate-100">{formattedUtc}</span>{' '}
                              <span className="font-data text-amber-300 font-semibold">
                                ({timeRemaining})
                              </span>
                            </span>
                          </div>
                        </div>

                        {/* Line 3: Calm muted secondary description & altitude */}
                        <div className="text-xs text-[#94adc9] font-sans leading-relaxed">
                          {event.secondary_object.origin_debris_event ||
                            'Catalogued orbital fragmentation debris'}{' '}
                          •{' '}
                          <span>
                            Altitude:{' '}
                            <span className="font-data text-[#b4c6dc]">
                              {event.altitude_at_tca_km} km
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Status Dropdown + Inspect Dossier Button */}
                    <div className="flex items-center space-x-3 self-end lg:self-center shrink-0 pt-1 lg:pt-0">
                      <StatusDropdown
                        status={event.investigation_status}
                        onChange={(newStatus) =>
                          handleStatusChange(event.conjunction_id, newStatus)
                        }
                      />

                      <button
                        type="button"
                        onClick={() => {
                          setActiveDossierEvent(event);
                          onSelectConjunction(event);
                        }}
                        className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-2xl bg-white/[0.06] border border-white/15 hover:border-cyan-400/50 hover:bg-cyan-500/10 hover:shadow-glow-cyan text-xs font-sans font-medium text-slate-100 hover:text-white transition-all duration-200"
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
      </GlassCard>

      {/* Compact Footer Disclaimer */}
      <GlassCard
        variant="chip"
        className="p-3.5 flex items-start sm:items-center space-x-2.5 text-xs text-[#b4c6dc]"
      >
        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5 sm:mt-0" />
        <p className="leading-relaxed">
          <strong className="text-slate-100 font-semibold">ASTRAVIGIL Scientific Disclaimer:</strong> Conjunction screening reflects coarse mean orbital elements. Alerts do not constitute certified probability calculations or guaranteed collision trajectories.
        </p>
      </GlassCard>

      {/* Right-Side Glass Dossier Drawer */}
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
