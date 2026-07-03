import fs from 'fs';
import path from 'path';
import type { PollingPlace, ContestResult } from '../src/types';

const boothsPath = path.resolve(import.meta.dirname || '.', '../src/data/booths.json');
let booths: PollingPlace[] = JSON.parse(fs.readFileSync(boothsPath, 'utf-8'));

// 1. Reset booths: Keep only original 84 booths, and clear results for the target elections
booths = booths.filter(b => parseInt(b.id) <= 84);
booths.forEach(b => {
  b.results = b.results.filter(r => 
    r.electionId !== '2026-by-election-newcastle' &&
    r.electionId !== '2023-state' &&
    r.electionId !== '2019-state' &&
    r.electionId !== '2015-state' &&
    r.electionId !== '2014-by-election-charlestown' &&
    r.electionId !== '2014-by-election-newcastle' &&
    r.electionId !== '2024-lake-macquarie-local'
  );
});

// Manual Mapping overrides to avoid matching high schools to public schools or mis-matching names
const manualMappings: Record<string, string> = {
  "Cardiff Sth Public": "57",
  "Cardiff Public": "53",
  "Cardiff Hghts Baptist": "20",
  "Charlestown E Public": "54",
  "Charlestown Sth Public": "4",
  "Dudley Pensioners Hall": "51",
  "Eleebana Public": "75",
  "Floraville Public": "74",
  "Garden Suburb Public": "56",
  "Hillsborough Public": "61",
  "Kahibah Public": "55",
  "Kotara Sth Public": "28",
  "Merewether Uniting": "23",
  "Mt Hutton Public": "58",
  "New Lambton Sth Public": "42",
  "The Junction Public": "46",
  "Warners Bay Public": "64",
  "Whitebridge High": "52",
  "Windale Public": "65",
  "Windale Comm. Cntr": "65",
  "Beresfield Public": "78",
  "Callaghan Cllg - Jesmond Snr": "79",
  "Callaghan Cllg - Waratah Tech": "80",
  "Carrington Public": "39",
  "Elermore Vale Public": "43",
  "Fletcher Comm. Cntr": "30",
  "Hamilton Nth Public": "19",
  "Hamilton Public": "77",
  "Hamilton Sth Comm. Hall": "2",
  "Islington Public": "29",
  "Maryland Public": "41",
  "Mayfield Church of Christ": "18",
  "Shortland Public": "31",
  "St Columba's Adamstown": "82",
  "St Thereses New Lambton": "83",
  "Stockton Public": "37",
  "Wallsend Sth Public": "45",
  "Tarro Hall": "84",
  "Glendore Public": "33",
  "Plattsburg Public": "35",
  "Minmi Hall": "14",
  "Jesmond Nhood Cntr": "34",
  "Tighes Hill Public": "15",
  "Newcastle TAFE": "15",
  "Valentine Public": "76"
};

// Helper to normalize names for strict matching (only replacing standard abbreviations and removing non-alphanumeric chars)
const normalizeName = (name: string): string => {
  return name.toLowerCase()
    .replace(/\bsth\b/g, "south")
    .replace(/\bnth\b/g, "north")
    .replace(/\beast\b/g, "east")
    .replace(/\bwest\b/g, "west")
    .replace(/[^a-z0-9]/g, "");
};

// Strict matching algorithm (Exact-Only match after normalization)
const strictMatch = (rawName: string): PollingPlace | undefined => {
  // Check manual mappings first
  if (manualMappings[rawName]) {
    const mapped = booths.find(b => b.id === manualMappings[rawName]);
    if (mapped) return mapped;
  }

  const normRaw = normalizeName(rawName);
  return booths.find(b => normalizeName(b.name) === normRaw);
};

// Add result logic
const addResult = (
  rawName: string,
  type: "ordinary" | "pre-poll" | "postal" | "absent" | "other-dec",
  division: string,
  lga: string,
  electionId: string,
  contestName: string,
  grnVotes: number,
  alpVotes: number,
  lnpVotes: number,
  othVotes: number,
  totalFormal: number
) => {
  let booth: PollingPlace | undefined;

  if (type === "ordinary") {
    booth = strictMatch(rawName);
  } else {
    // Special pseudo-booths match by name + division + type
    booth = booths.find(b => b.name === rawName && b.division === division && b.type === type);
  }

  if (!booth) {
    const maxId = Math.max(...booths.map(b => parseInt(b.id) || 0));
    // Determine suburb from rawName
    const suburb = rawName
      .replace(/ Public| High| TAFE| Snr Ctzn Cntr| Comm Cntr| Comm. Cntr| Hall| Uniting| Anglican| Baptist| Church of Christ| Presbyterian| Pensioners| Ordinary| East| North| South| West| City| Scout| Neighborhood| Nhood/g, "")
      .trim();

    booth = {
      id: String(maxId + 1),
      name: rawName,
      suburb,
      division: type === "ordinary" ? (lga === "Lake Macquarie City Council" ? "Shortland" : "Newcastle") : division,
      lga,
      lat: -32.9272,
      lng: 151.7761,
      type: type === "ordinary" ? undefined : type,
      results: []
    };
    booths.push(booth);
    console.log(`Created new booth: ${rawName} (ID: ${booth.id}, Type: ${type}, Division: ${booth.division})`);
  }

  const resultsData = [
    { party: "GRN", votes: grnVotes },
    { party: "ALP", votes: alpVotes },
    { party: "LNP", votes: lnpVotes },
    { party: "OTH", votes: othVotes }
  ];

  resultsData.forEach(({ party, votes }) => {
    const percentage = totalFormal > 0 ? parseFloat(((votes / totalFormal) * 100).toFixed(2)) : 0;
    
    // Filter old results to avoid duplicates (specifically checking the division for joint/shared booths)
    booth!.results = booth!.results.filter(r => !(r.electionId === electionId && r.party === party && r.contestName === contestName && r.division === division));

    booth!.results.push({
      electionId,
      contestName,
      party,
      votes,
      percentage,
      division
    });
  });
};

const parseNumber = (val: string | undefined): number => {
  if (!val) return 0;
  return parseInt(val.replace(/,/g, '')) || 0;
};

// ====================================================
// DATA INGESTION DEFINITIONS
// ====================================================

const lgaNewcastle = "City of Newcastle";
const lgaLakeMac = "Lake Macquarie City Council";

// 1. 2026 LORD MAYORAL BY-ELECTION
const raw2026Ordinary = `Adamstown Snr Ctzn Cntr	50	791	360	131	217	45	1594
Beresfield Public	34	1132	162	95	233	60	1716
Callaghan Cllg - Jesmond Snr	52	496	340	57	314	46	1305
Callaghan Cllg - Wallsend	39	715	215	109	256	41	1375
Callaghan Cllg - Waratah Tech	19	165	130	11	80	6	411
Carrington Public	43	639	475	72	232	26	1487
Elermore Vale Public	37	819	257	96	273	45	1527
Fletcher Comm. Cntr	30	626	153	154	278	47	1288
Glendore Public	20	639	150	89	199	35	1132
Hamilton Nth Public	19	279	144	20	87	9	558
Hamilton Public	85	663	538	137	272	19	1714
Hamilton Sth Comm. Hall	12	178	117	29	89	18	443
Hamilton Sth Public	41	824	347	124	241	29	1606
ICC Newcastle	10	184	117	21	76	26	434
Islington Public	67	492	628	72	187	35	1481
Jesmond Nhood Cntr	22	279	167	36	153	14	671
Kotara High	27	673	245	114	217	16	1292
Kotara Sth Public	31	592	226	77	144	23	1093
Lambton High	39	678	190	43	221	29	1200
Lambton Public	33	750	308	59	247	31	1428
Maryland Public	40	851	164	94	297	42	1488
Mayfield Baptist	22	177	162	28	98	12	499
Mayfield Church of Christ	51	590	334	86	224	19	1304
Mayfield E Public	70	651	509	77	311	28	1646
Mayfield Presbyterian	72	557	360	58	211	17	1275
Merewether Hghts Public	15	597	217	113	178	15	1135
Merewether Uniting	21	410	190	89	131	18	859
Minmi Hall	11	393	55	41	77	25	602
New Lambton Comm Cntr	35	762	302	113	250	37	1499
New Lambton Sth Public	41	737	279	115	180	26	1378
Newcastle City Hall	83	638	454	112	222	16	1525
Newcastle City Scout Hall	39	321	308	58	133	20	879
Newcastle E Public	73	480	328	81	150	13	1125
Newcastle TAFE	24	115	175	11	56	5	386
Our Lady of Victories Shortland	27	454	168	42	140	27	858
Shortland Public	45	671	199	84	226	32	1257
St Augustine's Anglican	34	663	227	103	131	24	1182
St Columba's Adamstown	25	525	258	92	159	27	1086
St Johns Cooks Hill	59	589	450	94	187	20	1399
St Lukes Wallsend	35	848	327	128	275	99	1712
St Patricks Wallsend	16	294	103	36	117	20	586
St Thereses New Lambton	30	769	283	122	254	24	1482
Stockton Public	42	841	203	112	265	33	1496
Tarro Hall	10	334	42	34	74	10	504
The Junction Public	54	978	474	221	290	24	2041
Wallsend Sth Public	37	622	209	73	216	19	1176
Warabrook Comm. Cntr	12	333	144	58	158	25	730
Waratah Public	75	806	492	88	262	31	1754`;

