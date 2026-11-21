/**
 * Utility helpers to format enums, operator strings, and identifiers
 * ensuring no raw enums or ugly parentheses appear in the UI.
 */

export function formatEnum(val: string | null | undefined): string {
  if (!val) return '';
  return val
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatOperator(op: string | null | undefined): string {
  if (!op) return '';
  // Clean up nested parentheses like "(ISRO (Indian Space Research Organisation))"
  // or "ISRO (Indian Space Research Organisation)" -> "ISRO, Indian Space Research Organisation"
  const stripped = op.replace(/^\(+/, '').replace(/\)+$/, '').trim();
  const parts = stripped.split(/\s*[\(\)]+\s*/).filter(Boolean);
  if (parts.length > 1) {
    return parts.join(', ');
  }
  return stripped;
}

export function formatSensorType(type: string | null | undefined): string {
  if (!type) return '';
  const map: Record<string, string> = {
    OPTICAL_PAN_MS: 'Panchromatic & Multispectral Optical',
    SYNTHETIC_APERTURE_RADAR: 'Synthetic Aperture Radar (SAR)',
    THERMAL_INFRARED: 'Thermal Infrared (TIR)',
    ATMOSPHERIC_SOUNDER: 'Atmospheric Sounder',
    OCEAN_COLOR_MONITOR: 'Ocean Color Monitor (OCM)',
    RF_TRANSPONDER: 'RF Transponder & Relay',
    OTHER: 'Scientific Payload',
  };
  return map[type] || formatEnum(type);
}
