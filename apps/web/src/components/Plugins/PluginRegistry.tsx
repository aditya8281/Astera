import { useState, useEffect, useCallback } from 'react'
import { COLORS } from '../../constants'

// ─── Plugin types (mirrors backend astera-plugins) ───

export interface PluginMeta {
  name: string
  version: string
  description: string
  author: string
  kind: 'Native' | 'Wasm' | 'BuiltIn'
}

export interface PluginFinding {
  severity: 'Info' | 'Warning' | 'Error' | 'Critical'
  message: string
  file: string | null
  line: number | null
  symbol: string | null
  rule: string
}

export interface PluginOutput {
  plugin: string
  findings: PluginFinding[]
}

// ─── Severity colors (on-palette) ───

const SEVERITY_COLORS: Record<string, string> = {
  Info: '#60a5fa',
  Warning: COLORS.warning,
  Error: COLORS.error,
  Critical: '#DC2626',
}

const SEVERITY_ICONS: Record<string, string> = {
  Info: 'ℹ',
  Warning: '⚠',
  Error: '✕',
  Critical: ' !!',
}

const KIND_BADGES: Record<string, { bg: string; text: string }> = {
  BuiltIn: { bg: 'rgba(89,246,255,0.10)', text: COLORS.accent },
  Native: { bg: 'rgba(74,222,128,0.10)', text: COLORS.success },
  Wasm: { bg: `${COLORS.warning}15`, text: COLORS.warning },
}

// ─── Plugin Registry Panel ───