raw2026Ordinary.split('\n').forEach(line => {
  const parts = line.split('\t');
  const name = parts[0].trim();
  const obrien = parseNumber(parts[1]);
  const morris = parseNumber(parts[2]);
  const grn = parseNumber(parts[3]);
  const lib = parseNumber(parts[4]);
  const alp = parseNumber(parts[5]);
  const caine = parseNumber(parts[6]);
  const total = parseNumber(parts[7]);
  addResult(name, "ordinary", "Newcastle", lgaNewcastle, "2026-by-election-newcastle", "Lord Mayoral", grn, alp, lib, obrien + morris + caine, total);
});

// Lord Mayoral Special Categories
addResult("Adamstown Pre-Poll", "pre-poll", "Newcastle", lgaNewcastle, "2026-by-election-newcastle", "Lord Mayoral", 1176, 990, 587, 174 + 3970 + 122, 7019);
addResult("Fletcher Pre-Poll", "pre-poll", "Newcastle", lgaNewcastle, "2026-by-election-newcastle", "Lord Mayoral", 293, 570, 238, 51 + 1917 + 69, 3138);
addResult("Mayfield Pre-Poll", "pre-poll", "Newcastle", lgaNewcastle, "2026-by-election-newcastle", "Lord Mayoral", 1060, 894, 349, 144 + 2747 + 106, 5300);
addResult("New Lambton Pre-Poll", "pre-poll", "Newcastle", lgaNewcastle, "2026-by-election-newcastle", "Lord Mayoral", 803, 746, 326, 112 + 2910 + 85, 4982);
addResult("Newcastle Pre-Poll", "pre-poll", "Newcastle", lgaNewcastle, "2026-by-election-newcastle", "Lord Mayoral", 1273, 834, 420, 245 + 3098 + 63, 5933);
addResult("Wallsend Pre-Poll", "pre-poll", "Newcastle", lgaNewcastle, "2026-by-election-newcastle", "Lord Mayoral", 704, 1151, 423, 144 + 3940 + 162, 6524);
addResult("Declared Institution (Newcastle)", "other-dec", "Newcastle", lgaNewcastle, "2026-by-election-newcastle", "Lord Mayoral", 30, 110, 57, 33 + 155 + 22, 407);
addResult("Provisional (Newcastle)", "other-dec", "Newcastle", lgaNewcastle, "2026-by-election-newcastle", "Lord Mayoral", 486, 373, 161, 72 + 757 + 44, 1893);
addResult("Postal (Newcastle)", "postal", "Newcastle", lgaNewcastle, "2026-by-election-newcastle", "Lord Mayoral", 1406, 1769, 848, 242 + 5832 + 260, 10357);


// 2. 2023 CHARLESTOWN STATE ELECTION
const raw2023Charlestown = `Adamstown Snr Ctzn Cntr	311	157	40	144	652
All Saints New Lambton	660	319	54	182	1215
Cardiff Hghts Baptist	51	28	8	19	106
Cardiff Public	329	126	44	90	589
Cardiff Sth Public	838	263	80	151	1332
Charlestown E Public	790	310	63	235	1398
Charlestown Public	820	319	68	245	1452
Charlestown Sth Public	797	262	73	163	1295
Dudley Pensioners Hall	543	244	63	201	1051
Eleebana Public	1221	791	102	246	2360
Floraville Public	264	104	24	42	434
Garden Suburb Public	653	295	68	136	1152
Hillsborough Public	689	267	49	106	1111
Hunter Sports High	527	148	62	110	847
Kahibah Public	768	357	66	251	1442
Kotara High	816	448	78	228	1570
Kotara Sth Public	838	333	64	248	1483
Lakelands Hall	100	36	10	17	163
Merewether Hghts Public	52	43	9	17	121
Merewether Uniting	64	40	9	28	141
Mt Hutton Public	1169	357	117	177	1820
New Lambton Sth Public	701	293	60	236	1290
St Columba's Adamstown	619	360	47	246	1272
St Thereses New Lambton	471	258	49	164	942
The Junction Public	59	35	7	34	135
Warners Bay High	858	438	60	162	1518
Warners Bay Public	516	233	70	95	914
Whitebridge High	480	211	55	122	868
Windale Public	915	130	66	117	1228`;

raw2023Charlestown.split('\n').forEach(line => {
  const parts = line.split('\t');
  const name = parts[0].trim();
  const alp = parseNumber(parts[1]);
  const lnp = parseNumber(parts[2]);
  const oth = parseNumber(parts[3]);
  const grn = parseNumber(parts[4]);
  const total = parseNumber(parts[5]);
  addResult(name, "ordinary", "Charlestown", lgaLakeMac, "2023-state", "Legislative Assembly", grn, alp, lnp, oth, total);
});

// Charlestown 2023 Special Categories
addResult("Adamstown EVC", "pre-poll", "Charlestown", lgaNewcastle, "2023-state", "Legislative Assembly", 555, 2189, 1103, 156, 4003);
addResult("Charlestown EM Office", "pre-poll", "Charlestown", lgaLakeMac, "2023-state", "Legislative Assembly", 574, 3900, 1575, 219, 6268);
addResult("Newcastle EVC", "pre-poll", "Charlestown", lgaNewcastle, "2023-state", "Legislative Assembly", 66, 183, 87, 16, 352);
addResult("Speers Point EVC", "pre-poll", "Charlestown", lgaLakeMac, "2023-state", "Legislative Assembly", 110, 967, 543, 63, 1683);
addResult("TAV", "pre-poll", "Charlestown", lgaLakeMac, "2023-state", "Legislative Assembly", 1, 7, 4, 0, 12);
addResult("Absent (Charlestown)", "absent", "Charlestown", lgaLakeMac, "2023-state", "Legislative Assembly", 637, 2175, 1017, 260, 4089);
addResult("Provisional (Charlestown)", "other-dec", "Charlestown", lgaLakeMac, "2023-state", "Legislative Assembly", 215, 497, 157, 62, 931);
addResult("Postal (Charlestown)", "postal", "Charlestown", lgaLakeMac, "2023-state", "Legislative Assembly", 408, 3595, 1487, 252, 5742);


// 3. 2023 WALLSEND STATE ELECTION
const raw2023Wallsend = `All Saints New Lambton	43	6	21	205	7	45	4	331
Beresfield Public	112	45	207	1049	39	274	29	1755
Callaghan Cllg - Jesmond Snr	268	45	85	896	30	169	34	1527
Callaghan Cllg - Wallsend	165	36	110	1233	26	161	19	1750
Callaghan Cllg - Waratah Tech	54	5	6	102	7	21	1	196
Cardiff Hghts Baptist	150	25	98	576	21	212	19	1101
Cardiff Nth Public	137	22	87	664	18	163	15	1106
Cardiff Public	36	4	14	96	7	28	5	190
Edgeworth Public	13	7	7	52	2	12	2	95
Elermore Vale Public	192	41	156	1165	26	227	16	1823
Fletcher Comm. Cntr	67	9	33	581	7	115	9	821
Glendale E Public	104	24	107	724	18	144	14	1135
Glendore Public	93	25	97	979	20	172	14	1400
Islington Public	25	0	4	42	0	9	1	81
Jesmond Nhood Cntr	84	16	35	368	9	59	8	579
Lambton High	203	27	96	860	26	226	22	1460
Lambton Public	144	26	57	748	20	166	23	1184
Maryland Public	100	25	133	1119	22	141	24	1564
Mayfield Presbyterian	33	2	8	72	3	16	6	140
Minmi Hall	46	10	59	446	8	105	13	687
New Lambton Sth Public	29	4	2	52	3	22	1	113
Our Lady of Victories Shortland	120	28	78	645	9	109	16	1005
Shortland Public	130	27	78	778	14	117	24	1168
St Patricks Wallsend	69	6	44	462	6	53	11	651
St Thereses New Lambton	102	13	32	444	30	161	9	791
Tarro Hall	16	5	30	242	6	47	10	356
Wallsend Public	169	38	91	950	27	159	19	1453
Wallsend Sth Public	236	45	122	1259	19	327	18	2026
Waratah Public	272	33	79	745	22	192	15	1358
Waratah W Public	116	18	60	516	8	74	15	807`;

raw2023Wallsend.split('\n').forEach(line => {
  const parts = line.split('\t');
  const name = parts[0].trim();
  const grn = parseNumber(parts[1]);
  const ajp = parseNumber(parts[2]);
  const on = parseNumber(parts[3]);
  const alp = parseNumber(parts[4]);
  const ind = parseNumber(parts[5]);
  const lnp = parseNumber(parts[6]);
  const sap = parseNumber(parts[7]);
  const total = parseNumber(parts[8]);
  addResult(name, "ordinary", "Wallsend", lgaNewcastle, "2023-state", "Legislative Assembly", grn, alp, lnp, ajp + on + ind + sap, total);
});

