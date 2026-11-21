import React, { useState, useEffect } from 'react';
import { Navbar, NavPage } from './components/layout/Navbar';
import { StarField } from './components/common/StarField';
import { OverviewDashboard } from './components/overview/OverviewDashboard';
import { SatelliteIntelligenceView } from './components/satellite/SatelliteIntelligenceView';
import { RiskAnalysisView } from './components/risk/RiskAnalysisView';
import { MissionImpactView } from './components/impact/MissionImpactView';
import { AlertsCentre } from './components/alerts/AlertsCentre';
import { SpaceObjectSummary, ConjunctionEvent } from './types/orbital';
import { SatelliteMissionProfile, OperatorAIBriefing } from './types/intelligence';
import { InvestigationStatus } from './types/common';
import { orbitalService } from './services/orbitalService';
import { intelligenceService } from './services/intelligenceService';
import { SCIENTIFIC_DISCLAIMERS } from './constants/disclaimers';
import { Info } from 'lucide-react';

export const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<NavPage>('overview');
  const [objects, setObjects] = useState<SpaceObjectSummary[]>([]);
  const [conjunctions, setConjunctions] = useState<ConjunctionEvent[]>([]);
  const [selectedObject, setSelectedObject] = useState<SpaceObjectSummary | null>(null);
  const [selectedConjunction, setSelectedConjunction] = useState<ConjunctionEvent | null>(null);
  const [selectedMissionProfile, setSelectedMissionProfile] = useState<SatelliteMissionProfile | null>(null);
  const [aiBriefing, setAiBriefing] = useState<OperatorAIBriefing | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Load initial orbital objects and conjunction screenings
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [objs, conj] = await Promise.all([
          orbitalService.getTrackedObjects(),
          orbitalService.getCloseApproachEvents(),
        ]);
        setObjects(objs);
        setConjunctions(conj);

        if (objs.length > 0) {
          // Check if URL query param ?satellite= specifies a target
          const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
          const satParam = params?.get('satellite');
          const matchedObj = satParam
            ? objs.find(o => o.norad_id === parseInt(satParam, 10)) || objs[0]
            : objs[0];

          setSelectedObject(matchedObj);
          const profile = await intelligenceService.getMissionProfile(matchedObj.norad_id);
          setSelectedMissionProfile(profile);
        }

        if (conj.length > 0) {
          const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
          const eventParam = params?.get('event');
          const matchedConj = eventParam
            ? conj.find(c => c.conjunction_id === eventParam) || conj[0]
            : conj[0];

          if (eventParam && conj.some(c => c.conjunction_id === eventParam)) {
            setCurrentPage('alerts');
          }

          setSelectedConjunction(matchedConj);
          const brief = await intelligenceService.getAIOperatorBriefing(matchedConj.conjunction_id);
          setAiBriefing(brief);
        }
      } catch (err) {
        console.error('Failed to load initial orbital intelligence data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Handle object selection and load corresponding mission profile
  const handleSelectObject = async (obj: SpaceObjectSummary) => {
    setSelectedObject(obj);
    const profile = await intelligenceService.getMissionProfile(obj.norad_id);
    setSelectedMissionProfile(profile);

    // If there is an associated conjunction event, select it
    const relatedConj = conjunctions.find(c => c.primary_object.norad_id === obj.norad_id);
    if (relatedConj) {
      setSelectedConjunction(relatedConj);
      const brief = await intelligenceService.getAIOperatorBriefing(relatedConj.conjunction_id);
      setAiBriefing(brief);
    }
  };

  // Handle conjunction selection and load corresponding briefing & target profile
  const handleSelectConjunction = async (conj: ConjunctionEvent) => {
    setSelectedConjunction(conj);
    const targetObj = objects.find(o => o.norad_id === conj.primary_object.norad_id);
    if (targetObj) {
      setSelectedObject(targetObj);
      const profile = await intelligenceService.getMissionProfile(targetObj.norad_id);
      setSelectedMissionProfile(profile);
    }

    const brief = await intelligenceService.getAIOperatorBriefing(conj.conjunction_id);
    setAiBriefing(brief);
  };

  // Handle alert investigation status update
  const handleUpdateStatus = async (conjunctionId: string, status: InvestigationStatus) => {
    await orbitalService.updateInvestigationStatus(conjunctionId, status);
    setConjunctions(prev =>
      prev.map(c => (c.conjunction_id === conjunctionId ? { ...c, investigation_status: status } : c))
    );
  };

  const activeAlertCount = conjunctions.filter(
    c => c.investigation_status === 'UNREVIEWED' || c.investigation_status === 'UNDER_EVALUATION'
  ).length;

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 flex flex-col font-sans relative overflow-x-hidden">
      {/* Reusable Fixed Animated Starfield Background Layer */}
      <StarField />

      {/* Top Navigation Bar */}
      <Navbar
        currentPage={currentPage}
        onSelectPage={setCurrentPage}
        activeAlertCount={activeAlertCount}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full relative z-10 flex flex-col">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-96 space-y-3">
            <div className="w-10 h-10 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-400 font-mono tracking-wider">
              PROPAGATING ORBITAL EPHEMERIS & INGESTING TLE DATA...
            </p>
          </div>
        ) : (
          <>
            {/* VIEW 1: Overview Dashboard (Hero 3D Globe with Space Glass Panels) */}
            {currentPage === 'overview' && (
              <div className="w-full h-full flex-1 flex flex-col">
                <OverviewDashboard
                  objects={objects}
                  conjunctions={conjunctions}
                  selectedObject={selectedObject}
                  selectedConjunction={selectedConjunction}
                  onSelectObject={handleSelectObject}
                  onSelectConjunction={handleSelectConjunction}
                  onNavigate={setCurrentPage}
                />
              </div>
            )}

            {/* VIEW 2: Satellite Intelligence (Catalogue, Hero, Capabilities, Criticality) */}
            {currentPage === 'satellites' && (
              <div className="w-full h-full flex-1 flex flex-col">
                <SatelliteIntelligenceView
                  initialSatelliteNoradId={selectedObject?.norad_id}
                  onNavigate={(page, satNoradId) => {
                    if (satNoradId) {
                      const obj = objects.find(o => o.norad_id === satNoradId);
                      if (obj) handleSelectObject(obj);
                    }
                    setCurrentPage(page);
                  }}
                />
              </div>
            )}

            {/* VIEW 3: Risk Analysis */}
            {currentPage === 'risk' && (
              <div className="w-full h-full flex-1 flex flex-col">
                <RiskAnalysisView
                  conjunctions={conjunctions}
                  selectedConjunction={selectedConjunction}
                  onSelectConjunction={handleSelectConjunction}
                  onNavigateToAlerts={(conj) => {
                    handleSelectConjunction(conj);
                    if (typeof window !== 'undefined') {
                      const url = new URL(window.location.href);
                      url.searchParams.set('event', conj.conjunction_id);
                      window.history.replaceState({}, '', url.toString());
                    }
                    setCurrentPage('alerts');
                  }}
                />
              </div>
            )}

            {/* VIEW 4: Mission Impact */}
            {currentPage === 'impact' && (
              <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                    Mission Criticality & Service Continuity Assessment
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    Evaluates downstream Earth-level service impact and matches alternative satellite capabilities with explicit redundancy gaps.
                  </p>
                </div>

                <MissionImpactView
                  missionProfile={selectedMissionProfile}
                  conjunction={selectedConjunction}
                  aiBriefing={aiBriefing}
                  availableSatellites={objects.map(o => ({
                    noradId: o.norad_id,
                    name: o.name,
                    category: o.object_type,
                  }))}
                  onSelectSatellite={(noradId) => {
                    const obj = objects.find(o => o.norad_id === noradId);
                    if (obj) handleSelectObject(obj);
                  }}
                  onSelectAlternative={(noradId) => {
                    const altObj = objects.find(o => o.norad_id === noradId);
                    if (altObj) handleSelectObject(altObj);
                  }}
                />
              </div>
            )}

            {/* VIEW 5: Alerts Centre */}
            {currentPage === 'alerts' && (
              <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
                <AlertsCentre
                  conjunctions={conjunctions}
                  selectedConjunction={selectedConjunction}
                  onSelectConjunction={(conj) => {
                    handleSelectConjunction(conj);
                  }}
                  onUpdateStatus={handleUpdateStatus}
                  onNavigateToRisk={(conj) => {
                    handleSelectConjunction(conj);
                    setCurrentPage('risk');
                  }}
                  onNavigateToContinuity={(conj) => {
                    handleSelectConjunction(conj);
                    if (typeof window !== 'undefined') {
                      const url = new URL(window.location.href);
                      url.searchParams.set('satellite', conj.primary_object.norad_id.toString());
                      window.history.replaceState({}, '', url.toString());
                    }
                    setCurrentPage('impact');
                  }}
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* Global Scientific Disclaimer Footer (Shown on non-overview/non-satellites/non-risk/non-impact/non-alerts tabs) */}
      {currentPage !== 'overview' && currentPage !== 'satellites' && currentPage !== 'risk' && currentPage !== 'impact' && currentPage !== 'alerts' && (
        <footer className="mt-auto border-t border-slate-800/80 bg-[#030712]/90 backdrop-blur-md py-4 px-4 sm:px-6 lg:px-8 text-xs text-slate-400 z-10 relative">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-start space-x-2">
              <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed text-slate-400">
                <strong className="text-slate-200">ASTRAVIGIL Scientific Disclaimer:</strong> {SCIENTIFIC_DISCLAIMERS.PRELIMINARY_SCREENING} {SCIENTIFIC_DISCLAIMERS.NO_INVENTED_PROBABILITY}
              </p>
            </div>
            <div className="text-[11px] font-mono text-slate-500 shrink-0">
              ASTRAVIGIL Space-Tech Platform • Hackathon Edition
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};

export default App;
