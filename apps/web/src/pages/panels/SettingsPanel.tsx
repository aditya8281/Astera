import { useUIStore } from '../../store'
import { COLORS } from '../../constants'
import type { Settings } from '../../types'

export function SettingsPanel() {
  const settings = useUIStore((s) => s.settings)
  const updateSettings = useUIStore((s) => s.updateSettings)

  return (
    <div className="p-3 space-y-5">
      {/* Layout engine */}
      <SettingGroup label="Layout Engine">
        <select
          value={settings.layoutEngine}
          onChange={(e) => updateSettings({ layoutEngine: e.target.value as Settings['layoutEngine'] })}
          aria-label="Layout engine"
          className="w-full px-2 py-1.5 rounded text-xs font-mono outline-none cursor-pointer"
          style={{ background: COLORS.bg, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
        >
          <option value="force">Force-directed</option>
          <option value="hierarchical">Hierarchical</option>
          <option value="radial">Radial</option>
          <option value="dagre">DAG</option>
          <option value="circular">Circular</option>
        </select>
      </SettingGroup>

      {/* Graph type */}
      <SettingGroup label="Graph Type">
        <select
          value={settings.graphType}
          onChange={(e) => updateSettings({ graphType: e.target.value as Settings['graphType'] })}
          aria-label="Graph type"
          className="w-full px-2 py-1.5 rounded text-xs font-mono outline-none cursor-pointer"
          style={{ background: COLORS.bg, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
        >
          <option value="dependency">Dependency</option>
          <option value="call">Call Graph</option>
          <option value="tree">Tree</option>
          <option value="circular-deps">Circular Dependencies</option>
        </select>
      </SettingGroup>

      {/* Edge animation */}
      <SettingGroup label="Edge Animation">
        <div className="flex gap-1">
          {(['none', 'glow', 'dots', 'both'] as const).map((v) => (
            <button
              key={v}
              onClick={() => updateSettings({ edgeAnimation: v })}
              className="flex-1 px-2 py-1.5 rounded text-[10px] font-mono capitalize transition-colors"
              style={{
                background: settings.edgeAnimation === v ? `${COLORS.selection}20` : COLORS.bg,
                color: settings.edgeAnimation === v ? COLORS.selection : COLORS.textMuted,
                border: `1px solid ${settings.edgeAnimation === v ? COLORS.selection : COLORS.border}`,
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </SettingGroup>

      {/* Camera speed */}
      <SettingGroup label="Camera Speed">
        <div className="flex gap-1">
          {(['slow', 'normal', 'fast'] as const).map((v) => (
            <button
              key={v}
              onClick={() => updateSettings({ cameraSpeed: v })}
              className="flex-1 px-2 py-1.5 rounded text-[10px] font-mono capitalize transition-colors"
              style={{
                background: settings.cameraSpeed === v ? `${COLORS.selection}20` : COLORS.bg,
                color: settings.cameraSpeed === v ? COLORS.selection : COLORS.textMuted,
                border: `1px solid ${settings.cameraSpeed === v ? COLORS.selection : COLORS.border}`,
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </SettingGroup>

      {/* Particle density */}
      <SettingGroup label="Background Particles">
        <div className="flex gap-1">
          {(['off', 'light', 'medium', 'heavy'] as const).map((v) => (
            <button
              key={v}
              onClick={() => updateSettings({ particleDensity: v })}
              className="flex-1 px-2 py-1.5 rounded text-[10px] font-mono capitalize transition-colors"
              style={{
                background: settings.particleDensity === v ? `${COLORS.selection}20` : COLORS.bg,
                color: settings.particleDensity === v ? COLORS.selection : COLORS.textMuted,
                border: `1px solid ${settings.particleDensity === v ? COLORS.selection : COLORS.border}`,
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </SettingGroup>

      {/* Toggles */}
      <SettingGroup label="Display">
        <div className="space-y-2">
          <Toggle label="Show labels" checked={settings.showLabels} onChange={(v) => updateSettings({ showLabels: v })} />
          <Toggle label="Edge highlight on select" checked={settings.edgeHighlightOnSelect} onChange={(v) => updateSettings({ edgeHighlightOnSelect: v })} />
          <Toggle label="Reduced motion" checked={settings.reducedMotion} onChange={(v) => updateSettings({ reducedMotion: v })} />
          <Toggle label="Performance telemetry" checked={settings.showPerformanceTelemetry} onChange={(v) => updateSettings({ showPerformanceTelemetry: v })} />
        </div>
      </SettingGroup>
    </div>
  )
}

function SettingGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-mono uppercase tracking-wider font-semibold" style={{ color: COLORS.textDim }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer group">
      <span className="text-xs" style={{ color: COLORS.textMuted }}>{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative w-8 h-4 rounded-full transition-colors"
        style={{ background: checked ? COLORS.selection : COLORS.border }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-3 h-3 rounded-full transition-transform"
          style={{
            background: checked ? COLORS.text : COLORS.textDim,
            transform: checked ? 'translateX(16px)' : 'translateX(0)',
          }}
        />
      </button>
    </label>
  )
}