// Wallsend 2023 Special Categories
addResult("Fletcher EVC", "pre-poll", "Wallsend", lgaNewcastle, "2023-state", "Legislative Assembly", 151, 2635, 440, 35 + 250 + 27 + 19, 3557);
addResult("Mayfield EVC", "pre-poll", "Wallsend", lgaNewcastle, "2023-state", "Legislative Assembly", 261, 1034, 234, 47 + 100 + 23 + 29, 1728);
addResult("Newcastle EVC", "pre-poll", "Wallsend", lgaNewcastle, "2023-state", "Legislative Assembly", 124, 338, 88, 18 + 25 + 13 + 10, 616);
addResult("TAV", "pre-poll", "Wallsend", lgaLakeMac, "2023-state", "Legislative Assembly", 0, 6, 2, 0, 8);
addResult("Wallsend EVC", "pre-poll", "Wallsend", lgaNewcastle, "2023-state", "Legislative Assembly", 490, 5093, 1088, 90 + 549 + 82 + 46, 7438);
addResult("Declared Facility (Wallsend)", "other-dec", "Wallsend", lgaNewcastle, "2023-state", "Legislative Assembly", 3, 45, 9, 0 + 5 + 1 + 2, 65);
addResult("Absent (Wallsend)", "absent", "Wallsend", lgaNewcastle, "2023-state", "Legislative Assembly", 708, 2509, 679, 151 + 276 + 120 + 118, 4561);
addResult("Provisional (Wallsend)", "other-dec", "Wallsend", lgaNewcastle, "2023-state", "Legislative Assembly", 280, 609, 122, 47 + 75 + 28 + 35, 1196);
addResult("Postal (Wallsend)", "postal", "Wallsend", lgaNewcastle, "2023-state", "Legislative Assembly", 200, 2788, 600, 83 + 216 + 57 + 42, 3986);


// 4. 2023 NEWCASTLE STATE ELECTION
const raw2023Newcastle = `Adamstown Snr Ctzn Cntr	175	125	10	72	410	17	809
Callaghan Cllg - Waratah Tech	78	57	3	21	208	12	379
Carrington Public	358	210	20	94	823	32	1537
Fern Bay Hall	122	515	2	74	972	50	1735
Goodlife Church Wickham	182	108	7	36	306	12	651
Hamilton Nth Public	118	104	7	38	284	13	564
Hamilton Public	426	330	37	102	888	32	1815
Hamilton Sth Comm. Hall	62	35	5	55	258	9	424
Hamilton Sth Public	236	458	8	69	710	35	1516
Islington Public	437	148	24	84	616	33	1342
Lambton High	19	15	2	10	52	6	104
Mayfield Church of Christ	153	83	6	59	389	29	719
Mayfield E Public	273	163	31	81	682	24	1254
Mayfield Presbyterian	260	194	24	146	604	32	1260
Merewether Hghts Public	178	379	3	71	486	17	1134
Merewether Uniting	151	203	3	57	340	18	772
New Lambton Sth Public	30	11	1	7	41	1	91
Newcastle E Public	371	256	24	78	473	30	1232
Newcastle TAFE	96	38	6	23	145	10	318
St Andrews Mayfield	183	154	13	64	536	28	978
St Augustine's Anglican	159	289	1	48	386	26	909
St Columba's Adamstown	30	23	1	6	65	0	125
St Johns Cooks Hill	375	311	19	74	590	28	1397
St Thereses New Lambton	14	19	0	3	38	1	75
Stockton Public	191	276	13	108	994	31	1613
The Junction Public	373	538	8	120	788	56	1883
Warabrook Comm. Cntr	90	164	7	59	446	25	791
Waratah Public	68	54	7	22	191	5	347
WEA Hunter Laman St Campus	202	177	12	63	390	15	859`;

raw2023Newcastle.split('\n').forEach(line => {
  const parts = line.split('\t');
  const name = parts[0].trim();
  const grn = parseNumber(parts[1]);
  const lnp = parseNumber(parts[2]);
  const sa = parseNumber(parts[3]);
  const lcp = parseNumber(parts[4]);
  const alp = parseNumber(parts[5]);
  const sap = parseNumber(parts[6]);
  const total = parseNumber(parts[7]);
  addResult(name, "ordinary", "Newcastle", lgaNewcastle, "2023-state", "Legislative Assembly", grn, alp, lnp, sa + lcp + sap, total);
});

// Newcastle 2023 Special Categories
addResult("Adamstown EVC", "pre-poll", "Newcastle", lgaNewcastle, "2023-state", "Legislative Assembly", 503, 1815, 747, 29 + 151 + 94, 3339);
addResult("Mayfield EVC", "pre-poll", "Newcastle", lgaNewcastle, "2023-state", "Legislative Assembly", 695, 2908, 1045, 74 + 284 + 86, 5092);
addResult("Newcastle EVC", "pre-poll", "Newcastle", lgaNewcastle, "2023-state", "Legislative Assembly", 829, 1966, 1180, 59 + 206 + 74, 4314);
addResult("Newcastle West EVC", "pre-poll", "Newcastle", lgaNewcastle, "2023-state", "Legislative Assembly", 480, 1252, 1037, 18 + 91 + 51, 2929);
addResult("TAV", "pre-poll", "Newcastle", lgaNewcastle, "2023-state", "Legislative Assembly", 1, 10, 2, 0, 13);
addResult("Absent (Newcastle)", "absent", "Newcastle", lgaNewcastle, "2023-state", "Legislative Assembly", 790, 1619, 793, 50 + 309 + 124, 3685);
addResult("Provisional (Newcastle)", "other-dec", "Newcastle", lgaNewcastle, "2023-state", "Legislative Assembly", 329, 492, 204, 24 + 119 + 54, 1222);
addResult("Postal (Newcastle)", "postal", "Newcastle", lgaNewcastle, "2023-state", "Legislative Assembly", 450, 1905, 903, 28 + 138 + 85, 3509);


// 5. 2019 CHARLESTOWN STATE ELECTION
const raw2019Charlestown = `Adamstown Snr Ctzn Cntr	187	85	38	204	514
Cardiff Hghts Baptist	95	52	20	133	300
Cardiff Sth Public	61	38	14	163	276
Charlestown E Public	401	144	55	744	1344
Charlestown Public	584	257	84	980	1905
Charlestown Sth Public	430	130	78	755	1393
Dudley Pensioners Hall	434	195	52	587	1268
Eleebana Public	1333	247	134	1104	2818
Floraville Public	123	40	28	183	374
Garden Suburb Public	453	159	101	630	1343
Hillsborough Public	396	118	53	770	1337
Hunter Sports High	173	86	59	613	931
Kahibah Public	593	236	73	761	1663
Kotara High	726	253	81	963	2023
Kotara Sth Public	592	224	78	905	1799
Mt Hutton Public	636	175	147	1136	2094
New Lambton Sth Public	221	120	46	354	741
New Lambton Uniting -Grinsell St	228	115	36	368	747
Redhead Public	598	196	57	896	1747
St Columba's Adamstown	693	335	86	888	2002
Sydney Town Hall	1	2	2	9	14
Warners Bay High	795	180	105	1071	2151
Warners Bay Public	351	110	43	476	980
Whitebridge High	311	106	44	490	951
Windale Comm. Cntr	293	117	104	1260	1774`;

raw2019Charlestown.split('\n').forEach(line => {
  const parts = line.split('\t');
  const name = parts[0].trim();
  const lnp = parseNumber(parts[1]);
  const grn = parseNumber(parts[2]);
  const oth = parseNumber(parts[3]);
  const alp = parseNumber(parts[4]);
  const total = parseNumber(parts[5]);
  addResult(name, "ordinary", "Charlestown", lgaLakeMac, "2019-state", "Legislative Assembly", grn, alp, lnp, oth, total);
});

// Charlestown 2019 Special Categories
addResult("Charlestown EM Office", "pre-poll", "Charlestown", lgaLakeMac, "2019-state", "Legislative Assembly", 491, 3309, 2241, 247, 6288);
addResult("Newcastle EVC", "pre-poll", "Charlestown", lgaNewcastle, "2019-state", "Legislative Assembly", 128, 425, 360, 58, 971);
addResult("Sydney Town Hall Pre-Poll", "pre-poll", "Charlestown", lgaNewcastle, "2019-state", "Legislative Assembly", 7, 8, 10, 0, 25);
addResult("Declared Facility (Charlestown)", "other-dec", "Charlestown", lgaLakeMac, "2019-state", "Legislative Assembly", 2, 40, 25, 1, 68);
addResult("Absent (Charlestown)", "absent", "Charlestown", lgaLakeMac, "2019-state", "Legislative Assembly", 698, 2104, 1426, 315, 4543);
addResult("Provisional (Charlestown)", "other-dec", "Charlestown", lgaLakeMac, "2019-state", "Legislative Assembly", 167, 418, 210, 71, 866);
addResult("iVote (Charlestown)", "other-dec", "Charlestown", lgaLakeMac, "2019-state", "Legislative Assembly", 260, 901, 637, 146, 1944);
addResult("Postal (Charlestown)", "postal", "Charlestown", lgaLakeMac, "2019-state", "Legislative Assembly", 66, 942, 603, 69, 1680);


