"""SGP4 Orbital Propagator Wrapper.

Uses the official sgp4 library (sgp4.api.Satrec) for deterministic propagation
of Earth-orbiting satellites from Two-Line Elements (TLE) or Orbit Mean-elements Messages (OMM).
Outputs TEME ECI state vectors and converts them to WGS84 Geodetic coordinates.
"""

import math
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Tuple, Dict, Any
from sgp4.api import Satrec, WGS72
from sgp4 import omm

from app.schemas.orbital import OrbitalPosition, OrbitRegime, DataFidelity
from app.orbital_engine.propagator.coordinates import (
    datetime_to_julian,
    teme_to_geodetic,
    WGS84_A,
)


class SGP4Propagator:
    """Encapsulates SGP4/SDP4 propagation for a single satellite."""

    def __init__(self, satrec: Satrec, name: str = "UNKNOWN", norad_id: int = 0):
        self.satrec = satrec
        self.name = name
        self.norad_id = norad_id or satrec.satnum

    @classmethod
    def from_tle(cls, line1: str, line2: str, name: str = "UNKNOWN") -> "SGP4Propagator":
        """Instantiate propagator from two TLE lines."""
        satrec = Satrec.twoline2rv(line1.strip(), line2.strip(), WGS72)
        return cls(satrec, name=name, norad_id=satrec.satnum)

    @classmethod
    def from_omm(cls, omm_dict: Dict[str, Any]) -> "SGP4Propagator":
        """Instantiate propagator from CelesTrak OMM (Orbit Mean-elements Message) dictionary."""
        satrec = Satrec()
        omm.initialize(satrec, omm_dict)
        name = omm_dict.get("OBJECT_NAME", "UNKNOWN")
        norad_id = int(omm_dict.get("NORAD_CAT_ID", satrec.satnum))
        return cls(satrec, name=name, norad_id=norad_id)

    def propagate_state(self, dt: datetime) -> Tuple[int, Tuple[float, float, float], Tuple[float, float, float]]:
        """Propagate state at specific UTC datetime.

        Returns:
            error_code: 0 if success, >0 if propagation error (e.g. decayed)
            position_teme_km: (x, y, z) in TEME ECI frame
            velocity_teme_km_s: (vx, vy, vz) in TEME ECI frame
        """
        jd_day, day_fraction = datetime_to_julian(dt)
        e, r, v = self.satrec.sgp4(jd_day, day_fraction)
        return e, r, v

    def get_position(self, dt: datetime) -> Optional[OrbitalPosition]:
        """Propagate and return a structured OrbitalPosition."""
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)

        error_code, r, v = self.propagate_state(dt)
        if error_code != 0:
            return None

        x, y, z = r
        vx, vy, vz = v
        speed = math.sqrt(vx * vx + vy * vy + vz * vz)

        lat, lon, alt = teme_to_geodetic(x, y, z, dt)

        return OrbitalPosition(
            timestamp=dt,
            epoch_seconds=dt.timestamp(),
            lat=round(lat, 5),
            lon=round(lon, 5),
            alt_km=round(alt, 3),
            eci_x_km=round(x, 3),
            eci_y_km=round(y, 3),
            eci_z_km=round(z, 3),
            vel_x_km_s=round(vx, 4),
            vel_y_km_s=round(vy, 4),
            vel_z_km_s=round(vz, 4),
            speed_km_s=round(speed, 4),
        )

    def generate_ephemeris(
        self,
        start_time: datetime,
        duration_hours: float,
        step_seconds: int = 60,
    ) -> List[OrbitalPosition]:
        """Generate a time-series ephemeris of positions."""
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=timezone.utc)

        positions: List[OrbitalPosition] = []
        total_steps = int((duration_hours * 3600) / step_seconds)

        for i in range(total_steps + 1):
            current_dt = start_time + timedelta(seconds=i * step_seconds)
            pos = self.get_position(current_dt)
            if pos is not None:
                positions.append(pos)

        return positions

    def compute_orbital_parameters(self) -> Dict[str, Any]:
        """Extract mean orbital parameters: perigee, apogee, period, regime."""
        # Mean motion in revs per day
        no_kozai = self.satrec.no_kozai # rad/min
        mean_motion_rev_day = (no_kozai * 1440.0) / (2.0 * math.pi)

        # Semi-major axis (a) in km
        # mu = 398600.4418 km^3/s^2; n in rad/s
        n_rad_s = (no_kozai) / 60.0
        if n_rad_s > 0:
            a_km = (398600.4418 / (n_rad_s ** 2)) ** (1.0 / 3.0)
        else:
            a_km = WGS84_A

        e = self.satrec.ecco
        perigee_km = a_km * (1.0 - e) - WGS84_A
        apogee_km = a_km * (1.0 + e) - WGS84_A
        period_min = 1440.0 / mean_motion_rev_day if mean_motion_rev_day > 0 else 0.0
        inclination_deg = math.degrees(self.satrec.inclo)

        # Classify regime
        if apogee_km < 2000:
            # Check for Sun-Synchronous (near 97-102 deg inclination in LEO)
            if 96.0 <= inclination_deg <= 105.0:
                regime = OrbitRegime.SSO
            else:
                regime = OrbitRegime.LEO
        elif 35000 <= apogee_km <= 36500 and e < 0.05:
            regime = OrbitRegime.GEO
        elif 2000 <= apogee_km < 35000:
            regime = OrbitRegime.MEO
        else:
            regime = OrbitRegime.HEO

        return {
            "semi_major_axis_km": round(a_km, 3),
            "eccentricity": round(e, 7),
            "inclination_deg": round(inclination_deg, 4),
            "period_min": round(period_min, 2),
            "apogee_km": round(apogee_km, 2),
            "perigee_km": round(perigee_km, 2),
            "mean_motion": round(mean_motion_rev_day, 4),
            "orbit_regime": regime,
        }
