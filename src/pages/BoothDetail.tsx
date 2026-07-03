import { useMemo } from 'react';
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
import boothsData from '../data/booths.json';
import electionsData from '../data/elections.json';
import type { PollingPlace, Election } from '../types';

export default function BoothDetail() {
  const { id } = useParams<{ id: string }>();

  const booth = useMemo(() => {
    return (boothsData as PollingPlace[]).find(b => b.id === id);
  }, [id]);

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

    // Group contest results by their election type / parentType (for by-elections)
    // and sort them chronologically.
    const sortedContests = [...booth.results]
      .map(result => {
        const election = electionsMap.get(result.electionId);
        return {
          result,
          election,
          compareGroup: election
            ? (election.type === 'by-election' ? election.parentType || 'state' : election.type)
            : 'other',
          date: election ? election.date : '1970-01-01'
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date)); // Chronological order (old to new)

    const computedRows = sortedContests.map((item) => {
      const currentElection = item.election;
      const currentContest = item.result;

      // Group votes by major blocks
      const allResultsForElectionAndContest = booth.results.filter(
        r => r.electionId === currentContest.electionId && r.contestName === currentContest.contestName
      );

      const grn = allResultsForElectionAndContest.find(r => r.party === 'GRN')?.votes || 0;
      const alp = allResultsForElectionAndContest.find(r => r.party === 'ALP')?.votes || 0;
      const lnp = allResultsForElectionAndContest.find(r => r.party === 'LNP')?.votes || 0;
      const oth = allResultsForElectionAndContest.find(r => r.party === 'OTH')?.votes || 0;
      const total = grn + alp + lnp + oth;

      if (total === 0) return;

      return {
        electionId: currentContest.electionId,
        contestName: currentContest.contestName,
        electionName: currentElection?.name || 'Unknown Election',
        date: item.date,
        type: currentElection?.type || 'federal',
        division: currentContest.division || currentElection?.division || 'Unknown',
        booth,
        grn,
        grnPct: parseFloat(((grn / total) * 100).toFixed(2)),
        alp,
        alpPct: parseFloat(((alp / total) * 100).toFixed(2)),
        lnp,
        lnpPct: parseFloat(((lnp / total) * 100).toFixed(2)),
        oth,
        othPct: parseFloat(((oth / total) * 100).toFixed(2)),
        total,
        rawResult: currentContest
      };

    });

    // Return in reverse chronological order (newest first) for the table view
    return computedRows
      .filter(row => row.rawResult.party === 'GRN') // Only show rows where Greens had a candidate
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [booth, electionsMap]);

  // Recharts Chart Data (chronological order)
  const chartData = useMemo(() => {
    return [...tableData]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(row => ({
        name: row.division + ' - ' + row.electionName.replace(' Election', '').replace(' NSW State', ' State'),
        'Greens %': row.grnPct,
        'ALP %': row.alpPct || null,
        'LNP %': row.lnpPct || null,
      }));
  }, [tableData]);

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
          {/* <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  {booth.suburb}
                </span>
                <span>•</span>
                <span>LGA: {booth.lga || 'N/A'}</span>
                <span>•</span>
                <span>Current Division: <strong className="text-slate-800">{booth.division}</strong></span>
              </div> */}
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
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} domain={[0, 'auto']} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', color: '#0f172a' }}
                  labelClassName="text-slate-500 font-bold"
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
                        <Link to={`/election/${r.electionId}?`} className="hover:text-greens-600 transition-colors">
                          {r.division} - {r.electionName}
                        </Link>
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
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
                    <td className={`px-5 py-3 font-mono ${isOthWinner ? 'text-slate-800 bg-slate-100/50 font-bold' : 'text-slate-450'}`}>
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