export function PluginRegistry() {
  const [plugins, setPlugins] = useState<PluginMeta[]>([])
  const [findings, setFindings] = useState<PluginOutput[]>([])
  const [running, setRunning] = useState(false)
  const [expandedPlugin, setExpandedPlugin] = useState<string | null>(null)

  // Fetch registered plugins
  useEffect(() => {
    fetch('/api/plugins')
      .then((r) => r.json())
      .then((data) => {
        if (data.plugins) setPlugins(data.plugins)
      })
      .catch(() => {
        setPlugins([
          {
            name: 'pattern-checker',
            version: '1.0.0',
            description: 'Built-in pattern checker for code quality rules',
            author: 'Astera',
            kind: 'BuiltIn',
          },
          {
            name: 'metrics-summary',
            version: '1.0.0',
            description: 'Built-in plugin that computes aggregate code metrics',
            author: 'Astera',
            kind: 'BuiltIn',
          },
        ])
      })
  }, [])

  const runPlugins = useCallback(async () => {
    setRunning(true)
    try {
      const res = await fetch('/api/plugins/run', { method: 'POST' })
      const data = await res.json()
      if (data.results) setFindings(data.results)
    } catch {
      setFindings([])
    }
    setRunning(false)
  }, [])

  const totalFindings = findings.reduce((sum, f) => sum + f.findings.length, 0)
  const criticalCount = findings.reduce(
    (sum, f) => sum + f.findings.filter((x) => x.severity === 'Critical').length,
    0
  )
  const warningCount = findings.reduce(
    (sum, f) => sum + f.findings.filter((x) => x.severity === 'Warning').length,
    0
  )

  return (
    <div className="p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-heading font-semibold" style={{ color: COLORS.text }}>
          Plugin Registry
        </h3>
        <button
          onClick={runPlugins}
          disabled={running}
          className="px-3 py-1.5 rounded text-xs font-mono transition-colors"
          style={{
            background: running ? `${COLORS.accent}10` : `${COLORS.accent}18`,
            border: `1px solid ${COLORS.accent}30`,
            color: COLORS.accent,
            cursor: running ? 'wait' : 'pointer',
          }}
        >
          {running ? '⟳ Running...' : '▶ Run All'}
        </button>
      </div>

      {/* Summary bar */}
      {findings.length > 0 && (
        <div
          className="flex gap-3 px-3 py-2 rounded text-xs font-mono"
          style={{ background: `${COLORS.surface}`, border: `1px solid ${COLORS.border}` }}
        >
          <span style={{ color: COLORS.text }}>{totalFindings} findings</span>
          {criticalCount > 0 && (
            <span style={{ color: SEVERITY_COLORS.Critical }}>
              {criticalCount} critical
            </span>
          )}
          {warningCount > 0 && (
            <span style={{ color: SEVERITY_COLORS.Warning }}>
              {warningCount} warnings
            </span>
          )}
        </div>
      )}

      {/* Plugin list */}
      <div className="space-y-2">
        {plugins.map((plugin) => {
          const badge = KIND_BADGES[plugin.kind] || KIND_BADGES.BuiltIn
          const pluginFindings = findings.find((f) => f.plugin === plugin.name)
          const isExpanded = expandedPlugin === plugin.name

          return (
            <div
              key={plugin.name}
              className="rounded-lg overflow-hidden"
              style={{ background: `${COLORS.surface}`, border: `1px solid ${COLORS.border}` }}
            >
              {/* Plugin header */}
              <button
                onClick={() => setExpandedPlugin(isExpanded ? null : plugin.name)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors"
                onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.surfaceHover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span className="text-xs font-medium flex-1" style={{ color: COLORS.text }}>
                  {plugin.name}
                </span>

                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono"
                  style={{ background: badge.bg, color: badge.text }}
                >
                  {plugin.kind}
                </span>

                <span className="text-[11px] font-mono" style={{ color: COLORS.textMuted }}>
                  v{plugin.version}
                </span>

                {pluginFindings && pluginFindings.findings.length > 0 && (
                  <span
                    className="px-1.5 py-0.5 rounded-full text-[11px] font-mono"
                    style={{ background: `${COLORS.surfaceDim}`, color: COLORS.text }}
                  >
                    {pluginFindings.findings.length}
                  </span>
                )}

                <span className="text-[10px]" style={{ color: COLORS.textDim }}>
                  {isExpanded ? '▾' : '▸'}
                </span>
              </button>

              {/* Expanded: findings */}
              {isExpanded && pluginFindings && pluginFindings.findings.length > 0 && (
                <div
                  className="px-3 py-2 space-y-1"
                  style={{ borderTop: `1px solid ${COLORS.border}` }}
                >
                  <p className="text-[11px] mb-2" style={{ color: COLORS.textMuted }}>
                    {plugin.description}
                  </p>
                  {pluginFindings.findings.slice(0, 20).map((finding, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-1.5 py-1 text-xs font-mono"
                      style={{ borderBottom: `1px solid ${COLORS.border}` }}
                    >
                      <span
                        className="flex-shrink-0 text-[11px]"
                        style={{ color: SEVERITY_COLORS[finding.severity] }}
                      >
                        {SEVERITY_ICONS[finding.severity]}
                      </span>
                      <span className="flex-1 break-words" style={{ color: COLORS.text }}>
                        {finding.message}
                      </span>
                      {finding.line && (
                        <span className="text-[10px] flex-shrink-0" style={{ color: COLORS.textDim }}>
                          L{finding.line}
                        </span>
                      )}
                    </div>
                  ))}
                  {pluginFindings.findings.length > 20 && (
                    <p className="text-[11px] mt-1" style={{ color: COLORS.textMuted }}>
                      +{pluginFindings.findings.length - 20} more
                    </p>
                  )}
                </div>
              )}

              {isExpanded && (!pluginFindings || pluginFindings.findings.length === 0) && (
                <div
                  className="px-3 py-3"
                  style={{ borderTop: `1px solid ${COLORS.border}` }}
                >
                  <p className="text-[11px]" style={{ color: COLORS.textMuted }}>
                    {plugin.description}
                  </p>
                  <p className="text-[11px] mt-2 italic" style={{ color: COLORS.textDim }}>
                    No findings yet — click "Run All" to execute
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
