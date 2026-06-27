# Astera Frontend Redesign Specification

**Date:** 2026-06-27
**Status:** Approved by user
**Scope:** Complete redesign of the React + Three.js frontend

---

## Vision

The most performant, information-dense code visualization tool ever built. Not a pretty graph — a living instrument for understanding code at any scale.

## Goals

1. **10K+ nodes at 60fps** — no compromise
2. **Instant navigation** — any node reachable in ≤3 interactions
3. **Progressive disclosure** — complexity revealed on demand, never dumped
4. **Semantic richness** — every visual element encodes meaning
5. **Extensible** — plugin architecture from day one

---

## Performance Targets

| Budget | Target |
|---|---|
| Frame time | ≤16ms (60fps) |
| CPU per frame | <5ms |
| GPU per frame | <8ms |
| Main thread blocking | <4ms |
| Memory cap | <500MB |
| Draw calls | <50 |
| Initial load | <2s |
| Progressive load | <500ms per level |
| Search latency | <100ms |
| API response | <200ms |

---

## Interaction Principles

**Clarity over decoration.** Every pixel serves understanding.
**Progressive complexity.** Simple by default, powerful on demand.
**Consistent physics.** One interpolation system, one timing scale.
**Selection is primary.** Everything derives from what the user has selected.
**Keyboard-first.** Every action has a key binding. Mouse is optional.

---

## Semantic Color System

| Token | Color | Usage |
|---|---|---|
| `--color-selection` | Deep Orange `#E65100` | Selected nodes, active states, sidebar highlight |
| `--color-relationship` | Electric Cyan `#00E5FF` | All edges, connections, call/dependency lines |
| `--color-success` | Emerald `#00E676` | Healthy metrics, low complexity, no circular deps |
| `--color-error` | Red `#FF1744` | Errors, high complexity, circular dependencies |
| `--color-ai` | Violet `#B388FF` | AI suggestions, insights, risk analysis (reserved) |
| `--color-inactive` | Gray `#555555` | Dimmed nodes, disabled states, background elements |
| `--color-warning` | Amber `#FFD740` | Medium complexity, attention needed |
| `--color-bg` | Warm Black `#0D0D0D` | Primary background |
| `--color-surface` | `#151515` | Elevated panels, cards |
| `--color-surface-dim` | `#111111` | Subtle elevation |
| `--color-border` | `#222222` | Separators |
| `--color-text` | `#F0F0F0` | Primary text |
| `--color-text-muted` | `#888888` | Secondary text |

Node module tinting derives from a hue wheel — each module gets a unique hue, its children inherit that hue at reduced saturation.

---

## Animation Timing Scale

| Category | Duration | Easing |
|---|---|---|
| Ambient (particles, edge pulse) | 2-4s loop | sine ease-in-out |
| Micro-interaction (hover, toggle) | 100-150ms | ease-out-quart |
| Selection feedback | 150ms | ease-out-quint |
| Panel enter/exit | 250ms | ease-out-expo |
| Camera transition | 500-800ms | ease-in-out-quint |
| Node grow/remove | 400ms | ease-out-expo |
| Full layout transition | 800ms | ease-in-out-expo |

All animations respect `prefers-reduced-motion: reduce` — instant crossfade, no motion.

---

## Typography

| Role | Font | Weight | Size |
|---|---|---|---|
| Heading | Space Grotesk | 700 | 24-32px |
| Subheading | Space Grotesk | 500 | 16-20px |
| Body | IBM Plex Sans | 400 | 14px |
| Body emphasis | IBM Plex Sans | 600 | 14px |
| Label | IBM Plex Mono | 400 | 11-13px |
| Code/Metric | IBM Plex Mono | 500 | 12-14px |
| Monospace data | IBM Plex Mono | 400 | 11px |

Line height: 1.5 for body, 1.2 for headings. Letter spacing: -0.01em for headings.

---

## State Architecture

### Graph State Machine

States:
```
Loading → Overview → ModuleFocused → ClassFocused → FunctionFocused → SearchFocused → ImpactFocused → SelectionLocked
```

