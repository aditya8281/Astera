import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import { COLORS } from '../../constants'

export function FilesPanel() {
  const [filter, setFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['files-panel'],
    queryFn: () => api.files(),
  })

  const files = (data?.data || []).filter(f =>
    !filter || f.relative_path.toLowerCase().includes(filter.toLowerCase())
  )

  // Group by language
  const byLang = new Map<string, typeof files>()
  for (const f of files) {
    if (!byLang.has(f.language)) byLang.set(f.language, [])
    byLang.get(f.language)!.push(f)
  }

  return (
    <div className="p-3 space-y-3">
      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter files..."
        className="w-full px-3 py-2 rounded text-xs font-mono outline-none"
        style={{ background: COLORS.bg, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
        autoFocus
      />

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-8 w-full" />)}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-[10px] font-mono px-2" style={{ color: COLORS.textDim }}>
            {files.length} files · {byLang.size} languages
          </div>

          {[...byLang.entries()].map(([lang, langFiles]) => (
            <div key={lang}>
              <div className="text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-1" style={{ color: COLORS.textMuted }}>
                {lang} ({langFiles.length})
              </div>
              <div className="space-y-0.5">
                {langFiles.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded transition-colors cursor-default"
                    style={{ color: COLORS.text }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.surfaceHover)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span className="text-[10px] font-mono truncate flex-1">{f.relative_path}</span>
                    <span className="text-[10px]" style={{ color: COLORS.textDim }}>{f.line_count}L</span>
                    <span className="text-[10px]" style={{ color: COLORS.textDim }}>{(f.size / 1024).toFixed(1)}K</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
