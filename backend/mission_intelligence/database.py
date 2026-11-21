"""Mission Database loader and query utilities for ASTRAVIGIL."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Optional

from .schemas import MissionType, SatelliteMission, SensorModality

DEFAULT_DB_PATH = Path(__file__).resolve().parent / "mission_db.json"


class MissionDatabase:
    """In-memory repository backed by the verified mission_db.json catalog."""

    def __init__(self, db_path: Path = DEFAULT_DB_PATH) -> None:
        self.db_path = db_path
        self._satellites: dict[int, SatelliteMission] = {}
        self.metadata: dict[str, str] = {}
        self._load()

    def _load(self) -> None:
        with self.db_path.open("r", encoding="utf-8") as fh:
            raw = json.load(fh)

        self.metadata = {
            "schema_version": str(raw.get("schema_version", "1.0.0")),
            "catalog_name": str(raw.get("catalog_name", "ASTRAVIGIL Mission Database")),
            "last_verified_utc": str(raw.get("last_verified_utc", "")),
            "scientific_note": str(raw.get("scientific_note", "")),
        }

        satellites_raw = raw.get("satellites", {})
        parsed: dict[int, SatelliteMission] = {}
        for key, record in satellites_raw.items():
            mission = SatelliteMission.model_validate(record)
            if str(mission.norad_id) != str(key):
                raise ValueError(
                    f"NORAD ID mismatch in mission_db.json: key={key}, record.norad_id={mission.norad_id}"
                )
            parsed[mission.norad_id] = mission
        self._satellites = parsed

    def count(self) -> int:
        return len(self._satellites)

    def get_by_norad_id(self, norad_id: int) -> Optional[SatelliteMission]:
        return self._satellites.get(norad_id)

    def list_all(self) -> list[SatelliteMission]:
        return sorted(self._satellites.values(), key=lambda m: (m.country != "India", m.name))

    def filter_missions(
        self,
        *,
        mission_type: Optional[MissionType] = None,
        country: Optional[str] = None,
        service_id: Optional[str] = None,
        sensor_modality: Optional[SensorModality] = None,
        region: Optional[str] = None,
    ) -> list[SatelliteMission]:
        results = self.list_all()
        if mission_type is not None:
            results = [m for m in results if m.mission_type == mission_type]
        if country:
            country_norm = country.strip().lower()
            results = [m for m in results if m.country.lower() == country_norm]
        if service_id:
            service_norm = service_id.strip().lower()
            results = [
                m
                for m in results
                if any(dep.service_id.lower() == service_norm for dep in m.active_service_dependencies)
            ]
        if sensor_modality is not None:
            results = [
                m for m in results if any(s.modality == sensor_modality for s in m.sensors)
            ]
        if region:
            region_norm = region.strip().lower()
            results = [
                m
                for m in results
                if any(
                    region_norm in r.lower() or r.lower() == "global"
                    for r in m.coverage_regions
                )
            ]
        return results


@lru_cache(maxsize=1)
def get_mission_db() -> MissionDatabase:
    """Return a cached singleton MissionDatabase instance."""
    return MissionDatabase()