// 6. 2019 NEWCASTLE STATE ELECTION
const raw2019Newcastle = `Adamstown Snr Ctzn Cntr	35	151	533	33	23	12	230	23	1040
Carrington Public	37	337	715	24	29	29	336	42	1549
Fern Bay Hall	38	88	943	30	6	11	699	58	1873
Hamilton Nth Public	16	123	343	19	10	18	113	25	667
Hamilton Public	63	481	1060	49	57	58	505	61	2334
Hamilton Sth Comm. Hall	33	47	346	14	16	5	99	20	580
Hamilton Sth Public	33	271	867	38	21	20	689	47	1986
Holy Family Merewether	43	281	675	30	15	22	725	29	1820
Islington Public	20	339	559	24	31	21	183	35	1212
Lambton High	11	52	163	8	6	9	68	4	321
Mayfield E Public	30	288	725	44	32	22	268	57	1466
Mayfield Presbyterian	45	237	843	42	37	13	268	45	1530
Mayfield W Public	32	201	800	44	25	24	258	51	1435
Merewether Hghts Public	31	182	425	24	3	10	479	24	1178
Merewether Uniting	20	123	366	26	9	14	256	22	836
New Lambton Sth Public	25	94	426	21	3	15	156	18	758
Newcastle E Public	31	366	567	52	74	37	399	25	1551
St Andrews Mayfield	29	189	714	33	21	13	253	46	1298
St Johns Cooks Hill	40	383	647	27	41	23	477	34	1672
St Matthews Anglican Georgetown	6	90	266	16	6	10	103	23	520
St Thereses New Lambton	13	80	351	23	5	9	173	24	678
Stockton Public	38	145	1069	41	42	25	431	47	1838
Sydney Town Hall	0	8	10	0	1	2	10	1	32
The Junction Public	46	362	828	58	23	33	632	51	2033
Tighes Hill Public	29	527	643	31	35	27	239	34	1565
Warabrook Comm. Cntr	36	85	528	23	5	10	237	26	950
Waratah Public	10	47	215	9	2	4	76	16	379
WEA Hunter Laman St Campus	19	211	352	23	16	39	233	29	922`;

raw2019Newcastle.split('\n').forEach(line => {
  const parts = line.split('\t');
  const name = parts[0].trim();
  const jelfsSap = parseNumber(parts[1]);
  const mccabeGrn = parseNumber(parts[2]);
  const crakanthorpLab = parseNumber(parts[3]);
  const fredericksSbp = parseNumber(parts[4]);
  const obrienSa = parseNumber(parts[5]);
  const lookerKso = parseNumber(parts[6]);
  const keatingLib = parseNumber(parts[7]);
  const bremnerAjp = parseNumber(parts[8]);
  const total = parseNumber(parts[9]);

  const grn = mccabeGrn;
  const alp = crakanthorpLab;
  const lnp = keatingLib;
  const oth = jelfsSap + fredericksSbp + obrienSa + lookerKso + bremnerAjp;

  addResult(name, "ordinary", "Newcastle", lgaNewcastle, "2019-state", "Legislative Assembly", grn, alp, lnp, oth, total);
});

// Newcastle 2019 Special Categories
addResult("Newcastle EM Office", "pre-poll", "Newcastle", lgaNewcastle, "2019-state", "Legislative Assembly", 1028, 3261, 2296, 132 + 142 + 153 + 106 + 192, 7310);
addResult("Sydney Town Hall Pre-Poll", "pre-poll", "Newcastle", lgaNewcastle, "2019-state", "Legislative Assembly", 10, 7, 9, 0 + 2 + 0 + 2 + 1, 31);
addResult("Declared Facility (Newcastle)", "other-dec", "Newcastle", lgaNewcastle, "2019-state", "Legislative Assembly", 3, 39, 25, 0, 67);
addResult("Absent (Newcastle)", "absent", "Newcastle", lgaNewcastle, "2019-state", "Legislative Assembly", 720, 1800, 1065, 156 + 119 + 42 + 108 + 214, 4224);
addResult("Provisional (Newcastle)", "other-dec", "Newcastle", lgaNewcastle, "2019-state", "Legislative Assembly", 213, 387, 164, 26 + 26 + 10 + 27 + 48, 901);
addResult("iVote (Newcastle)", "other-dec", "Newcastle", lgaNewcastle, "2019-state", "Legislative Assembly", 420, 968, 634, 70 + 50 + 29 + 67 + 72, 2310);
addResult("Postal (Newcastle)", "postal", "Newcastle", lgaNewcastle, "2019-state", "Legislative Assembly", 99, 790, 436, 26 + 33 + 26 + 9 + 34, 1453);


// 7. 2019 WALLSEND STATE ELECTION
const raw2019Wallsend = `All Saints New Lambton	637	135	22	44	380	1218
Beresfield Public	1494	142	147	129	411	2323
Callaghan Cllg - Jesmond Snr	963	209	67	60	242	1541
Callaghan Cllg - Wallsend	1245	118	98	69	308	1838
Cardiff Hghts Baptist	420	101	35	36	347	939
Cardiff Nth Public	703	103	72	40	244	1162
Cardiff Public	144	28	22	12	52	258
Elermore Vale Public	1287	164	118	86	447	2102
Glendale E Public	898	100	58	79	238	1373
Glendore Public	1477	132	67	119	407	2202
Lambton High	660	133	38	50	232	1113
Maryland Public	1418	116	79	93	316	2022
Minmi Hall	557	64	20	39	220	900
New Lambton Sth Public	182	51	15	13	103	364
Our Lady of Victories Shortland	723	84	55	45	167	1074
Shortland Public	878	115	62	71	232	1358
Silver Ridge Comm. Hall	472	56	18	43	200	789
St John the Baptist Lambton	1002	166	62	63	416	1709
St Patricks Wallsend	540	51	27	26	115	759
St Thereses New Lambton	692	187	42	38	391	1350
Sydney Town Hall	4	1	0	0	1	6
Wallsend Comm. Pre-School	351	40	22	17	71	501
Wallsend Public	1031	150	71	56	246	1554
Wallsend Sth Public	1439	240	102	95	595	2471
Waratah Public	1019	272	68	45	319	1723
Waratah W Public	666	125	36	31	161	1019`;

raw2019Wallsend.split('\n').forEach(line => {
  const parts = line.split('\t');
  const name = parts[0].trim();
  const alpVotes = parseNumber(parts[1]);
  const grnVotes = parseNumber(parts[2]);
  const ajpVotes = parseNumber(parts[3]);
  const acVotes = parseNumber(parts[4]);
  const lnpVotes = parseNumber(parts[5]);
  const total = parseNumber(parts[6]);

  const grn = grnVotes;
  const alp = alpVotes;
  const lnp = lnpVotes;
  const oth = ajpVotes + acVotes;

  addResult(name, "ordinary", "Wallsend", lgaNewcastle, "2019-state", "Legislative Assembly", grn, alp, lnp, oth, total);
});

// Wallsend 2019 Special Categories
addResult("Newcastle EVC", "pre-poll", "Wallsend", lgaNewcastle, "2019-state", "Legislative Assembly", 187, 644, 337, 50 + 28, 1246);
addResult("Sydney Town Hall Pre-Poll", "pre-poll", "Wallsend", lgaNewcastle, "2019-state", "Legislative Assembly", 4, 5, 8, 0, 17);
addResult("Wallsend EM Office", "pre-poll", "Wallsend", lgaNewcastle, "2019-state", "Legislative Assembly", 382, 5240, 1371, 207 + 254, 7454);
addResult("Declared Facility (Wallsend)", "other-dec", "Wallsend", lgaNewcastle, "2019-state", "Legislative Assembly", 9, 103, 45, 5 + 5, 167);
addResult("Absent (Wallsend)", "absent", "Wallsend", lgaNewcastle, "2019-state", "Legislative Assembly", 620, 2310, 904, 300 + 149, 4283);
addResult("Provisional (Wallsend)", "other-dec", "Wallsend", lgaNewcastle, "2019-state", "Legislative Assembly", 177, 527, 162, 57 + 37, 960);
addResult("iVote (Wallsend)", "other-dec", "Wallsend", lgaNewcastle, "2019-state", "Legislative Assembly", 234, 1038, 380, 77 + 55, 1784);
addResult("Postal (Wallsend)", "postal", "Wallsend", lgaNewcastle, "2019-state", "Legislative Assembly", 60, 1229, 390, 51 + 42, 1772);


