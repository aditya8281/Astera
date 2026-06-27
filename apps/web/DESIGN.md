# Design

## Visual System

### Color Palette

| Token | Value | Usage |
|---|---|---|
| `bg` | `#1F2128` | Main background, warm charcoal |
| `bg-gradient-top` | `#23252D` | Radial vignette top |
| `bg-gradient-bottom` | `#1B1D23` | Radial vignette bottom |
| `surface` | `#2A2D35` | Panels, sidebars, cards |
| `surface-dim` | `#252830` | Subtle surface differentiation |
| `surface-hover` | `#32353D` | Hover state on surfaces |
| `border` | `#3A3D45` | Borders, dividers |
| `border-light` | `#454850` | Lighter borders |
| `text` | `#E0E4EC` | Primary text |
| `text-muted` | `#8B91A0` | Secondary text |
| `text-dim` | `#5A6070` | Tertiary text, labels |
| `accent` | `#59F6FF` | Electric Cyan — selection, active states, focus |
| `accent-dim` | `#3AA8B0` | Dimmed accent |
| `node-default` | `#A7B5C9` | Default node fill, 92% opacity |
| `node-hover` | `#DCE8FF` | Hovered node fill |
| `node-selected` | `#59F6FF` | Selected node fill |
| `edge-default` | `rgba(180,190,210,0.22)` | Default edge stroke |
| `edge-hover` | `#59F6FF` | Hovered edge stroke |
| `label` | `#AEB8C7` | Node labels, 75% opacity |

### Typography

- **Primary**: Inter (400, 500, 600) — UI labels, panel text
- **Monospace**: JetBrains Mono (400, 500) — node labels in graph, code references
- **Graph labels**: 10px, weight 400, color `#AEB8C7`, opacity 75%
- **Scale**: 10px / 11px / 12px / 13px / 14px (tight product ratio)

### Graph Rendering

- **Renderer**: Three.js via React Three Fiber (keep existing stack)
- **Nodes**: InstancedMesh circles, radius 4-6px by importance
- **Edges**: InstancedMesh lines with curvature (quadratic bezier via custom geometry)
- **Labels**: drei Html, virtualized (only visible at zoom threshold or on hover/select)
- **Particles**: InstancedMesh points, 4-6% opacity, extremely slow drift

### Graph Physics

- **Layout**: d3-force-3d simulation running in Web Worker
- **Force config**: charge (repulsion) -300, link distance 80, collision radius based on node size, cluster gravity toward connected components
- **Stabilization**: alpha decay to 0.001, pause simulation when stable
- **Spring animation**: node positions interpolated toward target with damping (lerp factor 0.08)

### Interactions

| Trigger | Action |
|---|---|
| Hover node | Scale 1.3, color → #DCE8FF, glow, highlight connected edges, fade unrelated nodes/edges |
| Select node | Color → #59F6FF, glow 22px, center camera, expand immediate neighborhood, show label |
| Double-click | Expand recursive neighborhood |
| Right-click | Context menu (DOM overlay) |
| Hover edge | Color → electric cyan, animated pulse traveling source→destination (1.5s) |
| Search match | Flash node (pulse 3x), center camera, highlight shortest path, fade everything else |
| Zoom far | Edge opacity → 15%, labels hide |
| Zoom near | Edge opacity → 35%, labels show at threshold |
| Pan | Drag with inertia (momentum), no instant stop |

### Camera

- **Default position**: [0, 5, 15], fov 50
- **Zoom**: dampened, interpolated, no jumps
- **Pan**: inertia-based with tiny momentum
- **Selection centering**: smooth 350ms ease-out-quart lerp

### Animations

| Element | Duration | Easing |
|---|---|---|
| Node movement | Continuous spring | Lerp 0.08 |
| Hover scale | 120ms | ease-out-quart |
| Selection glow | 200ms | ease-out-quart |
| Camera movement | 350ms | ease-out-quart |
| Edge pulse | 1500ms | linear loop |
| Label fade | 150ms | ease-out |
| Node appear | 400ms | ease-out-quart (fade + scale) |
| Node disappear | 300ms | ease-in-quart (fade out) |

### Reduced Motion

- `prefers-reduced-motion: reduce` → disable particles, instant transitions, no spring animation
