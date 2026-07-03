import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronRight } from 'lucide-react';
import boothsData from '../data/booths.json';
import electionsData from '../data/elections.json';
import type { PollingPlace } from '../types';

export default function Home() {
  const [search, setSearch] = useState('');

  const [showSpecialCategories, setShowSpecialCategories] = useState(false);

  const booths = boothsData as PollingPlace[];
  const totalElectionsCount = electionsData.length;

  // Filter and sort booths by latest Greens vote percentage descending
  const filteredBooths = useMemo(() => {
    const list = booths.filter(booth => {
      if (!showSpecialCategories && booth.type && booth.type !== 'ordinary') {
        return false;
      }
      return booth.name.toLowerCase().includes(search.toLowerCase()) ||
        booth.suburb.toLowerCase().includes(search.toLowerCase());
    });

    return list.sort((a, b) => {
      const aLatest = a.results
        .filter(r => r.party === 'GRN')
        .sort((x, y) => y.electionId.localeCompare(x.electionId))[0];
      const bLatest = b.results
        .filter(r => r.party === 'GRN')
        .sort((x, y) => y.electionId.localeCompare(x.electionId))[0];

      const aPct = aLatest ? aLatest.percentage : 0;
      const bPct = bLatest ? bLatest.percentage : 0;
      return bPct - aPct;
    });
  }, [booths, search, showSpecialCategories]);

  return (
    <div className="space-y-6">
      {/* Title section */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-2">
          Newy Booth History
        </h1>
        <p className="text-slate-600 text-sm sm:text-base max-w-2xl">
          Historical polling place election results across Newcastle and Lake Macquarie
        </p>
      </div>

      {/* Filters bar */}
      <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="flex-1 relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by booth name or suburb..."
            className="w-full bg-slate-50 border border-slate-250 text-slate-900 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-greens-500 focus:bg-white transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto shrink-0 select-none">
          <input
            type="checkbox"
            id="special-categories"
            checked={showSpecialCategories}
            onChange={(e) => setShowSpecialCategories(e.target.checked)}
            className="w-4 h-4 text-greens-600 border-slate-300 rounded focus:ring-greens-500 cursor-pointer"
          />
          <label htmlFor="special-categories" className="text-xs font-semibold text-slate-650 cursor-pointer">
            Show Early Voting & Declaration Votes
          </label>
        </div>
      </div>

      {/* Booth results list */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Booths found: {filteredBooths.length}
          </span>
        </div>
        <div className="divide-y divide-slate-150">
          {filteredBooths.length > 0 ? (
            filteredBooths.map(booth => {
              // Get the most recent Greens vote percentage
              const latestResult = booth.results
                .filter(r => r.party === 'GRN')
                .sort((a, b) => b.electionId.localeCompare(a.electionId))[0];

              const alpResult = booth.results.find(r => r.party === 'ALP' && r.electionId === latestResult?.electionId);
              const lnpResult = booth.results.find(r => (r.party === 'LNP' || r.party === 'LIB') && r.electionId === latestResult?.electionId);

              const grnPct = latestResult ? latestResult.percentage : 0;
              const alpPct = alpResult ? alpResult.percentage : 0;
              const lnpPct = lnpResult ? lnpResult.percentage : 0;
              const othPct = Math.max(0, 100 - (grnPct + alpPct + lnpPct));

              const uniqueElectionsCount = new Set(booth.results.map(r => r.electionId)).size;

              return (
                <Link
                  key={booth.id}
                  to={`/booth/${booth.id}`}
                  className="flex items-center justify-between p-4 hover:bg-slate-50 transition-all group"
                >
                  <div className="space-y-1.5 pr-4 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-800 group-hover:text-greens-600 transition-colors truncate text-sm sm:text-base">
                        {booth.name}
                      </h3>
                      {booth.type && booth.type !== 'ordinary' && (
                        <span className={`border text-[9px] px-1.5 py-0.5 rounded font-bold font-mono uppercase tracking-wider ${booth.type === "pre-poll" ? "bg-amber-50 text-amber-700 border-amber-200" :
                          booth.type === "postal" ? "bg-blue-50 text-blue-700 border-blue-200" :
                            booth.type === "absent" ? "bg-purple-50 text-purple-700 border-purple-200" :
                              "bg-rose-50 text-rose-700 border-rose-200"
                          }`}>
                          {booth.type === "pre-poll" ? "Pre-Poll" :
                            booth.type === "postal" ? "Postal" :
                              booth.type === "absent" ? "Absent" : "Declaration"}
                        </span>
                      )}
                      <span className="bg-slate-100 text-slate-600 border border-slate-200 text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold" title="Elections with data / total registered elections">
                        {uniqueElectionsCount}/{totalElectionsCount} elections
                      </span>
                    </div>

                    {/* Stacked Vote Share Bar */}
                    <div className="flex items-center gap-3 pt-1 max-w-md">
                      <div className="h-1.5 rounded-full overflow-hidden flex bg-slate-150 w-28 sm:w-36">
                        <div style={{ width: `${grnPct}%` }} className="bg-emerald-500" title={`Greens: ${grnPct}%`} />
                        <div style={{ width: `${alpPct}%` }} className="bg-red-500" title={`ALP: ${alpPct}%`} />
                        <div style={{ width: `${lnpPct}%` }} className="bg-blue-500" title={`LNP: ${lnpPct}%`} />
                        <div style={{ width: `${othPct}%` }} className="bg-slate-300" title={`Others: ${othPct.toFixed(1)}%`} />
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 shrink-0">
                        GRN <strong className="text-emerald-600">{grnPct}%</strong> • ALP <strong className="text-red-600">{alpPct}%</strong> • LNP <strong className="text-blue-600">{lnpPct}%</strong> • OTH <strong className="text-slate-400">{othPct.toFixed(1)}%</strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {latestResult && (
                      <div className="text-right hidden sm:block">
                        <div className="text-xs text-slate-450">Latest Greens</div>
                        <div className="font-mono font-bold text-greens-600 text-sm">
                          {latestResult.percentage}%
                        </div>
                      </div>
                    )}
                    <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-greens-600 transition-colors" />
                  </div>
                </Link>
              );
            })
          ) : (
            <div className="p-8 text-center text-slate-400 text-sm">
              No booths match your search criteria. Try a different query.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
