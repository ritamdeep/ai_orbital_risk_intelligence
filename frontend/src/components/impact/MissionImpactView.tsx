import React, { useState, useEffect } from 'react';
import { SatelliteMissionProfile, OperatorAIBriefing } from '../../types/intelligence';
import { ConjunctionEvent } from '../../types/orbital';
import { CriticalityGauge } from '../satellite/CriticalityGauge';
import { SatelliteSwitcher } from './SatelliteSwitcher';
import { CriticalityScoringTab } from './CriticalityScoringTab';
import { EarthServiceImpactTab } from './EarthServiceImpactTab';
import { ContinuityRedundancyTab } from './ContinuityRedundancyTab';
import { AIBriefingTab } from './AIBriefingTab';
import { formatOperator, formatEnum } from '../../utils/textFormatters';
import { USE_MOCK_DATA } from '../../services/apiClient';
import { Sparkles, Info, Layers } from 'lucide-react';

export type ImpactSubTab = 'criticality' | 'earth_impact' | 'continuity' | 'ai_brief';

interface MissionImpactViewProps {
  missionProfile: SatelliteMissionProfile | null;
  conjunction: ConjunctionEvent | null;
  aiBriefing: OperatorAIBriefing | null;
  availableSatellites?: { noradId: number; name: string; category?: string }[];
  onSelectSatellite?: (noradId: number) => void;
  onSelectAlternative?: (noradId: number) => void;
}

