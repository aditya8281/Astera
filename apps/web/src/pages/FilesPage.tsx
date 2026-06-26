import { useQuery } from '@tanstack/react-query'
import { api } from '../api'

export function FilesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['files'],
    queryFn: () => api.files(),
  })

  const files = data?.data || []

  return (
    <div className="h-full flex flex-col p-6">
      <h2 className="text-lg font-semibold text-text-primary mb-4">Indexed Files</h2>

      {isLoading ? (
        <div className="text-text-muted text-sm animate-pulse">Loading…</div>
      ) : (
        <div className="flex-1 overflow-auto">
          <p className="text-[11px] text-text-muted mb-3">{files.length} files</p>
          <div className="space-y-1">
            {files.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-4 px-3 py-2 rounded bg-bg-surface hover:bg-bg-card transition-colors"
              >
                <span className="text-[10px] text-accent-cyan font-mono w-16 text-right">
                  {f.language}
                </span>
                <span className="text-xs text-text-primary font-mono flex-1 truncate">
                  {f.relative_path}
                </span>
                <span className="text-[10px] text-text-muted">
                  {f.line_count.toLocaleString()} lines
                </span>
                <span className="text-[10px] text-text-muted">
                  {(f.size / 1024).toFixed(1)}KB
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
