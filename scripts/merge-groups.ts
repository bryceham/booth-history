import fs from 'fs';
import path from 'path';
import type { BoothGroup } from '../src/types';

const groupsPath = path.resolve(import.meta.dirname || '.', '../src/data/booth-groups.json');

const sourceArg = process.argv[2];
const targetArg = process.argv[3];

if (!sourceArg || !targetArg) {
  console.error('Usage: npx tsx scripts/merge-groups.ts "<Source Booth Name or Slug>" "<Target Booth Name or Slug>"');
  process.exit(1);
}

if (!fs.existsSync(groupsPath)) {
  console.error(`Groups file not found at: ${groupsPath}`);
  process.exit(1);
}

let groups: BoothGroup[] = [];
try {
  groups = JSON.parse(fs.readFileSync(groupsPath, 'utf-8'));
} catch (e) {
  console.error('Failed to parse booth-groups.json', e);
  process.exit(1);
}

// Find source and target groups by slug or displayName (case-insensitive)
const findGroup = (query: string): BoothGroup | undefined => {
  const queryLower = query.toLowerCase();
  return groups.find(g => g.slug.toLowerCase() === queryLower || g.displayName.toLowerCase() === queryLower);
};

const sourceGroup = findGroup(sourceArg);
const targetGroup = findGroup(targetArg);

if (!sourceGroup) {
  console.error(`Error: Source booth group "${sourceArg}" not found.`);
  process.exit(1);
}

if (!targetGroup) {
  console.error(`Error: Target booth group "${targetArg}" not found.`);
  process.exit(1);
}

if (sourceGroup.slug === targetGroup.slug) {
  console.error('Error: Source and target booth groups are the same.');
  process.exit(1);
}

// Block merge if there is duplicate data (i.e. both groups contain results for the same contest in the same election)
const boothsPath = path.resolve(import.meta.dirname || '.', '../src/data/booths.json');
if (!fs.existsSync(boothsPath)) {
  console.error(`Booths database file not found at: ${boothsPath}`);
  process.exit(1);
}

let booths: any[] = [];
try {
  booths = JSON.parse(fs.readFileSync(boothsPath, 'utf-8'));
} catch (e) {
  console.error('Failed to parse booths.json', e);
  process.exit(1);
}

const sourceBooths = booths.filter(b => sourceGroup.rawNames.includes(b.name));
const targetBooths = booths.filter(b => targetGroup.rawNames.includes(b.name));

const sourceContests = new Set<string>();
sourceBooths.forEach(b => {
  b.results.forEach((r: any) => {
    const key = `${r.electionId}||${r.contestName}||${r.division || ''}`;
    sourceContests.add(key);
  });
});

const duplicateContests: string[] = [];
targetBooths.forEach(b => {
  b.results.forEach((r: any) => {
    const key = `${r.electionId}||${r.contestName}||${r.division || ''}`;
    if (sourceContests.has(key)) {
      duplicateContests.push(`${r.electionId} - ${r.contestName} (${r.division || 'default division'})`);
    }
  });
});

if (duplicateContests.length > 0) {
  console.error('Error: Cannot merge booth groups. Duplicate election/contest data found:');
  const uniqueDuplicates = Array.from(new Set(duplicateContests));
  uniqueDuplicates.forEach(d => console.error(`  - ${d}`));
  console.error('This indicates they are different physical booths and should not be merged.');
  process.exit(1);
}

// Merge rawNames from source into target, keeping unique entries
const uniqueRawNames = new Set([...targetGroup.rawNames, ...sourceGroup.rawNames]);
targetGroup.rawNames = Array.from(uniqueRawNames);

// Delete the source group
const initialLength = groups.length;
groups = groups.filter(g => g.slug !== sourceGroup.slug);

try {
  fs.writeFileSync(groupsPath, JSON.stringify(groups, null, 2), 'utf-8');
  console.log(`Successfully merged group "${sourceGroup.displayName}" into "${targetGroup.displayName}".`);
  console.log(`Updated rawNames for "${targetGroup.displayName}":`, targetGroup.rawNames);
  console.log(`Deleted source group entry. Total groups decreased from ${initialLength} to ${groups.length}.`);
} catch (e) {
  console.error('Failed to write updated booth-groups.json', e);
  process.exit(1);
}