Transitions:
- Overview → ModuleFocused: double-click module / sidebar tree click
- ModuleFocused → ClassFocused: double-click class
- ClassFocused → FunctionFocused: double-click function
- Any → SearchFocused: Ctrl+K search + Enter
- Any → ImpactFocused: Impact panel → select root
- Any → SelectionLocked: Pin selection (Ctrl+Click)
- Any → Overview: ESC / Back button / Space
- FunctionFocused → ModuleFocused: Back / click breadcrumb
- ClassFocused → ModuleFocused: Back / click breadcrumb

Each state determines: which nodes are visible, camera position, label detail, edge visibility, sidebar content.

### Camera Controller

States:
```
Idle → Transition → UserControlled → AutoFocus → OverviewReset
```

All movement uses the same interpolation:
- position: `Vector3.lerp(target, factor)`
- lookAt: `Vector3.lerp(target, factor)`
- factor derived from easing function per Animation Timing Scale

Triggers:
- double-click node → AutoFocus(node.position, node.children)
- search result → AutoFocus(result.position)
- sidebar tree click → AutoFocus(subtree.center)
- impact result → AutoFocus(root + affected spread)
- back/ESC → OverviewReset
- Space → OverviewReset
- F key → FocusSelected
- mouse drag/scroll → UserControlled

### Selection Model

- **Hover**: temporary highlight (node glow + connected edges brighten)
- **Click**: single selection (replaces previous)
- **Ctrl+Click**: toggle in multi-selection
- **Shift+Click**: range select (last clicked → this)
- **Pin (Ctrl+P)**: persistent selection (survives clicks elsewhere)
- **Selection history**: Previous/Next (Alt+Left/Right)

Selection state drives: camera focus, panel content, metrics filter, impact root, AI context.

### Settings Store (localStorage-persisted)

```typescript
interface Settings {
  edgeAnimation: 'dots' | 'glow' | 'both' | 'none'
  particleDensity: 'off' | 'light' | 'medium' | 'heavy'
  showLabels: boolean
  lodThreshold: 'low' | 'medium' | 'high'
  edgeHighlightOnSelect: boolean
  cameraSpeed: 'slow' | 'normal' | 'fast'
  reducedMotion: boolean
  showPerformanceTelemetry: boolean
  layoutEngine: 'force' | 'hierarchical' | 'radial' | 'dagre' | 'circular'
  graphType: 'dependency' | 'call' | 'tree' | 'circular-deps'
}
```

---

## Command Palette (Ctrl+K)

Global search bar, centered overlay. Searches across: symbols, files, modules, classes, functions.

```
┌─────────────────────────────────────────┐
│ 🔍 Search symbols, files, modules...   │
├─────────────────────────────────────────┤
│ ƒ handleRequest        Function  →     │
│ ≡ src/server.ts        File       →     │
│ ◆ server              Module     →     │
│ ○ UserService         Class      →     │
│ ▫ config              Variable   →     │
├─────────────────────────────────────────┤
│ ↑↓ navigate  Enter=focus  Esc=close    │
└─────────────────────────────────────────┘
```

Arrow keys navigate. Enter focuses graph on selection + closes palette. Esc closes. Results are color-coded by kind.

---

## Interaction Model

| Input | Action |
|---|---|
| Single click | Select node |
| Double click | Drill down (zoom into module/class/function) |
| Right click | Context menu (copy name, show in tree, impact from here, metrics) |
| Middle click | Center camera on node |
| Scroll | Zoom in/out |
| Drag | Pan/rotate camera |
| Ctrl+Click | Multi-select |
| Shift+Click | Range select |
| Ctrl+P | Pin selection |
| Ctrl+K | Command palette |
| F | Focus selected node |
| Space | Reset to overview |
| ESC | Back / close panel / clear selection |
| ← → | Selection history navigation |
| Ctrl+Shift+D | Toggle performance telemetry |
| 1-5 | Quick switch graph page |
| ? | Keyboard shortcuts overlay |

---

## Graph Layout Engines

