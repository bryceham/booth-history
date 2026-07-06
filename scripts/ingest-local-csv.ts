import fs from 'fs';
import path from 'path';
import type { PollingPlace, ContestResult } from '../src/types';

// Simple CSV parser that handles commas inside quotes (though not strictly needed for this simple dataset)
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function determineBoothType(name: string): "ordinary" | "pre-poll" | "postal" | "absent" | "other-dec" {
  const lower = name.toLowerCase();
  if (lower.includes('pre-poll') || lower.includes('evc') || lower.includes('ppvc')) {
    return 'pre-poll';
  }
  if (lower.includes('postal')) {
    return 'postal';
  }
  if (lower.includes('absent')) {
    return 'absent';
  }
  if (lower.includes('declared institution') || lower.includes('provisional') || lower.includes('other-dec') || lower.includes('facility')) {
    return 'other-dec';
  }
  return 'ordinary';
}

const csvDir = path.resolve(import.meta.dirname || '.', '../csv');
const boothsPath = path.resolve(import.meta.dirname || '.', '../src/data/booths.json');
const electionsPath = path.resolve(import.meta.dirname || '.', '../src/data/elections.json');

if (!fs.existsSync(csvDir)) {
  console.error(`CSV directory not found at ${csvDir}`);
  process.exit(1);
}

// Load booths database
if (!fs.existsSync(boothsPath)) {
  console.error(`booths.json not found at ${boothsPath}`);
  process.exit(1);
}
const booths: PollingPlace[] = JSON.parse(fs.readFileSync(boothsPath, 'utf-8'));

// Load elections database
if (!fs.existsSync(electionsPath)) {
  console.error(`elections.json not found at ${electionsPath}`);
  process.exit(1);
}
const elections = JSON.parse(fs.readFileSync(electionsPath, 'utf-8'));

// Find CSV files
const files = fs.readdirSync(csvDir).filter(f => f.endsWith('.csv'));
if (files.length === 0) {
  console.log('No CSV files found in csv/ directory.');
  process.exit(0);
}

