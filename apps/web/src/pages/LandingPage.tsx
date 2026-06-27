import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import { COLORS } from '../constants'
import { CopyIcon, CheckIcon, GraphIcon, ImpactIcon, MetricsIcon, GithubIcon, ArrowRightIcon } from '../components/Common/Icons'

// ─── Language icons (SVG inline) ───

const LANGUAGES = [
  { name: 'TypeScript', abbr: 'TS', color: '#3178C6' },
  { name: 'JavaScript', abbr: 'JS', color: '#F7DF1E' },
  { name: 'Python', abbr: 'PY', color: '#3776AB' },
  { name: 'Rust', abbr: 'RS', color: '#CE412B' },
  { name: 'Go', abbr: 'GO', color: '#00ADD8' },
  { name: 'C', abbr: 'C', color: '#888888' },
  { name: 'C++', abbr: 'C+', color: '#659AD2' },
  { name: 'Java', abbr: 'JV', color: '#ED8B00' },
]

const FEATURES: Array<{ icon: ReactNode; title: string; desc: string }> = [
  {
    icon: <GraphIcon size={20} color={COLORS.textMuted} />,
    title: 'Parse',
    desc: 'Tree-sitter powers symbol extraction across 8 languages. Error-tolerant, incremental, fast.',
  },
  {
    icon: <ImpactIcon size={20} color={COLORS.textMuted} />,
    title: 'Explore',
    desc: 'Interactive 3D knowledge graph. Drill down into modules, trace call paths, find clusters.',
  },
  {
    icon: <MetricsIcon size={20} color={COLORS.textMuted} />,
    title: 'Analyze',
    desc: 'Cyclomatic complexity, coupling metrics, circular dependency detection, change impact analysis.',
  },
]

const STEPS = [
  { cmd: 'cargo install astera', label: 'Install' },
  { cmd: 'astera index .', label: 'Index your repo' },
  { cmd: 'astera serve', label: 'Explore in browser' },
]

// ─── Mini 3D graph for hero ───

function MiniGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width * 0.5
    const h = canvas.height * 0.5

    const nodes: Array<{
      x: number; y: number; vx: number; vy: number
      r: number; cluster: number; opacity: number
    }> = []

    const clusterCenters = [
      { x: w * 0.3, y: h * 0.4 },
      { x: w * 0.7, y: h * 0.35 },
      { x: w * 0.5, y: h * 0.7 },
    ]

    for (let i = 0; i < 40; i++) {
      const cluster = i % 3
      const center = clusterCenters[cluster]
      nodes.push({
        x: center.x + (Math.random() - 0.5) * w * 0.25,
        y: center.y + (Math.random() - 0.5) * h * 0.2,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        r: 1.5 + Math.random() * 2,
        cluster,
        opacity: 0.3 + Math.random() * 0.5,
      })
    }

    const edges: Array<{ from: number; to: number }> = []
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (nodes[j].cluster === nodes[i].cluster && Math.random() < 0.15) {
          edges.push({ from: i, to: j })
        }
      }
      if (Math.random() < 0.03) {
        const otherCluster = (nodes[i].cluster + 1 + Math.floor(Math.random() * 2)) % 3
        const candidates = nodes
          .map((n, idx) => ({ n, idx }))
          .filter(x => x.n.cluster === otherCluster)
        if (candidates.length) {
          const target = candidates[Math.floor(Math.random() * candidates.length)]
          edges.push({ from: i, to: target.idx })
        }
      }
    }

    let t = 0
    const draw = () => {
      t += 0.005
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      ctx.lineWidth = 0.5
      for (const edge of edges) {
        const a = nodes[edge.from]
        const b = nodes[edge.to]
        const pulse = 0.06 + 0.04 * Math.sin(t * 2 + edge.from * 0.3)
        ctx.strokeStyle = `rgba(89,246,255,${pulse})`
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      }

      for (const node of nodes) {
        node.x += node.vx
        node.y += node.vy

        if (node.x < w * 0.1 || node.x > w * 0.9) node.vx *= -1
        if (node.y < h * 0.1 || node.y > h * 0.9) node.vy *= -1

        const center = clusterCenters[node.cluster]
        node.vx += (center.x - node.x) * 0.0001
        node.vy += (center.y - node.y) * 0.0001

        node.vx *= 0.999
        node.vy *= 0.999

        const pulse = 0.8 + 0.2 * Math.sin(t * 3 + node.x * 0.1)
        const alpha = node.opacity * pulse
        ctx.fillStyle = `rgba(167,181,201,${alpha})`
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2)
        ctx.fill()
      }

      animRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animRef.current)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={400}
      className="w-full h-full"
      style={{ imageRendering: 'auto' }}
    />
  )
}

