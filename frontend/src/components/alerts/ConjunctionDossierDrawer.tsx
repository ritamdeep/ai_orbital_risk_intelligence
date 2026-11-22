import React, { useEffect, useRef } from 'react';
import { ConjunctionEvent } from '../../types/orbital';
import { useOrbitalIntelligence } from '../../context/OrbitalIntelligenceContext';
import { isSameSatellite } from '../../api/adapters';
import { formatDistance, formatVelocity, formatUTC, formatTimeRemaining } from '../../utils/formatters';
import { formatEnum, formatOperator } from '../../utils/textFormatters';
import { X, ArrowRight, ShieldAlert, AlertTriangle, Layers, ExternalLink } from 'lucide-react';

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

  // Close on Escape & trap focus
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

  const matchedSat = satellites.find(s => isSameSatellite(s.noradId, conjunction.primary_object.norad_id));
  const critScore = matchedSat ? matchedSat.criticality.score : 50;
  const critTier = matchedSat ? matchedSat.criticality.tier : 'Tier 2 Moderate';
  const scoringFactors = [
    'Critical national orbital sensing asset',
    'Standard geometric screening buffer applicable',
  ];

  const formattedUtc = formatUTC(conjunction.tca).substring(0, 16) + ' UTC';
  const timeRemaining = formatTimeRemaining(conjunction.tca);

  const statusLabel = formatEnum(conjunction.investigation_status);

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden flex justify-end animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dossier-title"
    >
      {/* Dark backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-in Glass Drawer */}
      <div
        ref={drawerRef}
        className="relative w-full max-w-lg bg-slate-950/95 backdrop-blur-2xl border-l border-cyan-500/30 shadow-[0_0_50px_rgba(0,0,0,0.8)] h-full overflow-y-auto flex flex-col justify-between p-6 z-10 animate-in slide-in-from-right duration-300"
      >
        {/* Top Header */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                  Incident Dossier
                </span>
                <span className="text-xs font-mono font-bold text-slate-300">
                  {conjunction.conjunction_id}
                </span>
              </div>
              <h2 id="dossier-title" className="text-lg font-bold text-white font-mono mt-1">
                {conjunction.primary_object.name}
              </h2>
              <p className="text-xs text-slate-400">
                Encounter with <span className="text-slate-200 font-semibold uppercase">{conjunction.secondary_object.name}</span>
              </p>
            </div>

            <button
              onClick={onClose}
              aria-label="Close incident dossier"
              className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-400 text-slate-400 hover:text-white flex items-center justify-center transition-all focus:outline-none focus:ring-1 focus:ring-cyan-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Status Badge */}
          <div className="flex items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400">Investigation Disposition:</span>
            <span className="px-2.5 py-0.5 rounded text-xs font-mono font-semibold bg-slate-800 border border-slate-700 text-cyan-300">
              {statusLabel}
            </span>
          </div>

          {/* 2x2 Telemetry Inset Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3">
              <div className="text-[11px] text-slate-400 font-medium">Miss distance:</div>
              <div className="text-lg font-bold font-mono text-cyan-300 mt-0.5">
                {formatDistance(conjunction.miss_distance_km)}
              </div>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3">
              <div className="text-[11px] text-slate-400 font-medium">Relative velocity:</div>
              <div className="text-lg font-bold font-mono text-white mt-0.5">
                {formatVelocity(conjunction.relative_velocity_km_s)}
              </div>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3">
              <div className="text-[11px] text-slate-400 font-medium">Time of closest approach:</div>
              <div className="text-xs font-bold font-mono text-slate-200 mt-1 leading-snug">
                {formattedUtc}
              </div>
              <div className="text-[10px] font-mono text-amber-400 mt-0.5">
                ({timeRemaining})
              </div>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3">
              <div className="text-[11px] text-slate-400 font-medium">Secondary object:</div>
              <div className="text-xs font-bold font-mono text-slate-200 mt-1 uppercase line-clamp-2 leading-snug">
                {conjunction.secondary_object.name}
              </div>
            </div>
          </div>

          {/* Separate Section 1: Orbital Hazard (Separation & Speed only) */}
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-200 font-mono flex items-center space-x-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                <span>Orbital Hazard Assessment</span>
              </h3>
              <span className="text-[10px] uppercase font-mono text-slate-500 tracking-wider">
                Assessed Independently
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 pt-1 font-mono">
              <div>
                Separation: <strong className="text-white">{formatDistance(conjunction.miss_distance_km)}</strong>
              </div>
              <div>
                Crossing speed: <strong className="text-white">{formatVelocity(conjunction.relative_velocity_km_s)}</strong>
              </div>
              <div className="col-span-2">
                Altitude at TCA: <strong className="text-slate-200">{conjunction.altitude_at_tca_km} km</strong>
              </div>
            </div>

            <p className="text-[10px] text-slate-500 italic pt-1 border-t border-slate-800/60">
              Physical separation only. Not a collision probability.
            </p>
          </div>

          {/* Centered Divider */}
          <div className="relative flex items-center justify-center my-3">
            <div className="w-full border-t border-slate-800" />
            <span className="absolute bg-[#0b1329] px-3 text-[10px] uppercase font-mono tracking-widest text-slate-500">
              Assessed Independently
            </span>
          </div>

          {/* Separate Section 2: Mission Criticality */}
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-200 font-mono flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>Mission Criticality Assessment</span>
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-rose-950/70 border border-rose-500/40 text-rose-300">
                {critTier}
              </span>
            </div>

            <div className="flex items-baseline space-x-2 font-mono">
              <span className="text-2xl font-extrabold text-cyan-300">{critScore}</span>
              <span className="text-xs text-slate-400">/ 100 Mission Criticality Score</span>
            </div>

            <div className="space-y-1.5 pt-1 border-t border-slate-800/60">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-mono font-semibold">
                Contributing Criticality Factors:
              </div>
              {scoringFactors.map((f, idx) => (
                <div key={idx} className="text-[11px] text-slate-300 flex items-start space-x-1.5 leading-relaxed">
                  <span className="text-cyan-400 font-bold">•</span>
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="pt-4 border-t border-slate-800 space-y-3 mt-4">
          <div className="text-[11px] font-mono text-slate-500 text-center">
            TLE uncertainty ~1-3 km in LEO
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            <button
              onClick={() => onNavigateToRisk(conjunction)}
              className="w-full py-2.5 px-4 rounded-xl font-bold text-xs text-slate-950 bg-gradient-to-r from-cyan-400 to-cyan-300 hover:from-cyan-300 hover:to-cyan-200 shadow-[0_0_15px_rgba(34,211,238,0.35)] transition-all flex items-center justify-center space-x-2"
            >
              <span>View in Risk Analysis</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => onNavigateToContinuity(conjunction)}
              className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-slate-200 bg-slate-900 border border-slate-700 hover:border-cyan-400 hover:text-white transition-all flex items-center justify-center space-x-2"
            >
              <span>View Service Continuity</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
