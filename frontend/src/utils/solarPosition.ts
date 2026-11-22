/**
 * Astronomical solar sub-point and Earth-fixed spherical coordinate utilities.
 *
 * Coordinate convention matches Three.js SphereGeometry(R) with zero mesh rotation:
 *   +Y = North Pole (lat +90 deg)
 *   +X = Prime Meridian at Equator (lat 0 deg, lon 0 deg)
 *   -Z = 90 deg East at Equator (India / Bay of Bengal)
 *   +Z = 90 deg West at Equator (Americas)
 */

export const EARTH_RADIUS_KM = 6371.0;
const DEG_TO_RAD = Math.PI / 180;

export interface SubSolarPoint {
  latitudeDeg: number;
  longitudeDeg: number;
}

export interface Vec3Tuple {
  x: number;
  y: number;
  z: number;
}

/**
 * Compute fractional UTC day-of-year (1-based: Jan 1 00:00 UTC = 1.0).
 */
export function getDayOfYearUTC(date: Date): number {
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 1, 0, 0, 0, 0);
  const diffMs = date.getTime() - startOfYear;
  return diffMs / 86_400_000 + 1;
}

/**
 * Compute the approximate sub-solar point (latitude & longitude in degrees)
 * for a given UTC Date.
 *
 * - Solar declination uses the standard cosine obliquity approximation:
 *     delta = -23.44 * cos(2 * pi * (dayOfYear + 10) / 365.2422)
 * - Sub-solar longitude shifts 15 deg westward per UTC hour from 0 deg at 12:00 UTC,
 *   including the first-order Equation of Time correction (~minutes) for higher accuracy.
 */
export function computeSubSolarPoint(date: Date = new Date()): SubSolarPoint {
  const dayOfYear = getDayOfYearUTC(date);

  // Solar declination in degrees (-23.44 deg at Dec solstice, +23.44 deg at Jun solstice)
  const declAngleRad = ((2 * Math.PI) / 365.2422) * (dayOfYear + 10);
  const latitudeDeg = -23.44 * Math.cos(declAngleRad);

  // Equation of time approximation (in minutes)
  const bRad = ((2 * Math.PI) / 365.2422) * (dayOfYear - 81);
  const eotMinutes = 9.87 * Math.sin(2 * bRad) - 7.53 * Math.cos(bRad) - 1.5 * Math.sin(bRad);

  const utcHours =
    date.getUTCHours() +
    date.getUTCMinutes() / 60 +
    date.getUTCSeconds() / 3600 +
    eotMinutes / 60;

  // At 12:00 solar UTC, Sun is over Prime Meridian (0 deg); moves west at 15 deg/hr
  let longitudeDeg = (12 - utcHours) * 15;
  // Normalize into [-180, 180]
  longitudeDeg = ((((longitudeDeg + 180) % 360) + 360) % 360) - 180;

  return { latitudeDeg, longitudeDeg };
}

/**
 * Convert geodetic (latDeg, lonDeg) and radial distance to Three.js Earth-fixed Cartesian coordinates.
 */
export function latLonRadiusToCartesian(
  latDeg: number,
  lonDeg: number,
  radius: number
): Vec3Tuple {
  const phi = (90 - latDeg) * DEG_TO_RAD;
  const theta = (lonDeg + 180) * DEG_TO_RAD;
  const sinPhi = Math.sin(phi);
  return {
    x: -(radius * sinPhi * Math.cos(theta)),
    y: radius * Math.cos(phi),
    z: radius * sinPhi * Math.sin(theta),
  };
}

/**
 * Compute true-scale orbital radius in Earth-radii units:
 *   radius = (6371 + altitude_km) / 6371
 */
export function trueScaleRadius(altitudeKm: number): number {
  return (EARTH_RADIUS_KM + Math.max(0, altitudeKm)) / EARTH_RADIUS_KM;
}

/**
 * Return the unit vector pointing from Earth center toward the Sun in the Earth-fixed frame.
 */
export function computeSunDirectionVector(date: Date = new Date()): Vec3Tuple {
  const { latitudeDeg, longitudeDeg } = computeSubSolarPoint(date);
  return latLonRadiusToCartesian(latitudeDeg, longitudeDeg, 1.0);
}
