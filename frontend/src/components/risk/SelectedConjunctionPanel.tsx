import React from 'react';
import { ConjunctionEvent } from '../../types/orbital';
import { useOrbitalIntelligence } from '../../context/OrbitalIntelligenceContext';
import { isSameSatellite } from '../../api/adapters';
import { formatDistance, formatVelocity, formatUTC, formatTimeRemaining } from '../../utils/formatters';
import { ArrowRight } from 'lucide-react';

interface SelectedConjunctionPanelProps {
  conjunction: ConjunctionEvent | null;
  onOpenAlertsCentre: (event: ConjunctionEvent) => void;
}

export const SelectedConjunctionPanel: React.FC<SelectedConjunctionPanelProps> = ({
  conjunction,
  onOpenAlertsCentre,
}) => {
  const { satellites } = useOrbitalIntelligence();

  if (!conjunction) {
    return (
      <div className="bg-slate-900/60 backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-6 shadow-2xl h-full flex items-center justify-center text-slate-400 text-xs font-mono">
        Select a conjunction node to inspect orbital hazard and mission telemetry.
      </div>
    );
  }

  const matchedSat = satellites.find(s => isSameSatellite(s.noradId, conjunction.primary_object.norad_id));
  const critScore = matchedSat ? matchedSat.criticality.score : 50;
  const critTier = matchedSat ? matchedSat.criticality.tier : 'Tier 2 High';

  // Format UTC cleanly: "2026-11-23 14:22 UTC"
  const formattedUtcTime = formatUTC(conjunction.tca).substring(0, 16) + ' UTC';
  const timeRemainingStr = formatTimeRemaining(conjunction.tca);

  // Status mapping
  const statusDisplayMap: Record<string, { label: string; badgeClass: string }> = {
    UNREVIEWED: {
      label: 'Unreviewed',
      badgeClass: 'bg-slate-800/80 border-slate-700 text-slate-300',
    },
    UNDER_EVALUATION: {
      label: 'Under Evaluation',
      badgeClass: 'bg-amber-950/60 border-amber-500/50 text-amber-300',
    },
    MONITORING: {
      label: 'Monitoring',
      badgeClass: 'bg-sky-950/60 border-sky-500/50 text-sky-300',
    },
    DISMISSED: {
      label: 'Dismissed',
      badgeClass: 'bg-slate-800/60 border-slate-700/60 text-slate-400',
    },
  };

  const statusInfo = statusDisplayMap[conjunction.investigation_status] || {
    label: conjunction.investigation_status.replace(/_/g, ' '),
    badgeClass: 'bg-slate-800/80 border-slate-700 text-slate-300',
  };

  // Hazard percentage (Closer separation = higher bar fill, 0 to 20 km scale)
  // At 1.82 km: (1 - 1.82/20) * 100 = 90.9%
  const hazardPct = Math.max(5, Math.min(100, Math.round((1 - conjunction.miss_distance_km / 20) * 100)));
  const isCloseHazard = conjunction.miss_distance_km < 5.0;

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-5 sm:p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col justify-between h-full relative overflow-hidden">
      {/* Top Section */}
      <div>
        {/* Title */}
        <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
          Selected Event: {conjunction.primary_object.name}
        </h3>

        {/* Chips Row */}
        <div className="flex items-center space-x-2 mt-2">
          <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-800/90 text-slate-300 border border-slate-700">
            {conjunction.conjunction_id}
          </span>
          <span className={`px-2.5 py-0.5 rounded text-[11px] font-medium border ${statusInfo.badgeClass}`}>
            {statusInfo.label}
          </span>
        </div>

        {/* 2x2 Telemetry Grid */}
        <div className="grid grid-cols-2 gap-2.5 my-4">
          {/* Miss Distance */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
            <div className="text-[11px] text-slate-400 font-medium">Miss distance:</div>
            <div className="text-lg font-bold font-mono text-cyan-300 mt-0.5">
              {formatDistance(conjunction.miss_distance_km)}
            </div>
          </div>

          {/* Relative Velocity */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
            <div className="text-[11px] text-slate-400 font-medium">Relative velocity:</div>
            <div className="text-lg font-bold font-mono text-white mt-0.5">
              {formatVelocity(conjunction.relative_velocity_km_s)}
            </div>
          </div>

          {/* Time of Closest Approach */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
            <div className="text-[11px] text-slate-400 font-medium">Time of closest approach:</div>
            <div className="text-xs font-bold font-mono text-slate-200 mt-1 leading-snug">
              {formattedUtcTime}
            </div>
            <div className="text-[10px] font-mono text-amber-400 mt-0.5">
              ({timeRemainingStr})
            </div>
          </div>

          {/* Secondary Object */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
            <div className="text-[11px] text-slate-400 font-medium">Secondary object:</div>
            <div className="text-xs font-bold font-mono text-slate-200 mt-1 uppercase line-clamp-2 leading-snug">
              {conjunction.secondary_object.name}
            </div>
          </div>
        </div>

        {/* Mini Section 1: Orbital Hazard */}
        <div className="mt-4 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Orbital Hazard</span>
          </div>
          
          {/* Progress Bar (Closer = higher physical hazard) */}
          <div className="w-full h-2 rounded-full bg-slate-800/90 overflow-hidden mt-2">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isCloseHazard
                  ? 'bg-gradient-to-r from-rose-600 to-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.6)]'
                  : conjunction.miss_distance_km < 10
                  ? 'bg-gradient-to-r from-amber-600 to-amber-400'
                  : 'bg-gradient-to-r from-sky-600 to-sky-400'
              }`}
              style={{ width: `${hazardPct}%` }}
            />
          </div>

          {/* Captions */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5 font-mono">
            <span>Physical separation</span>
            <span className="text-[10px] text-slate-500 italic">Closer = higher physical hazard</span>
          </div>
        </div>

        {/* Centered Divider: Assessed independently */}
        <div className="relative flex items-center justify-center my-4">
          <div className="w-full border-t border-slate-800" />
          <span className="absolute bg-[#0b1329] px-3 text-[10px] uppercase font-mono tracking-widest text-slate-500">
            Assessed independently
          </span>
        </div>

        {/* Mini Section 2: Mission Criticality */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-300">Mission Criticality</div>
            <div className="text-lg font-bold font-mono text-cyan-300 mt-0.5">
              {critScore} <span className="text-xs font-normal text-slate-400">/ 100</span>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded text-[10px] font-bold tracking-wide uppercase bg-rose-950/60 text-rose-300 border border-rose-500/40">
            {critTier}
          </span>
        </div>
      </div>

      {/* Bottom Section: Action Button and TLE Uncertainty Note */}
      <div className="mt-6 pt-2">
        <button
          type="button"
          onClick={() => onOpenAlertsCentre(conjunction)}
          className="w-full py-3 px-4 rounded-xl font-bold text-sm text-slate-950 bg-gradient-to-r from-cyan-400 to-cyan-300 hover:from-cyan-300 hover:to-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.35)] hover:shadow-[0_0_25px_rgba(34,211,238,0.5)] transition-all duration-200 flex items-center justify-center space-x-2 group cursor-pointer"
        >
          <span>Open in Alerts Centre</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </button>

        <div className="text-[11px] font-mono text-slate-500 text-center mt-2.5">
          TLE uncertainty ~1-3 km in LEO
        </div>
      </div>
    </div>
  );
};