| Layout | When | Algorithm |
|---|---|---|
| Force-directed | Dependency graph, general exploration | Custom force simulation (web worker) |
| Hierarchical | Module overview, call graph | Tree layout top-to-bottom |
| Radial | Call graph from a single function | Root at center, callers/callees in rings |
| DAG | Dependency graph with known direction | Sugiyama-style layered layout |
| Circular | Circular dependency detection | Nodes on circle, circular deps as arcs |

Layout selected automatically based on graph type, or manually via settings. All layouts computed in a Web Worker.

---

## Progressive Loading

1. **Open repository** → Load module-level summary only (100-500 nodes) → Show module spheres, inter-module edges
2. **User drills into module** → Load that module's children (API: `/api/symbols?module=X`) → Nodes grow into view
3. **User drills deeper** → Load class/function children → Previous level dims but stays visible
4. **Cache loaded levels** → LRU cache, max 5 levels → Evict oldest on memory pressure
5. **On re-index** → Diff: new nodes grow, removed nodes fade, edges morph → Camera stays put → 400ms transition

API additions needed: `GET /api/graph/modules` (module-level summary), `GET /api/graph/modules/:id` (module children).

---

## Importance-Based Rendering

Each node gets an importance score (0-1) computed from:

| Factor | Weight |
|---|---|
| Degree (connections) | 0.3 |
| PageRank | 0.2 |
| Cyclomatic complexity | 0.15 |
| Fan-in (who calls this) | 0.15 |
| Impact count | 0.1 |
| File line count | 0.1 |

Rendering by importance:
- Score > 0.7: Large sphere, always labeled, full glow
- Score 0.3-0.7: Medium sphere, label on hover/close zoom
- Score < 0.3: Small sphere, no label until zoomed in
- Score < 0.1: Dot, hidden at far LOD

Importance scores precomputed in backend (`GET /api/graph/dependency` returns `importance` field per node) and cached.

---

## Node Shapes (Geometric Encoding)

| Kind | Shape | Rationale |
|---|---|---|
| Module | Sphere | Container, organic |
| Class/Struct | Rounded Cube | Solid, structural |
| Function/Method | Capsule (elongated sphere) | Directional, active |
| Interface/Trait | Hexagon | Abstract, boundary |
| Enum | Diamond | Variant, branching |
| Variable | Small sphere | Simple, atomic |
| Import | Thin line segment | Connection, not entity |
| Type alias | Octahedron | Transformation |

Implementation: shared geometry pool. 6-7 base geometries, instanced per kind. Each geometry is a different `BufferGeometry` stored in a map. `InstancedMesh` per geometry kind, color tinted by parent module.

---

## Animated Background — Particle Field

Thousands of tiny particles (0D–2D points) drift slowly in 3D space behind the graph. Warm orange-tinted, low opacity.