// 8. 2015 CHARLESTOWN STATE ELECTION
const raw2015Charlestown = `Adamstown Snr Ctzn Cntr	66	8	187	12	6	128	8	415
Cardiff Hghts Baptist	32	6	110	5	8	53	13	227
Cardiff Nth Public	12	3	47	1	0	8	3	74
Cardiff Public	17	8	72	7	3	33	11	151
Cardiff Snr Ctzns Cntr	9	5	35	0	2	17	4	72
Cardiff Sth Public	24	10	107	3	5	42	18	209
Charlestown E Public	155	21	746	14	41	367	53	1397
Charlestown Public	269	32	972	23	39	529	109	1973
Charlestown Sth Public	130	18	742	7	39	371	77	1384
Dudley Pensioners Hall	214	17	571	12	27	422	63	1326
Eleebana Public	214	22	1045	21	85	1290	255	2932
Floraville Public	41	6	186	2	15	104	22	376
Garden Suburb Public	137	19	585	15	38	384	120	1298
Hamilton Sth Comm. Hall	7	3	43	2	2	36	4	97
Hamilton Sth Public	16	5	35	2	3	43	11	115
Hillsborough Public	161	19	731	19	30	434	74	1468
Hunter Sports High	79	14	655	20	18	203	73	1062
Kahibah Public	219	23	751	21	32	498	92	1636
Kotara High	265	28	768	20	51	714	126	1972
Kotara Sth Public	234	23	841	20	27	570	120	1835
Lakelands Hall	10	4	89	4	2	37	6	152
Merewether Hghts Public	25	0	19	0	1	41	3	89
Merewether Uniting	29	1	92	3	2	79	14	220
Mt Hutton Public	193	16	1243	21	78	571	167	2289
New Lambton Hghts Infants	25	2	47	2	5	58	8	147
New Lambton Sth Public	111	8	294	11	7	180	26	637
New Lambton Uniting -Grinsell St	127	16	377	2	17	246	47	832
Redhead Public	218	18	878	9	34	563	93	1813
St Columba's Adamstown	292	37	884	19	38	714	133	2117
St Thereses New Lambton	24	3	43	3	3	28	3	107
Sydney Town Hall	4	1	4	0	0	1	0	10
The Junction Public	25	2	39	3	1	47	2	119
Valentine Public	9	3	39	1	6	30	3	91
Warners Bay High	172	32	1011	23	45	661	136	2080
Warners Bay Public	99	23	490	13	20	340	44	1029
Whitebridge High	156	18	532	9	17	356	57	1145
Windale Comm. Cntr	124	19	1440	24	29	216	49	1901`;

raw2015Charlestown.split('\n').forEach(line => {
  const parts = line.split('\t');
  const name = parts[0].trim();
  const oakleyGrn = parseNumber(parts[1]);
  const martinInd = parseNumber(parts[2]);
  const harrisonLab = parseNumber(parts[3]);
  const morvilloNlt = parseNumber(parts[4]);
  const tuckerCdp = parseNumber(parts[5]);
  const paulingLib = parseNumber(parts[6]);
  const armsInd = parseNumber(parts[7]);
  const total = parseNumber(parts[8]);

  const grn = oakleyGrn;
  const alp = harrisonLab;
  const lnp = paulingLib;
  const oth = martinInd + morvilloNlt + tuckerCdp + armsInd;

  addResult(name, "ordinary", "Charlestown", lgaLakeMac, "2015-state", "Legislative Assembly", grn, alp, lnp, oth, total);
});

// Charlestown 2015 Specials
addResult("Charlestown RO Pre-Poll", "pre-poll", "Charlestown", lgaLakeMac, "2015-state", "Legislative Assembly", 356, 2735, 1719, 59 + 38 + 90 + 381, 5378);
addResult("Newcastle RO Pre-Poll", "pre-poll", "Charlestown", lgaNewcastle, "2015-state", "Legislative Assembly", 123, 450, 421, 18 + 20 + 20 + 50, 1102);
addResult("Sydney Town Hall Pre-Poll", "pre-poll", "Charlestown", lgaNewcastle, "2015-state", "Legislative Assembly", 4, 2, 3, 0 + 0 + 0 + 2, 11);
addResult("Declared Institution (Charlestown)", "other-dec", "Charlestown", lgaLakeMac, "2015-state", "Legislative Assembly", 0, 16, 15, 2 + 0 + 1 + 1, 35);
addResult("Absent (Charlestown)", "absent", "Charlestown", lgaLakeMac, "2015-state", "Legislative Assembly", 435, 1231, 775, 41 + 49 + 77 + 136, 2744);
addResult("Enrolment (Charlestown)", "other-dec", "Charlestown", lgaLakeMac, "2015-state", "Legislative Assembly", 51, 123, 66, 15 + 4 + 5 + 9, 273);
addResult("iVote (Charlestown)", "other-dec", "Charlestown", lgaLakeMac, "2015-state", "Legislative Assembly", 352, 1022, 725, 44 + 36 + 32 + 142, 2353);
addResult("Postal (Charlestown)", "postal", "Charlestown", lgaLakeMac, "2015-state", "Legislative Assembly", 93, 1200, 650, 39 + 24 + 50 + 57, 2113);
addResult("Provisional / Silent (Charlestown)", "other-dec", "Charlestown", lgaLakeMac, "2015-state", "Legislative Assembly", 20, 55, 33, 1 + 0 + 3 + 5, 117);


// 9. 2015 NEWCASTLE STATE ELECTION
const raw2015Newcastle = `Adamstown Snr Ctzn Cntr	220	11	23	274	15	17	449	1009
All Saints New Lambton	16	0	1	24	0	0	48	89
Carrington Public	267	23	18	437	19	20	602	1386
Fern Bay Hall	129	25	20	467	12	4	596	1253
Hamilton Nth Public	93	10	11	173	9	4	276	576
Hamilton Public	548	28	29	804	43	44	975	2471
Hamilton Sth Comm. Hall	89	8	9	136	6	15	379	642
Hamilton Sth Public	258	30	25	915	51	19	669	1967
Holy Family Merewether	285	22	22	998	36	11	490	1864
Islington Public	359	19	12	254	19	17	494	1174
Lambton High	31	5	8	78	7	4	146	279
Mayfield E Public	334	20	23	340	17	26	617	1377
Mayfield Presbyterian	276	35	29	361	24	17	755	1497
Mayfield W Public	273	41	22	373	12	24	727	1472
Merewether Hghts Public	161	13	14	523	19	2	262	994
Merewether Uniting	134	11	15	365	12	12	303	852
New Lambton Sth Public	97	11	11	211	10	3	299	642
Newcastle E Public	404	21	16	562	26	39	409	1477
St Andrews Mayfield	257	33	26	328	13	14	723	1394
St Columba's Adamstown	28	5	4	60	1	3	62	163
St Johns Cooks Hill	390	23	13	615	22	20	470	1553
St Matthews Anglican Georgetown	63	5	3	115	9	7	221	423
St Thereses New Lambton	93	14	13	227	10	4	331	692
Stockton Public	240	32	31	577	31	22	1140	2073
Sydney Town Hall	7	0	1	12	1	0	1	22
The Junction Public	355	21	20	815	35	22	609	1877
Tighes Hill Public	452	13	11	341	24	33	575	1449
Warabrook Comm. Cntr	115	32	16	345	13	9	494	1024
Waratah Public	87	11	6	144	6	3	210	467
WEA Hunter Laman St Campus	176	7	8	299	11	16	253	770`;

raw2015Newcastle.split('\n').forEach(line => {
  const parts = line.split('\t');
  const name = parts[0].trim();
  const osborneGrn = parseNumber(parts[1]);
  const caineCdp = parseNumber(parts[2]);
  const addisonNlt = parseNumber(parts[3]);
  const howardLib = parseNumber(parts[4]);
  const reichAcp = parseNumber(parts[5]);
  const osa = parseNumber(parts[6]); // O'BRIEN (SA)
  const crakanthorpLab = parseNumber(parts[7]);
  const total = parseNumber(parts[8]);

  const grn = osborneGrn;
  const alp = crakanthorpLab;
  const lnp = howardLib;
  const oth = caineCdp + addisonNlt + reichAcp + osa;

  addResult(name, "ordinary", "Newcastle", lgaNewcastle, "2015-state", "Legislative Assembly", grn, alp, lnp, oth, total);
});

// Newcastle 2015 Specials (using Newcastle RO Pre-poll row)
addResult("Newcastle RO Pre-Poll", "pre-poll", "Newcastle", lgaNewcastle, "2015-state", "Legislative Assembly", 876, 2254, 2852, 81 + 53 + 84 + 53, 6253);
addResult("Sydney Town Hall Pre-Poll", "pre-poll", "Newcastle", lgaNewcastle, "2015-state", "Legislative Assembly", 4, 13, 6, 0 + 1 + 0 + 0, 24);
addResult("Declared Institution (Newcastle)", "other-dec", "Newcastle", lgaNewcastle, "2015-state", "Legislative Assembly", 9, 48, 48, 5 + 3 + 1 + 0, 114);
addResult("Absent (Newcastle)", "absent", "Newcastle", lgaNewcastle, "2015-state", "Legislative Assembly", 755, 1240, 979, 80 + 89 + 79 + 50, 3272);
addResult("Enrolment (Newcastle)", "other-dec", "Newcastle", lgaNewcastle, "2015-state", "Legislative Assembly", 111, 129, 139, 12 + 18 + 4 + 9, 422);
addResult("iVote (Newcastle)", "other-dec", "Newcastle", lgaNewcastle, "2015-state", "Legislative Assembly", 519, 854, 989, 22 + 45 + 84 + 32, 2545);
addResult("Postal (Newcastle)", "postal", "Newcastle", lgaNewcastle, "2015-state", "Legislative Assembly", 277, 1161, 862, 54 + 42 + 46 + 23, 2465);
addResult("Provisional / Silent (Newcastle)", "other-dec", "Newcastle", lgaNewcastle, "2015-state", "Legislative Assembly", 36, 40, 34, 4 + 3 + 6 + 3, 126);


