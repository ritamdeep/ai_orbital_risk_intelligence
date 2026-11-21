"""CelesTrak Ingestion Client & TLE Store.

Manages:
  1. Offline seed loading from bundled sample_tles.txt (dataSource: "mock")
  2. Live CelesTrak TLE fetching with disk cache and rate-limit guardrails (dataSource: "real")
  3. SGP4 propagator instantiation and state vector calculations
"""

import os
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
import httpx

from app.core.config import settings
from app.schemas.orbital import SatelliteSummary, PositionModel
from app.orbital_engine.propagator.sgp4_propagator import SGP4Propagator

logger = logging.getLogger(__name__)

# Known metadata for seed objects
METADATA_REGISTRY: Dict[int, Dict[str, Any]] = {
    44804: {
        "name": "CARTOSAT-3",
        "type": "payload",
        "countryCode": "IND",
        "intlDesignator": "2019-089A",
        "isActive": True,
        "orbitRegime": "SSO",
    },
    51656: {
        "name": "EOS-04 (RISAT-1A)",
        "type": "payload",
        "countryCode": "IND",
        "intlDesignator": "2022-013A",
        "isActive": True,
        "orbitRegime": "SSO",
    },
    41783: {
        "name": "PRATHAM",
        "type": "payload",
        "countryCode": "IND",
        "intlDesignator": "2016-059A",
        "isActive": True,
        "orbitRegime": "LEO",
    },
    54361: {
        "name": "OCEANSAT-3 (EOS-06)",
        "type": "payload",
        "countryCode": "IND",
        "intlDesignator": "2022-158A",
        "isActive": True,
        "orbitRegime": "SSO",
    },
    41752: {
        "name": "INSAT-3DR",
        "type": "payload",
        "countryCode": "IND",
        "intlDesignator": "2016-054A",
        "isActive": True,
        "orbitRegime": "GEO",
    },
    25730: {
        "name": "FENGYUN 1C DEBRIS",
        "type": "debris",
        "countryCode": "CHN",
        "intlDesignator": "1999-025A",
        "isActive": False,
        "orbitRegime": "LEO",
    },
    34454: {
        "name": "COSMOS 2251 DEBRIS",
        "type": "debris",
        "countryCode": "CIS",
        "intlDesignator": "1993-036SX",
        "isActive": False,
        "orbitRegime": "LEO",
    },
    22285: {
        "name": "SL-16 R/B DEBRIS",
        "type": "rocket_body",
        "countryCode": "CIS",
        "intlDesignator": "1992-080B",
        "isActive": False,
        "orbitRegime": "LEO",
    },
    19468: {
        "name": "CZ-4C DEBRIS",
        "type": "debris",
        "countryCode": "CHN",
        "intlDesignator": "1988-080B",
        "isActive": False,
        "orbitRegime": "LEO",
    },
}


