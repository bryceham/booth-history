import fs from 'fs';
import path from 'path';
import type { PollingPlace, ContestResult } from '../src/types';

const data = `Booth	TOP	SA	GRN	LIB	ALP	FF	SEP	PHON	Total Formal	% Green 2025
Raymond Terrace NEWCASTLE PPVC	7	1	19	25	54	2	0	10	118	16.10%
Special Hospital Team 1	12	4	9	20	79	3	3	4	134	6.72%
Special Hospital Team 2	15	1	13	33	81	4	3	4	154	8.44%
Special Hospital Team 3	6	3	20	32	93	4	1	3	162	12.35%
Belmont NEWCASTLE PPVC	7	3	29	39	74	3	3	11	169	17.16%
East Maitland NEWCASTLE PPVC	10	0	46	43	70	4	1	12	186	24.73%
Georgetown	4	3	69	23	97	3	1	4	204	33.82%
Edgeworth NEWCASTLE PPVC	22	5	61	53	156	6	3	30	336	18.15%
Minmi	24	1	58	72	159	12	1	36	363	15.98%
Tighes Hill	12	10	200	29	165	5	4	19	444	45.05%
Beaumont Park	25	10	78	61	242	14	3	33	466	16.74%
Wallsend East	31	5	137	60	231	19	7	35	525	26.10%
Mayfield	12	21	179	79	270	20	2	20	603	29.68%
Hamilton North	22	14	164	88	292	13	3	26	622	26.37%
Cardiff Heights (Newcastle)	23	7	140	136	267	17	6	30	626	22.36%
Warabrook	27	7	98	100	371	21	7	45	676	14.50%
Pittown	22	10	156	70	349	32	8	56	703	22.19%
Merewether	18	8	165	190	291	9	10	32	723	22.82%
Waratah West	38	9	194	81	390	26	8	45	791	24.53%
Wickham	26	19	295	114	292	12	7	33	798	36.97%
Mayfield West	30	17	243	99	352	21	6	57	825	29.45%
Birmingham Gardens North	36	15	207	96	360	22	7	90	833	24.85%
Cooks Hill	39	15	287	195	393	10	12	32	983	29.20%
Kotara South (Newcastle)	43	6	225	196	516	16	13	55	1070	21.03%
Mayfield South	42	33	312	112	467	37	13	69	1085	28.76%
Islington	19	37	536	85	423	15	12	48	1175	45.62%
Fletcher	44	8	196	235	604	31	12	70	1200	16.33%
Shortland	59	16	282	146	552	48	9	102	1214	23.23%
Merewether South	29	9	280	364	473	13	9	46	1223	22.89%
Lambton East	43	9	275	218	596	17	11	60	1229	22.38%
Merewether Heights	53	11	283	328	474	19	16	52	1236	22.90%
Glendore	57	12	206	216	600	51	18	121	1281	16.08%
Jesmond North	42	18	381	150	582	37	12	65	1287	29.60%
Plattsburg	89	10	268	180	582	44	13	103	1289	20.79%
Adamstown Heights (Newcastle)	40	18	318	253	602	21	10	54	1316	24.16%
Wallsend	83	32	305	169	589	50	21	87	1336	22.83%
Lambton	59	19	348	205	600	36	10	61	1338	26.01%
Stockton	58	19	213	294	670	28	16	88	1386	15.37%
New Lambton Central	31	10	271	320	716	33	5	44	1430	18.95%
Carrington	50	26	477	177	659	12	8	64	1473	32.38%
Adamstown North	68	22	365	242	675	16	22	70	1480	24.66%
Newcastle City	41	74	496	278	524	17	8	48	1486	33.38%
Maryland	90	23	221	218	733	60	11	132	1488	14.85%
New Lambton South	39	22	355	268	683	24	17	80	1488	23.86%
Elermore Vale	71	20	296	236	694	57	11	109	1494	19.81%
Cooks Hill South	34	32	526	271	571	16	7	42	1499	35.09%
Adamstown South	31	25	357	310	715	23	13	78	1552	23.00%
New Lambton	69	9	358	322	695	28	9	79	1569	22.82%
Hamilton South	47	20	356	403	672	22	9	64	1593	22.35%
Mayfield East	49	45	558	175	743	24	11	58	1663	33.55%
Waratah	57	40	471	217	753	36	10	87	1671	28.19%
Wallsend South	49	17	359	282	832	54	19	85	1697	21.15%
The Junction	66	26	490	456	782	26	18	53	1917	25.56%
Hamilton	53	58	662	275	741	48	26	62	1925	34.39%
Charlestown NEWCASTLE PPVC	144	38	815	857	1682	85	26	190	3837	21.24%
Mayfield NEWCASTLE PPVC	262	126	1915	1594	3998	163	65	437	8560	22.37%
Postal	304	121	1290	2173	4896	175	76	571	9606	13.43%
Newcastle NEWCASTLE PPVC	300	254	2684	2906	4901	144	59	409	11657	23.02%
Wallsend NEWCASTLE PPVC	477	88	1740	2667	6250	319	88	833	12462	13.96%`;

