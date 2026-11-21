export function formatDistance(km: number): string {
  if (km < 1) {
    return `${(km * 1000).toFixed(0)} m`;
  }
  return `${km.toFixed(2)} km`;
}

export function formatVelocity(kms: number): string {
  return `${kms.toFixed(2)} km/s`;
}

export function formatUTC(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  } catch {
    return isoString;
  }
}

export function formatTimeRemaining(isoString: string): string {
  try {
    const diffMs = new Date(isoString).getTime() - Date.now();
    if (diffMs < 0) return 'TCA Passed';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `in ${days}d ${hours % 24}h`;
    }
    return `in ${hours}h ${mins}m`;
  } catch {
    return 'Pending';
  }
}

export function formatCoordinates(lat: number, lon: number): string {
  const latStr = `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}`;
  const lonStr = `${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'E' : 'W'}`;
  return `${latStr}, ${lonStr}`;
}
