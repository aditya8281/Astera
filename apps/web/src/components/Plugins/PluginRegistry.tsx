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

// ─── Severity colors ───

const SEVERITY_COLORS: Record<string, string> = {
  Info: '#60a5fa',
  Warning: '#fbbf24',
  Error: '#f87171',
  Critical: '#dc2626',
}

const SEVERITY_ICONS: Record<string, string> = {
  Info: 'ℹ',
  Warning: '⚠',
  Error: '✕',
  Critical: ' !!',
}

const KIND_BADGES: Record<string, { bg: string; text: string }> = {
  BuiltIn: { bg: 'rgba(96,165,250,0.15)', text: '#60a5fa' },
  Native: { bg: 'rgba(52,211,153,0.15)', text: '#34d399' },
  Wasm: { bg: 'rgba(251,191,36,0.15)', text: '#fbbf24' },
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
        // Plugin endpoint not available — show built-in defaults
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
    <div style={{ padding: '16px', height: '100%', overflow: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, color: COLORS.text, fontSize: '14px', fontWeight: 600 }}>
          Plugin Registry
        </h3>
        <button
          onClick={runPlugins}
          disabled={running}
          style={{
            background: running ? 'rgba(0,255,136,0.1)' : 'rgba(0,255,136,0.2)',
            border: '1px solid rgba(0,255,136,0.3)',
            borderRadius: '6px',
            color: COLORS.accent,
            padding: '4px 12px',
            fontSize: '12px',
            cursor: running ? 'wait' : 'pointer',
            fontFamily: 'monospace',
          }}
        >
          {running ? '⟳ Running...' : '▶ Run All'}
        </button>
      </div>

      {/* Summary bar */}
      {findings.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '16px',
            padding: '8px 12px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '6px',
            fontSize: '12px',
            fontFamily: 'monospace',
          }}
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {plugins.map((plugin) => {
          const badge = KIND_BADGES[plugin.kind] || KIND_BADGES.BuiltIn
          const pluginFindings = findings.find((f) => f.plugin === plugin.name)
          const isExpanded = expandedPlugin === plugin.name

          return (
            <div
              key={plugin.name}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '8px',
                overflow: 'hidden',
              }}
            >
              {/* Plugin header */}
              <div
                onClick={() => setExpandedPlugin(isExpanded ? null : plugin.name)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 12px',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ color: COLORS.text, fontSize: '13px', fontWeight: 500, flex: 1 }}>
                  {plugin.name}
                </span>

                <span
                  style={{
                    background: badge.bg,
                    color: badge.text,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontFamily: 'monospace',
                  }}
                >
                  {plugin.kind}
                </span>

                <span style={{ color: COLORS.muted, fontSize: '11px', fontFamily: 'monospace' }}>
                  v{plugin.version}
                </span>

                {pluginFindings && pluginFindings.findings.length > 0 && (
                  <span
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      color: COLORS.text,
                      padding: '1px 6px',
                      borderRadius: '10px',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                    }}
                  >
                    {pluginFindings.findings.length}
                  </span>
                )}

                <span style={{ color: COLORS.muted, fontSize: '10px' }}>
                  {isExpanded ? '▾' : '▸'}
                </span>
              </div>

              {/* Expanded: findings */}
              {isExpanded && pluginFindings && pluginFindings.findings.length > 0 && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '8px 12px' }}>
                  <p style={{ margin: '0 0 8px', color: COLORS.muted, fontSize: '11px' }}>
                    {plugin.description}
                  </p>
                  {pluginFindings.findings.slice(0, 20).map((finding, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '6px',
                        padding: '4px 0',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                      }}
                    >
                      <span
                        style={{
                          color: SEVERITY_COLORS[finding.severity],
                          minWidth: '14px',
                          fontSize: '11px',
                        }}
                      >
                        {SEVERITY_ICONS[finding.severity]}
                      </span>
                      <span style={{ color: COLORS.text, flex: 1, wordBreak: 'break-word' }}>
                        {finding.message}
                      </span>
                      {finding.line && (
                        <span style={{ color: COLORS.muted, fontSize: '10px' }}>
                          L{finding.line}
                        </span>
                      )}
                    </div>
                  ))}
                  {pluginFindings.findings.length > 20 && (
                    <p style={{ margin: '4px 0 0', color: COLORS.muted, fontSize: '11px' }}>
                      +{pluginFindings.findings.length - 20} more
                    </p>
                  )}
                </div>
              )}

              {isExpanded && (!pluginFindings || pluginFindings.findings.length === 0) && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '12px' }}>
                  <p style={{ margin: 0, color: COLORS.muted, fontSize: '11px' }}>
                    {plugin.description}
                  </p>
                  <p style={{ margin: '8px 0 0', color: COLORS.muted, fontSize: '11px', fontStyle: 'italic' }}>
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
