import React, { useState, useEffect } from 'react';
import { useSatelliteIntelligence } from '../../hooks/useSatelliteIntelligence';
import { SatelliteCategory } from '../../types/satelliteIntelligence';
import { CriticalityGauge } from './CriticalityGauge';
import { SatelliteHeroIllustration } from './SatelliteHeroIllustration';
import { GlassCard } from '../common/GlassCard';
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
  XCircle,
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

  const categories: SatelliteCategory[] = [
    'All',
    'Earth Observation',
    'Communication',
    'Navigation',
    'Weather',
    'Disaster Monitoring',
  ];

  const [animatedFactorValues, setAnimatedFactorValues] = useState<number[]>([]);
  const [activeTooltip, setActiveTooltip] = useState<number | null>(null);

  useEffect(() => {
    if (!selectedSatellite) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setAnimatedFactorValues(selectedSatellite.criticality.factors.map((f) => f.value));
      return;
    }

    setAnimatedFactorValues(selectedSatellite.criticality.factors.map(() => 0));
    const timer = setTimeout(() => {
      setAnimatedFactorValues(selectedSatellite.criticality.factors.map((f) => f.value));
    }, 50);

    return () => clearTimeout(timer);
  }, [selectedSatellite]);

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
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 select-none">
      {/* 3-COLUMN RESPONSIVE LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ======================================================== */}
        {/* COLUMN 1: SATELLITE CATALOGUE (25% / lg:col-span-3)       */}
        {/* ======================================================== */}
        <GlassCard className="lg:col-span-3 p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="type-card-title text-white">Satellite Catalogue</h2>
            <span className="text-xs font-sans text-[#94adc9]">
              <span className="font-data text-slate-200">{filteredSatellites.length}</span> Satellites
            </span>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94adc9]" />
            <input
              type="text"
              placeholder="Search by satellite or NORAD ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-2xl bg-white/[0.05] border border-white/10 text-white placeholder-[#94adc9] focus:outline-none focus:border-cyan-400/60 transition-all font-sans"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-sans font-medium transition-all duration-200 ${
                    isSelected
                      ? 'border border-cyan-400/55 bg-cyan-500/15 text-cyan-200 shadow-glow-cyan font-semibold'
                      : 'border border-white/10 bg-white/[0.04] text-[#b4c6dc] hover:text-white hover:border-white/20'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Scrollable Satellite List (Lightweight rows; glowing animated border on selected) */}
          <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
            {filteredSatellites.length === 0 ? (
              <div className="py-10 text-center text-sm text-[#b4c6dc] space-y-2">
                <XCircle className="w-8 h-8 mx-auto text-[#94adc9] opacity-70" />
                <p>No satellites match your filters</p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('All');
                  }}
                  className="text-xs text-cyan-300 hover:underline font-medium"
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
                    className={`w-full text-left p-3 rounded-2xl transition-all duration-200 flex items-center space-x-3 border ${
                      isSelected
                        ? 'glass-selected bg-cyan-500/15'
                        : 'border-white/[0.08] bg-white/[0.025] hover:bg-white/[0.06] hover:border-cyan-400/30'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${
                        isSelected
                          ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200 shadow-glow-cyan'
                          : 'bg-white/[0.05] border-white/10 text-[#94adc9]'
                      }`}
                    >
                      <Satellite className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="font-display font-semibold text-sm text-white leading-tight truncate">
                        {sat.name}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-[#94adc9] font-data">
                          #{sat.noradId}
                        </span>
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-sans font-medium border border-cyan-400/30 bg-cyan-500/10 text-cyan-200">
                          {sat.categoryChipLabel}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </GlassCard>

        {/* ======================================================== */}
        {/* COLUMN 2: CENTRE SATELLITE DETAILS (50% / lg:col-span-6)   */}
        {/* ======================================================== */}
        <div className="lg:col-span-6 space-y-5">
          {selectedSatellite ? (
            <>
              {/* Header: Satellite Name & Category Chips */}
              <GlassCard
                selected
                className="p-5 sm:p-6 flex flex-wrap items-center justify-between gap-3"
              >
                <h1 className="type-page-title">{selectedSatellite.name}</h1>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-sans font-semibold border border-cyan-400/45 bg-cyan-500/15 text-cyan-200 shadow-glow-cyan">
                    {selectedSatellite.orbitSubtype}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-sans font-semibold border border-violet-400/40 bg-violet-500/15 text-violet-200 shadow-glow-violet">
                    {selectedSatellite.category}
                  </span>
                </div>
              </GlassCard>

              {/* Hero Panel with 3D Orbital Satellite Model */}
              <SatelliteHeroIllustration satelliteName={selectedSatellite.name} />

              {/* 2x3 Grid of Stat Tiles inside a single cohesive GlassCard */}
              <GlassCard className="p-4 sm:p-5">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-3.5">
                    <div className="type-label">Altitude</div>
                    <div className="text-lg font-semibold font-data text-white mt-1">
                      {selectedSatellite.altitudeKm.toLocaleString()} km
                    </div>
                  </div>

                  <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-3.5">
                    <div className="type-label">Orbit type</div>
                    <div className="text-lg font-semibold font-data text-cyan-200 mt-1">
                      {selectedSatellite.orbit}
                    </div>
                  </div>

                  <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-3.5">
                    <div className="type-label">Operator</div>
                    <div className="text-base font-display font-semibold text-white mt-1 truncate">
                      {selectedSatellite.operator}
                    </div>
                  </div>

                  <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-3.5">
                    <div className="type-label">Orbital period</div>
                    <div className="text-lg font-semibold font-data text-white mt-1">
                      {selectedSatellite.periodMin} min
                    </div>
                  </div>

                  <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-3.5">
                    <div className="type-label">Inclination</div>
                    <div className="text-lg font-semibold font-data text-white mt-1">
                      {selectedSatellite.inclinationDeg}°
                    </div>
                  </div>

                  <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-3.5">
                    <div className="type-label">Mission status</div>
                    <div className="text-base font-sans font-semibold text-emerald-300 mt-1 flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399] animate-pulse" />
                      <span>{selectedSatellite.status}</span>
                    </div>
                  </div>
                </div>
              </GlassCard>

              {/* Capabilities Card */}
              <GlassCard className="p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <h3 className="type-card-title text-white">Capabilities</h3>
                  {selectedSatellite.dataSource === 'mock' && (
                    <span className="text-xs text-[#94adc9] font-sans italic">
                      Mock data. Illustrative values.
                    </span>
                  )}
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between border-b border-white/[0.07] pb-2.5 gap-1">
                    <span className="text-[#94adc9] font-medium w-44 shrink-0">Sensor type</span>
                    <span className="text-slate-100 font-medium text-right sm:text-left flex-1">
                      {selectedSatellite.capabilities.sensorType}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between border-b border-white/[0.07] pb-2.5 gap-1">
                    <span className="text-[#94adc9] font-medium w-44 shrink-0">
                      Spatial resolution
                    </span>
                    <span className="text-slate-100 font-medium text-right sm:text-left flex-1">
                      {selectedSatellite.capabilities.spatialResolution}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between border-b border-white/[0.07] pb-2.5 gap-1">
                    <span className="text-[#94adc9] font-medium w-44 shrink-0">Revisit time</span>
                    <span className="text-slate-100 font-medium text-right sm:text-left flex-1">
                      {selectedSatellite.capabilities.revisitTime}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between border-b border-white/[0.07] pb-2.5 gap-1">
                    <span className="text-[#94adc9] font-medium w-44 shrink-0">Coverage</span>
                    <span className="text-slate-100 font-medium text-right sm:text-left flex-1">
                      {selectedSatellite.capabilities.coverage}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                    <span className="text-[#94adc9] font-medium w-44 shrink-0">Data access</span>
                    <span className="text-slate-100 font-medium text-right sm:text-left flex-1">
                      {selectedSatellite.capabilities.dataAccess}
                    </span>
                  </div>
                </div>
              </GlassCard>
            </>
          ) : (
            <GlassCard className="p-12 text-center text-[#b4c6dc]">
              Select a satellite from the catalogue.
            </GlassCard>
          )}
        </div>

        {/* ======================================================== */}
        {/* COLUMN 3: MISSION CRITICALITY (25% / lg:col-span-3)       */}
        {/* ======================================================== */}
        <GlassCard glow="violet" className="lg:col-span-3 p-5 space-y-5">
          <div>
            <h2 className="type-card-title text-white">Mission Criticality</h2>
          </div>

          {selectedSatellite && (
            <CriticalityGauge
              score={selectedSatellite.criticality.score}
              tier={selectedSatellite.criticality.tier}
            />
          )}

          {/* "Why this score" Section — One Cohesive Cyan-to-Teal Factor Bar Family */}
          {selectedSatellite && (
            <div className="space-y-3 pt-3 border-t border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-sm font-display font-semibold text-white">
                  Why this score
                </span>
                <span className="type-label text-[10px]">Explainable Criteria</span>
              </div>

              <div className="space-y-3">
                {selectedSatellite.criticality.factors.map((factor, idx) => {
                  const currentVal = animatedFactorValues[idx] ?? factor.value;

                  return (
                    <div
                      key={factor.name}
                      className="space-y-1.5 relative"
                      onMouseEnter={() => setActiveTooltip(idx)}
                      onMouseLeave={() => setActiveTooltip(null)}
                    >
                      <div className="flex justify-between items-baseline text-xs">
                        <span className="text-slate-200 font-sans font-medium truncate pr-2 flex items-center space-x-1">
                          <span>{factor.name}</span>
                          {factor.inverted && (
                            <span className="text-xs text-cyan-300 font-semibold">*</span>
                          )}
                        </span>
                        <span className="font-data text-cyan-300 font-semibold text-xs">
                          {factor.value}%
                        </span>
                      </div>

                      <div className="w-full bg-white/[0.08] h-2 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full progress-glow-fill transition-all duration-700 ease-out"
                          style={{ width: `${currentVal}%` }}
                        />
                      </div>

                      {activeTooltip === idx && (
                        <div className="glass-surface-chip absolute left-0 bottom-full mb-1.5 z-30 bg-[#081022]/95 text-slate-100 text-xs p-2.5 max-w-xs font-sans pointer-events-none">
                          {factor.description}
                          {factor.inverted && (
                            <div className="text-cyan-300 mt-1 font-semibold">
                              (Fewer alternatives, higher criticality)
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="text-xs text-[#94adc9] flex items-center space-x-1.5 pt-0.5">
                <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>*Fewer alternatives, higher criticality</span>
              </div>
            </div>
          )}

          {/* Supported Earth Services */}
          {selectedSatellite && (
            <div className="space-y-2.5 pt-3 border-t border-white/10">
              <div className="type-label">Supported Earth Services</div>
              <div className="flex flex-wrap gap-2">
                {selectedSatellite.supportedServices.map((service) => (
                  <div
                    key={service.name}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-2xl text-xs font-sans font-medium border border-white/10 bg-white/[0.04] text-slate-100"
                  >
                    {renderServiceIcon(service.icon)}
                    <span>{service.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scientific Disclaimer Note Box */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-3.5 text-xs text-[#b4c6dc] leading-relaxed">
            <p>
              Mission criticality does not change collision probability. It only indicates the importance of the service.
            </p>
          </div>

          {/* Action Button: View Service Continuity */}
          {selectedSatellite && (
            <div>
              <button
                onClick={() => onNavigate('impact', selectedSatellite.noradId)}
                className="btn-primary-glow w-full py-2.5 px-4 rounded-2xl text-sm flex items-center justify-center space-x-1.5"
              >
                <span>View Service Continuity</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </GlassCard>
      </div>

      {/* FOOTER DISCLAIMER */}
      <div className="text-center text-xs text-[#94adc9] font-sans pt-1">
        Mission criticality is an explainable, rule-based assessment. Physical orbital risk is assessed separately.
      </div>
    </div>
  );
};