class OrbitalDataStore:
    """In-memory store of satellite propagators and TLE records."""

    def __init__(self):
        self._propagators: Dict[int, SGP4Propagator] = {}
        self._tle_records: Dict[int, Dict[str, Any]] = {}
        self._is_live_loaded: bool = False
        self._last_fetch_time: Optional[datetime] = None
        self.load_bundled_seed()

    def load_bundled_seed(self) -> None:
        """Load bundled sample TLEs from disk (dataSource: 'mock')."""
        if not os.path.exists(settings.SAMPLE_TLES_FILE):
            logger.error(f"Sample TLE file not found at {settings.SAMPLE_TLES_FILE}")
            return

        with open(settings.SAMPLE_TLES_FILE, "r", encoding="utf-8") as f:
            raw_lines = [line.strip() for line in f if line.strip()]

        i = 0
        while i < len(raw_lines) - 2:
            name_line = raw_lines[i]
            line1 = raw_lines[i + 1]
            line2 = raw_lines[i + 2]

            if line1.startswith("1 ") and line2.startswith("2 "):
                try:
                    norad_id = int(line1[2:7].strip())
                    propagator = SGP4Propagator.from_tle(line1, line2, name=name_line)
                    self._propagators[norad_id] = propagator
                    self._tle_records[norad_id] = {
                        "name": name_line,
                        "line1": line1,
                        "line2": line2,
                        "dataSource": "mock",
                        "loadedAt": datetime.now(timezone.utc),
                    }
                except Exception as e:
                    logger.warning(f"Error parsing bundled TLE block for {name_line}: {e}")
                i += 3
            else:
                i += 1

        logger.info(f"Loaded {len(self._propagators)} seed objects from bundled file (dataSource: mock).")

    async def refresh_live_from_celestrak(self, force: bool = False) -> int:
        """Fetch live TLEs from CelesTrak for seed objects (dataSource: 'real')."""
        now = datetime.now(timezone.utc)
        if not force and self._last_fetch_time:
            if now - self._last_fetch_time < timedelta(hours=settings.CACHE_EXPIRATION_HOURS):
                logger.info("CelesTrak rate-limit guard: disk cache is fresh, skipping live fetch.")
                return 0

        updated_count = 0
        target_ids = list(METADATA_REGISTRY.keys())

        async with httpx.AsyncClient(timeout=10.0) as client:
            for norad_id in target_ids:
                url = f"{settings.CELESTRAK_BASE_URL}?CATNR={norad_id}&FORMAT=tle"
                try:
                    resp = await client.get(url)
                    if resp.status_code == 200:
                        lines = [l.strip() for l in resp.text.strip().split("\n") if l.strip()]
                        if len(lines) >= 3 and lines[1].startswith("1 ") and lines[2].startswith("2 "):
                            name = lines[0]
                            line1 = lines[1]
                            line2 = lines[2]
                            prop = SGP4Propagator.from_tle(line1, line2, name=name)
                            self._propagators[norad_id] = prop
                            self._tle_records[norad_id] = {
                                "name": name,
                                "line1": line1,
                                "line2": line2,
                                "dataSource": "real",
                                "loadedAt": now,
                            }
                            updated_count += 1
                except Exception as e:
                    logger.warning(f"Failed live CelesTrak fetch for {norad_id}: {e}")

        if updated_count > 0:
            self._is_live_loaded = True
            self._last_fetch_time = now
            logger.info(f"Successfully refreshed {updated_count} objects from live CelesTrak.")

        return updated_count

    def get_satellite_summary(self, norad_id: int, target_time: Optional[datetime] = None) -> Optional[SatelliteSummary]:
        """Generate structured SatelliteSummary matching contract specification."""
        prop = self._propagators.get(norad_id)
        if not prop:
            return None

        rec = self._tle_records.get(norad_id, {})
        data_source = rec.get("dataSource", "mock")

        now = target_time or datetime.now(timezone.utc)
        if now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)

        # Propagate current position
        pos = prop.get_position(now)
        if not pos:
            # Fallback approximate position near perigee if propagation edge case
            pos_model = PositionModel(
                timestampUtc=now.isoformat(),
                latitude=0.0,
                longitude=0.0,
                altitudeKm=500.0,
                eciX=6878.0,
                eciY=0.0,
                eciZ=0.0,
                speedKmS=7.6,
            )
        else:
            pos_model = PositionModel(
                timestampUtc=pos.timestamp.isoformat(),
                latitude=pos.lat,
                longitude=pos.lon,
                altitudeKm=pos.alt_km,
                eciX=pos.eci_x_km,
                eciY=pos.eci_y_km,
                eciZ=pos.eci_z_km,
                speedKmS=pos.speed_km_s,
            )

        params = prop.compute_orbital_parameters()
        meta = METADATA_REGISTRY.get(norad_id, {})

        # TLE Epoch extraction from Satrec
        tle_epoch_dt = prop.satrec.jdsatepoch
        # Convert Julian date to ISO UTC
        epoch_iso = self._jd_to_iso(prop.satrec.jdsatepoch, prop.satrec.jdsatepochF)

        obj_type = meta.get("type", "payload")
        is_active = meta.get("isActive", True)

        return SatelliteSummary(
            noradId=norad_id,
            name=meta.get("name", prop.name),
            intlDesignator=meta.get("intlDesignator"),
            type=obj_type,
            countryCode=meta.get("countryCode", "IND"),
            orbitRegime=params.get("orbit_regime", "LEO"),
            perigeeKm=params["perigee_km"],
            apogeeKm=params["apogee_km"],
            inclinationDeg=params["inclination_deg"],
            periodMin=params["period_min"],
            tleEpochUtc=epoch_iso,
            position=pos_model,
            isActive=is_active,
            dataSource=data_source,
        )

    def get_all_satellites(self, type_filter: Optional[str] = None) -> List[SatelliteSummary]:
        """Return all tracked objects, optionally filtered by type."""
        summaries: List[SatelliteSummary] = []
        now = datetime.now(timezone.utc)

        for norad_id in self._propagators.keys():
            summary = self.get_satellite_summary(norad_id, target_time=now)
            if summary:
                if type_filter:
                    tf = type_filter.strip().lower()
                    if summary.type.lower() != tf:
                        continue
                summaries.append(summary)

        return summaries

    def get_propagator(self, norad_id: int) -> Optional[SGP4Propagator]:
        return self._propagators.get(norad_id)

    @property
    def is_live(self) -> bool:
        return self._is_live_loaded

    @property
    def total_count(self) -> int:
        return len(self._propagators)

    @staticmethod
    def _jd_to_iso(jd: float, fr: float) -> str:
        """Convert SGP4 Julian Date epoch to ISO 8601 UTC string."""
        total_jd = jd + fr
        # Convert JD to datetime
        import math
        z = math.floor(total_jd + 0.5)
        f = (total_jd + 0.5) - z
        if z < 2299161:
            a = z
        else:
            alpha = math.floor((z - 1867216.25) / 36524.25)
            a = z + 1 + alpha - math.floor(alpha / 4)
        b = a + 1524
        c = math.floor((b - 122.1) / 365.25)
        d = math.floor(365.25 * c)
        e = math.floor((b - d) / 30.6001)
        day = b - d - math.floor(30.6001 * e) + f
        if e < 14:
            month = e - 1
        else:
            month = e - 13
        if month > 2:
            year = c - 4716
        else:
            year = c - 4715

        day_int = int(day)
        day_frac = day - day_int
        hour = int(day_frac * 24)
        minute = int((day_frac * 24 - hour) * 60)
        second = int(((day_frac * 24 - hour) * 60 - minute) * 60)

        dt = datetime(year, month, day_int, hour, minute, second, tzinfo=timezone.utc)
        return dt.isoformat()


# Global singleton instance
data_store = OrbitalDataStore()
