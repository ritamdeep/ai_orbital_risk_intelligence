import React, { useState, useEffect } from 'react';
import { useSatelliteIntelligence } from '../../hooks/useSatelliteIntelligence';
import { SatelliteCategory, SatelliteCatalogueItem } from '../../types/satelliteIntelligence';
import { CriticalityGauge } from './CriticalityGauge';
import { SatelliteHeroIllustration } from './SatelliteHeroIllustration';
import { 
  Search, 
  Satellite, 
  ArrowRight, 
  Droplets, 
  Wind, 
  Building2, 
  Shield, 
  Waves, 
  CloudSun, 
  Sprout, 
  LifeBuoy, 
  Info,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { NavPage } from '../layout/Navbar';

interface SatelliteIntelligenceViewProps {
  initialSatelliteNoradId?: number;
  onNavigate: (page: NavPage, satelliteNoradId?: number) => void;
}

export const SatelliteIntelligenceView: React.FC<SatelliteIntelligenceViewProps> = ({
  initialSatelliteNoradId,
  onNavigate,
}) => {
  const {
    filteredSatellites,
    selectedSatellite,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    setSelectedSatelliteId,
  } = useSatelliteIntelligence(initialSatelliteNoradId);

  // Categories list
  const categories: SatelliteCategory[] = [
    'All',
    'Earth Observation',
    'Communication',
    'Navigation',
    'Weather',
    'Disaster Monitoring',
  ];

  // Animated factor bars state
  const [animatedFactorValues, setAnimatedFactorValues] = useState<number[]>([]);
  const [activeTooltip, setActiveTooltip] = useState<number | null>(null);

  useEffect(() => {
    if (!selectedSatellite) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setAnimatedFactorValues(selectedSatellite.criticality.factors.map(f => f.value));
      return;
    }

    setAnimatedFactorValues(selectedSatellite.criticality.factors.map(() => 0));
    const timer = setTimeout(() => {
      setAnimatedFactorValues(selectedSatellite.criticality.factors.map(f => f.value));
    }, 50);

    return () => clearTimeout(timer);
  }, [selectedSatellite]);

  // Icon resolver for Supported Services
  const renderServiceIcon = (iconName: string) => {
    switch (iconName) {
      case 'flood':
        return <Droplets className="w-3.5 h-3.5 text-cyan-400" />;
      case 'cyclone':
        return <Wind className="w-3.5 h-3.5 text-cyan-400" />;
      case 'urban':
        return <Building2 className="w-3.5 h-3.5 text-cyan-400" />;
      case 'defense':
        return <Shield className="w-3.5 h-3.5 text-cyan-400" />;
      case 'ocean':
        return <Waves className="w-3.5 h-3.5 text-cyan-400" />;
      case 'agriculture':
        return <Sprout className="w-3.5 h-3.5 text-cyan-400" />;
      case 'weather':
        return <CloudSun className="w-3.5 h-3.5 text-cyan-400" />;
      case 'search':
        return <LifeBuoy className="w-3.5 h-3.5 text-cyan-400" />;
      default:
        return <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />;
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 select-none animate-in fade-in duration-300">
      {/* 3-COLUMN RESPONSIVE LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
        
        {/* ======================================================== */}
        {/* COLUMN 1: SATELLITE CATALOGUE (25% / lg:col-span-3)       */}
        {/* ======================================================== */}
        <div className="lg:col-span-3 bg-[#0b1325]/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4.5 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white tracking-wide">
              Satellite Catalogue
            </h2>
            <span className="text-xs font-mono text-slate-400">
              {filteredSatellites.length} Satellites
            </span>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by satellite or NORAD ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-900/80 border border-slate-700/60 text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/50 transition-all font-sans"
            />
          </div>

          {/* Category Filter Pills (Wrapping & fully visible) */}
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                    isSelected
                      ? 'border border-cyan-400/60 bg-cyan-950/50 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.3)] font-semibold'
                      : 'border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Scrollable Satellite Cards List */}
          <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
            {filteredSatellites.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400 space-y-2">
                <XCircle className="w-8 h-8 mx-auto text-slate-500 opacity-60" />
                <p>No satellites match your filters</p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('All');
                  }}
                  className="text-[11px] text-cyan-400 hover:underline"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              filteredSatellites.map((sat) => {
                const isSelected = selectedSatellite?.id === sat.id;

                return (
                  <button
                    key={sat.id}
                    onClick={() => setSelectedSatelliteId(sat.id)}
                    tabIndex={0}
                    className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between border ${
                      isSelected
                        ? 'border-cyan-400/80 bg-cyan-950/30 shadow-[0_0_18px_rgba(6,182,212,0.3)] ring-1 ring-cyan-400/50'
                        : 'border-slate-800/80 bg-[#0c1527]/50 hover:bg-[#0e192e]/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                        isSelected 
                          ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.3)]' 
                          : 'bg-slate-800/60 border-slate-700/60 text-slate-400'
                      }`}>
                        <Satellite className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <div className="font-bold text-xs text-white truncate font-mono">
                          {sat.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          #{sat.noradId}
                        </div>
                      </div>
                    </div>

                    {/* Category Chip on Right */}
                    <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium border border-cyan-500/30 bg-cyan-950/30 text-cyan-300 ml-2">
                      {sat.categoryChipLabel}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* COLUMN 2: CENTRE SATELLITE DETAILS (50% / lg:col-span-6)   */}
        {/* ======================================================== */}
        <div className="lg:col-span-6 space-y-4">
          {selectedSatellite ? (
            <>
              {/* Header: Satellite Name & Category Chips */}
              <div className="bg-[#0b1325]/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-wide font-mono">
                  {selectedSatellite.name}
                </h1>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold font-mono tracking-wide border border-cyan-400/50 bg-cyan-950/40 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.25)]">
                    {selectedSatellite.orbitSubtype}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold tracking-wide border border-teal-400/40 bg-teal-950/40 text-teal-300">
                    {selectedSatellite.category}
                  </span>
                </div>
              </div>

              {/* Hero Panel with 3D Orbital Satellite Model */}
              <SatelliteHeroIllustration satelliteName={selectedSatellite.name} />

              {/* 2x3 Grid of Stat Tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {/* Stat 1: Altitude */}
                <div className="bg-[#0b1325]/60 backdrop-blur-xl border border-slate-700/50 rounded-xl p-3.5 shadow-lg">
                  <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Altitude</div>
                  <div className="text-base sm:text-lg font-bold font-mono text-white mt-0.5">
                    {selectedSatellite.altitudeKm.toLocaleString()} km
                  </div>
                </div>

                {/* Stat 2: Orbit Type */}
                <div className="bg-[#0b1325]/60 backdrop-blur-xl border border-slate-700/50 rounded-xl p-3.5 shadow-lg">
                  <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Orbit type</div>
                  <div className="text-base sm:text-lg font-bold font-mono text-white mt-0.5">
                    {selectedSatellite.orbit}
                  </div>
                </div>

                {/* Stat 3: Operator */}
                <div className="bg-[#0b1325]/60 backdrop-blur-xl border border-slate-700/50 rounded-xl p-3.5 shadow-lg">
                  <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Operator</div>
                  <div className="text-base sm:text-lg font-bold font-mono text-white mt-0.5">
                    {selectedSatellite.operator}
                  </div>
                </div>

                {/* Stat 4: Orbital Period */}
                <div className="bg-[#0b1325]/60 backdrop-blur-xl border border-slate-700/50 rounded-xl p-3.5 shadow-lg">
                  <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Orbital period</div>
                  <div className="text-base sm:text-lg font-bold font-mono text-white mt-0.5">
                    {selectedSatellite.periodMin} min
                  </div>
                </div>

                {/* Stat 5: Inclination */}
                <div className="bg-[#0b1325]/60 backdrop-blur-xl border border-slate-700/50 rounded-xl p-3.5 shadow-lg">
                  <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Inclination</div>
                  <div className="text-base sm:text-lg font-bold font-mono text-white mt-0.5">
                    {selectedSatellite.inclinationDeg}°
                  </div>
                </div>

                {/* Stat 6: Mission Status */}
                <div className="bg-[#0b1325]/60 backdrop-blur-xl border border-slate-700/50 rounded-xl p-3.5 shadow-lg">
                  <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Mission status</div>
                  <div className="text-base sm:text-lg font-bold text-white mt-0.5 flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
                    <span>{selectedSatellite.status}</span>
                  </div>
                </div>
              </div>

              {/* Capabilities Card */}
              <div className="bg-[#0b1325]/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-5 shadow-2xl space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                  <h3 className="text-base font-bold text-white tracking-wide">
                    Capabilities
                  </h3>
                  {selectedSatellite.dataSource === 'mock' && (
                    <span className="text-[10px] text-slate-400 font-mono italic">
                      Mock data. Illustrative values.
                    </span>
                  )}
                </div>

                {/* Clean Two-Column Key-Value Rows */}
                <div className="space-y-2.5 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between border-b border-slate-800/50 pb-2 gap-1">
                    <span className="text-slate-400 font-medium w-40 shrink-0">Sensor type</span>
                    <span className="text-white font-semibold text-right sm:text-left flex-1">
                      {selectedSatellite.capabilities.sensorType}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between border-b border-slate-800/50 pb-2 gap-1">
                    <span className="text-slate-400 font-medium w-40 shrink-0">Spatial resolution</span>
                    <span className="text-white font-semibold text-right sm:text-left flex-1">
                      {selectedSatellite.capabilities.spatialResolution}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between border-b border-slate-800/50 pb-2 gap-1">
                    <span className="text-slate-400 font-medium w-40 shrink-0">Revisit time</span>
                    <span className="text-white font-semibold text-right sm:text-left flex-1">
                      {selectedSatellite.capabilities.revisitTime}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between border-b border-slate-800/50 pb-2 gap-1">
                    <span className="text-slate-400 font-medium w-40 shrink-0">Coverage</span>
                    <span className="text-white font-semibold text-right sm:text-left flex-1">
                      {selectedSatellite.capabilities.coverage}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                    <span className="text-slate-400 font-medium w-40 shrink-0">Data access</span>
                    <span className="text-white font-semibold text-right sm:text-left flex-1">
                      {selectedSatellite.capabilities.dataAccess}
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-slate-400 bg-slate-900/60 rounded-2xl border border-slate-800">
              Select a satellite from the catalogue.
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* COLUMN 3: MISSION CRITICALITY (25% / lg:col-span-3)       */}
        {/* ======================================================== */}
        <div className="lg:col-span-3 bg-[#0b1325]/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-5 shadow-2xl space-y-5">
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">
              Mission Criticality
            </h2>
          </div>

          {/* Semicircular Criticality Gauge */}
          {selectedSatellite && (
            <CriticalityGauge 
              score={selectedSatellite.criticality.score} 
              tier={selectedSatellite.criticality.tier} 
            />
          )}

          {/* "Why this score" Section with Animated Factor Bars */}
          {selectedSatellite && (
            <div className="space-y-3 pt-1 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">
                  Why this score
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Explainable Criteria
                </span>
              </div>

              <div className="space-y-2.5">
                {selectedSatellite.criticality.factors.map((factor, idx) => {
                  const currentVal = animatedFactorValues[idx] ?? factor.value;

                  return (
                    <div 
                      key={factor.name} 
                      className="space-y-1 relative"
                      onMouseEnter={() => setActiveTooltip(idx)}
                      onMouseLeave={() => setActiveTooltip(null)}
                    >
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300 text-[11px] truncate pr-2 flex items-center space-x-1">
                          <span>{factor.name}</span>
                          {factor.inverted && (
                            <span className="text-[9px] text-amber-400 font-mono">*</span>
                          )}
                        </span>
                        <span className="font-mono text-cyan-300 font-bold text-[11px]">
                          {factor.value}%
                        </span>
                      </div>

                      {/* Bar Track */}
                      <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.4)] transition-all duration-700 ease-out"
                          style={{ width: `${currentVal}%` }}
                        />
                      </div>

                      {/* Tooltip on hover */}
                      {activeTooltip === idx && (
                        <div className="absolute left-0 bottom-full mb-1 z-30 bg-slate-900 text-white text-[10px] p-2 rounded-lg border border-slate-700 shadow-xl max-w-xs font-sans pointer-events-none">
                          {factor.description}
                          {factor.inverted && (
                            <div className="text-amber-300 mt-0.5 font-semibold">
                              (Fewer alternatives, higher criticality)
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Note on Inverted Alternative Factor */}
              <div className="text-[10px] text-slate-400 flex items-center space-x-1 pt-0.5">
                <Info className="w-3 h-3 text-cyan-400 shrink-0" />
                <span>*Fewer alternatives, higher criticality</span>
              </div>
            </div>
          )}

          {/* Supported Earth Services */}
          {selectedSatellite && (
            <div className="space-y-2.5 pt-1 border-t border-slate-800/80">
              <div className="text-xs font-semibold text-slate-300">
                Supported Earth Services
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedSatellite.supportedServices.map((service) => (
                  <div
                    key={service.name}
                    className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border border-slate-800 bg-[#0c1527]/70 text-slate-200"
                  >
                    {renderServiceIcon(service.icon)}
                    <span>{service.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scientific Disclaimer Note Box */}
          <div className="bg-[#08101e]/80 border border-slate-800/80 rounded-xl p-3 text-[11px] text-slate-400 leading-relaxed space-y-1">
            <p>
              Mission criticality does not change collision probability. It only indicates the importance of the service.
            </p>
          </div>

          {/* Action Button: View Service Continuity */}
          {selectedSatellite && (
            <div>
              <button
                onClick={() => onNavigate('impact', selectedSatellite.noradId)}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-400 via-cyan-300 to-cyan-400 text-slate-950 font-bold text-xs tracking-wider shadow-[0_0_20px_rgba(34,211,238,0.5)] hover:shadow-[0_0_28px_rgba(34,211,238,0.7)] transition-all flex items-center justify-center space-x-1.5"
              >
                <span>View Service Continuity</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* FOOTER DISCLAIMER */}
      <div className="text-center text-xs text-slate-400 font-mono tracking-wide pt-2">
        Mission criticality is an explainable, rule-based assessment. Physical orbital risk is assessed separately.
      </div>
    </div>
  );
};