// ─── Main landing page ───

export function LandingPage() {
  const navigate = useNavigate()
  const [copied, setCopied] = useState<number | null>(null)

  const { data: statsData } = useQuery({
    queryKey: ['stats-check'],
    queryFn: () => api.stats(),
    retry: false,
  })

  const stats = statsData?.data

  const copyCmd = (cmd: string, index: number) => {
    navigator.clipboard.writeText(cmd).catch(() => {})
    setCopied(index)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="h-full overflow-y-auto" style={{ background: COLORS.bg }}>
      {/* ─── Hero ─── */}
      <section className="relative flex flex-col items-center justify-center min-h-[70vh] px-6">
        <div className="absolute inset-0 overflow-hidden" style={{ opacity: 0.5 }}>
          <MiniGraph />
        </div>

        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at center, transparent 30%, ${COLORS.bg} 80%)`,
          }}
        />

        <div className="relative z-10 flex flex-col items-center text-center max-w-2xl">
          <h1
            className="font-heading font-bold tracking-tight mb-3"
            style={{
              fontSize: 'clamp(2.5rem, 5vw, 3.5rem)',
              color: COLORS.text,
              letterSpacing: '-0.03em',
              textWrap: 'balance',
            }}
          >
            astera
          </h1>

          <p
            className="text-sm mb-8 max-w-md"
            style={{ color: COLORS.textMuted, lineHeight: 1.7, textWrap: 'pretty' }}
          >
            Local-first static analysis engine. Parses your codebase into a queryable
            code property graph and lets you explore it in 3D.
          </p>

          {/* Install command */}
          <div className="flex items-center gap-2 mb-6">
            <div
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg font-mono text-sm"
              style={{
                background: COLORS.surfaceDim,
                border: `1px solid ${COLORS.border}`,
                color: COLORS.text,
              }}
            >
              <span style={{ color: COLORS.textDim }}>$</span>
              <span>cargo install astera</span>
            </div>
            <button
              onClick={() => copyCmd('cargo install astera', 0)}
              aria-label="Copy install command"
              className="px-3 py-2.5 rounded-lg text-xs transition-colors"
              style={{
                background: COLORS.surfaceDim,
                border: `1px solid ${COLORS.border}`,
                color: copied === 0 ? COLORS.success : COLORS.textMuted,
              }}
            >
              {copied === 0 ? <CheckIcon size={14} color={COLORS.success} /> : <CopyIcon size={14} />}
            </button>
          </div>

          {/* GitHub link */}
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/astera-dev/astera"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono transition-colors"
              style={{
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                color: COLORS.textMuted,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = COLORS.surfaceHover
                e.currentTarget.style.color = COLORS.text
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = COLORS.textMuted
              }}
            >
              <GithubIcon size={14} />
              <span>github.com/astera-dev/astera</span>
            </a>

            <span
              className="text-[10px] font-mono px-2 py-1 rounded"
              style={{
                background: `${COLORS.success}10`,
                color: COLORS.success,
                border: `1px solid ${COLORS.success}20`,
              }}
            >
              MIT License
            </span>
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="px-6 py-16 max-w-3xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex flex-col gap-2">
              {f.icon}
              <h3
                className="font-heading font-bold text-sm"
                style={{ color: COLORS.text }}
              >
                {f.title}
              </h3>
              <p
                className="text-xs leading-relaxed"
                style={{ color: COLORS.textMuted, textWrap: 'pretty' }}
              >
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Languages ─── */}
      <section className="px-6 py-12" style={{ background: COLORS.surfaceDim }}>
        <div className="max-w-3xl mx-auto">
          <h2
            className="font-heading font-bold text-sm text-center mb-8"
            style={{ color: COLORS.text }}
          >
            8 languages. One graph.
          </h2>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
            {LANGUAGES.map((lang) => (
              <div
                key={lang.name}
                className="flex flex-col items-center gap-1.5 py-3 rounded-lg transition-colors"
                style={{
                  background: COLORS.surface,
                  border: `1px solid ${COLORS.border}`,
                }}
              >
                <span
                  className="font-mono text-xs font-semibold"
                  style={{ color: lang.color }}
                >
                  {lang.abbr}
                </span>
                <span
                  className="text-[9px]"
                  style={{ color: COLORS.textDim }}
                >
                  {lang.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Quick start ─── */}
      <section className="px-6 py-16 max-w-3xl mx-auto">
        <h2
          className="font-heading font-bold text-sm text-center mb-8"
          style={{ color: COLORS.text }}
        >
          Three commands. Your codebase, visualized.
        </h2>
        <div className="space-y-3">
          {STEPS.map((step, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-4 py-3 rounded-lg"
              style={{
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
              }}
            >
              <span
                className="font-mono text-[10px] tracking-wider flex-shrink-0 uppercase"
                style={{ color: COLORS.textDim, width: '48px' }}
              >
                {step.label}
              </span>
              <div className="flex-1 min-w-0">
                <code
                  className="font-mono text-xs block truncate"
                  style={{ color: COLORS.text }}
                >
                  {step.cmd}
                </code>
              </div>
              <button
                onClick={() => copyCmd(step.cmd, i + 1)}
                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono transition-colors flex-shrink-0"
                style={{
                  color: copied === i + 1 ? COLORS.success : COLORS.textDim,
                  background: 'transparent',
                }}
              >
                {copied === i + 1 ? <><CheckIcon size={10} color={COLORS.success} /> copied</> : <><CopyIcon size={10} /> copy</>}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Live demo CTA ─── */}
      {stats && (
        <section className="px-6 py-12">
          <div className="max-w-3xl mx-auto text-center">
            <div
              className="inline-flex items-center gap-4 px-6 py-4 rounded-xl cursor-pointer transition-colors"
              style={{
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
              }}
              onClick={() => navigate('/graph')}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/graph') }}
              onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.surfaceHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = COLORS.surface)}
              role="button"
              tabIndex={0}
            >
              <GraphIcon size={20} color={COLORS.textMuted} />
              <div className="text-left">
                <div className="text-sm font-heading font-bold" style={{ color: COLORS.text }}>
                  Index loaded — explore now
                </div>
                <div className="text-[11px] font-mono" style={{ color: COLORS.textMuted }}>
                  {stats.symbols.toLocaleString()} symbols · {stats.files.toLocaleString()} files · {stats.edges.toLocaleString()} edges
                </div>
              </div>
              <ArrowRightIcon size={16} color={COLORS.textMuted} />
            </div>
          </div>
        </section>
      )}

      {/* ─── Footer ─── */}
      <footer
        className="px-6 py-8 mt-8"
        style={{ borderTop: `1px solid ${COLORS.border}` }}
      >
        <div className="max-w-3xl mx-auto flex items-center justify-between text-[10px] font-mono" style={{ color: COLORS.textDim }}>
          <span>Built with Rust + React</span>
          <span>Astera v0.1.0</span>
        </div>
      </footer>
    </div>
  )
}
