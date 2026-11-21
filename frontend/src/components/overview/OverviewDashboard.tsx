import React, { useState } from 'react';
import { SpaceObjectSummary, ConjunctionEvent } from '../../types/orbital';
import { Globe3DView } from '../monitoring/Globe3DView';
import { MOCK_MISSION_PROFILES } from '../../services/mock/mockSatellites';
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
  ArrowRight
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

  // Default to CARTOSAT-3 (44431) or current selectedObject or first object
  const activeSatellites = objects.filter(o => o.object_type === 'PAYLOAD');
  const cataloguedDebris = objects.filter(o => o.object_type === 'DEBRIS' || o.object_type === 'ROCKET_BODY');
  const urgentEvents = conjunctions.filter(c => c.miss_distance_km < 5.0);

  const currentSat = selectedObject || objects.find(o => o.norad_id === 44431) || objects[0];
  const currentProfile = currentSat ? MOCK_MISSION_PROFILES[currentSat.norad_id] : null;

  // Format purpose
  const getPurpose = (sat: SpaceObjectSummary | null) => {
    if (!sat) return 'Earth Observation';
    if (currentProfile?.mission_category) {
      return currentProfile.mission_category
        .split('_')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    }
    return sat.object_type === 'PAYLOAD' ? 'Earth Observation' : 'Orbital Fragment';
  };

  const handleGlobeSelect = (obj: SpaceObjectSummary) => {
    onSelectObject(obj);
    setIsPanelOpen(true);
  };

  return (
    <div className="relative w-full min-h-[calc(100vh-140px)] flex flex-col justify-between overflow-hidden select-none pb-2">
      {/* 3D Globe Canvas (Hero in Center) */}
      <div className="w-full flex-1 flex items-center justify-center min-h-[580px] lg:min-h-[660px]">
        <Globe3DView
          objects={objects}
          conjunctions={conjunctions}
          selectedObject={currentSat}
          onSelectObject={handleGlobeSelect}
          showOrbits={showOrbits}
          showDebris={showDebris}
          autoRotate={autoRotate}
          heightClassName="h-[580px] lg:h-[680px]"
        />
      </div>

      {/* DESKTOP OVERLAY LAYOUT / RESPONSIVE CONTAINER */}
      <div className="w-full pointer-events-none lg:absolute lg:inset-0 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
        {/* Top / Main Floating Row */}
        <div className="flex flex-col lg:flex-row justify-between items-start gap-4 w-full">
          {/* LEFT COLUMN: 4 Glass KPI Cards */}
          <div className="w-full lg:w-72 space-y-3 pointer-events-auto shrink-0 z-20">
            {/* KPI 1 */}
            <div className="bg-[#0b1325]/50 hover:bg-[#0b1325]/70 backdrop-blur-xl border border-slate-700/40 rounded-2xl p-4.5 shadow-2xl transition-all flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400 font-medium tracking-wide">
                  Tracked Catalogued Objects
                </div>
                <div className="text-2xl sm:text-3xl font-bold font-mono text-white mt-1">
                  28,410+
                </div>
              </div>
              <div className="w-11 h-11 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-300 shrink-0">
                <Orbit className="w-5 h-5" />
              </div>
            </div>

            {/* KPI 2 */}
            <div className="bg-[#0b1325]/50 hover:bg-[#0b1325]/70 backdrop-blur-xl border border-slate-700/40 rounded-2xl p-4.5 shadow-2xl transition-all flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400 font-medium tracking-wide">
                  Monitored Active Satellites
                </div>
                <div className="text-2xl sm:text-3xl font-bold font-mono text-white mt-1">
                  {activeSatellites.length || 5}
                </div>
              </div>
              <div className="w-11 h-11 rounded-xl bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                <Satellite className="w-5 h-5" />
              </div>
            </div>

            {/* KPI 3 */}
            <div className="bg-[#0b1325]/50 hover:bg-[#0b1325]/70 backdrop-blur-xl border border-slate-700/40 rounded-2xl p-4.5 shadow-2xl transition-all flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400 font-medium tracking-wide">
                  Tracked Catalogued Debris
                </div>
                <div className="text-2xl sm:text-3xl font-bold font-mono text-white mt-1">
                  {cataloguedDebris.length || 3}
                </div>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-950/60 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>

            {/* KPI 4 */}
            <div className="bg-[#0b1325]/50 hover:bg-[#0b1325]/70 backdrop-blur-xl border border-slate-700/40 rounded-2xl p-4.5 shadow-2xl transition-all flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400 font-medium tracking-wide">
                  Flagged Close Approaches (&lt;5 km)
                </div>
                <div className="text-2xl sm:text-3xl font-bold font-mono text-rose-500 mt-1">
                  {urgentEvents.length || 2}
                </div>
                <div className="text-[11px] text-rose-400/90 font-medium mt-0.5">
                  within 72h window
                </div>
              </div>
              <div className="w-11 h-11 rounded-xl bg-rose-950/60 border border-rose-500/40 flex items-center justify-center text-rose-500 shrink-0 shadow-[0_0_15px_rgba(244,63,94,0.2)]">
                <ShieldAlert className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Selected Satellite Panel & Satellite Service Continuity */}
          <div className="w-full lg:w-80 space-y-4 pointer-events-auto shrink-0 z-20">
            {/* Selected Satellite Glass Card */}
            {isPanelOpen && currentSat && (
              <div className="bg-[#0b1325]/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-5 shadow-2xl transition-all space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 tracking-wider">
                    Selected Satellite
                  </span>
                  <button
                    onClick={() => setIsPanelOpen(false)}
                    aria-label="Close panel"
                    className="w-6 h-6 rounded-lg bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-400 hover:text-white hover:border-slate-500 transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div>
                  <h3 className="text-2xl font-bold font-mono text-white tracking-wide">
                    {currentSat.name}
                  </h3>
                </div>

                {/* 2x2 Telemetry Grid */}
                <div className="grid grid-cols-2 gap-y-3.5 gap-x-4 border-t border-slate-800/80 pt-3.5 font-mono text-xs">
                  <div>
                    <div className="text-[11px] text-slate-400">NORAD ID</div>
                    <div className="text-base font-bold text-white mt-0.5">
                      {currentSat.norad_id}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] text-slate-400">altitude</div>
                    <div className="text-base font-bold text-white mt-0.5">
                      {currentSat.current_position.altitude_km.toFixed(0)} km
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] text-slate-400">orbit</div>
                    <div className="text-base font-bold text-white mt-0.5">
                      {currentSat.orbit_regime}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] text-slate-400">purpose</div>
                    <div className="text-sm font-semibold text-white mt-0.5 font-sans leading-tight">
                      {getPurpose(currentSat)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Satellite Service Continuity Card (Bottom Right) */}
            <div className="bg-[#0b1325]/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-5 shadow-2xl transition-all relative overflow-hidden space-y-2">
              <Sparkles className="absolute right-3 top-8 w-24 h-24 text-cyan-400/5 pointer-events-none" />

              <h4 className="text-base font-bold text-white tracking-wide">
                Satellite Service Continuity
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed max-w-xs">
                Evaluate alternative satellites and redundancy gaps if primary payloads degrade.
              </p>

              <div className="pt-2">
                <button
                  onClick={() => onNavigate('impact')}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-400 via-cyan-300 to-cyan-400 text-slate-950 font-bold text-xs tracking-wider shadow-[0_0_20px_rgba(34,211,238,0.5)] hover:shadow-[0_0_28px_rgba(34,211,238,0.7)] transition-all flex items-center justify-center space-x-1.5"
                >
                  <span>Explore Continuity</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM CENTER: Floating AI Search Bar & Toggle Pills & Footer Note */}
        <div className="w-full flex flex-col items-center space-y-3 pointer-events-auto z-30 pt-6 lg:pt-0">
          {/* Floating AI Search Bar */}
          <div className="w-full max-w-md bg-[#0c1322]/80 backdrop-blur-xl border border-slate-700/60 rounded-full px-4 py-2.5 shadow-2xl flex items-center space-x-3 transition-all focus-within:border-cyan-500/60 focus-within:shadow-[0_0_20px_rgba(6,182,212,0.25)]">
            <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
            <input
              type="text"
              placeholder="Ask a question about space assets..."
              value={searchPrompt}
              onChange={(e) => setSearchPrompt(e.target.value)}
              className="bg-transparent text-xs text-white placeholder-slate-400 focus:outline-none flex-1 font-sans"
            />
            <button 
              type="button" 
              aria-label="Help"
              className="text-slate-400 hover:text-slate-200 transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            <button 
              type="button" 
              aria-label="Actions"
              className="text-slate-400 hover:text-slate-200 transition-colors"
            >
              <GripHorizontal className="w-4 h-4" />
            </button>
          </div>

          {/* Floating Toggle Pills */}
          <div className="bg-[#0b1325]/90 backdrop-blur-xl border border-slate-800/90 rounded-full p-1 shadow-2xl flex items-center space-x-1 sm:space-x-1.5">
            {/* Orbits Toggle */}
            <button
              onClick={() => setShowOrbits(!showOrbits)}
              className={`px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-medium transition-all flex items-center space-x-1.5 ${
                showOrbits
                  ? 'border border-cyan-400/50 bg-cyan-950/40 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                  : 'text-slate-400 hover:text-white border border-transparent'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${showOrbits ? 'bg-cyan-400 shadow-[0_0_6px_#22d3ee]' : 'bg-slate-600'}`}></span>
              <span>{showOrbits ? 'Orbits: ON' : 'Orbits: OFF'}</span>
            </button>

            {/* Debris Toggle */}
            <button
              onClick={() => setShowDebris(!showDebris)}
              className={`px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-medium transition-all flex items-center space-x-1.5 ${
                showDebris
                  ? 'border border-amber-500/40 bg-amber-950/40 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                  : 'text-slate-400 hover:text-white border border-transparent'
              }`}
            >
              <AlertTriangle className={`w-3.5 h-3.5 ${showDebris ? 'text-amber-400' : 'text-slate-500'}`} />
              <span>{showDebris ? 'Debris: Visible' : 'Debris: Hidden'}</span>
            </button>

            {/* Auto-Rotate Toggle */}
            <button
              onClick={() => setAutoRotate(!autoRotate)}
              className={`px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-medium transition-all flex items-center space-x-1.5 ${
                autoRotate
                  ? 'text-slate-200 border border-slate-700/60 bg-slate-800/40'
                  : 'text-slate-500 hover:text-white border border-transparent'
              }`}
            >
              <RotateCcw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin-slow text-cyan-400' : 'text-slate-500'}`} />
              <span>Auto-Rotate</span>
            </button>
          </div>

          {/* Footer Line */}
          <div className="text-[11px] text-slate-400 font-mono tracking-wide text-center pt-1">
            Preliminary screening, not a validated conjunction assessment.
          </div>
        </div>
      </div>
    </div>
  );
};
