import boothsData from './data/booths.json';
import boothGroupsData from './data/booth-groups.json';
import type { PollingPlace, BoothGroup } from './types';

let cachedGroupedBooths: PollingPlace[] | null = null;

export function getGroupedBooths(): PollingPlace[] {
  if (cachedGroupedBooths) {
    return cachedGroupedBooths;
  }

  const booths = boothsData as PollingPlace[];
  const groups = boothGroupsData as BoothGroup[];
  
  cachedGroupedBooths = groups.map(group => {
    const rawBooths = booths.filter(b => group.rawNames.includes(b.name));
    const combinedResults = rawBooths.flatMap(b => b.results.map(r => ({ ...r, boothName: b.name })));
    
    // Fallback if somehow a group has no matching booths (shouldn't happen with our script)
    if (rawBooths.length === 0) {
      return {
        id: group.slug,
        name: group.displayName,
        suburb: '',
        division: '',
        lat: 0,
        lng: 0,
        results: []
      } as PollingPlace;
    }

    return {
      id: group.slug, // Map id to slug for routing
      name: group.displayName,
      suburb: rawBooths.find(b => b.suburb)?.suburb || rawBooths[0].suburb,
      division: rawBooths.find(b => b.division)?.division || rawBooths[0].division,
      lga: rawBooths.find(b => b.lga)?.lga || rawBooths[0].lga,
      lat: rawBooths.find(b => b.lat)?.lat || rawBooths[0].lat,
      lng: rawBooths.find(b => b.lng)?.lng || rawBooths[0].lng,
      type: rawBooths.some(b => b.type === 'ordinary' || !b.type) ? 'ordinary' : rawBooths[0].type,
      results: combinedResults,
      rawNames: group.rawNames
    } as PollingPlace;
  });

  return cachedGroupedBooths;
}