const boothsPath = path.resolve(import.meta.dirname || '.', '../src/data/booths.json');
const booths: PollingPlace[] = JSON.parse(fs.readFileSync(boothsPath, 'utf-8'));

// Parse incoming lines
const lines = data.trim().split('\n');
const headers = lines[0].split('\t');

const parsedRows = lines.slice(1).map(line => {
  const parts = line.split('\t');
  const row: Record<string, string> = {};
  headers.forEach((header, index) => {
    row[header] = parts[index];
  });
  return row;
});

console.log(`Parsed ${parsedRows.length} rows of new 2025 election data.`);

let matchedCount = 0;
let createdCount = 0;

parsedRows.forEach(row => {
  const rawName = row['Booth'];
  const totalFormal = parseInt(row['Total Formal']);
  if (isNaN(totalFormal) || totalFormal === 0) return;

  const grnVotes = parseInt(row['GRN']) || 0;
  const libVotes = parseInt(row['LIB']) || 0;
  const alpVotes = parseInt(row['ALP']) || 0;

  const grnPercentage = parseFloat(((grnVotes / totalFormal) * 100).toFixed(2));
  const libPercentage = parseFloat(((libVotes / totalFormal) * 100).toFixed(2));
  const alpPercentage = parseFloat(((alpVotes / totalFormal) * 100).toFixed(2));

  // Try to find the booth in the existing booths-mock.json
  // We can do a smart name match
  let booth = booths.find(b => b.name.toLowerCase() === rawName.toLowerCase());

  // If not found, try a looser match (e.g. "Newcastle City Hall" matches "Newcastle City")
  if (!booth) {
    booth = booths.find(b =>
      b.name.toLowerCase().includes(rawName.toLowerCase()) ||
      rawName.toLowerCase().includes(b.name.toLowerCase())
    );
  }

  const newResults: ContestResult[] = [
    {
      electionId: "2025-federal",
      contestName: "House of Representatives",
      party: "GRN",
      votes: grnVotes,
      percentage: grnPercentage,
    },
    {
      electionId: "2025-federal",
      contestName: "House of Representatives",
      party: "LNP", // standardizing LIB to LNP
      votes: libVotes,
      percentage: libPercentage,
    },
    {
      electionId: "2025-federal",
      contestName: "House of Representatives",
      party: "ALP",
      votes: alpVotes,
      percentage: alpPercentage,
    }
  ];

  if (booth) {
    // Remove any existing 2025-federal results for this booth to avoid duplicates
    booth.results = booth.results.filter(r => r.electionId !== '2025-federal');
    // Append the new ones
    booth.results.push(...newResults);
    matchedCount++;
  } else {
    // Create new booth entry
    const newBoothId = String(booths.length + 1);
    // Extract suburb from booth name if possible, or use a default
    let suburb = rawName;
    if (rawName.includes('NEWCASTLE')) suburb = 'Newcastle';
    else if (rawName.includes('(')) suburb = rawName.split('(')[0].trim();

    booths.push({
      id: newBoothId,
      name: rawName,
      suburb: suburb,
      division: "Newcastle", // Default current division
      lga: rawName.toLowerCase().includes('lake') ? "Lake Macquarie City Council" : "City of Newcastle",
      lat: -32.9272, // Newcastle Center default
      lng: 151.7761,
      results: newResults
    });
    createdCount++;
  }
});

console.log(`Matched and updated: ${matchedCount} booths.`);
console.log(`Created new: ${createdCount} booths.`);

// Write back to booths-mock.json
fs.writeFileSync(boothsPath, JSON.stringify(booths, null, 2), 'utf-8');
console.log('Successfully wrote to booths-mock.json.');
