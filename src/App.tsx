import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Home as HomeIcon, Trophy, BarChart3 } from 'lucide-react';

const Home = lazy(() => import('./pages/Home'));
const BoothDetail = lazy(() => import('./pages/BoothDetail'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const ElectionLeaderboard = lazy(() => import('./pages/ElectionLeaderboard'));
const Completeness = lazy(() => import('./pages/Completeness'));
const ElectionDetail = lazy(() => import('./pages/ElectionDetail'));

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function App() {
  return (
    <Router>
      <ScrollToTop />
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
        {/* Navigation Header */}
        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-250/70 px-4 py-3 shadow-sm">
          <div className="max-w-6xl mx-auto flex items-center justify-center">
            <nav className="flex gap-2 sm:gap-4 justify-center items-center">
              <Link
                to="/"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all"
              >
                <HomeIcon className="w-4 h-4 text-greens-600 shrink-0" />
                <span>Home</span>
              </Link>
              <Link
                to="/leaderboard"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all"
              >
                <Trophy className="w-4 h-4 text-yellow-600 shrink-0" />
                <span>Leaderboard</span>
              </Link>
              <Link
                to="/election-leaderboard"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all"
              >
                <BarChart3 className="w-4 h-4 text-greens-600 shrink-0" />
                <span>Elections</span>
              </Link>
            </nav>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6">
          <Suspense fallback={
            <div className="flex items-center justify-center min-h-[50vh]">
              <div className="w-8 h-8 border-4 border-greens-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          }>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/booth/:id" element={<BoothDetail />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/election-leaderboard" element={<ElectionLeaderboard />} />
              <Route path="/completeness" element={<Completeness />} />
              <Route path="/election/:id" element={<ElectionDetail />} />
            </Routes>
          </Suspense>
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
