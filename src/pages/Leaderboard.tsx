import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpDown, ArrowUp, ArrowDown, Award, Filter, Search, ChevronLeft, ChevronRight } from 'lucide-react';
// import {
//   ResponsiveContainer,
//   LineChart,
//   Line,
//   XAxis,
//   YAxis,
//   CartesianGrid,
//   Tooltip,
//   Legend,
// } from 'recharts';
import { getGroupedBooths } from '../utils';
import electionsData from '../data/elections.json';
import type { Election } from '../types';

type LeaderboardRow = {
  boothId: string;
  boothName: string;
  lga: string;
  electionId: string;
  electionName: string;
  electionType: string;
  electionYear: number;
  contestName: string;
  division: string;
  greensPercentage: number;
  greensVotes: number;
  totalVotes: number;
  boothType?: string;
  swing: number | null;
  divisionChanged: boolean;
};

const getElectionDisplayName = (row: LeaderboardRow) => {
  const isLocal = row.electionType === 'local' || 
                  row.electionName.toLowerCase().includes('local') || 
                  row.electionName.toLowerCase().includes('mayor');
  if (isLocal) {
    if (row.contestName.toLowerCase().includes('mayor') || row.contestName.toLowerCase().includes('mayoral')) {
      if (row.electionName.toLowerCase().includes('mayor') || row.electionName.toLowerCase().includes('mayoral')) {
        return row.electionName;
      }
      return `Mayor - ${row.electionName}`;
    }
    if (row.division && row.division.toLowerCase().includes('ward')) {
      return `${row.division} - ${row.electionName}`;
    }
  }
  return row.electionName;
};

