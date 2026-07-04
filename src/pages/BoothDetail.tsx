import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle, TrendingUp } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import boothGroupsData from '../data/booth-groups.json';
import boothsData from '../data/booths.json';
import electionsData from '../data/elections.json';
import type { PollingPlace, Election, BoothGroup, ContestResult } from '../types';

const getContestDisplayName = (contestName: string) => {
  if (contestName.toLowerCase().includes('mayoral') || contestName.toLowerCase().includes('mayor')) {
    return 'Mayor';
  }
  if (contestName === 'Councillor') {
    return 'Councillor';
  }
  return '';
};

export default function BoothDetail() {
  const { id } = useParams<{ id: string }>();
  const [aggregateDivisions, setAggregateDivisions] = useState(true);

  const group = useMemo(() => {
    return (boothGroupsData as BoothGroup[]).find(g => g.slug === id);
  }, [id]);

  const booth = useMemo(() => {
    if (group) {
      const rawBooths = (boothsData as PollingPlace[]).filter(b => group.rawNames.includes(b.name));
      const combinedResults = rawBooths.flatMap(b => b.results.map(r => ({ ...r, boothName: b.name })));
      return {
        id: group.slug,
        name: group.displayName,
        suburb: rawBooths[0]?.suburb || '',
        division: rawBooths[0]?.division || '',
        lga: rawBooths[0]?.lga,
        lat: rawBooths[0]?.lat || 0,
        lng: rawBooths[0]?.lng || 0,
        results: combinedResults
      } as PollingPlace;
    }
    // Fallback if accessed by old ID
    const singleBooth = (boothsData as PollingPlace[]).find(b => b.id === id);
    if (singleBooth) {
      return {
        ...singleBooth,
        results: singleBooth.results.map(r => ({ ...r, boothName: singleBooth.name }))
      };
    }
    return undefined;
  }, [id, group]);

  const electionsMap = useMemo(() => {
    const map = new Map<string, Election>();
    (electionsData as Election[]).forEach(e => {
      map.set(e.id, e);
    });
    return map;
  }, []);

  // Compute table rows with grouped parties
  const tableData = useMemo(() => {
    if (!booth) return [];

    // Group results by key to handle aggregation
    const groups: {
      [key: string]: {
        electionId: string;
        contestName: string;
        boothName: string;
        divisions: Set<string>;
        results: ContestResult[];
        date: string;
        electionName: string;
        type: string;
      }
    } = {};

    const resultsWithElection = booth.results.map(r => {
      const election = electionsMap.get(r.electionId);
      return {
        r,
        election,
        date: election ? election.date : '1970-01-01',
        electionName: election?.name || 'Unknown Election',
      };
    }).sort((a, b) => a.date.localeCompare(b.date));

    resultsWithElection.forEach(({ r, election, date, electionName }) => {
      const div = r.division || election?.division || 'Unknown';
      const key = aggregateDivisions
        ? `${r.electionId}-${r.contestName}-${r.boothName}`
        : `${r.electionId}-${r.contestName}-${r.boothName}-${div}`;

      if (!groups[key]) {
        groups[key] = {
          electionId: r.electionId,
          contestName: r.contestName,
          boothName: r.boothName || booth.name,
          divisions: new Set<string>(),
          results: [],
          date,
          electionName,
          type: election?.type || 'federal',
        };
      }
      groups[key].divisions.add(div);
      groups[key].results.push(r);
    });

    const computedRows = Object.values(groups).map(g => {
      const grn = g.results.filter(r => r.party === 'GRN').reduce((sum, r) => sum + r.votes, 0);
      const alp = g.results.filter(r => r.party === 'ALP').reduce((sum, r) => sum + r.votes, 0);
      const lnp = g.results.filter(r => r.party === 'LNP').reduce((sum, r) => sum + r.votes, 0);
      const oth = g.results.filter(r => r.party === 'OTH').reduce((sum, r) => sum + r.votes, 0);
      const total = grn + alp + lnp + oth;

      if (total === 0) return null;

      // Only show rows where Greens had a candidate
      const hasGrn = g.results.some(r => r.party === 'GRN');
      if (!hasGrn) return null;

      const sortedDivisions = Array.from(g.divisions).sort();
      const division = sortedDivisions.join(' / ');
      const primaryDivision = sortedDivisions[0] || 'Unknown';

      // Count unique contests for this election in this booth
      const uniqueContestsCount = new Set(
        booth.results
          .filter(r => r.electionId === g.electionId)
          .map(r => r.contestName)
      ).size;

      let displayName = division;
      if (uniqueContestsCount > 1) {
        const contestDisplay = getContestDisplayName(g.contestName);
        if (contestDisplay && contestDisplay !== 'Councillor') {
          displayName = contestDisplay;
        }
      }

      return {
        electionId: g.electionId,
        contestName: g.contestName,
        electionName: g.electionName,
        type: g.type,
        date: g.date,
        division,
        primaryDivision,
        displayName,
        grn,
        grnPct: parseFloat(((grn / total) * 100).toFixed(2)),
        alp,
        alpPct: parseFloat(((alp / total) * 100).toFixed(2)),
        lnp,
        lnpPct: parseFloat(((lnp / total) * 100).toFixed(2)),
        oth,
        othPct: parseFloat(((oth / total) * 100).toFixed(2)),
        total,
        boothName: g.boothName
      };
    }).filter((row): row is NonNullable<typeof row> => row !== null);

    return computedRows.sort((a, b) => {
      if (a.date !== b.date) {
        return b.date.localeCompare(a.date);
      }

      const aIsMayor = a.contestName.toLowerCase().includes('mayor');
      const bIsMayor = b.contestName.toLowerCase().includes('mayor');
      if (aIsMayor && !bIsMayor) return -1;
      if (!aIsMayor && bIsMayor) return 1;
      return 0;
    });
  }, [booth, electionsMap, aggregateDivisions]);

  // Recharts Chart Data (chronological order)
  const chartData = useMemo(() => {
    return [...tableData]
      .sort((a, b) => {
        if (a.date !== b.date) {
          return a.date.localeCompare(b.date);
        }

        const aIsMayor = a.contestName.toLowerCase().includes('mayor');
        const bIsMayor = b.contestName.toLowerCase().includes('mayor');
        if (aIsMayor && !bIsMayor) return -1;
        if (!aIsMayor && bIsMayor) return 1;
        return 0;
      })
      .map(row => ({
        key: `${row.division}-${row.contestName}-${row.electionId}-${row.boothName}`,
        electionName: row.electionName,
        division: row.division,
        displayName: row.displayName,
        contestName: row.contestName,
        boothName: row.boothName,
        type: row.type,
        date: row.date,
        'Greens %': row.grnPct,
        'ALP %': row.alpPct || null,
        'LNP %': row.lnpPct || null,
        'Others %': row.othPct || null,
      }));
  }, [tableData]);

  const formatChartLabel = (value: any) => {
    if (typeof value !== 'string') return '';
    const item = chartData.find(d => d.key === value);
    if (!item) return value;
    
    let label = item.electionName.replace(' Election', '').replace(' NSW State', ' State');
    
    // Check if there are other data points in chartData for the same election
    const duplicates = chartData.filter(d => 
      d.electionName.replace(' Election', '').replace(' NSW State', ' State') === label
    );
    
    if (duplicates.length > 1) {
      const hasMultipleBooths = new Set(duplicates.map(d => d.boothName)).size > 1;
      
      const suffixes = [];
      suffixes.push(item.displayName);
      if (hasMultipleBooths && booth && item.boothName !== booth.name) suffixes.push(item.boothName);
      
      if (suffixes.length > 0) {
        label += ` (${suffixes.join(' - ')})`;
      }
    }
    return label;
  };

  const formatXAxisLabel = (value: any) => {
    if (typeof value !== 'string') return '';
    const item = chartData.find(d => d.key === value);
    if (!item) return value;

    const year = item.date ? item.date.substring(0, 4) : '';
    let typeLetter = '';
    switch (item.type) {
      case 'federal':
        typeLetter = 'F';
        break;
      case 'state':
        typeLetter = 'S';
        break;
      case 'local':
        typeLetter = 'L';
        break;
      case 'by-election':
        typeLetter = 'B';
        break;
      default:
        typeLetter = '?';
    }

    let label = `${year} ${typeLetter}`;

    const duplicates = chartData.filter(d => d.electionName === item.electionName);
    if (duplicates.length > 1) {
      const hasMultipleBooths = new Set(duplicates.map(d => d.boothName)).size > 1;
      const suffixes = [];
      if (item.displayName === 'Mayor') {
        suffixes.push('Mayor');
      }
      if (hasMultipleBooths && booth && item.boothName !== booth.name) suffixes.push(item.boothName);
      if (suffixes.length > 0) {
        label += ` (${suffixes.join(' - ')})`;
      }
    }

    return label;
  };

  if (!booth) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Booth Not Found</h2>
        <Link to="/" className="text-greens-400 hover:underline">Return to Home</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link to="/" className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900 transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to list</span>
        </Link>
      </div>

      {/* Header Info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2 mb-1">{booth.name}</h1>
          {group && group.rawNames.length > 1 && (
            <p className="text-sm text-slate-500 mb-2">
              Also known as: {group.rawNames.filter(n => n !== group.displayName).join(', ')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-lg border border-slate-200 text-sm">
          <label className="flex items-center gap-2 cursor-pointer select-none px-2 py-1">
            <input
              type="checkbox"
              checked={aggregateDivisions}
              onChange={(e) => setAggregateDivisions(e.target.checked)}
              className="rounded border-slate-300 text-greens-600 focus:ring-greens-500"
            />
            <span className="font-medium text-slate-700">Aggregate divisions</span>
          </label>
        </div>
      </div>

      {/* Graph Area */}
      {chartData.length > 0 && (
        <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-greens-600" />
            Greens Primary Vote Trend
          </h2>
          <div className="h-64 sm:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="key"
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  tickFormatter={formatXAxisLabel}
                />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} domain={[0, 'auto']} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', color: '#0f172a' }}
                  labelClassName="text-slate-500 font-bold"
                  labelFormatter={formatChartLabel}
                />
                <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
                <Line
                  type="monotone"
                  dataKey="Greens %"
                  stroke="#16a34a"
                  strokeWidth={3}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="ALP %"
                  stroke="#dc2626"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                />
                <Line
                  type="monotone"
                  dataKey="LNP %"
                  stroke="#2563eb"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                />
                <Line
                  type="monotone"
                  dataKey="Others %"
                  stroke="#64748b"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Table Area */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
          <h2 className="text-md font-bold text-slate-800">Historical Results Table</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="px-5 py-3">Election & Date</th>
                <th className="px-5 py-3.5 text-greens-700">Greens %</th>
                <th className="px-5 py-3.5 text-red-750">ALP %</th>
                <th className="px-5 py-3.5 text-blue-750">LNP %</th>
                <th className="px-5 py-3.5 text-slate-500">Others %</th>
                <th className="px-5 py-3.5 text-right">Total Votes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150">
              {tableData.map((r, idx) => {
                const maxPct = Math.max(r.grnPct, r.alpPct, r.lnpPct, r.othPct);
                const isGrnWinner = r.grnPct === maxPct;
                const isAlpWinner = r.alpPct === maxPct;
                const isLnpWinner = r.lnpPct === maxPct;
                const isOthWinner = r.othPct === maxPct;

                return (
                  <tr key={`${r.electionId}-${r.contestName}-${idx}`} className="hover:bg-slate-50/50">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-800">
                        <Link to={`/election/${r.electionId}?contest=${`${r.contestName}-${r.primaryDivision}`.toLowerCase().replace(/\s+/g, '-')}`} className="hover:text-greens-600 transition-colors">
                          {r.electionName.toLowerCase().includes(r.displayName.toLowerCase())
                            ? r.electionName
                            : `${r.displayName} - ${r.electionName}`}
                        </Link>
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <span>{r.boothName}</span>
                        <span>•</span>
                        <span>{r.date}</span>
                      </div>
                    </td>
                    <td className={`px-5 py-3 font-mono font-bold ${isGrnWinner ? 'text-greens-800 bg-greens-100/50' : 'text-greens-650'}`}>
                      {r.grnPct}% <span className="text-[10px] font-normal text-slate-400">({r.grn})</span>
                    </td>
                    <td className={`px-5 py-3 font-mono ${isAlpWinner ? 'text-red-800 bg-red-100/50 font-bold' : 'text-red-650'}`}>
                      {r.alpPct}% <span className="text-[10px] font-normal text-slate-400">({r.alp})</span>
                    </td>
                    <td className={`px-5 py-3 font-mono ${isLnpWinner ? 'text-blue-800 bg-blue-100/50 font-bold' : 'text-blue-650'}`}>
                      {r.lnpPct}% <span className="text-[10px] font-normal text-slate-400">({r.lnp})</span>
                    </td>
                    <td className={`px-5 py-3 font-mono ${isOthWinner ? 'text-slate-900 bg-slate-200/70 font-bold' : 'text-slate-450'}`}>
                      {r.othPct}% <span className="text-[10px] font-normal text-slate-400">({r.oth})</span>
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-slate-500">
                      {r.total.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
