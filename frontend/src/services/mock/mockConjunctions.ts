import { ConjunctionEvent } from '../../types/orbital';
import { OperatorAIBriefing } from '../../types/intelligence';

export const MOCK_CONJUNCTIONS: ConjunctionEvent[] = [
  {
    conjunction_id: 'CONJ-2026-0042',
    primary_object: {
      norad_id: 44431,
      name: 'CARTOSAT-3',
      object_type: 'PAYLOAD',
      orbit_regime: 'LEO',
      country_code: 'IND'
    },
    secondary_object: {
      norad_id: 28221,
      name: 'FENGYUN 1C DEBRIS',
      object_type: 'DEBRIS',
      orbit_regime: 'LEO',
      country_code: 'CHN',
      origin_debris_event: '2007 ASAT Test Fragmentation Field'
    },
    tca: '2026-11-23T14:22:18Z', // in ~18 hours
    miss_distance_km: 1.82,
    relative_velocity_km_s: 14.35,
    altitude_at_tca_km: 508.4,
    tle_epoch_age_hours: 6.4,
    is_preliminary_screening: true,
    investigation_status: 'UNDER_EVALUATION',
    data_source: {
      source_name: 'CelesTrak / Space-Track SGP4 Screening Engine',
      epoch_time: '2026-11-21T18:00:00Z',
      is_mock: true,
      scientific_note: 'Preliminary geometric screening based on mean orbital elements. Covariance matrices required for collision probability calculations are not present in open TLEs.'
    }
  },
  {
    conjunction_id: 'CONJ-2026-0043',
    primary_object: {
      norad_id: 51656,
      name: 'EOS-04 (RISAT-1A)',
      object_type: 'PAYLOAD',
      orbit_regime: 'LEO',
      country_code: 'IND'
    },
    secondary_object: {
      norad_id: 34454,
      name: 'COSMOS 2251 DEBRIS',
      object_type: 'DEBRIS',
      orbit_regime: 'LEO',
      country_code: 'RUS',
      origin_debris_event: '2009 Iridium-Cosmos Hypervelocity Collision'
    },
    tca: '2026-11-24T06:14:02Z', // in ~34 hours
    miss_distance_km: 4.65,
    relative_velocity_km_s: 11.20,
    altitude_at_tca_km: 531.0,
    tle_epoch_age_hours: 8.2,
    is_preliminary_screening: true,
    investigation_status: 'MONITORING',
    data_source: {
      source_name: 'SGP4 Coarse-to-Fine Screening Engine',
      epoch_time: '2026-11-21T19:30:00Z',
      is_mock: true,
      scientific_note: 'Radial separation is within 5 km threshold. High relative inclination creates crossing velocity exceeding 11 km/s.'
    }
  },
  {
    conjunction_id: 'CONJ-2026-0044',
    primary_object: {
      norad_id: 41783,
      name: 'PRATHAM (IIT BOMBAY)',
      object_type: 'PAYLOAD',
      orbit_regime: 'LEO',
      country_code: 'IND'
    },
    secondary_object: {
      norad_id: 23467,
      name: 'SL-16 R/B DEBRIS',
      object_type: 'ROCKET_BODY',
      orbit_regime: 'LEO',
      country_code: 'CIS',
      origin_debris_event: 'Upper stage abandoned orbital rocket body'
    },
    tca: '2026-11-24T21:45:30Z',
    miss_distance_km: 8.40,
    relative_velocity_km_s: 9.75,
    altitude_at_tca_km: 686.0,
    tle_epoch_age_hours: 12.1,
    is_preliminary_screening: true,
    investigation_status: 'UNREVIEWED',
    data_source: {
      source_name: 'SGP4 Coarse-to-Fine Screening Engine',
      epoch_time: '2026-11-21T14:15:00Z',
      is_mock: true
    }
  },
  {
    conjunction_id: 'CONJ-2026-0045',
    primary_object: {
      norad_id: 54361,
      name: 'OCEANSAT-3 (EOS-06)',
      object_type: 'PAYLOAD',
      orbit_regime: 'LEO',
      country_code: 'IND'
    },
    secondary_object: {
      norad_id: 39812,
      name: 'CZ-4C DEBRIS',
      object_type: 'DEBRIS',
      orbit_regime: 'LEO',
      country_code: 'CHN'
    },
    tca: '2026-11-25T11:08:44Z',
    miss_distance_km: 18.20,
    relative_velocity_km_s: 13.50,
    altitude_at_tca_km: 721.5,
    tle_epoch_age_hours: 5.8,
    is_preliminary_screening: true,
    investigation_status: 'DISMISSED',
    data_source: {
      source_name: 'SGP4 Screening Pipeline',
      epoch_time: '2026-11-21T21:00:00Z',
      is_mock: true
    }
  }
];

export const MOCK_AI_BRIEFINGS: Record<string, OperatorAIBriefing> = {
  'CONJ-2026-0042': {
    conjunction_id: 'CONJ-2026-0042',
    executive_summary: 'Preliminary orbital screening flagged an urgent potential close approach between CARTOSAT-3 (NORAD 44431) and catalogued FENGYUN 1C DEBRIS (NORAD 28221) occurring at 2026-11-23 14:22:18 UTC with a predicted miss distance of 1.82 km.',
    physical_encounter_analysis: 'The encounter occurs in Sun-Synchronous Low Earth Orbit at an altitude of 508.4 km with a severe relative velocity of 14.35 km/s. At this kinetic velocity, even a minor fragment impact would cause catastrophic structural breakup and create thousands of hypervelocity secondary debris fragments in the 500-520 km orbital shell.',
    mission_vulnerability_analysis: 'CARTOSAT-3 is an irreplaceable Tier-1 National Critical asset providing India\'s finest 0.28m optical resolution imagery. Disruption would critically blind urban infrastructure development, border zone cadastral surveillance, and post-monsoon structural damage assessment.',
    service_continuity_plan: 'Domestic radar asset EOS-04 (RISAT-1A) can provide partial cloud-penetrating radar continuity, but optical sub-meter color capability cannot be matched by any other active domestic satellite. Copernicus Sentinel-2A provides regional coverage but at a much coarser 10-20m resolution.',
    actionable_recommendations: [
      'Prioritize high-rate ground station tracking pass at next visibility window (Shadnagar / Hyderabad) to obtain fresh TLE observations.',
      'Check if TLE age (6.4 hours) has induced significant in-track propagation error along the velocity vector.',
      'Request high-precision Conjunction Data Message (CDM) with state covariance from certified space surveillance networks.',
      'Alert flight dynamics team to evaluate potential collision avoidance maneuver (CAM) delta-V budget if radial separation closes under 1.0 km in subsequent screenings.'
    ],
    scientific_disclaimer: 'This intelligence brief is an AI-generated decision-support aid based on deterministic SGP4 preliminary screening. Open TLE data does not contain covariance matrices; therefore, this screening identifies physical proximity only and is not a validated collision prediction.',
    generated_at: '2026-11-21T22:30:00Z'
  }
};
