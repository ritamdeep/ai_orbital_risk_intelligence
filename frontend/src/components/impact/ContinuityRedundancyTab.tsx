import React from 'react';
import { SatelliteMissionProfile, AlternativeSatellite } from '../../types/intelligence';
import { getAlternativeComparison } from '../../services/mock/mockContinuityComparison';
import { formatOperator, formatEnum } from '../../utils/textFormatters';
import { Info, AlertTriangle, ShieldAlert } from 'lucide-react';

interface ContinuityRedundancyTabProps {
  primaryProfile: SatelliteMissionProfile;
  alternatives: AlternativeSatellite[];
  onSelectAlternative?: (noradId: number) => void;
}

export const ContinuityRedundancyTab: React.FC<ContinuityRedundancyTabProps> = ({
  primaryProfile,
  alternatives,
}) => {
  return (
    <div className="space-y-6">
      {/* Header and Mandatory Fixed Caption Banner */}
      <div>
        <div className="flex flex-wrap items-center gap-2.5">
          <h3 className="type-card-title text-white">
            Alternative Satellite Identification & Continuity Analysis
          </h3>
          <span className="px-3 py-0.5 text-[11px] font-sans font-semibold tracking-[0.06em] rounded-full bg-amber-500/15 text-amber-200 border border-amber-400/40 uppercase shadow-glow-amber">
            Scientific Rule #3: Alternatives are not 1:1 Clones
          </span>
        </div>
        <p className="text-sm text-[#b4c6dc] mt-1">
          Evaluates candidate replacements and explicitly reports technical redundancy gaps (modality, resolution, revisit time).
        </p>
      </div>

      {/* Mandatory Fixed Caption Banner */}
      <div className="bg-cyan-500/[0.07] border border-cyan-400/30 rounded-2xl p-4 flex items-start space-x-3 text-sm text-slate-200">
        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-1" />
        <p className="leading-relaxed">
          <strong className="text-cyan-200 font-semibold">Operational Continuity Rule:</strong> Similar mission category does not guarantee replacement. Sensor, coverage, resolution, revisit time, availability and access permissions all matter.
        </p>
      </div>

      {/* List of Alternatives */}
      {alternatives.length === 0 ? (
        <div className="p-8 text-center bg-white/[0.03] rounded-2xl border border-white/[0.08] space-y-3">
          <ShieldAlert className="w-10 h-10 text-amber-400/85 mx-auto" />
          <h4 className="type-card-title text-white">No Direct Sovereign Alternative in Orbit</h4>
          <p className="text-sm text-[#b4c6dc] max-w-lg mx-auto leading-relaxed">
            {primaryProfile.name} is a sovereign orbital capability. No active domestic replacement provides identical sensor modality or spatial resolution. Redundancy requires international coordination or satellite charter tasking.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {alternatives.map((alt) => {
            const comparisonDimensions =
              alt.redundancy_gaps &&
              alt.redundancy_gaps.length > 0 &&
              alt.redundancy_gaps[0].target_value
                ? alt.redundancy_gaps.map((g) => ({
                    dimension: g.parameter,
                    primaryValue: g.target_value,
                    alternativeValue: g.alternative_value,
                    gapChip:
                      g.impact_assessment?.includes('GAP') ||
                      g.impact_assessment?.includes('lower') ||
                      g.impact_assessment?.includes('slower') ||
                      g.impact_assessment?.includes('Different')
                        ? 'Performance Gap'
                        : undefined,
                  }))
                : getAlternativeComparison(primaryProfile.norad_id, alt.norad_id);
            const isFullParity = alt.sensor_parity === 'FULL';

            return (
              <div
                key={alt.norad_id}
                className="border border-white/10 rounded-3xl p-5 sm:p-6 bg-white/[0.025] hover:border-cyan-400/30 transition-all duration-200 space-y-5"
              >
                {/* Header Row: Alternative Title, Operator, Capability Match */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/10 gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display font-semibold text-white text-lg">
                        {alt.name}
                      </span>
                      <span className="text-xs text-[#94adc9] font-data">#{alt.norad_id}</span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-sans font-semibold tracking-wide uppercase border ${
                          isFullParity
                            ? 'bg-emerald-500/15 text-emerald-200 border-emerald-400/40 shadow-glow-green'
                            : 'bg-amber-500/15 text-amber-200 border-amber-400/40 shadow-glow-amber'
                        }`}
                      >
                        {formatEnum(alt.sensor_parity)} Parity
                      </span>
                    </div>
                    <p className="text-sm text-[#94adc9] mt-1 font-sans">
                      Operator:{' '}
                      <strong className="text-slate-100 font-medium">
                        {formatOperator(alt.operator)}
                      </strong>{' '}
                      • Orbit: <span className="font-data text-slate-200">{alt.orbit_regime}</span>
                    </p>
                  </div>

                  {/* Capability Match Metric */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1 bg-white/[0.05] px-4 py-2.5 rounded-2xl border border-white/10 shrink-0">
                    <span className="type-label text-[10px]">Capability Match</span>
                    <span className="text-lg font-semibold font-data text-cyan-300 text-glow-cyan">
                      {alt.coverage_overlap_pct}% Overlap
                    </span>
                  </div>
                </div>

                {/* Side-by-Side Comparison */}
                <div>
                  <div className="type-label text-cyan-300 mb-3">
                    Side-by-Side Capability Comparison
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
                    <table className="w-full text-left text-xs sm:text-sm border-collapse font-sans">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/[0.04] type-label text-[11px]">
                          <th className="py-3 px-4 font-semibold w-1/4">Evaluation Dimension</th>
                          <th className="py-3 px-4 font-semibold w-5/12 text-slate-200">
                            Primary: {primaryProfile.name}
                          </th>
                          <th className="py-3 px-4 font-semibold w-5/12 text-cyan-200">
                            Alternative: {alt.name}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.07]">
                        {comparisonDimensions.map((dim, dIdx) => (
                          <tr key={dIdx} className="hover:bg-white/[0.03] transition-colors">
                            <td className="py-3 px-4 font-semibold text-slate-200 whitespace-nowrap">
                              {dim.dimension}
                            </td>
                            <td className="py-3 px-4 text-[#b4c6dc] text-xs sm:text-sm">
                              {dim.primaryValue}
                            </td>
                            <td className="py-3 px-4 text-slate-100 text-xs sm:text-sm">
                              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                                <span>{dim.alternativeValue}</span>
                                {dim.gapChip && (
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-sans font-semibold bg-amber-500/15 border border-amber-400/45 text-amber-200 shrink-0">
                                    {dim.gapChip}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Explicit Redundancy Gaps Panel */}
                <div className="space-y-2.5 pt-1">
                  <div className="type-label">Explicit Redundancy Gaps & Limitations</div>
                  <div className="space-y-2.5">
                    {alt.redundancy_gaps.map((gap, gIdx) => (
                      <div
                        key={gIdx}
                        className="bg-white/[0.03] p-4 rounded-2xl border border-white/[0.08] text-xs sm:text-sm space-y-1.5"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between font-semibold text-slate-100 gap-1">
                          <span className="flex items-center space-x-2 text-cyan-200 font-sans">
                            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                            <span>{gap.parameter}</span>
                          </span>
                          <span className="text-xs text-[#94adc9] font-sans">
                            Target: <span className="text-slate-100">{gap.target_value}</span> → Alt:{' '}
                            <span className="text-amber-200">{gap.alternative_value}</span>
                          </span>
                        </div>
                        <p className="text-[#b4c6dc] text-xs sm:text-sm leading-relaxed">
                          {gap.impact_assessment}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Viability Verdict */}
                <div className="bg-amber-500/[0.09] border border-amber-400/35 rounded-2xl p-4 text-sm text-amber-100 leading-relaxed">
                  <strong className="text-amber-200 font-semibold">Technical Verdict:</strong>{' '}
                  {alt.viability_verdict}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