export default function Leaderboard() {
  // Filter States
  const [showSpecialCategories, setShowSpecialCategories] = useState(false);
  const [hideSmallBooths, setHideSmallBooths] = useState(true);
  const [selectedType, setSelectedType] = useState<string>('All');
  const [selectedLga, setSelectedLga] = useState<string>('All');
  const [selectedDivision, setSelectedDivision] = useState<string>('All');
  const [boothSearch, setBoothSearch] = useState<string>('');
  const [yearMin, setYearMin] = useState<string>('2014');
  const [yearMax, setYearMax] = useState<string>('2026');

  // Sorting State
  const [sortField, setSortField] = useState<'percentage' | 'swing' | 'name' | 'year' | 'votes' | 'totalVotes'>('percentage');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage] = useState<number>(10);

  const electionsMap = useMemo(() => {
    const map = new Map<string, Election>();
    (electionsData as Election[]).forEach(e => {
      map.set(e.id, e);
    });
    return map;
  }, []);

  // Flatten booths data into one row per Greens contest
  const flatData: LeaderboardRow[] = useMemo(() => {
    const rows: LeaderboardRow[] = [];
    const booths = getGroupedBooths();

    booths.forEach(booth => {
      if (!showSpecialCategories && booth.type && booth.type !== 'ordinary') {
        return;
      }
      // Find historical results for this booth
      const grnContests = booth.results.filter(r => r.party === 'GRN');

      grnContests.forEach(contest => {
        const election = electionsMap.get(contest.electionId);
        if (!election) return;

        const year = new Date(election.date).getFullYear();

        // Calculate Swing & Boundary change
        let swing: number | null = null;
        let divisionChanged = false;

        // Group type to compare with previous comparable elections
        const compareGroup = election.type === 'by-election' ? election.parentType || 'state' : election.type;

        // Find previous comparable contest for this booth
        const comparableContests = booth.results
          .filter(r => r.party === 'GRN' && r.contestName === contest.contestName)
          .map(r => ({ result: r, election: electionsMap.get(r.electionId) }))
          .filter(x => x.election && (x.election.type === 'by-election' ? x.election.parentType === compareGroup : x.election.type === compareGroup))
          .sort((a, b) => (a.election?.date || '').localeCompare(b.election?.date || ''));

        const currentIdx = comparableContests.findIndex(c => c.result.electionId === contest.electionId);
        if (currentIdx > 0) {
          const prev = comparableContests[currentIdx - 1];
          swing = parseFloat((contest.percentage - prev.result.percentage).toFixed(1));
          if (prev.election) {
            divisionChanged = election.division !== prev.election.division;
          }
        }

        rows.push({
          boothId: booth.id,
          boothName: booth.name,
          lga: booth.lga || 'Unknown LGA',
          electionId: contest.electionId,
          electionName: election.name,
          electionType: election.type,
          electionYear: year,
          contestName: contest.contestName,
          division: contest.division || election.division,
          greensPercentage: contest.percentage,
          greensVotes: contest.votes,
          totalVotes: contest.percentage > 0 ? Math.round((contest.votes / contest.percentage) * 100) : 0,
          boothType: booth.type,
          swing,
          divisionChanged
        });
      });
    });

    return rows;
  }, [electionsMap, showSpecialCategories]);


  // List of unique LGAs for filter dropdown
  const lgas = useMemo(() => {
    const allLgas = flatData.map((r: LeaderboardRow) => r.lga);
    return ['All', ...Array.from(new Set(allLgas))].sort();
  }, [flatData]);

  // List of unique Divisions/Wards for filter dropdown
  const divisions = useMemo(() => {
    const allDivisions = flatData.map((r: LeaderboardRow) => r.division);
    return ['All', ...Array.from(new Set(allDivisions))].sort();
  }, [flatData]);

  // Filter the rows
  const filteredRows = useMemo(() => {
    return flatData.filter((row: LeaderboardRow) => {
      const matchesType = selectedType === 'All' || row.electionType === selectedType;
      const matchesLga = selectedLga === 'All' || row.lga === selectedLga;
      const matchesDivision = selectedDivision === 'All' || row.division === selectedDivision;
      const matchesBooth = row.boothName.toLowerCase().includes(boothSearch.toLowerCase());

      const year = row.electionYear;
      const matchesYearMin = yearMin ? year >= parseInt(yearMin) : true;
      const matchesYearMax = yearMax ? year <= parseInt(yearMax) : true;

      const matchesSmallBooths = !hideSmallBooths || row.totalVotes >= 250;

      return matchesType && matchesLga && matchesDivision && matchesBooth && matchesYearMin && matchesYearMax && matchesSmallBooths;
    });
  }, [flatData, selectedType, selectedLga, selectedDivision, boothSearch, yearMin, yearMax, hideSmallBooths]);

  // Generate chart data matching filter criteria
  // const chartData = useMemo(() => {
  //   const uniqueElectionIds = Array.from(new Set(filteredRows.map((r: LeaderboardRow) => r.electionId)));
  //   const sortedElections = uniqueElectionIds
  //     .map(id => electionsMap.get(id))
  //     .filter((e): e is Election => !!e)
  //     .sort((a, b) => a.date.localeCompare(b.date));

  //   return sortedElections.map(election => {
  //     const dataPoint: any = {
  //       electionId: election.id,
  //       electionName: election.name,
  //       dateLabel: election.date.split('-').reverse().join('/'),
  //     };

  //     filteredRows.forEach((row: LeaderboardRow) => {
  //       if (row.electionId === election.id) {
  //         dataPoint[row.boothName] = row.greensPercentage;
  //       }
  //     });

  //     return dataPoint;
  //   });
  // }, [filteredRows, electionsMap]);

  // Sort the filtered rows
  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows];
    sorted.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'percentage') {
        comparison = a.greensPercentage - b.greensPercentage;
      } else if (sortField === 'swing') {
        comparison = (a.swing ?? -999) - (b.swing ?? -999);
      } else if (sortField === 'name') {
        comparison = a.boothName.localeCompare(b.boothName);
      } else if (sortField === 'year') {
        comparison = a.electionYear - b.electionYear;
      } else if (sortField === 'votes') {
        comparison = (a.greensVotes || 0) - (b.greensVotes || 0);
      } else if (sortField === 'totalVotes') {
        comparison = (a.totalVotes || 0) - (b.totalVotes || 0);
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });
    return sorted;
  }, [filteredRows, sortField, sortOrder]);

  // Paginated Rows
  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return sortedRows.slice(startIndex, startIndex + rowsPerPage);
  }, [sortedRows, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(sortedRows.length / rowsPerPage);

  const handleSort = (field: 'percentage' | 'swing' | 'name' | 'year' | 'votes' | 'totalVotes') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-2 flex items-center gap-2">
          <Award className="w-8 h-8 text-yellow-600" />
          Booth Leaderboard
        </h1>
        <p className="text-slate-600 text-sm max-w-3xl">
          Historical rank of all booths in Newcastle and Lake Macquarie based on Greens first preference percentage.
        </p>
      </div>

      {/* Advanced Filters Card */}
      <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-slate-400" />
          Leaderboard Filters
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          {/* Booth Search */}
          <div className="space-y-1">
            <label className="text-xs text-slate-500 font-semibold">Booth Name</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search booth..."
                className="w-full bg-slate-50 border border-slate-250 text-slate-900 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-greens-500 focus:bg-white transition-all"
                value={boothSearch}
                onChange={e => { setBoothSearch(e.target.value); setCurrentPage(1); }}
              />
            </div>
          </div>

          {/* Election Type */}
          <div className="space-y-1">
            <label className="text-xs text-slate-500 font-semibold">Election Type</label>
            <select
              className="w-full bg-slate-50 border border-slate-250 text-slate-900 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-greens-500 focus:bg-white transition-all cursor-pointer"
              value={selectedType}
              onChange={e => { setSelectedType(e.target.value); setCurrentPage(1); }}
            >
              <option value="All">All Types</option>
              <option value="federal">Federal</option>
              <option value="state">State</option>
              <option value="local">Local</option>
              <option value="by-election">By-election</option>
            </select>
          </div>

          {/* LGA */}
          <div className="space-y-1">
            <label className="text-xs text-slate-500 font-semibold">LGA Region</label>
            <select
              className="w-full bg-slate-50 border border-slate-250 text-slate-900 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-greens-500 focus:bg-white transition-all cursor-pointer"
              value={selectedLga}
              onChange={e => { setSelectedLga(e.target.value); setCurrentPage(1); }}
            >
              {lgas.map((lga: string) => (
                <option key={lga} value={lga}>{lga === 'All' ? 'All LGAs' : lga}</option>
              ))}
            </select>
          </div>

          {/* Division/Ward */}
          <div className="space-y-1">
            <label className="text-xs text-slate-500 font-semibold">Division / Ward</label>
            <select
              className="w-full bg-slate-50 border border-slate-250 text-slate-900 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-greens-500 focus:bg-white transition-all cursor-pointer"
              value={selectedDivision}
              onChange={e => { setSelectedDivision(e.target.value); setCurrentPage(1); }}
            >
              {divisions.map((div: string) => (
                <option key={div} value={div}>{div === 'All' ? 'All Divisions' : div}</option>
              ))}
            </select>
          </div>

          {/* Year Range */}
          <div className="space-y-1">
            <label className="text-xs text-slate-500 font-semibold">Year Range</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="2000"
                max="2030"
                className="w-full bg-slate-50 border border-slate-250 text-slate-900 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-greens-500 focus:bg-white transition-all text-center"
                value={yearMin}
                onChange={e => { setYearMin(e.target.value); setCurrentPage(1); }}
              />
              <span className="text-slate-400 font-mono">-</span>
              <input
                type="number"
                min="2000"
                max="2030"
                className="w-full bg-slate-50 border border-slate-250 text-slate-900 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-greens-500 focus:bg-white transition-all text-center"
                value={yearMax}
                onChange={e => { setYearMax(e.target.value); setCurrentPage(1); }}
              />
            </div>
          </div>
        </div>
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row justify-between gap-2 sm:items-center">
          <div className="flex items-center gap-2 select-none">
            <input
              type="checkbox"
              id="hide-small-booths"
              checked={hideSmallBooths}
              onChange={(e) => { setHideSmallBooths(e.target.checked); setCurrentPage(1); }}
              className="w-4 h-4 text-greens-600 border-slate-300 rounded focus:ring-greens-500 cursor-pointer"
            />
            <label htmlFor="hide-small-booths" className="text-xs font-semibold text-slate-655 cursor-pointer">
              Hide small booths (&lt; 250 formal votes)
            </label>
          </div>
          <div className="flex items-center gap-2 select-none">
            <input
              type="checkbox"
              id="special-categories"
              checked={showSpecialCategories}
              onChange={(e) => { setShowSpecialCategories(e.target.checked); setCurrentPage(1); }}
              className="w-4 h-4 text-greens-600 border-slate-300 rounded focus:ring-greens-500 cursor-pointer"
            />
            <label htmlFor="special-categories" className="text-xs font-semibold text-slate-650 cursor-pointer">
              Show Early Voting & Declaration Votes
            </label>
          </div>
        </div>
      </div>

      {/* Historical Greens Trend Chart */}
      {/* <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
            Greens Historical Trend Chart
          </h2>
          <span className="text-[11px] text-slate-500 font-mono">
            {filteredUniqueBooths.length} booths showing
          </span>
        </div>
        <div className="w-full h-[400px]">
          {chartData.length > 0 && filteredUniqueBooths.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="dateLabel"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  stroke="#cbd5e1"
                />
                <YAxis
                  tickFormatter={tick => `${tick}%`}
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  stroke="#cbd5e1"
                />
                <Tooltip
                  formatter={(value: any, name: any) => [`${value}%`, name]}
                  contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}
                />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  wrapperStyle={{ maxHeight: '350px', overflowY: 'auto', paddingLeft: '10px', fontSize: '10px' }}
                />
                {filteredUniqueBooths.map((boothName, index) => {
                  const style = getBoothStyle(index);
                  return (
                    <Line
                      key={boothName}
                      type="monotone"
                      dataKey={boothName}
                      stroke={style.stroke}
                      strokeDasharray={style.strokeDasharray}
                      strokeWidth={2}
                      dot={{ r: 3, strokeWidth: 1 }}
                      activeDot={{ r: 5 }}
                      connectNulls
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
              No historical data available for current filters.
            </div>
          )}
        </div>
      </div> */}

      {/* Leaderboard Table Card */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-xs uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5 w-14 whitespace-nowrap">Rank</th>
                <th className="px-5 py-3.5 w-full">Booth / Election</th>
                 <th
                  className={`px-5 py-3.5 cursor-pointer transition-colors select-none whitespace-nowrap w-24 md:w-28 ${
                    sortField === 'percentage'
                      ? 'bg-greens-50/50 text-greens-900 font-bold'
                      : 'hover:bg-slate-100/60 text-greens-700'
                  }`}
                  onClick={() => handleSort('percentage')}
                >
                  <div className="flex items-center gap-1">
                    <span>Greens %</span>
                    {sortField === 'percentage' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-greens-600" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-greens-600" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>
                <th
                  className={`px-5 py-3.5 cursor-pointer transition-colors select-none whitespace-nowrap w-28 md:w-32 ${
                    sortField === 'votes'
                      ? 'bg-greens-50/50 text-greens-900 font-bold'
                      : 'hover:bg-slate-100/60 text-greens-700'
                  }`}
                  onClick={() => handleSort('votes')}
                >
                  <div className="flex items-center gap-1">
                    <span>Greens Votes</span>
                    {sortField === 'votes' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-greens-600" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-greens-600" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>
                <th
                  className={`px-5 py-3.5 cursor-pointer transition-colors select-none whitespace-nowrap w-28 md:w-32 ${
                    sortField === 'totalVotes'
                      ? 'bg-slate-100 text-slate-900 font-bold'
                      : 'hover:bg-slate-100/60 text-slate-655'
                  }`}
                  onClick={() => handleSort('totalVotes')}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Total Votes</span>
                    {sortField === 'totalVotes' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-slate-800" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-slate-800" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 text-slate-700">
              {paginatedRows.length > 0 ? (
                paginatedRows.map((row, index) => {
                  // Calculate absolute rank in filtered list
                  const rank = (currentPage - 1) * rowsPerPage + index + 1;
                  const isTop3 = rank <= 3;


                  return (
                    <tr key={`${row.boothId}-${row.electionId}-${row.contestName}-${row.division}`} className="hover:bg-slate-50/50">
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-mono font-bold ${isTop3
                            ? 'bg-yellow-50 text-yellow-700 border border-yellow-250 shadow-sm font-semibold'
                            : 'bg-slate-100 text-slate-655 border border-slate-200'
                            }`}
                        >
                          {rank}
                        </span>
                      </td>
                      <td className="px-5 py-4 w-full">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-0.5">
                          <Link
                            to={`/booth/${row.boothId}`}
                            className="font-bold text-slate-900 hover:text-greens-600 transition-colors text-sm"
                          >
                            {row.boothName}
                          </Link>
                          <span className="text-slate-400 font-mono">-</span>
                          <Link 
                            to={`/election/${row.electionId}?contest=${`${row.contestName}-${row.division}`.toLowerCase().replace(/\s+/g, '-')}`} 
                            className="font-bold text-slate-900 hover:text-greens-600 transition-colors text-sm"
                          >
                            {getElectionDisplayName(row)}
                          </Link>
                          {row.boothType && row.boothType !== 'ordinary' && (
                            <span className={`border text-[9px] px-1 py-0.5 rounded font-bold font-mono uppercase tracking-wider whitespace-nowrap ${row.boothType === "pre-poll" ? "bg-amber-50 text-amber-700 border-amber-200" :
                              row.boothType === "postal" ? "bg-blue-50 text-blue-700 border-blue-200" :
                                row.boothType === "absent" ? "bg-purple-50 text-purple-700 border-purple-200" :
                                  "bg-rose-50 text-rose-700 border-rose-200"
                              }`}>
                              {row.boothType === "pre-poll" ? "Pre-Poll" :
                                row.boothType === "postal" ? "Postal" :
                                  row.boothType === "absent" ? "Absent" : "Declaration"}
                            </span>
                          )}
                        </div>
                      </td>
                       <td className={`px-5 py-4 font-mono font-bold text-greens-600 text-base transition-colors whitespace-nowrap ${
                        sortField === 'percentage' ? 'bg-greens-50/10 font-extrabold' : ''
                      }`}>
                        {row.greensPercentage.toFixed(2)}%
                      </td>
                      <td className={`px-5 py-4 font-mono font-semibold text-greens-700 transition-colors whitespace-nowrap ${
                        sortField === 'votes' ? 'bg-greens-50/10 font-bold' : ''
                      }`}>
                        {row.greensVotes.toLocaleString()}
                      </td>
                      <td className={`px-5 py-4 text-right font-mono text-slate-500 text-xs transition-colors whitespace-nowrap ${
                        sortField === 'totalVotes' ? 'bg-slate-50/30' : ''
                      }`}>
                        {row.totalVotes.toLocaleString()}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-slate-400 text-sm">
                    No records found matching current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {totalPages > 1 && (
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-mono">
              Showing {(currentPage - 1) * rowsPerPage + 1} to{' '}
              {Math.min(currentPage * rowsPerPage, sortedRows.length)} of {sortedRows.length} rows
            </span>
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="p-1.5 bg-white border border-slate-200 text-slate-700 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="p-1.5 bg-white border border-slate-200 text-slate-700 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