files.forEach(filename => {
  console.log(`\nProcessing file: ${filename}`);

  // Filename pattern e.g., 2024_Newcastle_Ward1.csv
  const fileBase = path.basename(filename, '.csv');
  const parts = fileBase.split('_');
  if (parts.length < 3) {
    console.warn(`Filename ${filename} does not match expected YYYY_LGA_WardName.csv pattern. Skipping.`);
    return;
  }

  const year = parts[0];
  const lgaRaw = parts[1]; // e.g. Newcastle
  const wardRaw = parts[2]; // e.g. Ward1

  // Format ward name nicely (e.g. Ward1 -> Ward 1, NorthWard -> North Ward)
  let wardName = wardRaw.replace(/([a-zA-Z]+)(\d+)/, '$1 $2');
  wardName = wardName.replace(/([a-zA-Z]+)(Ward)/, '$1 $2');
  const lgaName = lgaRaw.replace(/([a-z])([A-Z])/g, '$1 $2'); // e.g. LakeMacquarie -> Lake Macquarie

  let electionId = `${year}-local-${lgaRaw.toLowerCase()}`;
  if (electionId === '2024-local-lakemacquarie') {
    electionId = '2024-lake-macquarie-local';
  }
  console.log(`Parsed electionId: ${electionId}, Ward/Division: ${wardName}`);

  // Check if election is in elections.json
  let election = elections.find((e: any) => e.id === electionId);
  if (!election) {
    console.log(`Adding missing election ${electionId} to elections.json`);
    election = {
      id: electionId,
      name: `${year} ${lgaName} Local Election`,
      date: `${year}-09-14`, // Default approximate date, can be updated later
      type: "local",
      division: lgaName
    };
    elections.push(election);
    fs.writeFileSync(electionsPath, JSON.stringify(elections, null, 2), 'utf-8');
  }

  // Read file lines
  const filePath = path.join(csvDir, filename);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);

  if (lines.length === 0) {
    console.warn(`File ${filename} is empty. Skipping.`);
    return;
  }

  const headers = parseCsvLine(lines[0]);
  // Booths are at columns index 3 to headers.length - 2
  const boothColsStart = 3;
  const boothColsEnd = headers.length - 2;

  // Validate headers length
  if (headers.length < 4) {
    console.warn(`Invalid CSV headers in ${filename}. Skipping.`);
    return;
  }

  // Initialize data structures for each booth in this CSV
  const boothVotesMap: Record<string, { GRN: number; ALP: number; LNP: number; OTH: number }> = {};
  const boothTotalFormalMap: Record<string, number> = {};

  for (let c = boothColsStart; c <= boothColsEnd; c++) {
    const boothName = headers[c];
    boothVotesMap[boothName] = { GRN: 0, ALP: 0, LNP: 0, OTH: 0 };
    boothTotalFormalMap[boothName] = 0;
  }

  // Parse candidate/ATL rows
  let currentGroup = '';
  let currentPartyCode: 'GRN' | 'ALP' | 'LNP' | 'OTH' = 'OTH';

  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    if (row.length < headers.length) continue;

    const groupCol = row[0];
    const candidateCol = row[1];
    const partyCol = row[2];

    // Check if it's a metadata row
    const isUngroupedHeader =
      candidateCol.includes('UNGROUPED CANDIDATES') ||
      partyCol.includes('UNGROUPED CANDIDATES');

    const isMetadata =
      candidateCol.includes('Total Formal Votes') ||
      candidateCol.includes('Total Informal Ballot Papers') ||
      candidateCol.includes('Total Votes / Ballot Papers') ||
      isUngroupedHeader;

    if (isMetadata) {
      if (isUngroupedHeader) {
        currentGroup = '';
        currentPartyCode = 'OTH';
      }
      if (candidateCol.includes('Total Formal Votes')) {
        for (let c = boothColsStart; c <= boothColsEnd; c++) {
          const boothName = headers[c];
          boothTotalFormalMap[boothName] = parseInt(row[c].replace(/,/g, '')) || 0;
        }
      }
      continue;
    }

    // Determine party code statefully
    if (groupCol !== '') {
      currentGroup = groupCol;
      const partyLower = partyCol.toLowerCase();
      if (partyLower.includes('greens')) {
        currentPartyCode = 'GRN';
      } else if (partyLower.includes('labor')) {
        currentPartyCode = 'ALP';
      } else if (partyLower.includes('liberal')) {
        currentPartyCode = 'LNP';
      } else {
        currentPartyCode = 'OTH';
      }
    } else {
      // Below the line candidate
      // We keep the currentPartyCode if we are within a group, or OTH if not (e.g. ungrouped candidates)
      if (!currentGroup) {
        currentPartyCode = 'OTH';
      }
    }

    // Accumulate votes for each booth
    for (let c = boothColsStart; c <= boothColsEnd; c++) {
      const boothName = headers[c];
      const voteVal = parseInt(row[c].replace(/,/g, '')) || 0;
      boothVotesMap[boothName][currentPartyCode] += voteVal;
    }
  }

  // Write the ingested results to the booths database
  let matchedCount = 0;
  let createdCount = 0;

  for (let c = boothColsStart; c <= boothColsEnd; c++) {
    const rawBoothName = headers[c];
    const votes = boothVotesMap[rawBoothName];
    const totalFormal = boothTotalFormalMap[rawBoothName] || (votes.GRN + votes.ALP + votes.LNP + votes.OTH);

    if (totalFormal === 0) {
      console.warn(`Total formal votes for booth ${rawBoothName} is 0. Skipping result ingestion for this booth.`);
      continue;
    }

    const fullLgaName = lgaName.toLowerCase().includes('lake') ? "Lake Macquarie City Council" : "City of Newcastle";
    const boothType = determineBoothType(rawBoothName);

    // Try to find the booth in the existing booths.json
    let booth: PollingPlace | undefined;
    if (boothType === 'ordinary') {
      booth = booths.find(b => b.name.toLowerCase() === rawBoothName.toLowerCase() && (!b.type || b.type === 'ordinary'));
      if (!booth) {
        booth = booths.find(b =>
          (b.name.toLowerCase().includes(rawBoothName.toLowerCase()) ||
            rawBoothName.toLowerCase().includes(b.name.toLowerCase())) &&
          (!b.type || b.type === 'ordinary')
        );
      }
    } else {
      booth = booths.find(b => 
        b.name.toLowerCase() === rawBoothName.toLowerCase() && 
        b.type === boothType && 
        b.lga === fullLgaName
      );
      if (!booth) {
        booth = booths.find(b =>
          (b.name.toLowerCase().includes(rawBoothName.toLowerCase()) ||
            rawBoothName.toLowerCase().includes(b.name.toLowerCase())) &&
          b.type === boothType &&
          b.lga === fullLgaName
        );
      }
    }

    const contestResults: ContestResult[] = [
      {
        electionId,
        contestName: "Councillor",
        party: "GRN",
        votes: votes.GRN,
        percentage: parseFloat(((votes.GRN / totalFormal) * 100).toFixed(2)),
        division: wardName
      },
      {
        electionId,
        contestName: "Councillor",
        party: "ALP",
        votes: votes.ALP,
        percentage: parseFloat(((votes.ALP / totalFormal) * 100).toFixed(2)),
        division: wardName
      },
      {
        electionId,
        contestName: "Councillor",
        party: "LNP",
        votes: votes.LNP,
        percentage: parseFloat(((votes.LNP / totalFormal) * 100).toFixed(2)),
        division: wardName
      },
      {
        electionId,
        contestName: "Councillor",
        party: "OTH",
        votes: votes.OTH,
        percentage: parseFloat(((votes.OTH / totalFormal) * 100).toFixed(2)),
        division: wardName
      }
    ];

    if (booth) {
      // Remove any existing result for this electionId + contestName + division to avoid duplicates
      booth.results = booth.results.filter(
        r => !(r.electionId === electionId && r.contestName === "Councillor" && r.division === wardName)
      );
      booth.results.push(...contestResults);
      matchedCount++;
    } else {
      const maxId = booths.length > 0 ? Math.max(...booths.map(b => parseInt(b.id) || 0)) : 0;
      const newBoothId = String(maxId + 1);
      const newBooth: PollingPlace = {
        id: newBoothId,
        name: rawBoothName,
        division: "Newcastle", // Default current division/electorate
        lga: fullLgaName,
        lat: -32.9272,
        lng: 151.7761,
        type: boothType === 'ordinary' ? undefined : boothType,
        results: contestResults
      };
      booths.push(newBooth);
      createdCount++;
    }
  }

  console.log(`Matched and updated: ${matchedCount} booths.`);
  console.log(`Created new: ${createdCount} booths.`);
});

// Save booths back to booths.json
fs.writeFileSync(boothsPath, JSON.stringify(booths, null, 2), 'utf-8');
console.log('\nSuccessfully saved results to booths.json.');