// 10. 2015 WALLSEND STATE ELECTION
const raw2015Wallsend = `All Saints New Lambton	30	14	515	142	405	1106
Argenton Comm. Hall	0	1	51	5	12	69
Beresfield Public	81	70	1605	166	472	2394
Black Hill Public	4	2	22	9	44	81
Callaghan Cllg - Jesmond Snr	65	61	1041	301	395	1863
Callaghan Cllg - Wallsend	65	63	1295	158	394	1975
Cardiff Hghts Baptist	40	5	381	78	256	760
Cardiff Nth Public	48	21	726	131	276	1202
Cardiff Public	13	17	113	30	39	212
Edgeworth Public	5	6	80	8	19	118
Elermore Vale Public	79	72	1345	213	597	2306
Glendale E Public	57	55	869	104	253	1338
Glendore Public	61	50	1033	153	467	1764
Lambton High	43	19	467	114	275	918
Maryland Public	98	66	1624	155	464	2407
Minmi Hall	36	25	452	58	211	782
New Lambton Hghts Infants	22	10	270	133	257	692
New Lambton Sth Public	2	3	146	47	123	321
New Lambton Uniting -Grinsell St	7	3	52	16	53	131
Our Lady of Victories Shortland	35	30	696	118	211	1090
Shortland Public	61	43	867	109	264	1344
Silver Ridge Comm. Hall	34	22	462	78	232	828
St John the Baptist Lambton	60	49	1151	240	620	2120
St Matthews Anglican Georgetown	1	1	40	14	18	74
St Patricks Wallsend	30	13	486	62	117	708
St Thereses New Lambton	38	23	648	222	427	1358
Sydney Town Hall	0	0	7	2	4	13
Wallsend Comm. Pre-School	29	16	485	80	156	766
Wallsend Public	44	46	1129	200	334	1753
Wallsend Sth Public	82	70	1211	285	732	2380
Waratah Public	59	52	1021	362	435	1929
Waratah W Public	20	26	596	160	193	995`;

raw2015Wallsend.split('\n').forEach(line => {
  const parts = line.split('\t');
  const name = parts[0].trim();
  const cottonCdp = parseNumber(parts[1]);
  const diNlt = parseNumber(parts[2]);
  const horneryLab = parseNumber(parts[3]);
  const swegenGrn = parseNumber(parts[4]);
  const evesLib = parseNumber(parts[5]);
  const total = parseNumber(parts[6]);

  const grn = swegenGrn;
  const alp = horneryLab;
  const lnp = evesLib;
  const oth = cottonCdp + diNlt;

  addResult(name, "ordinary", "Wallsend", lgaNewcastle, "2015-state", "Legislative Assembly", grn, alp, lnp, oth, total);
});

// Wallsend 2015 Specials
addResult("Newcastle RO Pre-Poll", "pre-poll", "Wallsend", lgaNewcastle, "2015-state", "Legislative Assembly", 123, 540, 404, 32 + 25, 1124);
addResult("Sydney Town Hall Pre-Poll", "pre-poll", "Wallsend", lgaNewcastle, "2015-state", "Legislative Assembly", 2, 6, 6, 2 + 0, 16);
addResult("Wallsend RO Pre-poll", "pre-poll", "Wallsend", lgaNewcastle, "2015-state", "Legislative Assembly", 221, 2607, 919, 118 + 68, 3933);
addResult("Declared Institution (Wallsend)", "other-dec", "Wallsend", lgaNewcastle, "2015-state", "Legislative Assembly", 7, 109, 40, 11 + 2, 169);
addResult("Absent (Wallsend)", "absent", "Wallsend", lgaNewcastle, "2015-state", "Legislative Assembly", 548, 1683, 834, 141 + 154, 3360);
addResult("Enrolment (Wallsend)", "other-dec", "Wallsend", lgaNewcastle, "2015-state", "Legislative Assembly", 58, 185, 61, 8 + 26, 338);
addResult("iVote (Wallsend)", "other-dec", "Wallsend", lgaNewcastle, "2015-state", "Legislative Assembly", 314, 1286, 620, 67 + 69, 2356);
addResult("Postal (Wallsend)", "postal", "Wallsend", lgaNewcastle, "2015-state", "Legislative Assembly", 95, 1690, 627, 71 + 40, 2523);
addResult("Provisional / Silent (Wallsend)", "other-dec", "Wallsend", lgaNewcastle, "2015-state", "Legislative Assembly", 9, 42, 25, 7 + 3, 86);


// 11. 2014 CHARLESTOWN BY-ELECTION
// Source: NSW Electoral Commission official results (25-Oct-2014)
// Columns: ARMS(IND) | SKY(IND) | OAKLEY(GRN) | WRIGHTSON | HARRISON(ALP) | CUBIS(IND) | MARTIN | TUCKER(CDP) | HOPE(IND) | Total Formal
const raw2014Charlestown = `Adamstown Snr Ctzn Cntr	35	17	79	26	183	29	7	10	40	426
Cardiff Public	76	11	67	51	413	17	11	30	30	706
Cardiff Sth Public	139	28	160	125	852	33	17	65	63	1482
Charlestown E Public	132	32	242	110	710	48	16	51	75	1416
Charlestown Public	195	50	309	104	938	73	29	100	122	1920
Charlestown Sth Public	180	34	176	76	578	31	18	49	51	1193
Dudley Pensioners Hall	118	52	322	64	525	40	27	46	68	1262
Eleebana Public	542	61	383	170	1090	156	37	171	129	2739
Floraville Public	53	23	57	16	214	15	4	34	24	440
Garden Suburb Public	152	17	175	90	537	48	12	61	64	1156
Hamilton Sth Public	5	0	11	2	27	2	5	2	7	61
Hillsborough Public	201	29	208	93	704	75	18	37	70	1435
Kahibah Public	182	66	289	139	720	48	44	46	86	1620
Kotara High	217	53	308	180	796	81	45	123	110	1913
Kotara Sth Public	254	43	255	118	813	46	24	62	254	1869
Lakeside School	44	13	65	90	473	10	9	16	16	736
Mt Hutton Public	302	32	276	120	1051	59	19	121	86	2066
New Lambton Sth Public	19	9	49	9	70	14	2	8	15	195
St Columba's Adamstown	108	29	223	74	500	57	21	34	117	1163
Warners Bay High	335	39	227	181	1037	118	26	101	57	2121
Warners Bay Public	136	12	130	52	499	29	11	55	45	969
Whitebridge High	51	45	220	80	474	31	36	28	47	1012
Windale Comm. Cntr	62	36	181	149	1264	26	13	60	39	1830
Wiripaang Public	57	18	106	67	478	18	12	27	24	807`;

raw2014Charlestown.split('\n').forEach(line => {
  const parts = line.split('\t');
  const name = parts[0].trim();
  const armsInd = parseNumber(parts[1]);
  const skyInd = parseNumber(parts[2]);
  const oakleyGrn = parseNumber(parts[3]);
  const wrightsonOth = parseNumber(parts[4]);
  const harrisonLab = parseNumber(parts[5]);
  const cubisInd = parseNumber(parts[6]);
  const martinOth = parseNumber(parts[7]);
  const tuckerCdp = parseNumber(parts[8]);
  const hopeInd = parseNumber(parts[9]);
  const total = parseNumber(parts[10]);

  const grn = oakleyGrn;
  const alp = harrisonLab;
  const lnp = 0;
  const oth = armsInd + skyInd + wrightsonOth + cubisInd + martinOth + tuckerCdp + hopeInd;

  addResult(name, "ordinary", "Charlestown", lgaLakeMac, "2014-by-election-charlestown", "Legislative Assembly", grn, alp, lnp, oth, total);
});

