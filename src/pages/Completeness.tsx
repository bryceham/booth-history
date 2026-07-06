import { useState, useMemo } from 'react';
import { Check, X, ShieldAlert, Database } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getGroupedBooths } from '../utils';
import electionsData from '../data/elections.json';
import type { Election } from '../types';

export default function Completeness() {
  const [showSpecialCategories, setShowSpecialCategories] = useState(false);
  const elections = electionsData as Election[];

  // Filter booths by category
  const filteredBooths = useMemo(() => {
    return getGroupedBooths().filter(booth => {
      if (!showSpecialCategories && booth.type && booth.type !== 'ordinary') {
        return false;
      }
      return true;
    });
  }, [showSpecialCategories]);

  // Sort elections: newest first
  const sortedElections = useMemo(() => {
    return [...elections].sort((a, b) => b.date.localeCompare(a.date));
  }, [elections]);

  // Compute completeness statistics
  const stats = useMemo(() => {
    let totalCells = filteredBooths.length * elections.length;
    let filledCells = 0;

    filteredBooths.forEach(booth => {
      // Find how many unique electionIds have at least one result
      const uniqueElectionIds = new Set(booth.results.map(r => r.electionId));
      elections.forEach(election => {
        if (uniqueElectionIds.has(election.id)) {
          filledCells++;
        }
      });
    });

    const percentage = ((filledCells / totalCells) * 100).toFixed(1);

    return {
      totalCells,
      filledCells,
      percentage
    };
  }, [filteredBooths, elections]);

  return (
    <div className="space-y-6">
      {/* Page Title & Stats Card */}
      <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center gap-2">
              <Database className="w-7 h-7 text-greens-600" />
              Data Completeness Matrix
            </h1>
            <p className="text-slate-500 text-sm max-w-xl">
              Track which polling booths have historical results imported for each registered election.
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center gap-4 self-stretch md:self-auto">
            <div className="text-center">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Completeness</div>
              <div className="text-2xl font-mono font-extrabold text-greens-600">{stats.percentage}%</div>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <div className="text-xs font-semibold text-slate-700">
                {stats.filledCells} / {stats.totalCells} cells filled
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {filteredBooths.length} Booths × {elections.length} Elections
              </div>
            </div>
          </div>
        </div>
        <div className="pt-4 mt-4 border-t border-slate-100 flex justify-end">
          <div className="flex items-center gap-2 select-none">
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
      </div>

      {/* Matrix Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-655 font-semibold sticky top-0">
              <tr>
                <th className="px-4 py-3.5 min-w-[200px] border-r border-slate-200 sticky left-0 bg-slate-50 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                  Polling Place
                </th>
                {sortedElections.map(election => {
                  const shortName = election.name
                    .replace(' Election', '')
                    .replace(' Newcastle Local', ' Local')
                    .replace(' Lake Macquarie Local', ' Local')
                    .replace(' NSW State', ' State');

                  // Extract year and a simple abbreviation
                  const year = election.date.substring(0, 4);
                  const typeLabel = election.type.toUpperCase().substring(0, 3);
                  const isNewcastle = election.division.includes("Newcastle");
                  const isCharlestown = election.division.includes("Charlestown");
                  const isLakeMac = election.division.includes("Lake Macquarie");

                  let labelColor = "text-slate-600 bg-slate-100 border-slate-200";
                  if (election.type === "federal") labelColor = "text-blue-700 bg-blue-50 border-blue-100";
                  else if (election.type === "state") labelColor = "text-red-700 bg-red-50 border-red-100";
                  else if (election.type === "local") labelColor = "text-emerald-700 bg-emerald-50 border-emerald-100";

                  let divTag = "";
                  if (isNewcastle && election.type === 'local') divTag = "NEW";
                  else if (isLakeMac && election.type === 'local') divTag = "LM";
                  else if (election.type === 'by-election' && isNewcastle) divTag = 'NEW';
                  else if (election.type === 'by-election' && isCharlestown) divTag = 'CHA';

                  return (
                    <th key={election.id} className="px-2 py-3 text-center border-r border-slate-200 min-w-[80px]" title={`${shortName} (${election.division})`}>
                      <Link to={`/election/${election.id}`} className="hover:text-greens-600 transition-colors block">
                        <div className="font-bold text-slate-700">{year}</div>
                        <span className={`inline-block text-[9px] font-mono font-bold px-1 py-0.5 rounded border mt-1 ${labelColor}`}>
                          {typeLabel} {divTag && `• ${divTag}`}
                        </span>
                      </Link>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150">
              {filteredBooths.map(booth => {
                const boothElectionIds = new Set(booth.results.map(r => r.electionId));

                return (
                  <tr key={booth.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 border-r border-slate-200 font-bold text-slate-800 sticky left-0 bg-white hover:bg-slate-50 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link to={`/booth/${booth.id}`} className="hover:text-greens-600 transition-colors">
                          {booth.name}
                        </Link>
                        {booth.type && booth.type !== 'ordinary' && (
                          <span className={`border text-[9px] px-1 py-0.2 rounded font-bold font-mono uppercase tracking-wider ${booth.type === "pre-poll" ? "bg-amber-50 text-amber-700 border-amber-200" :
                            booth.type === "postal" ? "bg-blue-50 text-blue-700 border-blue-200" :
                              booth.type === "absent" ? "bg-purple-50 text-purple-700 border-purple-200" :
                                "bg-rose-50 text-rose-700 border-rose-200"
                            }`}>
                            {booth.type === "pre-poll" ? "Pre-Poll" :
                              booth.type === "postal" ? "Postal" :
                                booth.type === "absent" ? "Absent" : "Declaration"}
                          </span>
                        )}
                      </div>
                    </td>
                    {sortedElections.map(election => {
                      const hasData = boothElectionIds.has(election.id);
                      return (
                        <td key={election.id} className="px-2 py-3 text-center border-r border-slate-200">
                          <div className="flex items-center justify-center">
                            {hasData ? (
                              <span className="p-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-sm" title="Data available">
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </span>
                            ) : (
                              <span className="p-1 rounded-full bg-rose-50 text-rose-600 border border-rose-100 shadow-sm" title="Missing data">
                                <X className="w-3.5 h-3.5 stroke-[3]" />
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Warning/Legend Card */}
      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex gap-3">
        <ShieldAlert className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-600 space-y-1.5">
          <p className="font-semibold text-slate-700">Data Matrix Legend:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>FED</strong>: Federal Election • <strong>STA</strong>: State Election • <strong>LOC</strong>: Local Government Election</li>
            <li><strong>NEW</strong>: Newcastle • <strong>SHO</strong>: Shortland • <strong>LM</strong>: Lake Macquarie</li>
            <li>Row-level names are clickable links to go directly to that Polling Place's detail view.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
