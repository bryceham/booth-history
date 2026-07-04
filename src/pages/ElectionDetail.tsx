import { useMemo, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPin, BarChart3, Trophy, SlidersHorizontal } from 'lucide-react';
import { getGroupedBooths } from '../utils';
import electionsData from '../data/elections.json';
import type { PollingPlace, Election } from '../types';

const getContestKey = (contest: { contestName: string; division: string }) => {
  return `${contest.contestName}-${contest.division}`.toLowerCase().replace(/\s+/g, '-');
};

export default function ElectionDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchTerm, setSearchTerm] = useState('');
  const [showSpecialCategories, setShowSpecialCategories] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const election = useMemo(() => {
    return (electionsData as Election[]).find(e => e.id === id);
  }, [id]);

  const activeContestKey = searchParams.get('contest') || '';

  // Discover all unique contests (combination of contestName and division) present in this election's results
  const contests = useMemo(() => {
    if (!id) return [];
    const map = new Map<string, { contestName: string; division: string }>();

    const booths = getGroupedBooths();
    booths.forEach(booth => {
      booth.results.forEach(r => {
        if (r.electionId === id) {
          const div = r.division || election?.division || 'Unknown';
          const key = `${r.contestName} - ${div}`;
          if (!map.has(key)) {
            map.set(key, { contestName: r.contestName, division: div });
          }
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => {
      // Prioritize Mayor/Lord Mayoral contests first, then sort by division name
      const aIsMayor = a.contestName.toLowerCase().includes('mayor');
      const bIsMayor = b.contestName.toLowerCase().includes('mayor');
      if (aIsMayor && !bIsMayor) return -1;
      if (!aIsMayor && bIsMayor) return 1;
      return a.division.localeCompare(b.division);
    });
  }, [id]);

  const selectedContestIdx = useMemo(() => {
    if (!activeContestKey) return 0;
    const idx = contests.findIndex(c => getContestKey(c) === activeContestKey);
    return idx !== -1 ? idx : 0;
  }, [contests, activeContestKey]);

  const activeContest = useMemo(() => {
    return contests[selectedContestIdx] || null;
  }, [contests, selectedContestIdx]);

  // Aggregate results across all booths for the active contest
  const allBoothResults = useMemo(() => {
    if (!id || !activeContest) return [];

    const list: {
      booth: PollingPlace;
      grn: number;
      grnPct: number;
      alp: number;
      alpPct: number;
      lnp: number;
      lnpPct: number;
      oth: number;
      othPct: number;
      total: number;
      division: string;
    }[] = [];

    const booths = getGroupedBooths();
    booths.forEach(booth => {
      const contestResults = booth.results.filter(r => {
        const rDiv = r.division || election?.division || 'Unknown';
        return r.electionId === id &&
               r.contestName === activeContest.contestName &&
               rDiv === activeContest.division;
      });
      if (contestResults.length === 0) return;

      const grn = contestResults.find(r => r.party === 'GRN')?.votes || 0;
      const alp = contestResults.find(r => r.party === 'ALP')?.votes || 0;
      const lnp = contestResults.find(r => r.party === 'LNP')?.votes || 0;
      const oth = contestResults.find(r => r.party === 'OTH')?.votes || 0;
      const total = grn + alp + lnp + oth;

      if (total === 0) return;

      list.push({
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
        division: activeContest.division
      });
    });

    return list;
  }, [id, activeContest]);

  // Filter booth results based on special categories toggle
  const divisionBoothResults = useMemo(() => {
    let list = allBoothResults;
    if (!showSpecialCategories) {
      list = list.filter(r => !r.booth.type || r.booth.type === 'ordinary');
    }
    return list;
  }, [allBoothResults, showSpecialCategories]);

  // Calculate totals for the selected contest (includes all data regardless of checkbox)
  const overallTotals = useMemo(() => {
    let grn = 0;
    let alp = 0;
    let lnp = 0;
    let oth = 0;
    let total = 0;

    allBoothResults.forEach(r => {
      grn += r.grn;
      alp += r.alp;
      lnp += r.lnp;
      oth += r.oth;
      total += r.total;
    });

    return {
      grn,
      grnPct: total > 0 ? parseFloat(((grn / total) * 100).toFixed(2)) : 0,
      alp,
      alpPct: total > 0 ? parseFloat(((alp / total) * 100).toFixed(2)) : 0,
      lnp,
      lnpPct: total > 0 ? parseFloat(((lnp / total) * 100).toFixed(2)) : 0,
      oth,
      othPct: total > 0 ? parseFloat(((oth / total) * 100).toFixed(2)) : 0,
      total
    };
  }, [allBoothResults]);

  // Filtered booth list for table display
  const filteredBoothResults = useMemo(() => {
    const list = divisionBoothResults.filter(r =>
      r.booth.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.booth.suburb.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return list.sort((a, b) => b.grnPct - a.grnPct);
  }, [divisionBoothResults, searchTerm]);

  // Sort booths by Greens percentage descending to get top booths in current context
  const topGreensBooths = useMemo(() => {
    return [...divisionBoothResults]
      .sort((a, b) => b.grnPct - a.grnPct)
      .slice(0, 3);
  }, [divisionBoothResults]);

  if (!election) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Election Not Found</h2>
        <Link to="/" className="text-greens-600 hover:underline">Return to Home</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div>
        <Link to="/" className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900 transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>
      </div>

      {/* Header Card */}
      <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="bg-greens-50 border border-greens-200 text-greens-700 text-xs px-2.5 py-1 rounded-full font-semibold font-mono uppercase tracking-wider">
              {election.type} election
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2 mb-1">{election.name}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4 text-slate-400" />
                {election.date}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4 text-slate-400" />
                Region: <strong className="text-slate-800">{election.division}</strong>
              </span>
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-right font-mono self-stretch md:self-auto flex md:flex-col justify-between items-center md:items-end">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Formal Votes</span>
            <span className="text-lg font-bold text-slate-850">{overallTotals.total.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Contest Selector Tabs (shown if multiple contests/wards exist) */}
      {contests.length > 1 && (
        <div className="border-b border-slate-200">
          <div className="flex flex-wrap gap-2 -mb-px">
            {contests.map((c, index) => {
              const isActive = selectedContestIdx === index;
              const isMayor = c.contestName.toLowerCase().includes('mayor');
              const label = isMayor ? `Mayor` : `${c.division}`;

              return (
                <button
                  key={`${c.contestName}-${c.division}`}
                  onClick={() => { setSearchParams({ contest: getContestKey(c) }); setSearchTerm(''); }}
                  className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-all ${isActive
                    ? 'border-greens-600 text-greens-700 bg-greens-50/20'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                    }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Overall Summary Stats & Top Booths */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Vote Share Card */}
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm md:col-span-2 space-y-4">
          <h2 className="text-md font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-greens-600" />
            Vote Share {activeContest && `(${activeContest.division} ${activeContest.contestName})`}
          </h2>
          <div className="space-y-3.5">
            {/* Progress Bars */}
            {[
              { label: 'Greens (GRN)', pct: overallTotals.grnPct, votes: overallTotals.grn, color: 'bg-emerald-500', text: 'text-emerald-700' },
              { label: 'Labor (ALP)', pct: overallTotals.alpPct, votes: overallTotals.alp, color: 'bg-red-500', text: 'text-red-750' },
              { label: 'Coalition (LNP)', pct: overallTotals.lnpPct, votes: overallTotals.lnp, color: 'bg-blue-500', text: 'text-blue-750' },
              { label: 'Others (OTH)', pct: overallTotals.othPct, votes: overallTotals.oth, color: 'bg-slate-300', text: 'text-slate-600' }
            ].sort((a, b) => b.votes - a.votes)
              .map(party => (
                <div key={party.label} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-700">{party.label}</span>
                    <span className="font-mono">
                      <strong className={party.text}>{party.pct}%</strong> • {party.votes.toLocaleString()} votes
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div style={{ width: `${party.pct}%` }} className={`h-full ${party.color}`} />
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Top Greens Booths Card */}
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm space-y-4">
          <h2 className="text-md font-bold text-slate-800 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-600" />
            Top Greens Booths
          </h2>
          <div className="divide-y divide-slate-150">
            {topGreensBooths.length > 0 ? (
              topGreensBooths.map((tb) => (
                <div key={tb.booth.id} className="py-2.5 first:pt-0 last:pb-0 flex justify-between items-center">
                  <div className="min-w-0 pr-2">
                    <Link to={`/booth/${tb.booth.id}`} className="font-semibold text-slate-800 hover:text-greens-600 transition-colors truncate block text-sm">
                      {tb.booth.name}
                    </Link>
                    <div className="text-[10px] text-slate-450 mt-0.5">{tb.booth.suburb}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-mono font-extrabold text-greens-600">{tb.grnPct}%</div>
                    <div className="text-[9px] text-slate-400 mt-0.5">{tb.grn.toLocaleString()} votes</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-slate-400 py-6 text-xs">No booths found.</div>
            )}
          </div>
        </div>
      </div>

      {/* Filter and Booth Table list */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <SlidersHorizontal className="w-4 h-4 text-slate-400" />
            Booths: {filteredBoothResults.length} / {divisionBoothResults.length}
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex items-center gap-2 select-none self-start sm:self-auto shrink-0">
              <input
                type="checkbox"
                id="special-categories"
                checked={showSpecialCategories}
                onChange={(e) => setShowSpecialCategories(e.target.checked)}
                className="w-4 h-4 text-greens-600 border-slate-300 rounded focus:ring-greens-500 cursor-pointer"
              />
              <label htmlFor="special-categories" className="text-xs font-semibold text-slate-655 cursor-pointer">
                Show Early Voting & Decs
              </label>
            </div>
            <input
              type="text"
              placeholder="Search booth name..."
              className="bg-white border border-slate-250 text-slate-900 rounded-lg px-3 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-greens-500 transition-all w-full sm:max-w-[200px]"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Polling Place</th>
                <th className="px-5 py-3.5 text-greens-700">Greens %</th>
                <th className="px-5 py-3.5 text-red-750">ALP %</th>
                <th className="px-5 py-3.5 text-blue-750">LNP %</th>
                <th className="px-5 py-3.5 text-slate-500">Others %</th>
                <th className="px-5 py-3.5 text-right">Total Votes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 text-slate-700">
              {filteredBoothResults.length > 0 ? (
                filteredBoothResults.map(r => {
                  const maxPct = Math.max(r.grnPct, r.alpPct, r.lnpPct, r.othPct);
                  const isGrnWinner = r.grnPct === maxPct;
                  const isAlpWinner = r.alpPct === maxPct;
                  const isLnpWinner = r.lnpPct === maxPct;
                  const isOthWinner = r.othPct === maxPct;

                  return (
                    <tr key={r.booth.id} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link to={`/booth/${r.booth.id}`} className="font-bold text-slate-955 hover:text-greens-600 transition-colors">
                            {r.booth.name}
                          </Link>
                          {r.booth.type && r.booth.type !== 'ordinary' && (
                            <span className={`border text-[9px] px-1 py-0.2 rounded font-bold font-mono uppercase tracking-wider ${r.booth.type === "pre-poll" ? "bg-amber-50 text-amber-700 border-amber-200" :
                              r.booth.type === "postal" ? "bg-blue-50 text-blue-700 border-blue-200" :
                                r.booth.type === "absent" ? "bg-purple-50 text-purple-700 border-purple-200" :
                                  "bg-rose-50 text-rose-700 border-rose-200"
                              }`}>
                              {r.booth.type === "pre-poll" ? "Pre-Poll" :
                                r.booth.type === "postal" ? "Postal" :
                                  r.booth.type === "absent" ? "Absent" : "Declaration"}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-450 mt-0.5">{r.booth.suburb}</div>
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
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    No matching booths with results found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
