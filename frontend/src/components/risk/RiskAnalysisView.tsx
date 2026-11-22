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
  const activeConjunction =
    selectedConjunction || (conjunctions.length > 0 ? conjunctions[0] : null);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 flex flex-col justify-between gap-5">
      {/* Top Page Header (Consistent Position & Scale) */}
      <div>
        <h1 className="type-page-title">Close-Approach Risk Analysis</h1>
        <p className="text-sm text-[#b4c6dc] mt-1.5">
          Preliminary SGP4 geometric screening across active satellites and catalogued space debris.
        </p>
      </div>

      {/* Main 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 min-[960px]:grid-cols-12 gap-6 items-stretch flex-1">
        <div className="min-[960px]:col-span-8 flex flex-col min-h-[500px]">
          <RiskMatrix2D
            conjunctions={conjunctions}
            selectedConjunction={activeConjunction}
            onSelectConjunction={onSelectConjunction}
          />
        </div>

        <div className="min-[960px]:col-span-4 flex flex-col min-h-[500px]">
          <SelectedConjunctionPanel
            conjunction={activeConjunction}
            onOpenAlertsCentre={onNavigateToAlerts}
          />
        </div>
      </div>

      {/* Centered Footer Disclaimer Line */}
      <div className="text-center pt-1 pb-1">
        <p className="text-xs text-[#94adc9] font-sans">
          Preliminary close-approach screening is based on public SGP4 mean elements and does not constitute a certified Conjunction Data Message (CDM).
        </p>
      </div>
    </div>
  );
};
