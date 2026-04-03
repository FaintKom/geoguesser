import type { Location } from '../types';
import locationsData from '../data/locations.json';

const locations: Location[] = locationsData as Location[];

export function pickRandomLocations(count: number): Location[] {
  const shuffled = [...locations];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
