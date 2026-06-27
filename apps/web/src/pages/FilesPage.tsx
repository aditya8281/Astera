import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import { COLORS } from '../constants'

export function FilesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['files'],
    queryFn: () => api.files(),
  })

  const files = data?.data || []

  return (
    <div className="h-full flex flex-col p-6">
      <h2 className="text-lg font-heading font-bold mb-4" style={{ color: COLORS.text }}>Indexed Files</h2>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(10)].map((_, i) => <div key={i} className="skeleton h-8 w-full" />)}
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <p className="text-[11px] mb-3" style={{ color: COLORS.textMuted }}>{files.length} files</p>
          <div className="space-y-0.5">
            {files.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-4 px-3 py-2 rounded transition-colors"
                style={{ color: COLORS.text }}
                onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.surfaceHover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span className="text-[10px] font-mono w-16 text-right" style={{ color: COLORS.relationship }}>{f.language}</span>
                <span className="text-xs font-mono flex-1 truncate">{f.relative_path}</span>
                <span className="text-[10px]" style={{ color: COLORS.textMuted }}>{f.line_count.toLocaleString()} lines</span>
                <span className="text-[10px]" style={{ color: COLORS.textMuted }}>{(f.size / 1024).toFixed(1)}KB</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
