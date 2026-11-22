import { useState, useMemo } from 'react';
import { SatelliteCatalogueItem, SatelliteCategory } from '../types/satelliteIntelligence';
import { useOrbitalIntelligence } from '../context/OrbitalIntelligenceContext';
import { isSameSatellite } from '../api/adapters';

export function useSatelliteIntelligence(initialNoradId?: number) {
  const { satellites, selectedNoradId, selectSatellite, overallFidelity } = useOrbitalIntelligence();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<SatelliteCategory>('All');

  const filteredSatellites = useMemo(() => {
    return satellites.filter((sat) => {
      // Category filter
      const matchesCategory =
        selectedCategory === 'All' ||
        sat.category === selectedCategory ||
        (selectedCategory === 'Earth Observation' && sat.category === 'Earth Observation') ||
        (selectedCategory === 'Disaster Monitoring' && sat.category === 'Disaster Monitoring') ||
        (selectedCategory === 'Weather' && sat.category === 'Weather') ||
        (selectedCategory === 'Communication' && sat.category === 'Communication') ||
        (selectedCategory === 'Navigation' && sat.category === 'Navigation') ||
        (selectedCategory === 'Scientific / Student' && sat.category === 'Scientific / Student');

      // Search filter
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        sat.name.toLowerCase().includes(query) ||
        String(sat.noradId).includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [satellites, searchQuery, selectedCategory]);

  const activeNoradId = initialNoradId || selectedNoradId;

  const selectedSatellite = useMemo(() => {
    return (
      satellites.find((s) => isSameSatellite(s.noradId, activeNoradId)) ||
      filteredSatellites[0] ||
      satellites[0] ||
      null
    );
  }, [satellites, activeNoradId, filteredSatellites]);

  const handleSelectSatellite = (sat: SatelliteCatalogueItem) => {
    selectSatellite(sat.noradId);
  };

  return {
    satellites,
    filteredSatellites,
    selectedSatellite,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    setSelectedSatelliteId: (idOrNorad: string | number) => {
      const num = typeof idOrNorad === 'number' ? idOrNorad : parseInt(idOrNorad.replace('sat-', ''), 10);
      if (!isNaN(num)) selectSatellite(num);
    },
    onSelectSatellite: handleSelectSatellite,
    overallFidelity,
  };
}
