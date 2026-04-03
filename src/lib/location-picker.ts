import type { Location, LocationCategory } from '../types';
import locationsData from '../data/locations.json';

const locations: Location[] = locationsData as Location[];

export function pickRandomLocations(count: number, category: LocationCategory = 'all'): Location[] {
  const filtered = category === 'all'
    ? locations
    : locations.filter(loc => loc.category.includes(category));

  const pool = filtered.length > 0 ? filtered : locations;
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export function getCategoryCounts(): Record<LocationCategory, number> {
  const counts: Record<string, number> = { all: locations.length };
  for (const loc of locations) {
    for (const cat of loc.category) {
      counts[cat] = (counts[cat] || 0) + 1;
    }
  }
  return counts as Record<LocationCategory, number>;
}