// Manual specials mapping for 2014 Charlestown
addResult("Absent (Charlestown)", "absent", "Charlestown", lgaLakeMac, "2014-by-election-charlestown", "Legislative Assembly", 86, 153, 0, 30 + 19 + 18 + 19 + 3 + 15 + 38, 381);
addResult("Declared Institution (Charlestown)", "other-dec", "Charlestown", lgaLakeMac, "2014-by-election-charlestown", "Legislative Assembly", 0, 2, 0, 1 + 1 + 1 + 0 + 0 + 1 + 1, 7);
addResult("Enrolment (Charlestown)", "other-dec", "Charlestown", lgaLakeMac, "2014-by-election-charlestown", "Legislative Assembly", 57, 104, 0, 21 + 7 + 15 + 3 + 3 + 7 + 11, 228);
addResult("Postal (Charlestown)", "postal", "Charlestown", lgaLakeMac, "2014-by-election-charlestown", "Legislative Assembly", 91, 892, 0, 148 + 55 + 88 + 36 + 38 + 116 + 101, 1565);
addResult("Pre-poll (Charlestown)", "pre-poll", "Charlestown", lgaLakeMac, "2014-by-election-charlestown", "Legislative Assembly", 724, 2979, 0, 911 + 200 + 252 + 175 + 83 + 288 + 295, 5907);
addResult("Provisional/Silent (Charlestown)", "other-dec", "Charlestown", lgaLakeMac, "2014-by-election-charlestown", "Legislative Assembly", 14, 26, 0, 11 + 2 + 2 + 4 + 0 + 8 + 2, 69);
addResult("iVote (Charlestown)", "other-dec", "Charlestown", lgaLakeMac, "2014-by-election-charlestown", "Legislative Assembly", 123, 327, 0, 90 + 35 + 30 + 25 + 21 + 32 + 57, 740);


// 12. 2014 NEWCASTLE BY-ELECTION
const raw2014Newcastle = `Adamstown Snr Ctzn Cntr	40	496	218	74	59	236	20	18	1161
Carrington Public	30	564	287	101	34	318	25	18	1377
Hamilton Nth Public	21	270	120	52	21	147	11	8	650
Hamilton Public	102	906	521	143	59	480	54	42	2307
Hamilton Sth Comm. Hall	30	368	99	37	26	138	12	6	716
Hamilton Sth Public	45	668	327	139	23	763	31	29	2025
Holy Family Merewether	41	486	415	123	78	857	30	36	2066
Islington Public	34	412	347	67	34	146	20	17	1077
Lambton High	26	541	180	86	48	323	30	21	1255
Mayfield E Public	56	558	357	89	53	197	17	23	1350
Mayfield Presbyterian	23	376	152	52	36	128	21	9	797
Merewether Hghts Public	12	244	184	108	41	442	17	17	1065
Merewether Uniting	12	337	192	87	25	395	23	28	1099
New Lambton Sth Public	16	343	123	43	27	176	11	14	753
Newcastle E Public	64	360	437	88	37	438	25	28	1477
St Andrews Mayfield	42	553	208	44	46	223	30	15	1161
St Columba's Adamstown	20	354	199	81	22	333	22	8	1039
St Johns Cooks Hill	30	394	360	91	37	545	47	27	1531
St Thereses New Lambton	19	322	106	23	26	222	10	12	740
Stockton Public	32	984	252	350	67	218	45	13	1961
The Junction Public	45	544	352	115	51	694	31	56	1888
Tighes Hill Public	65	514	439	123	36	172	26	17	1392
WEA Hunter Laman St Campus	24	234	177	66	19	217	16	16	769
Waratah Public	62	1005	408	131	108	463	56	35	2268`;

raw2014Newcastle.split('\n').forEach(line => {
  const parts = line.split('\t');
  const name = parts[0].trim();
  const obrienSa = parseNumber(parts[1]);
  const crakanthorpLab = parseNumber(parts[2]);
  const osborneGrn = parseNumber(parts[3]);
  const hainesInd = parseNumber(parts[4]);
  const stefanacOth = parseNumber(parts[5]);
  const howardInd = parseNumber(parts[6]);
  const caineCdp = parseNumber(parts[7]);
  const buckleyInd = parseNumber(parts[8]);
  const total = parseNumber(parts[9]);

  const grn = osborneGrn;
  const alp = crakanthorpLab;
  const lnp = 0;
  const oth = obrienSa + hainesInd + stefanacOth + howardInd + caineCdp + buckleyInd;

  addResult(name, "ordinary", "Newcastle", lgaNewcastle, "2014-by-election-newcastle", "Legislative Assembly", grn, alp, lnp, oth, total);
});

// Newcastle 2014 Specials
addResult("Absent (Newcastle)", "absent", "Newcastle", lgaNewcastle, "2014-by-election-newcastle", "Legislative Assembly", 58, 75, 0, 5 + 33 + 13 + 30 + 5 + 6, 225);
addResult("Declared Institution (Newcastle)", "other-dec", "Newcastle", lgaNewcastle, "2014-by-election-newcastle", "Legislative Assembly", 8, 36, 0, 7 + 21 + 4 + 8 + 5 + 4, 93);
addResult("Enrolment (Newcastle)", "other-dec", "Newcastle", lgaNewcastle, "2014-by-election-newcastle", "Legislative Assembly", 93, 129, 0, 12 + 22 + 11 + 74 + 9 + 7, 357);
addResult("Postal (Newcastle)", "postal", "Newcastle", lgaNewcastle, "2014-by-election-newcastle", "Legislative Assembly", 107, 620, 0, 22 + 112 + 39 + 181 + 44 + 38, 1163);
addResult("Pre-poll (Newcastle)", "pre-poll", "Newcastle", lgaNewcastle, "2014-by-election-newcastle", "Legislative Assembly", 1294, 2283, 0, 129 + 421 + 221 + 2015 + 121 + 150, 6634);
addResult("Provisional/Silent (Newcastle)", "other-dec", "Newcastle", lgaNewcastle, "2014-by-election-newcastle", "Legislative Assembly", 37, 31, 0, 4 + 9 + 3 + 23 + 1 + 1, 109);
addResult("iVote (Newcastle)", "other-dec", "Newcastle", lgaNewcastle, "2014-by-election-newcastle", "Legislative Assembly", 179, 246, 0, 16 + 88 + 28 + 194 + 19 + 43, 813);


// 13. 2024 LAKE MACQUARIE MAYORAL ELECTION
const raw2024LMMayor = `Arcadia Vale Public	69	139	244	54	139	131	776
Argenton Comm. Hall	97	103	341	54	53	146	794
Barnsley Public	92	148	362	104	51	374	1131
Belmont High	74	126	215	34	33	84	566
Belmont N'hood Cntr	99	165	440	52	38	175	969
Belmont Public	108	239	425	54	47	119	992
Belmont Scout Hall	99	253	392	71	53	133	1001
Biraban Public	83	106	416	58	64	257	984
Blackalls Park Public	69	116	386	70	92	265	998
Blacksmiths Public	69	140	268	51	60	101	689
Bonnells Bay Youth and Comm Cntr	148	344	376	134	339	356	1697
Booragul Public	64	127	252	33	46	315	837
Cameron Park Comm. Cntr	187	372	658	77	71	407	1772
Cardiff Hghts Baptist	174	246	376	46	77	206	1125
Cardiff Nth Public	200	191	384	50	48	182	1055
Cardiff Public	330	350	726	91	127	490	2114
Cardiff Sth Public	214	272	616	71	71	230	1474
Caves Beach Uniting	71	181	211	43	40	92	638
Charlestown E Public	260	274	590	42	57	184	1407
Charlestown Public	365	360	615	72	77	246	1735
Charlestown Sth Public	200	260	556	62	78	239	1395
Coal Pt Public	59	200	172	38	64	321	854
Cooranbong Public	104	254	279	107	231	429	1404
Dora Crk Arts Hall	59	192	228	83	261	136	959
Dudley Pensioners Hall	270	230	371	43	30	137	1081
Edgeworth Heights Public	83	155	327	49	24	139	777
Edgeworth Public	197	244	669	85	69	334	1598
Eleebana Public	187	624	746	77	65	629	2328
Elermore Vale Public	32	40	54	17	10	21	174
Fassifern Public	47	100	197	28	48	136	556
Fennell Bay Public	103	141	327	88	79	343	1081
Floraville Public	134	385	554	70	40	221	1404
Garden Suburb Public	209	258	402	51	60	178	1158
Glendale E Public	161	202	460	57	77	232	1189
Hillsborough Public	136	228	493	35	54	165	1111
Hunter Sports High	95	148	368	38	22	140	811
Jewells Public	128	264	601	71	65	208	1337
Kahibah Public	267	338	538	53	55	209	1460
Kilaben Bay Hall	60	152	185	42	68	282	789
Kotara High	57	82	126	17	27	56	365
Kotara Sth Public	97	93	133	19	24	81	447
Lakelands Hall	117	304	488	37	46	324	1316
Marks Pt Public	78	134	302	64	59	124	761
Morisset Public	122	234	373	153	240	314	1436
Mt Hutton Public	263	361	813	86	107	271	1901
Nords Wharf Hall	54	149	119	43	83	69	517
Pasterfield Sports	125	200	384	43	45	235	1032
Rathmines Hall	82	242	442	142	215	428	1551
Redhead Public	180	420	630	64	78	176	1548
Speers Pt Masonic	244	429	656	89	75	303	1796
Sth Lake Macquarie Sailing Club	55	90	201	43	233	109	731
Swansea Public	40	145	259	36	31	69	580
Teralba Public	98	234	404	95	91	272	1194
The Swansea Cntr	191	450	662	150	170	222	1845
Toronto MPC	78	145	275	40	127	270	935
Valentine Hall	56	179	308	24	21	182	770
Valentine Public	125	336	666	46	88	383	1644
W Wallsend High	170	235	628	109	67	379	1588
Wallsend Sth Public	114	99	217	19	27	134	610
Wangi Wangi Public	105	217	367	102	191	325	1307
Warners Bay High	226	458	707	61	56	471	1979
Warners Bay Public	67	163	338	22	43	150	783
Whitebridge High	162	165	319	32	46	120	844
Windale Comm. Cntr	171	196	735	106	68	209	1485
Woodrising Neighbourhood Cntr	68	118	336	57	86	181	846
Wyee Public	126	321	345	290	210	506	1798`;

