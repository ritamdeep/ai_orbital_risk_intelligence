export interface CapabilityComparisonDimension {
  dimension: string;
  primaryValue: string;
  alternativeValue: string;
  gapChip?: string; // Amber chip label if weaker or different (e.g. "Lower resolution", "Restricted access")
}

export interface AlternativeComparisonData {
  altNoradId: number;
  dimensions: CapabilityComparisonDimension[];
}

export const ALTERNATIVE_COMPARISONS: Record<number, Record<number, CapabilityComparisonDimension[]>> = {
  // CARTOSAT-3 (44431)
  44431: {
    // EOS-04 (51656)
    51656: [
      {
        dimension: 'Sensor type',
        primaryValue: 'Panchromatic & Multispectral Optical',
        alternativeValue: 'Active Microwave Radar (C-band SAR)',
        gapChip: 'Different Modality',
      },
      {
        dimension: 'Spatial resolution',
        primaryValue: '0.28m PAN / 1.12m MX (Sub-metre)',
        alternativeValue: '1.0m (Spotlight) to 10m (ScanSAR)',
        gapChip: 'Lower resolution',
      },
      {
        dimension: 'Revisit time',
        primaryValue: '4 days (agile steer)',
        alternativeValue: '12 days (48h emergency steer)',
        gapChip: 'Slower revisit',
      },
      {
        dimension: 'Coverage',
        primaryValue: 'Global, focus on India',
        alternativeValue: 'Monsoon cloud-penetrating, focus on India',
      },
      {
        dimension: 'Data access',
        primaryValue: 'Restricted / Government (Sovereign ISRO)',
        alternativeValue: 'Restricted / Government (Sovereign ISRO)',
      },
    ],
    // SENTINEL-2A (40697)
    40697: [
      {
        dimension: 'Sensor type',
        primaryValue: 'Panchromatic & Multispectral Optical',
        alternativeValue: 'Multispectral Optical (13 Bands)',
      },
      {
        dimension: 'Spatial resolution',
        primaryValue: '0.28m PAN / 1.12m MX (Sub-metre)',
        alternativeValue: '10 - 20 meters (Medium resolution)',
        gapChip: 'Coarse resolution',
      },
      {
        dimension: 'Revisit time',
        primaryValue: '4 days (agile steer)',
        alternativeValue: '5 days constellation revisit',
        gapChip: 'Longer latency',
      },
      {
        dimension: 'Coverage',
        primaryValue: 'Global, focus on India',
        alternativeValue: '100% Tropical coverage overlap',
      },
      {
        dimension: 'Data access',
        primaryValue: 'Sovereign ISRO immediate tasking',
        alternativeValue: 'ESA Copernicus / Charter tasking (24-48h)',
        gapChip: 'Charter latency',
      },
    ],
  },
  // EOS-04 (51656)
  51656: {
    // SENTINEL-1A (39634)
    39634: [
      {
        dimension: 'Sensor type',
        primaryValue: 'C-band Synthetic Aperture Radar (SAR)',
        alternativeValue: 'C-band Synthetic Aperture Radar (SAR)',
      },
      {
        dimension: 'Spatial resolution',
        primaryValue: '1.0m Spotlight / 10m ScanSAR',
        alternativeValue: '5.0 - 20.0 meters SAR',
        gapChip: 'Coarser resolution',
      },
      {
        dimension: 'Revisit time',
        primaryValue: '12 days (48h sovereign steer)',
        alternativeValue: '72 hours constellation repeat',
      },
      {
        dimension: 'Coverage',
        primaryValue: 'All-weather, focus on Indian deltas',
        alternativeValue: '95% geographic coverage overlap',
      },
      {
        dimension: 'Data access',
        primaryValue: 'Sovereign ISRO emergency steer',
        alternativeValue: 'Pre-scheduled European baseline routine',
        gapChip: 'Pre-scheduled routine',
      },
    ],
  },
  // INSAT-3DR (41752)
  41752: {
    // INSAT-3D (39532)
    39532: [
      {
        dimension: 'Sensor type',
        primaryValue: '6-Channel Imager & 19-Channel Sounder',
        alternativeValue: '6-Channel Imager & 19-Channel Sounder',
      },
      {
        dimension: 'Spatial resolution',
        primaryValue: '1.0 km Thermal IR (Nominal)',
        alternativeValue: '1.0 km Thermal IR (Elevated noise)',
        gapChip: 'Aging sensor noise',
      },
      {
        dimension: 'Revisit time',
        primaryValue: 'Continuous 30-minute full disk',
        alternativeValue: 'Continuous 30-minute full disk',
      },
      {
        dimension: 'Coverage',
        primaryValue: 'Full-disk Indian Ocean (82°E)',
        alternativeValue: 'Adjacent slot Indian Ocean (74°E)',
      },
      {
        dimension: 'Data access',
        primaryValue: 'Direct IMD early cyclone telemetry',
        alternativeValue: 'Direct IMD sister feed backup',
      },
    ],
  },
};

export function getAlternativeComparison(
  primaryNoradId: number,
  altNoradId: number
): CapabilityComparisonDimension[] {
  const primaryRecord = ALTERNATIVE_COMPARISONS[primaryNoradId];
  if (primaryRecord && primaryRecord[altNoradId]) {
    return primaryRecord[altNoradId];
  }
  return [
    {
      dimension: 'Sensor type',
      primaryValue: 'Primary payload telemetry',
      alternativeValue: 'Alternative sensor payload',
    },
    {
      dimension: 'Spatial resolution',
      primaryValue: 'Operational ground resolution',
      alternativeValue: 'Alternative ground resolution',
      gapChip: 'Resolution variance',
    },
    {
      dimension: 'Revisit time',
      primaryValue: 'Nominal orbital cadence',
      alternativeValue: 'Estimated repeat pass',
    },
    {
      dimension: 'Coverage',
      primaryValue: 'Regional observation swath',
      alternativeValue: 'Overlap footprint',
    },
    {
      dimension: 'Data access',
      primaryValue: 'Direct operator access',
      alternativeValue: 'Shared / External protocol',
      gapChip: 'Access protocol',
    },
  ];
}
