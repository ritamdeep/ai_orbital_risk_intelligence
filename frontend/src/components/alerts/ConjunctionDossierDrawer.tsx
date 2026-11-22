import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ConjunctionEvent } from '../../types/orbital';
import { useOrbitalIntelligence } from '../../context/OrbitalIntelligenceContext';
import { isSameSatellite } from '../../api/adapters';
import {
  formatDistance,
  formatVelocity,
  formatUTC,
  formatTimeRemaining,
} from '../../utils/formatters';
import { formatEnum } from '../../utils/textFormatters';
import { X, ArrowRight, ShieldAlert, Layers, ExternalLink } from 'lucide-react';

interface ConjunctionDossierDrawerProps {
  conjunction: ConjunctionEvent | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToRisk: (event: ConjunctionEvent) => void;
  onNavigateToContinuity: (event: ConjunctionEvent) => void;
}

export const ConjunctionDossierDrawer: React.FC<ConjunctionDossierDrawerProps> = ({
  conjunction,
  isOpen,
  onClose,
  onNavigateToRisk,
  onNavigateToContinuity,
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const { satellites } = useOrbitalIntelligence();

  if (!isOpen || !conjunction) return null;

  const matchedSat = satellites.find((s) =>
    isSameSatellite(s.noradId, conjunction.primary_object.norad_id)
  );
  const critScore = matchedSat ? matchedSat.criticality.score : 50;
  const critTier = matchedSat ? matchedSat.criticality.tier : 'Tier 2 Moderate';
  const scoringFactors = [
    'Critical national orbital sensing asset',
    'Standard geometric screening buffer applicable',
  ];

  const formattedUtc = formatUTC(conjunction.tca).substring(0, 16) + ' UTC';
  const timeRemaining = formatTimeRemaining(conjunction.tca);
  const statusLabel = formatEnum(conjunction.investigation_status);

  const drawerMarkup = (
    <div
      className="fixed inset-0 z-[70] overflow-hidden flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dossier-title"
    >
      {/* Dark backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/65 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-in Glass Drawer */}
      <div
        ref={drawerRef}
        className="glass-surface relative w-full max-w-lg rounded-none rounded-l-[24px] border-r-0 border-y-0 h-full overflow-y-auto flex flex-col justify-between p-6 z-10 bg-[#060d1e]/92"
      >
        {/* Top Header */}
        <div className="space-y-4">
          <div className="flex items-start justify-between pb-4 border-b border-white/10 gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] uppercase font-sans font-semibold tracking-[0.08em] px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-200 border border-cyan-400/40">
                  Incident Dossier
                </span>
                <span className="text-xs font-data font-semibold text-[#b4c6dc]">
                  {conjunction.conjunction_id}
                </span>
              </div>
              <h2
                id="dossier-title"
                className="font-display text-xl font-bold text-white tracking-[-0.02em] mt-2"
              >
                {conjunction.primary_object.name}
              </h2>
              <p className="text-sm text-[#b4c6dc] mt-0.5">
                Encounter with{' '}
                <span className="text-slate-100 font-semibold">
                  {conjunction.secondary_object.name}
                </span>
              </p>
            </div>

            <button
              onClick={onClose}
              aria-label="Close incident dossier"
              className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/15 hover:border-cyan-400/50 text-[#b4c6dc] hover:text-white flex items-center justify-center transition-all shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Status Badge */}
          <div className="flex items-center justify-between bg-white/[0.03] p-3.5 rounded-2xl border border-white/[0.08]">
            <span className="text-xs font-sans text-[#b4c6dc]">Investigation Disposition:</span>
            <span className="px-3 py-0.5 rounded-full text-xs font-sans font-semibold bg-cyan-500/15 border border-cyan-400/40 text-cyan-200 shadow-glow-cyan">
              {statusLabel}
            </span>
          </div>

          {/* 2x2 Telemetry Inset Grid */}
          <div className="grid grid-cols-2 gap-3">
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
                {formattedUtc}
              </div>
              <div className="text-[11px] font-data text-amber-300 mt-0.5">
                ({timeRemaining})
              </div>
            </div>

            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-3.5">
              <div className="type-label">Secondary object:</div>
              <div className="text-xs font-semibold font-sans text-slate-100 mt-1 line-clamp-2 leading-snug">
                {conjunction.secondary_object.name}
              </div>
            </div>
          </div>

          {/* Separate Section 1: Orbital Hazard */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-display font-semibold text-white flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span>Orbital Hazard Assessment</span>
              </h3>
              <span className="type-label text-[10px]">Assessed Independently</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-[#b4c6dc] pt-1 font-sans">
              <div>
                Separation:{' '}
                <strong className="font-data text-white">
                  {formatDistance(conjunction.miss_distance_km)}
                </strong>
              </div>
              <div>
                Crossing speed:{' '}
                <strong className="font-data text-white">
                  {formatVelocity(conjunction.relative_velocity_km_s)}
                </strong>
              </div>
              <div className="col-span-2">
                Altitude at TCA:{' '}
                <strong className="font-data text-slate-100">
                  {conjunction.altitude_at_tca_km} km
                </strong>
              </div>
            </div>

            <p className="text-xs text-[#94adc9] italic pt-2 border-t border-white/[0.08]">
              Physical separation only. Not a collision probability.
            </p>
          </div>

          {/* Centered Divider */}
          <div className="relative flex items-center justify-center my-3">
            <div className="w-full border-t border-white/10" />
            <span className="absolute bg-[#0a1326] px-3 py-0.5 rounded-full border border-white/10 type-label text-[10px]">
              Assessed Independently
            </span>
          </div>

          {/* Separate Section 2: Mission Criticality */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-display font-semibold text-white flex items-center space-x-2">
                <Layers className="w-4 h-4 text-violet-400" />
                <span>Mission Criticality Assessment</span>
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-sans font-semibold bg-rose-500/15 border border-rose-400/45 text-rose-200 shadow-glow-red">
                {critTier}
              </span>
            </div>

            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-semibold font-data text-cyan-300 text-glow-cyan">
                {critScore}
              </span>
              <span className="text-xs text-[#94adc9] font-sans">
                <span className="font-data">/ 100</span> Mission Criticality Score
              </span>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-white/[0.08]">
              <div className="type-label">Contributing Criticality Factors:</div>
              {scoringFactors.map((f, idx) => (
                <div
                  key={idx}
                  className="text-xs text-slate-200 flex items-start space-x-2 leading-relaxed"
                >
                  <span className="text-cyan-400 font-bold">•</span>
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="pt-4 border-t border-white/10 space-y-3 mt-5">
          <div className="text-xs font-sans text-[#94adc9] text-center">
            TLE uncertainty <span className="font-data text-slate-300">~1-3 km</span> in LEO
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            <button
              onClick={() => onNavigateToRisk(conjunction)}
              className="btn-primary-glow w-full py-2.5 px-4 rounded-2xl text-sm flex items-center justify-center space-x-2"
            >
              <span>View in Risk Analysis</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => onNavigateToContinuity(conjunction)}
              className="w-full py-2.5 px-4 rounded-2xl font-sans font-semibold text-sm text-slate-100 bg-white/[0.06] border border-white/15 hover:border-cyan-400/50 hover:bg-cyan-500/10 hover:shadow-glow-cyan transition-all flex items-center justify-center space-x-2"
            >
              <span>View Service Continuity</span>
              <ExternalLink className="w-4 h-4 text-cyan-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(drawerMarkup, document.body) : drawerMarkup;
};
