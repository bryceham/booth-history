import fs from 'fs';
import path from 'path';

// Define expected types for reference in validation
const ELECTION_TYPES = ["federal", "state", "local", "by-election"];
const PARENT_TYPES = ["federal", "state", "local"];
const POLLING_PLACE_TYPES = ["ordinary", "pre-poll", "postal", "absent", "other-dec"];

// Paths
const electionsPath = path.resolve(import.meta.dirname || '.', '../src/data/elections.json');
const boothsPath = path.resolve(import.meta.dirname || '.', '../src/data/booths.json');

console.log('=== Data Validation Script ===\n');

let errorCount = 0;
const logError = (context: string, message: string) => {
  console.error(`[ERROR] ${context}: ${message}`);
  errorCount++;
};
const logWarn = (context: string, message: string) => {
  console.warn(`[WARN] ${context}: ${message}`);
};

// 1. Validate Elections
console.log('--- Validating elections.json ---');
let elections: any[] = [];
const electionIds = new Set<string>();

if (!fs.existsSync(electionsPath)) {
  logError('File', 'elections.json not found.');
} else {
  try {
    elections = JSON.parse(fs.readFileSync(electionsPath, 'utf-8'));
    if (!Array.isArray(elections)) {
      logError('elections.json', 'Root must be an array.');
    } else {
      elections.forEach((election, index) => {
        const ctx = `Election at index ${index} (ID: ${election.id || 'missing'})`;
        
        if (!election.id || typeof election.id !== 'string') logError(ctx, 'Missing or invalid "id".');
        else {
          if (electionIds.has(election.id)) logError(ctx, `Duplicate "id" found: ${election.id}`);
          electionIds.add(election.id);
        }

        if (!election.name || typeof election.name !== 'string') logError(ctx, 'Missing or invalid "name".');
        
        if (!election.date || typeof election.date !== 'string') logError(ctx, 'Missing or invalid "date".');
        else if (isNaN(Date.parse(election.date))) logError(ctx, `Invalid date format: ${election.date}`);

        if (!election.type || !ELECTION_TYPES.includes(election.type)) logError(ctx, `Missing or invalid "type": ${election.type}`);
        
        if (!election.division || typeof election.division !== 'string') logError(ctx, 'Missing or invalid "division".');
        
        if (election.parentType && !PARENT_TYPES.includes(election.parentType)) logError(ctx, `Invalid "parentType": ${election.parentType}`);
      });
    }
  } catch (e: any) {
    logError('elections.json', `Failed to parse JSON: ${e.message}`);
  }
}

console.log(`Elections validation complete. Processed ${elections.length} elections.\n`);

// 2. Validate Booths
console.log('--- Validating booths.json ---');
let booths: any[] = [];

if (!fs.existsSync(boothsPath)) {
  logError('File', 'booths.json not found.');
} else {
  try {
    booths = JSON.parse(fs.readFileSync(boothsPath, 'utf-8'));
    if (!Array.isArray(booths)) {
      logError('booths.json', 'Root must be an array.');
    } else {
      const boothIds = new Set<string>();

      booths.forEach((booth, index) => {
        const ctx = `Booth at index ${index} (Name: ${booth.name || 'missing'}, ID: ${booth.id || 'missing'})`;

        if (!booth.id || typeof booth.id !== 'string') logError(ctx, 'Missing or invalid "id".');
        else {
          if (boothIds.has(booth.id)) logError(ctx, `Duplicate booth "id" found: ${booth.id}`);
          boothIds.add(booth.id);
        }

        if (!booth.name || typeof booth.name !== 'string') logError(ctx, 'Missing or invalid "name".');
        if (typeof booth.suburb !== 'string') logError(ctx, 'Missing or invalid "suburb".'); // could be empty string
        if (typeof booth.division !== 'string') logError(ctx, 'Missing or invalid "division".');
        
        if (booth.lga && typeof booth.lga !== 'string') logError(ctx, 'Invalid "lga".');
        
        if (typeof booth.lat !== 'number' || isNaN(booth.lat)) logError(ctx, 'Missing or invalid "lat".');
        if (typeof booth.lng !== 'number' || isNaN(booth.lng)) logError(ctx, 'Missing or invalid "lng".');

        if (booth.type && !POLLING_PLACE_TYPES.includes(booth.type)) logError(ctx, `Invalid booth "type": ${booth.type}`);

        if (!Array.isArray(booth.results)) {
          logError(ctx, '"results" must be an array.');
        } else {
          // Check for empty results array which might be an anomaly depending on expected data state, but technically valid type-wise.
          if (booth.results.length === 0) logWarn(ctx, 'Booth has empty results array.');

          booth.results.forEach((result: any, rIndex: number) => {
            const rCtx = `${ctx} -> Result [${rIndex}]`;
            
            if (!result.electionId || typeof result.electionId !== 'string') logError(rCtx, 'Missing or invalid "electionId".');
            else if (!electionIds.has(result.electionId)) logError(rCtx, `electionId "${result.electionId}" not found in elections.json.`);

            if (!result.contestName || typeof result.contestName !== 'string') logError(rCtx, 'Missing or invalid "contestName".');
            if (!result.party || typeof result.party !== 'string') logError(rCtx, 'Missing or invalid "party".');
            
            if (typeof result.votes !== 'number' || isNaN(result.votes)) logError(rCtx, 'Missing or invalid "votes".');
            if (typeof result.percentage !== 'number' || isNaN(result.percentage)) logError(rCtx, 'Missing or invalid "percentage".');
            
            if (result.division && typeof result.division !== 'string') logError(rCtx, 'Invalid "division".');
          });
        }
      });
    }
  } catch (e: any) {
    logError('booths.json', `Failed to parse JSON: ${e.message}`);
  }
}

console.log(`Booths validation complete. Processed ${booths.length} booths.\n`);

console.log('=== Summary ===');
if (errorCount === 0) {
  console.log('✅ No anomalies found!');
} else {
  console.log(`❌ Found ${errorCount} anomalies/errors. Please review the logs above.`);
}
