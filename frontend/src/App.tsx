import React, { useState } from 'react';
import { Navbar, NavPage } from './components/layout/Navbar';
import { StarField } from './components/common/StarField';
import { GlassCard } from './components/common/GlassCard';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { OverviewDashboard } from './components/overview/OverviewDashboard';
import { SatelliteIntelligenceView } from './components/satellite/SatelliteIntelligenceView';
import { RiskAnalysisView } from './components/risk/RiskAnalysisView';
import { MissionImpactView } from './components/impact/MissionImpactView';
import { AlertsCentre } from './components/alerts/AlertsCentre';
import {
  OrbitalIntelligenceProvider,
  useOrbitalIntelligence,
} from './context/OrbitalIntelligenceContext';
import { SCIENTIFIC_DISCLAIMERS } from './constants/disclaimers';
import { Info, AlertCircle, RefreshCw } from 'lucide-react';

const AppContent: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<NavPage>('overview');
  const {
    satellites,
    objects,
    conjunctions,
    selectedNoradId,
    selectedObject,
    selectedConjunction,
    selectedMissionProfile,
    aiBriefing,
    loading,
    error,
    selectSatellite,
    selectConjunction,
    updateInvestigationStatus,
    refetchAll,
  } = useOrbitalIntelligence();

  const activeAlertCount = conjunctions.filter(
    (c) => c.investigation_status === 'UNREVIEWED' || c.investigation_status === 'UNDER_EVALUATION'
  ).length;

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 flex flex-col font-sans relative overflow-x-hidden">
      {/* Fixed Ambient Orbs + Vignette + Noise + Denser 4-Layer Animated Starfield */}
      <StarField warpTrigger={currentPage} />

      {/* Top Navigation Bar */}
      <Navbar
        currentPage={currentPage}
        onSelectPage={setCurrentPage}
        activeAlertCount={activeAlertCount}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full relative z-10 flex flex-col">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-96 space-y-4">
            <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin shadow-glow-cyan-strong" />
            <div className="text-center space-y-1.5">
              <p className="type-label text-cyan-300">
                Synchronizing Live Orbital & Mission Feeds...
              </p>
              <p className="text-sm text-[#b4c6dc] font-sans">
                Connecting to Orbital Risk (port 8000) & Mission Intelligence (port 8001)
              </p>
            </div>
          </div>
        ) : error ? (
          <GlassCard
            glow="red"
            className="flex flex-col items-center justify-center my-16 p-8 max-w-lg mx-auto space-y-4 text-center"
          >
            <AlertCircle className="w-12 h-12 text-rose-400 drop-shadow-[0_0_16px_rgba(244,63,94,0.5)]" />
            <h3 className="type-card-title text-white">Connection Error</h3>
            <p className="text-sm text-slate-200 leading-relaxed">{error}</p>
            <button
              onClick={() => refetchAll()}
              className="btn-primary-glow inline-flex items-center space-x-2 px-5 py-2.5 rounded-2xl text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry Telemetry Feed</span>
            </button>
          </GlassCard>
        ) : (
          <>
            {/* VIEW 1: Overview Dashboard */}
            {currentPage === 'overview' && (
              <ErrorBoundary pageName="Overview Dashboard">
                <div className="w-full h-full flex-1 flex flex-col">
                  <OverviewDashboard
                    objects={objects}
                    conjunctions={conjunctions}
                    selectedObject={selectedObject}
                    selectedConjunction={selectedConjunction}
                    onSelectObject={(obj) => selectSatellite(obj.norad_id)}
                    onSelectConjunction={(conj) => selectConjunction(conj)}
                    onNavigate={setCurrentPage}
                  />
                </div>
              </ErrorBoundary>
            )}

            {/* VIEW 2: Satellite Intelligence */}
            {currentPage === 'satellites' && (
              <ErrorBoundary pageName="Satellite Intelligence">
                <div className="w-full h-full flex-1 flex flex-col">
                  <SatelliteIntelligenceView
                    initialSatelliteNoradId={selectedNoradId}
                    onNavigate={(page, satNoradId) => {
                      if (satNoradId) selectSatellite(satNoradId);
                      setCurrentPage(page);
                    }}
                  />
                </div>
              </ErrorBoundary>
            )}

            {/* VIEW 3: Risk Analysis */}
            {currentPage === 'risk' && (
              <ErrorBoundary pageName="Risk Analysis">
                <div className="w-full h-full flex-1 flex flex-col">
                  <RiskAnalysisView
                    conjunctions={conjunctions}
                    selectedConjunction={selectedConjunction}
                    onSelectConjunction={(conj) => selectConjunction(conj)}
                    onNavigateToAlerts={(conj) => {
                      selectConjunction(conj);
                      if (typeof window !== 'undefined') {
                        const url = new URL(window.location.href);
                        url.searchParams.set('event', conj.conjunction_id);
                        window.history.replaceState({}, '', url.toString());
                      }
                      setCurrentPage('alerts');
                    }}
                  />
                </div>
              </ErrorBoundary>
            )}

            {/* VIEW 4: Mission Impact */}
            {currentPage === 'impact' && (
              <ErrorBoundary pageName="Mission Impact Assessment">
                <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
                  <div>
                    <h2 className="type-page-title">
                      Mission Criticality & Service Continuity Assessment
                    </h2>
                    <p className="text-sm text-[#b4c6dc] mt-1.5">
                      Evaluates downstream Earth-level service impact and matches alternative satellite capabilities with explicit redundancy gaps.
                    </p>
                  </div>

                  <MissionImpactView
                    missionProfile={selectedMissionProfile}
                    conjunction={selectedConjunction}
                    aiBriefing={aiBriefing}
                    availableSatellites={satellites.map((s) => ({
                      noradId: s.noradId,
                      name: s.name,
                      category: s.categoryChipLabel || s.category,
                    }))}
                    onSelectSatellite={(noradId) => selectSatellite(noradId)}
                    onSelectAlternative={(noradId) => selectSatellite(noradId)}
                  />
                </div>
              </ErrorBoundary>
            )}

            {/* VIEW 5: Alerts Centre */}
            {currentPage === 'alerts' && (
              <ErrorBoundary pageName="Alerts Centre">
                <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
                  <AlertsCentre
                    conjunctions={conjunctions}
                    selectedConjunction={selectedConjunction}
                    onSelectConjunction={(conj) => selectConjunction(conj)}
                    onUpdateStatus={(eventId, status) => updateInvestigationStatus(eventId, status)}
                    onNavigateToRisk={(conj) => {
                      selectConjunction(conj);
                      setCurrentPage('risk');
                    }}
                    onNavigateToContinuity={(conj) => {
                      selectConjunction(conj);
                      if (typeof window !== 'undefined') {
                        const url = new URL(window.location.href);
                        url.searchParams.set('satellite', conj.primary_object.norad_id.toString());
                        window.history.replaceState({}, '', url.toString());
                      }
                      setCurrentPage('impact');
                    }}
                  />
                </div>
              </ErrorBoundary>
            )}
          </>
        )}
      </main>

      {/* Global Scientific Disclaimer Footer */}
      <footer className="mt-auto border-t border-white/10 bg-[#030712]/75 backdrop-blur-md py-4 px-4 sm:px-6 lg:px-8 text-xs text-[#94adc9] z-10 relative">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-start space-x-2.5">
            <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed text-[#b4c6dc]">
              <strong className="text-slate-100 font-semibold">ASTRAVIGIL Scientific Disclaimer:</strong>{' '}
              {SCIENTIFIC_DISCLAIMERS.PRELIMINARY_SCREENING} {SCIENTIFIC_DISCLAIMERS.NO_INVENTED_PROBABILITY}
            </p>
          </div>
          <div className="text-xs font-sans font-medium text-[#94adc9] shrink-0 text-center md:text-right">
            <span>ASTRAVIGIL Space-Tech Platform • Live Integration Edition</span>
            <span className="mx-2 text-slate-600">•</span>
            <span className="text-[#b4c6dc]">Imagery: NASA</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <OrbitalIntelligenceProvider>
      <AppContent />
    </OrbitalIntelligenceProvider>
  );
};

export default App;
