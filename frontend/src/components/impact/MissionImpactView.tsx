import React, { useState, useEffect } from 'react';
import { SatelliteMissionProfile, OperatorAIBriefing } from '../../types/intelligence';
import { ConjunctionEvent } from '../../types/orbital';
import { CriticalityGauge } from '../satellite/CriticalityGauge';
import { SatelliteSwitcher } from './SatelliteSwitcher';
import { CriticalityScoringTab } from './CriticalityScoringTab';
import { EarthServiceImpactTab } from './EarthServiceImpactTab';
import { ContinuityRedundancyTab } from './ContinuityRedundancyTab';
import { AIBriefingTab } from './AIBriefingTab';
import { GlassCard } from '../common/GlassCard';
import { formatOperator, formatEnum } from '../../utils/textFormatters';
import { useOrbitalIntelligence } from '../../context/OrbitalIntelligenceContext';
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
  const { overallFidelity } = useOrbitalIntelligence();
  const [activeTab, setActiveTab] = useState<ImpactSubTab>('criticality');

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
      <GlassCard className="p-10 text-center text-[#b4c6dc] space-y-3">
        <Layers className="w-12 h-12 text-[#94adc9] mx-auto opacity-70" />
        <h3 className="type-card-title text-white">No Satellite Selected</h3>
        <p className="text-sm text-[#b4c6dc] max-w-md mx-auto">
          Select a satellite from the Satellite Intelligence catalogue or Conjunction Feed to evaluate downstream service continuity and redundancy gaps.
        </p>
      </GlassCard>
    );
  }

  const { criticality, earth_impact, continuity_alternatives } = missionProfile;
  const formattedTier = formatEnum(criticality.tier);
  const formattedOperatorName = formatOperator(missionProfile.operator);
  const formattedStatus = formatEnum(missionProfile.verified_operational_status);

  const subTabs: { id: ImpactSubTab; label: string; hasSparkle?: boolean; count?: number }[] = [
    { id: 'criticality', label: '1. Criticality Scoring' },
    { id: 'earth_impact', label: '2. Earth Service Impact' },
    { id: 'continuity', label: '3. Continuity & Redundancy Gaps', count: continuity_alternatives.length },
    { id: 'ai_brief', label: '4. AI Operator Briefing', hasSparkle: true },
  ];

  const handleTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveTab(subTabs[(index + 1) % subTabs.length].id);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveTab(subTabs[(index - 1 + subTabs.length) % subTabs.length].id);
    }
  };

  return (
    <div className="w-full space-y-6 select-none">
      {/* SATELLITE HEADER GLASS CARD */}
      <GlassCard
        selected
        glow="violet"
        className="p-5 sm:p-6 flex flex-col min-[900px]:flex-row min-[900px]:items-center justify-between gap-6 relative overflow-hidden"
      >
        {/* Left: Satellite Identifiers & Description */}
        <div className="flex-1 space-y-2.5 z-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-0.5 text-xs font-data font-semibold rounded-full bg-cyan-500/15 text-cyan-200 border border-cyan-400/40 shadow-glow-cyan">
              NORAD #{missionProfile.norad_id}
            </span>
            <span className="px-3 py-0.5 text-xs font-sans font-semibold rounded-full bg-emerald-500/15 text-emerald-200 border border-emerald-400/40 shadow-glow-green">
              {formattedStatus}
            </span>
            <span className="text-xs text-[#94adc9] font-sans">
              Launched <span className="font-data text-slate-200">{missionProfile.launch_year}</span>
            </span>
          </div>

          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-[-0.02em] text-white mt-1">
            {missionProfile.name}
          </h1>

          <p className="text-sm text-[#94adc9] font-sans">
            Operator: <span className="text-slate-100 font-medium">{formattedOperatorName}</span>
          </p>

          <p className="type-body text-[#b4c6dc] max-w-2xl pt-0.5">
            {missionProfile.primary_mission_purpose}
          </p>

          {overallFidelity !== 'Live' && (
            <div className="pt-0.5">
              <span className="text-xs text-[#94adc9] font-sans italic">
                Mock data. Illustrative values.
              </span>
            </div>
          )}
        </div>

        {/* Right: Satellite Switcher & Animated Criticality Gauge */}
        <div className="flex flex-col items-center min-[900px]:items-end justify-between gap-4 z-10 shrink-0">
          <SatelliteSwitcher
            currentNoradId={missionProfile.norad_id}
            onSelectSatellite={(id) => onSelectSatellite?.(id)}
            availableSatellites={availableSatellites}
          />

          <div className="flex flex-col items-center">
            <CriticalityGauge score={criticality.score} tier={formattedTier} />
            <span className="text-xs text-[#94adc9] font-sans mt-2 text-center">
              Mission criticality does not change collision probability.
            </span>
          </div>
        </div>
      </GlassCard>

      {/* SUB-TAB PILL NAVIGATION */}
      <div className="flex items-center justify-start overflow-x-auto pb-1">
        <GlassCard
          as="nav"
          variant="pill"
          role="tablist"
          aria-label="Mission impact analysis views"
          className="flex items-center p-1.5 shrink-0 gap-1"
        >
          {subTabs.map((tab, idx) => {
            const isActive = activeTab === tab.id;
            const activeClass = tab.hasSparkle
              ? 'glass-selected-violet bg-violet-500/20 text-violet-100 font-semibold'
              : 'glass-selected bg-cyan-500/20 text-cyan-200 font-semibold';

            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(e) => handleTabKeyDown(e, idx)}
                className={`relative flex items-center space-x-1.5 px-4 py-1.5 rounded-full text-xs sm:text-[13px] font-sans font-medium transition-all duration-200 whitespace-nowrap ${
                  isActive
                    ? activeClass
                    : 'border border-transparent text-[#b4c6dc] hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                {tab.hasSparkle && (
                  <Sparkles className="w-3.5 h-3.5 text-violet-300 shrink-0" />
                )}
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-white/[0.10] text-[11px] font-data font-semibold text-slate-200">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </GlassCard>
      </div>

      {/* ACTIVE SUB-TAB BODY */}
      <GlassCard
        glow={activeTab === 'ai_brief' ? 'violet' : 'cyan'}
        className="p-5 sm:p-7 relative overflow-hidden"
      >
        {activeTab === 'criticality' && <CriticalityScoringTab criticality={criticality} />}

        {activeTab === 'earth_impact' && <EarthServiceImpactTab earthImpact={earth_impact} />}

        {activeTab === 'continuity' && (
          <ContinuityRedundancyTab
            primaryProfile={missionProfile}
            alternatives={continuity_alternatives}
            onSelectAlternative={onSelectAlternative}
          />
        )}

        {activeTab === 'ai_brief' && <AIBriefingTab aiBriefing={aiBriefing} />}
      </GlassCard>

      {/* COMPACT FOOTER DISCLAIMER */}
      <GlassCard
        variant="chip"
        className="p-3.5 flex items-start sm:items-center space-x-2.5 text-xs text-[#b4c6dc]"
      >
        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5 sm:mt-0" />
        <p className="leading-relaxed">
          <strong className="text-slate-100 font-semibold">ASTRAVIGIL Scientific Disclaimer:</strong> Preliminary close-approach screening is based on public SGP4 mean elements and does not constitute a certified Conjunction Data Message (CDM). High mission criticality increases intervention priority but does not alter orbital collision mechanics.
        </p>
      </GlassCard>
    </div>
  );
};
