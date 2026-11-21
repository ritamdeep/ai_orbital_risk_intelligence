/**
 * ASTRAVIGIL Scientific Disclaimers & Operational Limitations
 * Upholding Section 5 Scientific Rules throughout the platform
 */

export const SCIENTIFIC_DISCLAIMERS = {
  PRELIMINARY_SCREENING: 
    'Preliminary close-approach screening is conducted via SGP4 orbital propagation of publicly available Two-Line Element (TLE) sets. It identifies geometric proximity and does not constitute a verified Conjunction Data Message (CDM) or high-precision collision prediction.',
  
  NO_INVENTED_PROBABILITY: 
    'Physical collision probabilities require full 3D orbital covariance error matrices, which are not provided in open TLE datasets. In accordance with orbital safety standards, ASTRAVIGIL reports physical miss distance (km) and relative velocity (km/s) rather than unverified collision probability percentages.',

  SEPARATE_DIMENSIONS: 
    'Mission criticality measures downstream socio-economic and disaster response importance. Mission importance does not alter the physical laws of orbital motion or the probability of collision.',

  CATALOGUED_VS_UNTRACKED_DEBRIS: 
    'Display represents catalogued space objects (typically >10 cm in LEO). Over 1 million lethal uncatalogued debris fragments exist in orbit that cannot currently be tracked with public telemetry.',

  AI_DECISION_SUPPORT: 
    'Artificial Intelligence is utilized strictly for natural language synthesis, mission context analysis, and decision support. Physical orbital trajectories and proximity calculations are computed deterministically via SGP4 orbital mechanics.',

  MOCK_MODE_BANNER: 
    'SIMULATED / MOCK DATA MODE: Active for local interface testing and validation. Orbital parameters and mission entries are sourced from open research records and offline fixtures.'
};
