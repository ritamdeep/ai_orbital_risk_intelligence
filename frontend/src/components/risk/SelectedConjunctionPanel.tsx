import React from 'react';
import { ConjunctionEvent } from '../../types/orbital';
import { useOrbitalIntelligence } from '../../context/OrbitalIntelligenceContext';
import { isSameSatellite } from '../../api/adapters';
import {
  formatDistance,
  formatVelocity,
  formatUTC,
  formatTimeRemaining,
} from '../../utils/formatters';
import { GlassCard } from '../common/GlassCard';
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
      <GlassCard className="p-6 h-full flex items-center justify-center text-[#b4c6dc] text-sm font-sans text-center">
        Select a conjunction node to inspect orbital hazard and mission telemetry.
      </GlassCard>
    );
  }

  const matchedSat = satellites.find((s) =>
    isSameSatellite(s.noradId, conjunction.primary_object.norad_id)
  );
  const critScore = matchedSat ? matchedSat.criticality.score : 50;
  const critTier = matchedSat ? matchedSat.criticality.tier : 'Tier 2 High';
  const isTier1 = critScore >= 85 || critTier.toLowerCase().includes('1');

  const formattedUtcTime = formatUTC(conjunction.tca).substring(0, 16) + ' UTC';
  const timeRemainingStr = formatTimeRemaining(conjunction.tca);

  const statusDisplayMap: Record<string, { label: string; badgeClass: string }> = {
    UNREVIEWED: {
      label: 'Unreviewed',
      badgeClass: 'bg-white/[0.06] border-white/15 text-slate-200',
    },
    UNDER_EVALUATION: {
      label: 'Under Evaluation',
      badgeClass: 'bg-amber-500/15 border-amber-400/45 text-amber-200 shadow-glow-amber',
    },
    MONITORING: {
      label: 'Monitoring',
      badgeClass: 'bg-cyan-500/15 border-cyan-400/45 text-cyan-200 shadow-glow-cyan',
    },
    DISMISSED: {
      label: 'Dismissed',
      badgeClass: 'bg-white/[0.04] border-white/10 text-[#94adc9]',
    },
  };

  const statusInfo = statusDisplayMap[conjunction.investigation_status] || {
    label: conjunction.investigation_status.replace(/_/g, ' '),
    badgeClass: 'bg-white/[0.06] border-white/15 text-slate-200',
  };

  const hazardPct = Math.max(
    5,
    Math.min(100, Math.round((1 - conjunction.miss_distance_km / 20) * 100))
  );
  const isCloseHazard = conjunction.miss_distance_km < 5.0;

  return (
    <GlassCard
      selected
      glow={isCloseHazard ? 'red' : 'cyan'}
      className="p-5 sm:p-6 flex flex-col justify-between h-full relative overflow-hidden"
    >
      <div>
        <h3 className="type-card-title text-white">
          Selected Event: {conjunction.primary_object.name}
        </h3>

        <div className="flex flex-wrap items-center gap-2 mt-2.5">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-data font-semibold bg-white/[0.07] text-slate-200 border border-white/15">
            {conjunction.conjunction_id}
          </span>
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-sans font-medium border ${statusInfo.badgeClass}`}
          >
            {statusInfo.label}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 my-4">
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-3.5">
            <div className="type-label">Miss distance:</div>
            <div className="text-lg font-semibold font-data text-cyan-300 text-glow-cyan mt-1">
              {formatDistance(conjunction.miss_distance_km)}
            </div>
          </div>

          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-3.5">
            <div className="type-label">Relative velocity:</div>
            <div className="text-lg font-semibold font-data text-white mt-1">
              {formatVelocity(conjunction.relative_velocity_km_s)}
            </div>
          </div>

          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-3.5">
            <div className="type-label">Time of closest approach:</div>
            <div className="text-xs font-semibold font-data text-slate-100 mt-1 leading-snug">
              {formattedUtcTime}
            </div>
            <div className="text-[11px] font-data text-amber-300 mt-0.5">
              ({timeRemainingStr})
            </div>
          </div>

          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-3.5">
            <div className="type-label">Secondary object:</div>
            <div className="text-xs font-semibold font-sans text-slate-100 mt-1 line-clamp-2 leading-snug">
              {conjunction.secondary_object.name}
            </div>
          </div>
        </div>

        {/* Mini Section 1: Orbital Hazard */}
        <div className="mt-4 pt-1">
          <div className="flex items-center justify-between">
            <span className="type-label text-slate-200">Orbital Hazard</span>
          </div>

          <div className="w-full h-2 rounded-full bg-white/[0.08] overflow-hidden mt-2">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isCloseHazard
                  ? 'bg-gradient-to-r from-rose-600 via-rose-500 to-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.7)]'
                  : conjunction.miss_distance_km < 10
                  ? 'bg-gradient-to-r from-amber-500 to-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.55)]'
                  : 'progress-glow-fill'
              }`}
              style={{ width: `${hazardPct}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-[#94adc9] mt-2 font-sans">
            <span>Physical separation</span>
            <span className="text-[11px] italic">Closer = higher physical hazard</span>
          </div>
        </div>

        {/* Centered Divider */}
        <div className="relative flex items-center justify-center my-5">
          <div className="w-full border-t border-white/10" />
          <span className="absolute bg-[#0c1426] px-3 py-0.5 rounded-full border border-white/10 type-label text-[10px]">
            Assessed independently
          </span>
        </div>

        {/* Mini Section 2: Mission Criticality */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="type-label text-slate-200">Mission Criticality</div>
            <div className="text-2xl font-semibold font-data text-cyan-300 text-glow-cyan mt-1">
              {critScore}{' '}
              <span className="text-xs font-normal text-[#94adc9] font-data">/ 100</span>
            </div>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-sans font-semibold tracking-wide uppercase border ${
              isTier1
                ? 'bg-rose-500/15 text-rose-200 border-rose-400/45 shadow-glow-red'
                : 'bg-cyan-500/15 text-cyan-200 border-cyan-400/40 shadow-glow-cyan'
            }`}
          >
            {critTier}
          </span>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="mt-6 pt-2">
        <button
          type="button"
          onClick={() => onOpenAlertsCentre(conjunction)}
          className="btn-primary-glow w-full py-3 px-4 rounded-2xl text-sm flex items-center justify-center space-x-2 group cursor-pointer"
        >
          <span>Open in Alerts Centre</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </button>

        <div className="text-xs font-sans text-[#94adc9] text-center mt-2.5">
          TLE uncertainty <span className="font-data text-slate-300">~1-3 km</span> in LEO
        </div>
      </div>
    </GlassCard>
  );
};