- **Implementation:** Instanced buffer geometry with ~2000 particles. Position + velocity in a Float32Array. Updated in `useFrame` with simple drift + wrap-around.
- **Performance:** Instanced rendering = 1 draw call for all particles. GPU-bound, negligible CPU cost. User-configurable density (off / light / medium / heavy).
- **Color:** Particles are dim warm orange (#E65100 at 15-30% opacity).

---

## Edge Rendering

**Instanced lines:** All edges rendered using `LineSegments` or instanced `Line2` (drei).
- Base color: electric cyan (#00E5FF)
- Highlighted edges (connected to selected node): brighter, thicker
- Dimmed edges (unrelated): lower opacity

**Configurable animations (user chooses):**
- **Traveling dots:** Small bright dots moving along edge paths. Speed varies by edge kind. Implemented via `dashOffset` animation.
- **Glow pulse:** Edge opacity oscillates sinusoidally. Phase offset per edge. Custom shader material.
- **Both:** Traveling dots + glow combined.
- **None:** Static edges, fastest performance.

---

## Temporal Animation (Re-index Transitions)

When file watcher triggers re-index:

1. Diff old vs new node set → new_nodes, removed_nodes, unchanged_nodes
2. Animate:
   - new_nodes: scale 0→1, opacity 0→1 (400ms ease-out-expo)
   - removed_nodes: scale 1→0, opacity 1→0 (400ms ease-out-expo)
   - edges: morph positions if endpoints moved (400ms lerp)
   - camera: stay exactly where it is
3. Importance scores recomputed
4. Layout optionally re-runs (if "auto-layout on re-index" enabled)

---

## Mini-Map (Mandatory)

Fixed position: bottom-right corner, 200×150px, semi-transparent.

- All nodes rendered as 1px dots (single instanced draw call)
- Viewport rectangle updates on camera move (throttled 60ms)
- Selected node: bright orange dot
- Click on mini-map → camera pans to that region
- Search hits: pulsing cyan dots

---

## Navigation History

```
NavigationStack:
  visited: Array<{state, camera, selection}>
  currentIndex: number

Actions:
  push(state)       : on any navigation
  back()            : Alt+Left
  forward()         : Alt+Right
  recentSearches    : last 20 searches, persisted
  recentSelections  : last 20 selected node IDs
  bookmarks         : user-saved views
```

---

## Error / Empty States

| State | UI |
|---|---|
| Loading (initial) | Centered spinner + "Indexing repository..." with progress |
| Loading (data) | Skeleton shimmer on panels, graph stays visible |
| No repository | Full-page: "Navigate to a repo and run `astera init && astera index`" |
| No results | "No matches for '{query}'" with suggestion to broaden |
| Empty graph | "No symbols indexed yet. Run `astera index` to build the graph." |
| API error | Toast notification + retry button. Graph stays visible |
| Unsupported language | Gray node with tooltip "Language not parsed" |
| Corrupt database | "Index corrupted. Run `astera index` to rebuild." |
| Worker crashed | Automatic fallback to main-thread layout |

---

## Performance Telemetry (Ctrl+Shift+D)

Developer overlay, top-right corner:

```
┌─────────────────────────┐
│ FPS: 60    GPU: 4.2ms  │
│ CPU: 2.8ms  Draw: 23   │
│ Nodes: 1,247 / 3,891   │
│ Edges: 3,412            │
│ Memory: 142MB           │
│ Worker: 12ms            │
│ LOD: Level 1            │
└─────────────────────────┘
```

---

## Accessibility

- Keyboard navigation: All panels, palette, settings reachable via Tab/Arrow/Enter
- Reduced motion: `prefers-reduced-motion` → disable particles, instant transitions, static edges
- High contrast: `prefers-contrast: more` → bump all border/text contrast ratios
- Screen reader: `aria-label` on all interactive elements, `role` attributes on panels
- Focus rings: Visible orange focus ring on all keyboard-navigable elements
- Skip links: "Skip to graph" / "Skip to search" at top of page

---

## AI-Ready Architecture (Reserved, Phase 4+)

```
AI Layer:
  ├── Code explanation       : Select node → "Explain this function"
  ├── Suggested navigation   : "Most callers of this are in module X"
  ├── Architecture insights  : "This module has high coupling..."
  ├── Hotspots               : "These 5 functions have highest complexity"
  ├── Risk analysis          : "Changing this affects 847 downstream nodes"
  └── Chat overlay           : Natural language queries over the graph
```

API endpoint: `POST /api/ai/query`. Node metadata: `ai_insights` field. Settings toggle: "Enable AI features" (hidden until backend ready).

---

## Plugin Architecture (Frontend)

```typescript
PanelRegistry.register(id, component)
ToolbarRegistry.register(action)
NodeRendererRegistry.register(kind, renderer)
GraphOverlayRegistry.register(overlay)
MetricCardRegistry.register(card)
```

Internal components register the same way plugins would — no special casing.

---

## File Structure

```
apps/web/src/
├── main.tsx
├── App.tsx
├── index.css
├── types.ts
├── constants.ts
│
├── state/
│   ├── graphState.ts
│   ├── cameraController.ts
│   ├── selectionModel.ts
│   ├── settingsStore.ts
│   ├── navigationHistory.ts
│   └── store.ts
│
├── api/
│   ├── client.ts
│   └── hooks.ts
│
├── hooks/
│   ├── useForceLayout.ts
│   ├── useGraphHierarchy.ts
│   ├── useLOD.ts
│   ├── useImportance.ts
│   ├── useKeyboard.ts
│   └── usePerformanceBudget.ts
│
├── components/
│   ├── Layout.tsx
│   ├── Sidebar/
│   │   ├── Sidebar.tsx
│   │   ├── TreeView.tsx
│   │   └── SettingsPanel.tsx
│   ├── Graph/
│   │   ├── GraphScene.tsx
│   │   ├── ParticleField.tsx
│   │   ├── NodeInstances.tsx
│   │   ├── EdgeInstances.tsx
│   │   ├── NodeLabels.tsx
│   │   ├── MiniMap.tsx
│   │   ├── DrillDown.tsx
│   │   ├── CameraRig.tsx
│   │   └── GraphOverlay.tsx
│   ├── Overlay/
│   │   ├── OverlayPanel.tsx
│   │   ├── SymbolsPanel.tsx
│   │   ├── FilesPanel.tsx
│   │   ├── MetricsPanel.tsx
│   │   ├── ImpactPanel.tsx
│   │   └── AIPanel.tsx
│   ├── CommandPalette/
│   │   └── CommandPalette.tsx
│   ├── Common/
│   │   ├── ContextMenu.tsx
│   │   ├── Toast.tsx
│   │   ├── KeyboardShortcuts.tsx
│   │   ├── FocusRing.tsx
│   │   └── EmptyState.tsx
│   └── Telemetry/
│       └── PerformanceOverlay.tsx
│
├── renderers/
│   ├── nodeGeometries.ts
│   ├── nodeMaterials.ts
│   ├── edgeMaterials.ts
│   └── labelSprites.ts
│
├── layouts/
│   ├── forceLayout.ts
│   ├── hierarchicalLayout.ts
│   ├── radialLayout.ts
│   ├── dagreLayout.ts
│   └── circularLayout.ts
│
├── workers/
│   └── forceLayout.worker.ts
│
└── plugins/
    ├── registry.ts
    └── builtIn.ts
```

---

## New Dependencies

| Package | Purpose | Size |
|---|---|---|
| `@tanstack/react-virtual` | Virtual scrolling | 4KB |
| `framer-motion` | Panel transitions | 15KB |
| `@fontsource/space-grotesk` | Heading font | 20KB |
| `@fontsource/ibm-plex-sans` | Body font | 25KB |
| `@fontsource/ibm-plex-mono` | Code font | 20KB |
| `comlink` | Web Worker communication | 2KB |

**Removed:** `@react-three/drei` Stars (replaced by particle field). Keep drei for `OrbitControls` and `Line`.

Total new JS: ~86KB uncompressed, ~32KB gzipped.

---

## Implementation Phases

### Phase A: Foundation (Days 1-2)
- New types, constants, store architecture
- Font setup, Tailwind config, CSS variables
- Layout shell: icon sidebar + overlay panel system
- Fix dead routes (Metrics, Impact)
- Command palette (Ctrl+K)

### Phase B: Graph Engine (Days 3-5)
- Web Worker force layout
- Instanced node rendering (geometry pool + material per kind)
- Instanced edge rendering + configurable animation
- Sprite-based labels
- LOD system
- Camera controller with transitions

### Phase C: Hierarchy & Navigation (Days 6-7)
- Module-level clustering + progressive loading
- Drill-down zoom + breadcrumbs
- Sidebar tree view
- Selection model + history
- Mini-map
- Layout engine switching

### Phase D: Panels & Polish (Days 8-9)
- All overlay panels with virtual scrolling
- Settings panel with localStorage persistence
- Error/empty states
- Accessibility (keyboard, reduced motion, focus rings)
- Performance telemetry overlay

### Phase E: Temporal & Extensibility (Day 10)
- Re-index temporal animation (grow/fade/morph)
- Plugin registry system
- AI layer reservation
- Final polish + testing
