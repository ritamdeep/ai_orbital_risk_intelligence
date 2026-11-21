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
  onSelectAlternative,
}) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header and Mandatory Fixed Caption Banner */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-bold text-white tracking-wide">
            Alternative Satellite Identification & Continuity Analysis
          </h3>
          <span className="px-2.5 py-0.5 text-[10px] font-bold font-mono rounded-full bg-amber-950/60 text-amber-300 border border-amber-500/40 uppercase">
            Scientific Rule #3: Alternatives are not 1:1 Clones
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-0.5">
          Evaluates candidate replacements and explicitly reports technical redundancy gaps (modality, resolution, revisit time).
        </p>
      </div>

      {/* Mandatory Fixed Caption Banner */}
      <div className="bg-slate-950/70 border border-cyan-500/30 rounded-2xl p-4 flex items-start space-x-3 text-xs text-slate-300 shadow-lg">
        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-cyan-300">Operational Continuity Rule:</strong> Similar mission category does not guarantee replacement. Sensor, coverage, resolution, revisit time, availability and access permissions all matter.
        </p>
      </div>

      {/* List of Alternatives */}
      {alternatives.length === 0 ? (
        <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-slate-800/80 shadow-lg space-y-3">
          <ShieldAlert className="w-10 h-10 text-amber-400/80 mx-auto" />
          <h4 className="text-sm font-bold text-white">No Direct Sovereign Alternative in Orbit</h4>
          <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
            {primaryProfile.name} is a sovereign orbital capability. No active domestic replacement provides identical sensor modality or spatial resolution. Redundancy requires international coordination or satellite charter tasking.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {alternatives.map((alt) => {
            const comparisonDimensions = getAlternativeComparison(primaryProfile.norad_id, alt.norad_id);
            const isFullParity = alt.sensor_parity === 'FULL';

            return (
              <div
                key={alt.norad_id}
                className="border border-slate-800/90 rounded-2xl p-5 sm:p-6 bg-slate-950/60 shadow-xl space-y-5 transition-all"
              >
                {/* Header Row: Alternative Title, Operator, Capability Match */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-white text-base font-mono">{alt.name}</span>
                      <span className="text-xs text-slate-400 font-mono">#{alt.norad_id}</span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border ${
                          isFullParity
                            ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40'
                            : 'bg-amber-950/70 text-amber-300 border-amber-500/40'
                        }`}
                      >
                        {formatEnum(alt.sensor_parity)} Parity
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 font-sans">
                      Operator: <strong className="text-slate-200">{formatOperator(alt.operator)}</strong> • Orbit:{' '}
                      <span className="font-mono text-slate-300">{alt.orbit_regime}</span>
                    </p>
                  </div>

                  {/* Capability Match Metric */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1 bg-slate-900/80 px-3.5 py-2 rounded-xl border border-slate-800 shrink-0">
                    <span className="text-[11px] text-slate-400 font-mono">Capability Match</span>
                    <span className="text-base font-extrabold font-mono text-cyan-300">
                      {alt.coverage_overlap_pct}% Overlap
                    </span>
                  </div>
                </div>

                {/* Side-by-Side Comparison: Primary vs Alternative */}
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 font-mono mb-3">
                    Side-by-Side Capability Comparison
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-900/40">
                    <table className="w-full text-left text-xs border-collapse font-sans">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900/80 text-[11px] font-mono text-slate-400">
                          <th className="py-2.5 px-3.5 font-semibold w-1/4">Evaluation Dimension</th>
                          <th className="py-2.5 px-3.5 font-semibold w-5/12 text-slate-300">
                            Primary: {primaryProfile.name}
                          </th>
                          <th className="py-2.5 px-3.5 font-semibold w-5/12 text-cyan-300">
                            Alternative: {alt.name}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {comparisonDimensions.map((dim, dIdx) => (
                          <tr key={dIdx} className="hover:bg-slate-800/20 transition-colors">
                            <td className="py-3 px-3.5 font-semibold text-slate-300 whitespace-nowrap">
                              {dim.dimension}
                            </td>
                            <td className="py-3 px-3.5 text-slate-300 font-mono text-[11px]">
                              {dim.primaryValue}
                            </td>
                            <td className="py-3 px-3.5 text-slate-200 font-mono text-[11px]">
                              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                                <span>{dim.alternativeValue}</span>
                                {dim.gapChip && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/70 border border-amber-500/50 text-amber-300 shadow-sm shrink-0">
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
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                    Explicit Redundancy Gaps & Limitations
                  </div>
                  <div className="space-y-2">
                    {alt.redundancy_gaps.map((gap, gIdx) => (
                      <div
                        key={gIdx}
                        className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80 text-xs space-y-1 shadow-sm"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between font-semibold text-slate-200 gap-1">
                          <span className="flex items-center space-x-1.5 text-cyan-300 font-mono">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>{gap.parameter}</span>
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            Target: <span className="text-slate-200">{gap.target_value}</span> → Alt:{' '}
                            <span className="text-amber-300">{gap.alternative_value}</span>
                          </span>
                        </div>
                        <p className="text-slate-300 text-[11px] leading-relaxed pt-0.5">
                          {gap.impact_assessment}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Viability Verdict */}
                <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-3.5 text-xs text-amber-200 leading-relaxed shadow-sm">
                  <strong className="text-amber-100 font-semibold font-mono">Technical Verdict:</strong>{' '}
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
