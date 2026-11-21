"""CelesTrak GP/OMM Orbital Data Ingestion Client.

Fetches publicly available Orbit Mean-elements Message (OMM) JSON data from CelesTrak.
Implements local disk caching and transparent offline fallback to curated scenarios.
"""

import os
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
import httpx

from app.core.config import settings
from app.schemas.orbital import (
    TrackedObject,
    DebrisObject,
    ObjectType,
    OrbitRegime,
    DataFidelity,
)
from app.orbital_engine.scenarios.test_scenarios import CURATED_OBJECTS
from app.orbital_engine.propagator.sgp4_propagator import SGP4Propagator

logger = logging.getLogger(__name__)


class CelesTrakClient:
    """Manages acquisition, caching, and parsing of CelesTrak GP data."""

    def __init__(self, cache_dir: Optional[str] = None):
        self.cache_dir = cache_dir or str(settings.CACHE_DIR)
        os.makedirs(self.cache_dir, exist_ok=True)
        self._memory_cache: Dict[int, Dict[str, Any]] = {}
        self._propagator_cache: Dict[int, SGP4Propagator] = {}
        self._last_loaded_time: Optional[datetime] = None

    def _get_cache_filepath(self, group: str) -> str:
        safe_group = "".join(c for c in group if c.isalnum() or c in ("-", "_"))
        return os.path.join(self.cache_dir, f"celestrak_{safe_group}.json")

    async def fetch_group(self, group: str = "active", use_cache: bool = True) -> List[Dict[str, Any]]:
        """Fetch OMM JSON records for a CelesTrak group with cache fallback."""
        cache_file = self._get_cache_filepath(group)

        # Check existing disk cache
        if use_cache and os.path.exists(cache_file):
            try:
                mod_time = datetime.fromtimestamp(os.path.getmtime(cache_file), tz=timezone.utc)
                if datetime.now(timezone.utc) - mod_time < timedelta(hours=settings.CACHE_EXPIRATION_HOURS):
                    with open(cache_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        logger.info(f"Loaded {len(data)} objects from disk cache for group: {group}")
                        return data
            except Exception as e:
                logger.warning(f"Error reading disk cache for {group}: {e}")

        # Attempt live download
        url = f"{settings.CELESTRAK_BASE_URL}?GROUP={group}&FORMAT=json"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url)
                if response.status_code == 200:
                    records = response.json()
                    # Cache to disk
                    with open(cache_file, "w", encoding="utf-8") as f:
                        json.dump(records, f)
                    logger.info(f"Successfully fetched and cached {len(records)} objects from CelesTrak for group: {group}")
                    return records
        except Exception as e:
            logger.warning(f"Network fetch failed for CelesTrak group '{group}': {e}. Falling back to disk cache or curated data.")

        # Fallback to expired disk cache if available
        if os.path.exists(cache_file):
            try:
                with open(cache_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass

        # Offline fallback: return curated scenario objects
        logger.info(f"Using pre-seeded curated scenario objects for group '{group}'.")
        return CURATED_OBJECTS

    def seed_initial_catalog(self) -> None:
        """Seed memory catalog with curated scenario objects immediately."""
        for obj in CURATED_OBJECTS:
            norad_id = int(obj["NORAD_CAT_ID"])
            self._memory_cache[norad_id] = obj
            try:
                propagator = SGP4Propagator.from_omm(obj)
                self._propagator_cache[norad_id] = propagator
            except Exception as e:
                logger.warning(f"Failed to create propagator for {norad_id}: {e}")
        self._last_loaded_time = datetime.now(timezone.utc)

    def get_all_objects(self) -> List[TrackedObject]:
        """Return all tracked objects in memory as structured TrackedObject models."""
        if not self._memory_cache:
            self.seed_initial_catalog()

        result: List[TrackedObject] = []
        now = datetime.now(timezone.utc)

        for norad_id, raw in self._memory_cache.items():
            try:
                prop = self._propagator_cache.get(norad_id)
                if not prop:
                    continue

                params = prop.compute_orbital_parameters()
                epoch_str = raw.get("EPOCH", now.isoformat())
                try:
                    epoch_dt = datetime.fromisoformat(epoch_str.replace("Z", "+00:00"))
                    if epoch_dt.tzinfo is None:
                        epoch_dt = epoch_dt.replace(tzinfo=timezone.utc)
                except Exception:
                    epoch_dt = now

                age_hours = (now - epoch_dt).total_seconds() / 3600.0

                obj_type_str = raw.get("OBJECT_TYPE", "UNKNOWN").upper()
                obj_type = (
                    ObjectType.PAYLOAD if "PAYLOAD" in obj_type_str
                    else ObjectType.ROCKET_BODY if "ROCKET" in obj_type_str
                    else ObjectType.DEBRIS if "DEBRIS" in obj_type_str
                    else ObjectType.UNKNOWN
                )

                fidelity = (
                    DataFidelity.SYNTHETIC_SCENARIO if raw.get("DATA_SOURCE") == "SYNTHETIC_SCENARIO"
                    else DataFidelity.REAL_CELESTRAK
                )

                result.append(
                    TrackedObject(
                        norad_id=norad_id,
                        name=raw.get("OBJECT_NAME", "UNKNOWN"),
                        intl_des=raw.get("OBJECT_ID"),
                        object_type=obj_type,
                        country=raw.get("COUNTRY"),
                        epoch=epoch_dt,
                        epoch_age_hours=round(age_hours, 1),
                        inclination_deg=params["inclination_deg"],
                        period_min=params["period_min"],
                        apogee_km=params["apogee_km"],
                        perigee_km=params["perigee_km"],
                        eccentricity=params["eccentricity"],
                        mean_motion=params["mean_motion"],
                        rcs_size=raw.get("RCS_SIZE", "UNKNOWN"),
                        orbit_regime=params["orbit_regime"],
                        data_source=fidelity,
                        tle_line1=raw.get("TLE_LINE1"),
                        tle_line2=raw.get("TLE_LINE2"),
                    )
                )
            except Exception as e:
                logger.error(f"Error parsing object {norad_id}: {e}")

        return result

    def get_debris_objects(self) -> List[DebrisObject]:
        """Return only catalogued space debris and rocket bodies."""
        all_objs = self.get_all_objects()
        debris_list: List[DebrisObject] = []
        for obj in all_objs:
            if obj.object_type in (ObjectType.DEBRIS, ObjectType.ROCKET_BODY):
                raw = self._memory_cache.get(obj.norad_id, {})
                debris_list.append(
                    DebrisObject(
                        norad_id=obj.norad_id,
                        name=obj.name,
                        intl_des=obj.intl_des,
                        origin_event=raw.get("ORIGIN_EVENT"),
                        rcs_size=obj.rcs_size,
                        apogee_km=obj.apogee_km,
                        perigee_km=obj.perigee_km,
                        inclination_deg=obj.inclination_deg,
                        data_source=obj.data_source,
                    )
                )
        return debris_list

    def get_object_by_id(self, norad_id: int) -> Optional[TrackedObject]:
        """Lookup a single object by its NORAD catalog ID."""
        for obj in self.get_all_objects():
            if obj.norad_id == norad_id:
                return obj
        return None

    def get_propagator(self, norad_id: int) -> Optional[SGP4Propagator]:
        """Return the instantiated SGP4 propagator for an object."""
        if not self._propagator_cache:
            self.seed_initial_catalog()
        return self._propagator_cache.get(norad_id)

    def get_raw_metadata(self, norad_id: int) -> Optional[Dict[str, Any]]:
        """Return raw metadata dictionary for an object."""
        return self._memory_cache.get(norad_id)

    @property
    def object_count(self) -> int:
        return len(self._memory_cache)

    @property
    def last_loaded_time(self) -> Optional[datetime]:
        return self._last_loaded_time


# Singleton client instance
celestrak_client = CelesTrakClient()
celestrak_client.seed_initial_catalog()
