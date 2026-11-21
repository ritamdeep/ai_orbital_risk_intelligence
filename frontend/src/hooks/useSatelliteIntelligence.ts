import { useState, useMemo } from 'react';
import { SatelliteCatalogueItem, SatelliteCategory } from '../types/satelliteIntelligence';
import { MOCK_SATELLITE_CATALOGUE } from '../services/mock/mockSatelliteIntelligence';

export function useSatelliteIntelligence(initialSatelliteId = 'cartosat-3') {
  const [satellites] = useState<SatelliteCatalogueItem[]>(MOCK_SATELLITE_CATALOGUE);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<SatelliteCategory>('All');
  const [selectedSatelliteId, setSelectedSatelliteId] = useState<string>(initialSatelliteId);

  const filteredSatellites = useMemo(() => {
    return satellites.filter((sat) => {
      // Category filter
      const matchesCategory =
        selectedCategory === 'All' ||
        sat.category === selectedCategory ||
        (selectedCategory === 'Earth Observation' && sat.category === 'Earth Observation') ||
        (selectedCategory === 'Disaster Monitoring' && sat.category === 'Disaster Monitoring') ||
        (selectedCategory === 'Weather' && sat.category === 'Weather');

      // Search filter
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        sat.name.toLowerCase().includes(query) ||
        String(sat.noradId).includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [satellites, searchQuery, selectedCategory]);

  const selectedSatellite = useMemo(() => {
    return (
      satellites.find((s) => s.id === selectedSatelliteId) ||
      satellites.find((s) => s.noradId === Number(selectedSatelliteId)) ||
      filteredSatellites[0] ||
      satellites[0]
    );
  }, [satellites, selectedSatelliteId, filteredSatellites]);

  return {
    satellites,
    filteredSatellites,
    selectedSatellite,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    setSelectedSatelliteId,
  };
}
