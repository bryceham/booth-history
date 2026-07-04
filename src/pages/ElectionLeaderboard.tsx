import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpDown, BarChart3, Filter } from 'lucide-react';
import summariesData from '../data/election-summaries.json';

// ── Types ─────────────────────────────────────────────────────────────────────

type ElectionSummary = {
  id: string;
  electionId: string;
  electionName: string;
  electionType: string;
  electionDate: string;
  electionYear: number;
  contestName: string;
  division: string;
  grnVotes: number;
  grnPct: number;
  alpVotes: number;
  alpPct: number;
  lnpVotes: number;
  lnpPct: number;
  othVotes: number;
  othPct: number;
  totalVotes: number;
  boothCount: number;
  grnSwing: number | null;
};

type SortField = 'grnPct' | 'grnVotes' | 'year' | 'totalVotes';

// const ELECTION_TYPE_LABELS: Record<string, string> = {
//   federal: 'Federal',
//   state: 'State',
//   local: 'Local',
//   'by-election': 'By-election',
// };

// const TYPE_COLORS: Record<string, string> = {
//   federal: 'bg-violet-50 text-violet-700 border-violet-200',
//   state: 'bg-sky-50 text-sky-700 border-sky-200',
//   local: 'bg-amber-50 text-amber-700 border-amber-200',
//   'by-election': 'bg-rose-50 text-rose-700 border-rose-200',
// };

// ── Component ─────────────────────────────────────────────────────────────────

