import { HashRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Home as HomeIcon, Trophy, Vote, BarChart3 } from 'lucide-react';
import Home from './pages/Home';
import BoothDetail from './pages/BoothDetail';
import Leaderboard from './pages/Leaderboard';
import ElectionLeaderboard from './pages/ElectionLeaderboard';
import Completeness from './pages/Completeness';
import ElectionDetail from './pages/ElectionDetail';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
        {/* Navigation Header */}
        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-250/70 px-4 py-3 shadow-sm">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-greens-600 hover:text-greens-700 transition-colors">
              <Vote className="w-6 h-6 text-greens-600" />
              <span className="font-extrabold text-lg tracking-tight text-slate-900 font-mono">
                NEWY<span className="text-greens-600">BOOTH</span>
              </span>
            </Link>
            <nav className="flex gap-4">
              <Link
                to="/"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all"
              >
                <HomeIcon className="w-4 h-4 text-greens-600" />
                <span>Home</span>
              </Link>
              <Link
                to="/leaderboard"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all"
              >
                <Trophy className="w-4 h-4 text-yellow-600" />
                <span>Booth Leaderboard</span>
              </Link>
              <Link
                to="/election-leaderboard"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all"
              >
                <BarChart3 className="w-4 h-4 text-greens-600" />
                <span>Elections Leaderboard</span>
              </Link>
            </nav>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/booth/:id" element={<BoothDetail />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/election-leaderboard" element={<ElectionLeaderboard />} />
            <Route path="/completeness" element={<Completeness />} />
            <Route path="/election/:id" element={<ElectionDetail />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
          <p>Data compiled by Madeleine Ham •{' '}
            <Link to="/completeness" className="text-greens-600 hover:underline font-semibold">
              Booth Matrix
            </Link>
          </p>
        </footer>
      </div>
    </Router>
  );
}

export default App;
