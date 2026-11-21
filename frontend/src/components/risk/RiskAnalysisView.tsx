import React from 'react';
import { ConjunctionEvent } from '../../types/orbital';
import { RiskMatrix2D } from './RiskMatrix2D';
import { SelectedConjunctionPanel } from './SelectedConjunctionPanel';

interface RiskAnalysisViewProps {
  conjunctions: ConjunctionEvent[];
  selectedConjunction: ConjunctionEvent | null;
  onSelectConjunction: (event: ConjunctionEvent) => void;
  onNavigateToAlerts: (event: ConjunctionEvent) => void;
}

export const RiskAnalysisView: React.FC<RiskAnalysisViewProps> = ({
  conjunctions,
  selectedConjunction,
  onSelectConjunction,
  onNavigateToAlerts,
}) => {
  // If no conjunction is selected, default to the first urgent one (e.g. CARTOSAT-3)
  const activeConjunction = selectedConjunction || (conjunctions.length > 0 ? conjunctions[0] : null);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex-1 flex flex-col justify-between">
      {/* Top Page Header */}
      <div className="mb-4">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
          Close-Approach Risk Analysis
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Preliminary SGP4 geometric screening across active satellites and catalogued space debris.
        </p>
      </div>

      {/* Main 2-Column Responsive Layout (Side-by-side on desktop from 960px+) */}
      <div className="grid grid-cols-1 min-[960px]:grid-cols-12 gap-5 items-stretch flex-1">
        {/* Left Column: Two-Dimensional Decision Matrix (~68% width) */}
        <div className="min-[960px]:col-span-8 flex flex-col min-h-[480px]">
          <RiskMatrix2D
            conjunctions={conjunctions}
            selectedConjunction={activeConjunction}
            onSelectConjunction={onSelectConjunction}
          />
        </div>

        {/* Right Column: Selected Event Panel (~32% width) */}
        <div className="min-[960px]:col-span-4 flex flex-col min-h-[480px]">
          <SelectedConjunctionPanel
            conjunction={activeConjunction}
            onOpenAlertsCentre={onNavigateToAlerts}
          />
        </div>
      </div>

      {/* Centered Footer Disclaimer Line */}
      <div className="text-center pt-4 pb-1">
        <p className="text-xs text-slate-500 font-mono">
          Preliminary close-approach screening is based on public SGP4 mean elements and does not constitute a certified Conjunction Data Message (CDM).
        </p>
      </div>
    </div>
  );
};
