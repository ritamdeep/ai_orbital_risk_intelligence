import React, { useState } from 'react';
import { SpaceObjectSummary, ConjunctionEvent } from '../../types/orbital';
import { Globe3DView } from '../monitoring/Globe3DView';
import { useOrbitalIntelligence } from '../../context/OrbitalIntelligenceContext';
import { GlassCard } from '../common/GlassCard';
import {
  Orbit,
  Satellite,
  AlertTriangle,
  ShieldAlert,
  X,
  Sparkles,
  HelpCircle,
  GripHorizontal,
  RotateCcw,
} from 'lucide-react';
import { NavPage } from '../layout/Navbar';

interface OverviewDashboardProps {
  objects: SpaceObjectSummary[];
  conjunctions: ConjunctionEvent[];
  selectedObject: SpaceObjectSummary | null;
  selectedConjunction?: ConjunctionEvent | null;
  onSelectObject: (obj: SpaceObjectSummary) => void;
  onSelectConjunction?: (event: ConjunctionEvent) => void;
  onNavigate: (page: NavPage) => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  objects,
  conjunctions,
  selectedObject,
  onSelectObject,
  onNavigate,
}) => {
  // Toggle states for globe controls (passed down to Globe3DView)
  const [showOrbits, setShowOrbits] = useState<boolean>(true);
  const [showDebris, setShowDebris] = useState<boolean>(true);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);

  // Selected Satellite Panel visibility
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(true);

  // AI search bar state
  const [searchPrompt, setSearchPrompt] = useState<string>('');

  const { selectedMissionProfile, selectedSatellite } = useOrbitalIntelligence();

  // Default to CARTOSAT-3 (44431) or current selectedObject or first object
  const activeSatellites = objects.filter((o) => o.object_type === 'PAYLOAD');
  const cataloguedDebris = objects.filter(
    (o) => o.object_type === 'DEBRIS' || o.object_type === 'ROCKET_BODY'
  );
  const urgentEvents = conjunctions.filter((c) => c.miss_distance_km < 5.0);

  const currentSat =
    selectedObject || objects.find((o) => o.norad_id === 44431) || objects[0];

  // Format purpose
  const getPurpose = (sat: SpaceObjectSummary | null) => {
    if (!sat) return 'Earth Observation';
    if (selectedMissionProfile?.primary_mission_purpose) {
      return selectedSatellite?.category || selectedMissionProfile.primary_mission_purpose;
    }
    if (selectedSatellite?.category) {
      return selectedSatellite.category;
    }
    return sat.object_type === 'PAYLOAD' ? 'Earth Observation' : 'Orbital Fragment';
  };

  const handleGlobeSelect = (obj: SpaceObjectSummary) => {
    onSelectObject(obj);
    setIsPanelOpen(true);
  };

  return (
    <div className="relative w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5 flex-1 flex flex-col justify-between gap-4 select-none">
      {/* MAIN HERO STAGE: Left KPIs | Centered Full-Viewport Globe | Right Mission Panels */}
      <div className="relative flex-1 grid grid-cols-1 lg:grid-cols-12 items-center gap-5 min-h-[500px] lg:min-h-[580px]">
        {/* LEFT COLUMN: 4 Real Glass KPI Cards */}
        <div className="order-2 lg:order-1 lg:col-span-3 space-y-3.5 z-20">
          {/* KPI 1 */}
          <GlassCard interactive glow="cyan" className="p-5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="type-label">Tracked Catalogued Objects</div>
              <div className="type-kpi text-white text-glow-cyan mt-1.5">28,410+</div>
            </div>
            <div className="w-12 h-12 rounded-full bg-cyan-500/15 border border-cyan-400/35 flex items-center justify-center text-cyan-300 shrink-0 shadow-glow-cyan">
              <Orbit className="w-5 h-5" />
            </div>
          </GlassCard>

          {/* KPI 2 */}
          <GlassCard interactive glow="cyan" className="p-5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="type-label">Monitored Active Satellites</div>
              <div className="type-kpi text-cyan-300 text-glow-cyan mt-1.5">
                {activeSatellites.length || 5}
              </div>
            </div>
            <div className="w-12 h-12 rounded-full bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shrink-0 shadow-glow-cyan">
              <Satellite className="w-5 h-5" />
            </div>
          </GlassCard>

          {/* KPI 3 */}
          <GlassCard interactive glow="amber" className="p-5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="type-label">Tracked Catalogued Debris</div>
              <div className="type-kpi text-amber-300 text-glow-amber mt-1.5">
                {cataloguedDebris.length || 3}
              </div>
            </div>
            <div className="w-12 h-12 rounded-full bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0 shadow-glow-amber">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </GlassCard>

          {/* KPI 4 (Critical Soft Pulse) */}
          <GlassCard
            interactive
            glow="red"
            pulseCritical
            className="p-5 flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <div className="type-label">Flagged Close Approaches (&lt;5 km)</div>
              <div className="type-kpi text-rose-400 text-glow-red mt-1.5">
                {urgentEvents.length || 2}
              </div>
              <div className="text-xs text-rose-300/90 font-medium mt-1">within 72h window</div>
            </div>
            <div className="w-12 h-12 rounded-full bg-rose-500/15 border border-rose-400/45 flex items-center justify-center text-rose-400 shrink-0 shadow-glow-red">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </GlassCard>
        </div>

        {/* CENTER HERO: Fully Centered, Unclipped 3D Globe */}
        <div className="order-1 lg:order-2 lg:col-span-6 flex items-center justify-center relative z-10">
          <Globe3DView
            objects={objects}
            conjunctions={conjunctions}
            selectedObject={currentSat}
            onSelectObject={handleGlobeSelect}
            showOrbits={showOrbits}
            showDebris={showDebris}
            autoRotate={autoRotate}
            heightClassName="h-[420px] sm:h-[480px] lg:h-[540px] xl:h-[600px]"
          />
        </div>

        {/* RIGHT COLUMN: Selected Satellite Panel & Satellite Service Continuity */}
        <div className="order-3 lg:col-span-3 space-y-4 z-20">
          {/* Selected Satellite Glass Card (Animated Gradient Border + Strong Glow) */}
          {isPanelOpen && currentSat && (
            <GlassCard selected glow="cyan" className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="type-label">Selected Satellite</span>
                <button
                  onClick={() => setIsPanelOpen(false)}
                  aria-label="Close panel"
                  className="w-7 h-7 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-[#b4c6dc] hover:text-white hover:border-cyan-400/40 transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div>
                <h3 className="font-display text-2xl font-bold text-white tracking-[-0.02em]">
                  {currentSat.name}
                </h3>
              </div>

              {/* 2x2 Telemetry Grid */}
              <div className="grid grid-cols-2 gap-y-4 gap-x-4 border-t border-white/10 pt-4">
                <div>
                  <div className="type-label">NORAD ID</div>
                  <div className="text-base font-semibold font-data text-cyan-200 mt-1">
                    {currentSat.norad_id}
                  </div>
                </div>

                <div>
                  <div className="type-label">altitude</div>
                  <div className="text-base font-semibold font-data text-white mt-1">
                    {currentSat.current_position.altitude_km.toFixed(0)} km
                  </div>
                </div>

                <div>
                  <div className="type-label">orbit</div>
                  <div className="text-base font-semibold font-data text-white mt-1">
                    {currentSat.orbit_regime}
                  </div>
                </div>

                <div>
                  <div className="type-label">purpose</div>
                  <div className="text-sm font-medium text-slate-100 mt-1 font-sans leading-snug">
                    {getPurpose(currentSat)}
                  </div>
                </div>
              </div>
            </GlassCard>
          )}

          {/* Satellite Service Continuity Card (Violet Mission Glow) */}
          <GlassCard interactive glow="violet" className="p-5 relative overflow-hidden space-y-3">
            <Sparkles className="absolute right-3 top-6 w-24 h-24 text-violet-400/10 pointer-events-none" />

            <h4 className="type-card-title text-white">Satellite Service Continuity</h4>
            <p className="text-sm text-[#b4c6dc] leading-relaxed">
              Evaluate alternative satellites and redundancy gaps if primary payloads degrade.
            </p>

            <div className="pt-1">
              <button
                onClick={() => onNavigate('impact')}
                className="btn-primary-glow w-full py-2.5 px-4 rounded-2xl text-sm flex items-center justify-center space-x-1.5"
              >
                <span>Explore Continuity</span>
              </button>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* BOTTOM CENTER CONTROLS: Cleanly Below Globe (Zero Overlap) */}
      <div className="w-full flex flex-col items-center space-y-3 z-30 pt-1 pb-1">
        {/* Floating AI Search Bar */}
        <GlassCard
          variant="pill"
          glow="violet"
          className="w-full max-w-lg px-4 py-2.5 flex items-center space-x-3 focus-within:border-cyan-400/50 focus-within:shadow-glow-cyan"
        >
          <Sparkles className="w-4 h-4 text-violet-400 shrink-0" />
          <input
            type="text"
            placeholder="Ask a question about space assets..."
            value={searchPrompt}
            onChange={(e) => setSearchPrompt(e.target.value)}
            className="bg-transparent text-sm text-white placeholder-[#94adc9] focus:outline-none flex-1 font-sans"
          />
          <button
            type="button"
            aria-label="Help"
            className="text-[#94adc9] hover:text-white transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
          <button
            type="button"
            aria-label="Actions"
            className="text-[#94adc9] hover:text-white transition-colors"
          >
            <GripHorizontal className="w-4 h-4" />
          </button>
        </GlassCard>

        {/* Floating Toggle Pills */}
        <GlassCard variant="pill" className="p-1.5 flex items-center space-x-1.5">
          {/* Orbits Toggle */}
          <button
            onClick={() => setShowOrbits(!showOrbits)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-sans font-medium transition-all duration-200 flex items-center space-x-1.5 ${
              showOrbits
                ? 'border border-cyan-400/50 bg-cyan-500/15 text-cyan-200 shadow-glow-cyan'
                : 'text-[#94adc9] hover:text-white border border-transparent hover:bg-white/[0.05]'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                showOrbits ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]' : 'bg-slate-600'
              }`}
            />
            <span>{showOrbits ? 'Orbits: ON' : 'Orbits: OFF'}</span>
          </button>

          {/* Debris Toggle */}
          <button
            onClick={() => setShowDebris(!showDebris)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-sans font-medium transition-all duration-200 flex items-center space-x-1.5 ${
              showDebris
                ? 'border border-amber-400/50 bg-amber-500/15 text-amber-200 shadow-glow-amber'
                : 'text-[#94adc9] hover:text-white border border-transparent hover:bg-white/[0.05]'
            }`}
          >
            <AlertTriangle
              className={`w-3.5 h-3.5 ${showDebris ? 'text-amber-400' : 'text-slate-500'}`}
            />
            <span>{showDebris ? 'Debris: Visible' : 'Debris: Hidden'}</span>
          </button>

          {/* Auto-Rotate Toggle */}
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-sans font-medium transition-all duration-200 flex items-center space-x-1.5 ${
              autoRotate
                ? 'text-slate-100 border border-white/15 bg-white/[0.08]'
                : 'text-[#94adc9] hover:text-white border border-transparent hover:bg-white/[0.05]'
            }`}
          >
            <RotateCcw
              className={`w-3.5 h-3.5 ${
                autoRotate ? 'animate-spin-slow text-cyan-400' : 'text-slate-500'
              }`}
            />
            <span>Auto-Rotate</span>
          </button>
        </GlassCard>

        {/* Footer Line */}
        <div className="text-xs text-[#94adc9] font-sans text-center">
          Preliminary screening, not a validated conjunction assessment.
        </div>
      </div>
    </div>
  );
};