export default function ElectionLeaderboard() {
  const allSummaries = summariesData as ElectionSummary[];

  // ── Filter state ──────────────────────────────────────────────────────────
  const [selectedType, setSelectedType] = useState<string>('All');
  const [selectedDivision, setSelectedDivision] = useState<string>('All');
  const [yearMin, setYearMin] = useState<string>('2013');
  const [yearMax, setYearMax] = useState<string>('2026');

  // ── Sort state ────────────────────────────────────────────────────────────
  const [sortField, setSortField] = useState<SortField>('grnPct');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // ── Derived filter options ────────────────────────────────────────────────
  const divisions = useMemo(() => {
    const divs = new Set(allSummaries.map(s => s.division));
    return ['All', ...Array.from(divs).sort()];
  }, [allSummaries]);

  // ── Elections that span multiple electorates (need division prefix in label) ──
  const multiDivisionIds = useMemo(() => {
    const counts = new Map<string, number>();
    allSummaries.forEach(s => counts.set(s.electionId, (counts.get(s.electionId) ?? 0) + 1));
    return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([id]) => id));
  }, [allSummaries]);

  // ── Filtered + sorted rows ────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    return allSummaries.filter(s => {
      const matchesType = selectedType === 'All' || s.electionType === selectedType;
      const matchesDivision = selectedDivision === 'All' || s.division === selectedDivision;
      const matchesYearMin = !yearMin || s.electionYear >= parseInt(yearMin);
      const matchesYearMax = !yearMax || s.electionYear <= parseInt(yearMax);
      return matchesType && matchesDivision && matchesYearMin && matchesYearMax && s.boothCount >= 10;
    });
  }, [allSummaries, selectedType, selectedDivision, yearMin, yearMax]);

  const sortedRows = useMemo(() => {
    const rows = [...filteredRows];
    rows.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'grnPct') cmp = a.grnPct - b.grnPct;
      if (sortField === 'grnVotes') {
        const votesA = parseInt(String(a.grnVotes || '').replace(/,/g, '')) || 0;
        const votesB = parseInt(String(b.grnVotes || '').replace(/,/g, '')) || 0;
        cmp = votesA - votesB;
      }
      if (sortField === 'totalVotes') {
        const totalA = parseInt(String(a.totalVotes || '').replace(/,/g, '')) || 0;
        const totalB = parseInt(String(b.totalVotes || '').replace(/,/g, '')) || 0;
        cmp = totalA - totalB;
      }
      if (sortField === 'year') cmp = a.electionYear - b.electionYear;
      return sortOrder === 'desc' ? -cmp : cmp;
    });
    return rows;
  }, [filteredRows, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };



  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-2 flex items-center gap-2">
          <BarChart3 className="w-8 h-8 text-greens-600" />
          Elections Leaderboard
        </h1>
        <p className="text-slate-600 text-sm max-w-xl">
          Aggregated Greens first-preference totals per election contest, ranked across all elections.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-slate-400" />
          Filters
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Election Type */}
          <div className="space-y-1">
            <label className="text-xs text-slate-500 font-semibold">Election Type</label>
            <select
              className="w-full bg-slate-50 border border-slate-250 text-slate-900 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-greens-500 focus:bg-white transition-all cursor-pointer"
              value={selectedType}
              onChange={e => setSelectedType(e.target.value)}
            >
              <option value="All">All Types</option>
              <option value="federal">Federal</option>
              <option value="state">State</option>
              <option value="local">Local</option>
              <option value="by-election">By-election</option>
            </select>
          </div>

          {/* Division */}
          <div className="space-y-1">
            <label className="text-xs text-slate-500 font-semibold">Division / Ward</label>
            <select
              className="w-full bg-slate-50 border border-slate-250 text-slate-900 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-greens-500 focus:bg-white transition-all cursor-pointer"
              value={selectedDivision}
              onChange={e => setSelectedDivision(e.target.value)}
            >
              {divisions.map(d => (
                <option key={d} value={d}>{d === 'All' ? 'All Divisions' : d}</option>
              ))}
            </select>
          </div>

          {/* Year Range */}
          <div className="space-y-1 sm:col-span-2 md:col-span-2">
            <label className="text-xs text-slate-500 font-semibold">Year Range</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="2000" max="2030"
                className="w-full bg-slate-50 border border-slate-250 text-slate-900 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-greens-500 focus:bg-white transition-all text-center"
                value={yearMin}
                onChange={e => setYearMin(e.target.value)}
              />
              <span className="text-slate-400 font-mono">–</span>
              <input
                type="number"
                min="2000" max="2030"
                className="w-full bg-slate-50 border border-slate-250 text-slate-900 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-greens-500 focus:bg-white transition-all text-center"
                value={yearMax}
                onChange={e => setYearMax(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-xs uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5 w-14">Rank</th>
                <th className="px-5 py-3.5">Election / Contest</th>

                <th
                  className="px-5 py-3.5 cursor-pointer hover:bg-slate-100/60 text-greens-700"
                  onClick={() => handleSort('grnPct')}
                >
                  <div className="flex items-center gap-1">
                    <span>Greens %</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>

                <th
                  className="px-5 py-3.5 cursor-pointer hover:bg-slate-100/60 text-greens-700"
                  onClick={() => handleSort('grnVotes')}
                >
                  <div className="flex items-center gap-1">
                    <span>Greens Votes</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>

                <th
                  className="px-5 py-3.5 cursor-pointer hover:bg-slate-100/60 text-right"
                  onClick={() => handleSort('totalVotes')}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Total Votes</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {sortedRows.length > 0 ? (
                sortedRows.map((row, index) => {
                  const rank = index + 1;
                  const isTop3 = rank <= 3;
                  // const typeColor = TYPE_COLORS[row.electionType] ?? 'bg-slate-50 text-slate-600 border-slate-200';

                  return (
                    <tr key={row.id} className="hover:bg-slate-50/50">
                      {/* Rank */}
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-mono font-bold ${isTop3
                            ? 'bg-yellow-50 text-yellow-700 border border-yellow-250 shadow-sm'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                        >
                          {rank}
                        </span>
                      </td>

                      {/* Election / Contest */}
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap items-center gap-2 mb-0.5">
                          <Link
                            to={`/election/${row.electionId}`}
                            className="font-bold text-slate-900 hover:text-greens-600 transition-colors text-sm"
                          >
                            {multiDivisionIds.has(row.electionId)
                              ? `${row.electionName} — ${row.contestName.toLowerCase().includes('mayor') ? 'Mayor' : row.division}`
                              : row.electionName}
                          </Link>
                          {/* <span className={`border text-[9px] px-1.5 py-0.5 rounded font-bold font-mono uppercase tracking-wider ${typeColor}`}>
                            {ELECTION_TYPE_LABELS[row.electionType] ?? row.electionType}
                          </span> */}
                        </div>
                        <div className="text-[10px] text-slate-450 font-mono uppercase tracking-wider">
                          {row.boothCount} booths
                        </div>
                      </td>

                      {/* Greens % */}
                      <td className="px-5 py-4 font-mono font-bold text-greens-600 text-base">
                        {row.grnPct}%
                      </td>

                      {/* Greens Votes */}
                      <td className="px-5 py-4 font-mono font-semibold text-greens-700">
                        {row.grnVotes.toLocaleString()}
                      </td>

                      {/* Total Votes */}
                      <td className="px-5 py-4 text-right font-mono text-slate-500 text-xs">
                        {row.totalVotes.toLocaleString()}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-400 text-sm">
                    No records found matching current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer summary */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200">
          <span className="text-xs text-slate-500 font-mono">
            {sortedRows.length} election contest{sortedRows.length !== 1 ? 's' : ''} shown
          </span>
        </div>
      </div>
    </div>
  );
}
