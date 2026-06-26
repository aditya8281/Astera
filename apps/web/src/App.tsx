import { Routes, Route } from 'react-router-dom'
import { GraphPage } from './pages/GraphPage'
import { SymbolsPage } from './pages/SymbolsPage'
import { FilesPage } from './pages/FilesPage'
import { Layout } from './components/Layout'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<GraphPage />} />
        <Route path="/symbols" element={<SymbolsPage />} />
        <Route path="/files" element={<FilesPage />} />
      </Route>
    </Routes>
  )
}
