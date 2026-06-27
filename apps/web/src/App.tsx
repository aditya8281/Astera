import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { COLORS } from './constants'

// Lazy-load pages — GraphPage pulls in Three.js (~1MB), keep it out of initial chunk
const GraphPage = lazy(() => import('./pages/GraphPage').then(m => ({ default: m.GraphPage })))
const SymbolsPage = lazy(() => import('./pages/SymbolsPage').then(m => ({ default: m.SymbolsPage })))
const FilesPage = lazy(() => import('./pages/FilesPage').then(m => ({ default: m.FilesPage })))
const MetricsPage = lazy(() => import('./pages/MetricsPage').then(m => ({ default: m.MetricsPage })))
const ImpactPage = lazy(() => import('./pages/ImpactPage').then(m => ({ default: m.ImpactPage })))

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-6 h-6 border-2 rounded-full animate-spin"
          style={{ borderColor: `${COLORS.selection}40`, borderTopColor: COLORS.selection }}
        />
        <span className="text-xs font-mono" style={{ color: COLORS.textMuted }}>Loading...</span>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Suspense fallback={<PageLoader />}><GraphPage /></Suspense>} />
        <Route path="/symbols" element={<Suspense fallback={<PageLoader />}><SymbolsPage /></Suspense>} />
        <Route path="/files" element={<Suspense fallback={<PageLoader />}><FilesPage /></Suspense>} />
        <Route path="/metrics" element={<Suspense fallback={<PageLoader />}><MetricsPage /></Suspense>} />
        <Route path="/impact" element={<Suspense fallback={<PageLoader />}><ImpactPage /></Suspense>} />
      </Route>
    </Routes>
  )
}