export const MissionImpactView: React.FC<MissionImpactViewProps> = ({
  missionProfile,
  aiBriefing,
  availableSatellites,
  onSelectSatellite,
  onSelectAlternative,
}) => {
  const [activeTab, setActiveTab] = useState<ImpactSubTab>('criticality');

  // Read ?satellite query parameter on mount and sync if different
  useEffect(() => {
    if (typeof window !== 'undefined' && onSelectSatellite) {
      const params = new URLSearchParams(window.location.search);
      const satParam = params.get('satellite');
      if (satParam) {
        const id = parseInt(satParam, 10);
        if (!isNaN(id) && id !== missionProfile?.norad_id) {
          onSelectSatellite(id);
        }
      }
    }
  }, []);

  if (!missionProfile) {
    return (
      <div className="bg-slate-900/60 backdrop-blur-xl border border-cyan-500/20 rounded-3xl p-10 text-center text-slate-400 shadow-2xl space-y-3">
        <Layers className="w-12 h-12 text-slate-500 mx-auto opacity-60" />
        <h3 className="text-base font-bold text-white">No Satellite Selected</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Select a satellite from the Satellite Intelligence catalogue or Conjunction Feed to evaluate downstream service continuity and redundancy gaps.
        </p>
      </div>
    );
  }

  const { criticality, earth_impact, continuity_alternatives } = missionProfile;
  const formattedTier = formatEnum(criticality.tier); // e.g. "Tier 1 Critical"
  const formattedOperatorName = formatOperator(missionProfile.operator); // e.g. "ISRO, Indian Space Research Organisation"
  const formattedStatus = formatEnum(missionProfile.verified_operational_status); // e.g. "Operational"

  const subTabs: { id: ImpactSubTab; label: string; hasSparkle?: boolean; count?: number }[] = [
    { id: 'criticality', label: '1. Criticality Scoring' },
    { id: 'earth_impact', label: '2. Earth Service Impact' },
    { id: 'continuity', label: `3. Continuity & Redundancy Gaps`, count: continuity_alternatives.length },
    { id: 'ai_brief', label: '4. AI Operator Briefing', hasSparkle: true },
  ];

  // Handle keyboard navigation across sub-tabs
  const handleTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = (index + 1) % subTabs.length;
      setActiveTab(subTabs[nextIdx].id);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIdx = (index - 1 + subTabs.length) % subTabs.length;
      setActiveTab(subTabs[prevIdx].id);
    }
  };

  return (
    <div className="w-full space-y-6 select-none animate-in fade-in duration-300">
      {/* ======================================================== */}
      {/* SATELLITE HEADER GLASS CARD                               */}
      {/* ======================================================== */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-cyan-500/20 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col min-[900px]:flex-row min-[900px]:items-center justify-between gap-6 relative overflow-hidden">
        {/* Subtle cyan gradient glow in background */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Left: Satellite Identifiers & Description */}
        <div className="flex-1 space-y-2 z-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 text-xs font-mono font-bold rounded-full bg-cyan-950/70 text-cyan-300 border border-cyan-500/40 shadow-sm">
              NORAD #{missionProfile.norad_id}
            </span>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-950/70 text-emerald-300 border border-emerald-500/40 shadow-sm">
              {formattedStatus}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Launched {missionProfile.launch_year}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-mono mt-1">
            {missionProfile.name}
          </h1>

          <p className="text-xs sm:text-sm text-slate-400 font-medium font-sans">
            Operator: <span className="text-slate-200">{formattedOperatorName}</span>
          </p>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl pt-1">
            {missionProfile.primary_mission_purpose}
          </p>

          {USE_MOCK_DATA && (
            <div className="pt-1">
              <span className="text-[10px] text-slate-400 font-mono italic">
                Mock data. Illustrative values.
              </span>
            </div>
          )}
        </div>

        {/* Right: Satellite Switcher & Animated Criticality Gauge */}
        <div className="flex flex-col items-center min-[900px]:items-end justify-between gap-4 z-10 shrink-0">
          {/* Compact Satellite Switcher Dropdown */}
          <SatelliteSwitcher
            currentNoradId={missionProfile.norad_id}
            onSelectSatellite={(id) => onSelectSatellite?.(id)}
            availableSatellites={availableSatellites}
          />

          {/* Semicircular Animated Criticality Gauge */}
          <div className="flex flex-col items-center">
            <CriticalityGauge score={criticality.score} tier={formattedTier} />
            <span className="text-[11px] text-slate-400 font-mono mt-1.5 text-center">
              Mission criticality does not change collision probability.
            </span>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SUB-TAB PILL NAVIGATION                                   */}
      {/* ======================================================== */}
      <div className="flex items-center justify-start overflow-x-auto pb-1">
        <nav
          role="tablist"
          aria-label="Mission impact analysis views"
          className="flex items-center bg-[#0c1322]/90 backdrop-blur-xl border border-slate-800/90 rounded-full p-1 shadow-2xl shrink-0 gap-1"
        >
          {subTabs.map((tab, idx) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(e) => handleTabKeyDown(e, idx)}
                className={`relative flex items-center space-x-1.5 px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap focus:outline-none ${
                  isActive
                    ? 'border border-cyan-400/60 bg-cyan-950/50 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.35)] font-semibold'
                    : 'border border-transparent text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.hasSparkle && <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] font-mono font-bold text-slate-300">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ======================================================== */}
      {/* ACTIVE SUB-TAB BODY (Dark Glass Panel)                    */}
      {/* ======================================================== */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-cyan-500/20 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative overflow-hidden">
        {/* Tab 1: Criticality Scoring */}
        {activeTab === 'criticality' && (
          <CriticalityScoringTab criticality={criticality} />
        )}

        {/* Tab 2: Earth Service Impact */}
        {activeTab === 'earth_impact' && (
          <EarthServiceImpactTab earthImpact={earth_impact} />
        )}

        {/* Tab 3: Continuity & Redundancy Gaps */}
        {activeTab === 'continuity' && (
          <ContinuityRedundancyTab
            primaryProfile={missionProfile}
            alternatives={continuity_alternatives}
            onSelectAlternative={onSelectAlternative}
          />
        )}

        {/* Tab 4: AI Operator Briefing */}
        {activeTab === 'ai_brief' && (
          <AIBriefingTab aiBriefing={aiBriefing} />
        )}
      </div>

      {/* ======================================================== */}
      {/* COMPACT FOOTER DISCLAIMER                                 */}
      {/* ======================================================== */}
      <div className="bg-slate-900/60 backdrop-blur-md border border-cyan-500/20 rounded-xl p-3 flex items-start sm:items-center space-x-2.5 text-xs text-slate-400 shadow-md">
        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5 sm:mt-0" />
        <p className="text-[11px] leading-relaxed">
          <strong className="text-slate-200">ASTRAVIGIL Scientific Disclaimer:</strong> Preliminary close-approach screening is based on public SGP4 mean elements and does not constitute a certified Conjunction Data Message (CDM). High mission criticality increases intervention priority but does not alter orbital collision mechanics.
        </p>
      </div>
    </div>
  );
};
