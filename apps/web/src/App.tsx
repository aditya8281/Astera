import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { GraphPage } from './pages/GraphPage'
import { SymbolsPage } from './pages/SymbolsPage'
import { FilesPage } from './pages/FilesPage'
import { MetricsPage } from './pages/MetricsPage'
import { ImpactPage } from './pages/ImpactPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<GraphPage />} />
        <Route path="/symbols" element={<SymbolsPage />} />
        <Route path="/files" element={<FilesPage />} />
        <Route path="/metrics" element={<MetricsPage />} />
        <Route path="/impact" element={<ImpactPage />} />
      </Route>
    </Routes>
  )
}