raw2024LMMayor.split('\n').forEach(line => {
  const parts = line.split('\t');
  const name = parts[0].trim();
  const hamGrn = parseNumber(parts[1]);
  const hardingLib = parseNumber(parts[2]);
  const shultzAlp = parseNumber(parts[3]);
  const gilbertOth = parseNumber(parts[4]);
  const dawsonOth = parseNumber(parts[5]);
  const warnerOth = parseNumber(parts[6]);
  const total = parseNumber(parts[7]);

  addResult(name, "ordinary", "Lake Macquarie", lgaLakeMac, "2024-lake-macquarie-local", "Mayor", hamGrn, shultzAlp, hardingLib, gilbertOth + dawsonOth + warnerOth, total);
});

// Specials for Lake Macquarie 2024 Mayor
addResult("Belmont Pre-Poll", "pre-poll", "Lake Macquarie", lgaLakeMac, "2024-lake-macquarie-local", "Mayor", 540, 3329, 2270, 320 + 313 + 1166, 7938);
addResult("Cameron Park Pre-Poll", "pre-poll", "Lake Macquarie", lgaLakeMac, "2024-lake-macquarie-local", "Mayor", 441, 2386, 1127, 233 + 268 + 1093, 5548);
addResult("Charlestown Pre-Poll", "pre-poll", "Lake Macquarie", lgaLakeMac, "2024-lake-macquarie-local", "Mayor", 821, 2552, 1457, 208 + 238 + 1993, 7269);
addResult("Cooranbong Pre-Poll", "pre-poll", "Lake Macquarie", lgaLakeMac, "2024-lake-macquarie-local", "Mayor", 258, 1324, 1835, 457 + 1669 + 1251, 6794);
addResult("Speers Point Pre-Poll", "pre-poll", "Lake Macquarie", lgaLakeMac, "2024-lake-macquarie-local", "Mayor", 322, 1664, 1263, 266 + 236 + 819, 4570);
addResult("Swansea Pre-Poll", "pre-poll", "Lake Macquarie", lgaLakeMac, "2024-lake-macquarie-local", "Mayor", 276, 1858, 1216, 291 + 333 + 585, 4559);
addResult("Toronto Pre-Poll", "pre-poll", "Lake Macquarie", lgaLakeMac, "2024-lake-macquarie-local", "Mayor", 306, 1604, 1054, 376 + 769 + 1670, 5779);
addResult("Wallsend Pre-Poll", "pre-poll", "Lake Macquarie", lgaLakeMac, "2024-lake-macquarie-local", "Mayor", 124, 370, 211, 57 + 54 + 158, 974);
addResult("Declared Institution (Lake Macquarie)", "other-dec", "Lake Macquarie", lgaLakeMac, "2024-lake-macquarie-local", "Mayor", 30, 164, 147, 29 + 23 + 46, 439);
addResult("Provisional (Lake Macquarie)", "other-dec", "Lake Macquarie", lgaLakeMac, "2024-lake-macquarie-local", "Mayor", 663, 1066, 621, 280 + 250 + 620, 3500);
addResult("Postal (Lake Macquarie)", "postal", "Lake Macquarie", lgaLakeMac, "2024-lake-macquarie-local", "Mayor", 664, 3797, 2790, 607 + 783 + 1957, 10598);


// 14. 2024 LAKE MACQUARIE NORTH WARD ELECTION
const raw2024LMNorthWard = `Argenton Comm. Hall	36	14	29	73	0	0	0	152
Barnsley Public	50	15	28	35	0	0	0	128
Cameron Park Comm. Cntr	425	209	438	663	4	1	3	1743
Cardiff Hghts Baptist	256	198	277	376	3	0	3	1113
Cardiff Nth Public	226	202	204	403	3	1	4	1043
Cardiff Public	557	320	418	762	16	6	12	2091
Cardiff Sth Public	306	240	305	605	10	5	3	1474
Charlestown E Public	152	147	197	344	2	0	0	842
Charlestown Public	238	290	297	455	8	1	2	1291
Charlestown Sth Public	196	167	244	337	2	0	4	950
Dudley Pensioners Hall	168	282	253	365	1	1	0	1070
Edgeworth Heights Public	188	85	161	335	1	0	1	771
Edgeworth Public	434	201	259	687	6	0	1	1588
Elermore Vale Public	36	35	44	53	2	0	2	172
Garden Suburb Public	264	220	294	372	2	0	4	1156
Glendale E Public	309	154	225	481	4	1	5	1179
Hillsborough Public	206	140	264	479	4	1	1	1095
Kahibah Public	260	296	382	512	1	1	1	1453
Kotara High	76	66	78	137	1	1	1	360
Kotara Sth Public	90	101	106	140	2	0	0	439
Lakelands Hall	322	146	371	467	6	0	0	1312
Mt Hutton Public	35	24	18	39	0	0	0	116
Pasterfield Sports	260	123	238	393	2	2	0	1018
Speers Pt Masonic	359	206	383	560	2	2	0	1512
W Wallsend High	281	132	186	424	5	0	2	1030
Wallsend Sth Public	134	127	114	225	0	0	1	601
Warners Bay High	135	73	186	185	2	0	0	581
Whitebridge High	173	168	191	307	0	0	1	840`;

raw2024LMNorthWard.split('\n').forEach(line => {
  const parts = line.split('\t');
  const name = parts[0].trim();
  const ind1 = parseNumber(parts[1]);
  const grn = parseNumber(parts[2]);
  const lib = parseNumber(parts[3]);
  const alp = parseNumber(parts[4]);
  const ind2 = parseNumber(parts[5]);
  const ind3 = parseNumber(parts[6]);
  const ind4 = parseNumber(parts[7]);
  const total = parseNumber(parts[8]);

  addResult(name, "ordinary", "North Ward", lgaLakeMac, "2024-lake-macquarie-local", "Councillor", grn, alp, lib, ind1 + ind2 + ind3 + ind4, total);
});

// Specials for North Ward
addResult("Belmont Pre-Poll", "pre-poll", "North Ward", lgaLakeMac, "2024-lake-macquarie-local", "Councillor", 26, 74, 61, 58 + 0 + 0 + 0, 219);
addResult("Cameron Park Pre-Poll", "pre-poll", "North Ward", lgaLakeMac, "2024-lake-macquarie-local", "Councillor", 387, 2065, 1105, 1063 + 15 + 2 + 5, 4642);
addResult("Charlestown Pre-Poll", "pre-poll", "North Ward", lgaLakeMac, "2024-lake-macquarie-local", "Councillor", 653, 1663, 1176, 1085 + 12 + 3 + 8, 4600);
addResult("Cooranbong Pre-Poll", "pre-poll", "North Ward", lgaLakeMac, "2024-lake-macquarie-local", "Councillor", 2, 9, 0, 4 + 0 + 0 + 0, 15);
addResult("Speers Point Pre-Poll", "pre-poll", "North Ward", lgaLakeMac, "2024-lake-macquarie-local", "Councillor", 222, 937, 842, 691 + 6 + 1 + 5, 2704);
addResult("Swansea Pre-Poll", "pre-poll", "North Ward", lgaLakeMac, "2024-lake-macquarie-local", "Councillor", 7, 19, 19, 21 + 0 + 0 + 1, 67);
addResult("Toronto Pre-Poll", "pre-poll", "North Ward", lgaLakeMac, "2024-lake-macquarie-local", "Councillor", 8, 22, 15, 18 + 1 + 0 + 0, 64);
addResult("Wallsend Pre-Poll", "pre-poll", "North Ward", lgaLakeMac, "2024-lake-macquarie-local", "Councillor", 115, 316, 195, 160 + 2 + 0 + 2, 790);
addResult("Declared Institution (North Ward)", "other-dec", "North Ward", lgaLakeMac, "2024-lake-macquarie-local", "Councillor", 2, 16, 15, 8 + 0 + 0 + 0, 41);
addResult("Provisional (North Ward)", "other-dec", "North Ward", lgaLakeMac, "2024-lake-macquarie-local", "Councillor", 316, 441, 226, 330 + 4 + 2 + 4, 1323);
addResult("Postal (North Ward)", "postal", "North Ward", lgaLakeMac, "2024-lake-macquarie-local", "Councillor", 306, 1346, 978, 909 + 12 + 4 + 13, 3568);

fs.writeFileSync(boothsPath, JSON.stringify(booths, null, 2), 'utf-8');
console.log("Successfully completed strict re-ingestion.");
