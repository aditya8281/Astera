---
name: Astera
description: Local-first static analysis engine — 2D code graph explorer
colors:
  primary: "#59F6FF"
  primary-dim: "#3AA8B0"
  neutral-bg: "#000000"
  neutral-surface: "#0E0F12"
  neutral-surface-dim: "#0A0B0E"
  neutral-surface-hover: "#16171C"
  neutral-border: "#1E1F25"
  neutral-border-light: "#26272E"
  neutral-text: "#E0E4EC"
  neutral-text-muted: "#8B91A0"
  neutral-text-dim: "#5A6070"
  neutral-label: "#AEB8C7"
  success: "#4ADE80"
  error: "#F87171"
  warning: "#FBBF24"
  ai: "#B388FF"
  graph-node-default: "#CBD5E1"
  graph-node-hover: "#F1F5F9"
  graph-node-selected: "#59F6FF"
  graph-edge-default: "#3A506B"
  graph-edge-hover: "#59F6FF"
  graph-label: "#AEB8C7"
  inactive: "#5A6070"
  node-function: "#60A5FA"
  node-method: "#818CF8"
  node-class: "#38BDF8"
  node-interface: "#22D3EE"
  node-enum: "#FBBF24"
  node-variable: "#F472B6"
  node-module: "#C084FC"
  node-typealias: "#34D399"
  node-field: "#FB923C"
  node-parameter: "#A78BFA"
  node-import: "#8B95A5"
  node-file: "#8B95A5"
typography:
  display:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "IBM Plex Sans, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "IBM Plex Sans, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.05em"
  mono:
    fontFamily: "IBM Plex Mono, Fira Code, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  "2xl": "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral-bg}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    typography: "{typography.label}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.neutral-text-muted}"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
    typography: "{typography.label}"
  input:
    backgroundColor: "{colors.neutral-bg}"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
    typography: "{typography.mono}"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.neutral-text-muted}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
    typography: "{typography.label}"
  panel:
    backgroundColor: "{colors.neutral-surface}"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.md}"
    padding: "16px"
---

# Design System: Astera

## 1. Overview

**Creative North Star: "The Observatory"**

You are looking out at a vast codebase through a precision instrument. The dark field is not decoration — it is the void against which structure becomes visible. Every bright point is a symbol, every line is a relationship, and the instrument's purpose is to make the invisible architecture of code appear with total clarity.

Astera's visual system borrows from observatories, radar screens, and modern code editors. The OLED black background is deep space — pure, unlit, the absolute minimum. The electric cyan accent is the instrument's reticle — the thing that draws your eye to what matters. The vivid node kind colors are spectral objects: each emits its own wavelength, distinguishable by hue, never fighting for attention against the data itself.

The graph canvas is the primary surface. It breathes perpetually — nodes drift on gentle sine waves, edges follow their endpoints, and the particle constellation parallax responds to the cursor with spring-based momentum. The graph never feels dead. This is not decoration; it is the living pulse of a codebase being observed.

This system explicitly rejects: generic SaaS dashboards with card grids and gradient heroes; cyberpunk "hacker" UIs with scanlines, neon glow, and RGB effects; glassmorphism-heavy interfaces with decorative blurs and transparency; oversized rounded cards; and any visual language that prioritizes aesthetic display over information density. Astera is closer to Obsidian, Linear, and modern developer tools than to a marketing dashboard or sci-fi terminal.

**Key Characteristics:**
- Pure OLED black — no tinted neutrals, no warm-charcoal pretense
- Tonal depth only — no shadows, no glass effects, no decorative blur
- Information density over visual spectacle
- Precision geometry — clean borders, consistent spacing, mechanical feel
- One accent color (electric cyan) reserved for active states and primary actions
- Vivid node kind colors — each symbol kind emits its own spectral hue
- Living canvas — perpetual ambient breathing, spring-based particle parallax
- Dark by necessity, not by style — the graph needs maximum contrast to breathe

## 2. Colors

The palette is built for a pure OLED observatory field: true black backgrounds, near-black surfaces for layering, and a single electric cyan instrument accent. Vivid spectral colors categorize node kinds in the graph. Every color earns its place through function, never decoration.

### Primary

- **Electric Cyan** (#59F6FF): The instrument's reticle. Used exclusively for selection, active states, focus rings, and primary interactive feedback. Appears on ≤10% of any given screen. Its rarity is the point — when cyan appears, something important is happening.
- **Cyan Dim** (#3AA8B0): A muted version of the primary for backgrounds and hover states where full cyan would be too intense. Tonal container fills, selection backgrounds at 10% opacity.

### Semantic

- **Success Green** (#4ADE80): Positive states — no circular dependencies, healthy metrics, clean analysis results. Used in small doses: status badges, checkmarks, success messages.
- **Error Red** (#F87171): Failure states — circular dependencies detected, API errors, failed indexing. Never decorative; always signals a real problem.
- **Warning Amber** (#FBBF24): Caution states — high complexity, borderline metrics. Less urgent than error, more attention than info.
- **AI Violet** (#B388FF): Reserved for the AI analysis panel. A distinct identity that signals "this is not static analysis — this is inference."

### Neutral

- **OLED Black** (#000000): The primary background. Pure, unlit, absolute minimum. The graph canvas fills this color. No tint, no warmth — the void against which all structure becomes visible.
- **Surface** (#0E0F12): Sidebar, panels, cards. One step above true black, creating tonal layering without shadows. The warmth in this near-black prevents the UI from feeling clinical.
- **Surface Dim** (#0A0B0E): Sidebar active state, secondary containers. A subtle intermediate step between OLED black and Surface.
- **Surface Hover** (#16171C): Interactive hover state across all surfaces. Consistent across sidebar items, buttons, list rows.
- **Border** (#1E1F25): Structural dividers — sidebar edge, panel borders, input outlines, card edges. Always 1px, never decorative.
- **Border Light** (#26272E): Lighter variant for subtle separation within panels — section dividers, nested containers.
- **Text Primary** (#E0E4EC): Body text, node names, primary labels. High contrast against dark backgrounds, never gray-on-dark.
- **Text Muted** (#8B91A0): Secondary text — descriptions, placeholder text, inactive labels. Must maintain ≥4.5:1 contrast ratio.
- **Text Dim** (#5A6070): Tertiary text — timestamps, metadata, tertiary labels. Used sparingly; never for text that carries meaning.
- **Label** (#AEB8C7): Node labels in the graph, medium-emphasis text in panels. Distinct from primary text for visual separation.

### Graph-Specific

- **Node Default** (#CBD5E1): Default fill for graph nodes when kind-specific color is not defined. Muted slate — the baseline from which selection and hover depart.
- **Node Hover** (#F1F5F9): Hovered node fill. Shifts toward white, signaling interactivity without committing to selection.
- **Node Selected** (#59F6FF): Selected node fill. Full cyan — the most intense use of color in the entire graph, reserved for the user's current focus.
- **Edge Default** (#3A506B): Default edge stroke. Muted blue-gray, solid hex. Visible on OLED black without being distracting. Rendered at 1.2px lineWidth with 85% opacity.
- **Edge Hover** (#59F6FF): Hovered/highlighted edge. Full cyan, matching the selection color for consistency.

### Node Kind Colors

Each symbol kind gets a vivid spectral hue for visual categorization in the graph. These are deliberately saturated to remain visible on pure OLED black:
- Function: #60A5FA (bright blue)
- Method: #818CF8 (indigo)
- Class: #38BDF8 (sky blue)
- Interface: #22D3EE (cyan)
- Enum: #FBBF24 (amber)
- Variable: #F472B6 (pink)
- Module: #C084FC (purple)
- TypeAlias: #34D399 (emerald)
- Field: #FB923C (orange)
- Parameter: #A78BFA (violet)
- Import: #8B95A5 (neutral gray)
- File: #8B95A5 (neutral gray)

### Named Rules

**The Reticle Rule.** Electric cyan (#59F6FF) is used on ≤10% of any given screen. It appears only on: the currently selected node, active sidebar item, focus rings, primary action buttons, and highlighted edges. Everywhere else, it does not exist. Its rarity is the point — the eye follows it because it is rare.

**The Tonal Depth Rule.** Depth is conveyed through surface color steps (OLED black → Surface → Surface Hover), never through shadows, drop-shadows, or backdrop-blur. If it looks like it's floating, it's wrong. Everything sits on the same plane; hierarchy comes from color, not elevation.

**The OLED Rule.** The background is pure #000000. No tinting, no warming, no gradient. The graph canvas must achieve maximum contrast for nodes and edges to breathe. If the background is not #000000, it is wrong.

## 3. Typography

**Display/Heading Font:** Space Grotesk (with system-ui fallback)
**Body Font:** IBM Plex Sans (with -apple-system, BlinkMacSystemFont, sans-serif fallback)
**Mono Font:** IBM Plex Mono (with Fira Code, monospace fallback)

**Character:** Space Grotesk is a geometric sans with technical character — its slightly squared letterforms feel engineered rather than designed, matching the observatory metaphor. IBM Plex Sans carries the body text with quiet neutrality — it disappears into the task. IBM Plex Mono provides code-adjacent monospace for data, commands, and technical labels. The pairing is technical without being cold — both families have enough warmth to feel crafted, not default.

### Hierarchy

- **Display** (Space Grotesk, 700, 1.5rem/24px, line-height 1.2, letter-spacing -0.01em): Page titles — "Impact Analysis", "Metrics", the landing page hero. Used sparingly; most screens have one at most.
- **Title** (Space Grotesk, 700, 1.25rem/20px, line-height 1.3): Section headers within panels — "Circular Dependencies", "Affected Symbols". Slightly smaller than display but same weight.
- **Subtitle** (Space Grotesk, 700, 1rem/16px, line-height 1.4): Subsection headers, card headings. The workhorse heading in dense UI.
- **Body** (IBM Plex Sans, 400, 13px/21px, line-height 1.5): Paragraphs, descriptions, panel content. Max line length: 65–75ch for prose, denser for data panels.
- **Label** (IBM Plex Sans, 600, 11px, letter-spacing 0.05em): Navigation items, section labels, uppercase category markers. Never more than 2–3 words.
- **Mono Data** (IBM Plex Mono, 400, 12px/18px): File paths, symbol names, node IDs, timestamps, CLI commands. The primary data font.
- **Mono Small** (IBM Plex Mono, 400, 10px): Metadata badges, kind labels, depth indicators, secondary data. Smallest readable text.

### Named Rules

**The Single-Weight Rule.** Space Grotesk uses only weight 700 (bold). No light, no regular, no semibold. Bold for all hierarchy levels, differentiated by size alone. This keeps the heading system clean and prevents weight confusion.

**The Monospace-For-Data Rule.** Any text that represents code, paths, IDs, or technical data is set in IBM Plex Mono. No exceptions. Human-readable labels use the sans. This creates instant visual categorization: mono = data, sans = interface.

## 4. Elevation

This system uses flat tonal layering exclusively. No shadows exist anywhere in the interface. Depth is conveyed through three surface color steps: the background (OLED black #000000), the panel surface (#0E0F12), and hover states (#16171C). These create a clear visual hierarchy without any illusion of floating.

The graph canvas sits at the deepest layer (pure black). Panels and sidebars sit one step above (Surface). Interactive elements shift one more step on hover (Surface Hover). This is the entire elevation vocabulary.

The command palette and context menu are exceptions that float above the panel layer — they use a slightly lighter surface with a thin border, but no shadow or blur. If it looks like it's floating, it's wrong.

### Named Rules

**The Flat-By-Default Rule.** Surfaces are flat at rest. No shadows, no backdrop-blur, no lift on hover. Interactive feedback comes from surface color shifts (hover → Surface Hover) and border color changes (Border → Primary), never from elevation changes. The only "lifted" elements are the command palette and context menu, which use z-index layering, not shadow.

**The Three-Step Rule.** There are exactly three surface depths: background (OLED black), surface (#0E0F12), surface-hover (#16171C). No more. If a design needs a fourth surface color, it's over-decorated. Simplify.

## 5. Components

Every component is engineered — clean geometry, consistent spacing, crisp borders. The interface disappears so the graph remains the primary focus.

### Navigation Sidebar

- **Collapsed width:** 48px (icon rail only)
- **Expanded width:** 200px (icon + label + shortcut)
- **Background:** Surface Dim (#0A0B0E), one step darker than panel surface
- **Border:** 1px right border using Border (#1E1F25)
- **Nav items:** 10px vertical padding, 12px horizontal. Active state: 2px left accent bar + 10% cyan background. Hover: Surface Hover (#16171C).
- **Typography:** Label weight (600), 11px, icons 16px
- **Behavior:** Auto-expands on mouse-enter, auto-collapses on mouse-leave with 300ms delay
- **Active indicator:** 2px wide, 20px tall, rounded right, full cyan, positioned at left edge

### Panels (Symbols, Files, Metrics, Impact, Settings)

- **Width:** 380px fixed
- **Background:** Surface (#0E0F12)
- **Border:** 1px left border using Border (#1E1F25)
- **Padding:** 16px consistent
- **Header:** Subtitle weight (1rem bold), 16px bottom margin
- **Sections:** Separated by 1px Border Light dividers
- **Entrance:** slideInRight 250ms cubic-bezier(0.16, 1, 0.3, 1)
- **Scrolling:** Custom scrollbar — 5px wide, Border thumb, transparent track

### Command Palette

- **Width:** max-w-lg (512px), centered
- **Background:** Surface (#0E0F12) with Border (#1E1F25) outline
- **Border-radius:** 12px (rounded-lg)
- **Shadow:** None — uses z-index (40) for layering only
- **Backdrop:** rgba(0, 0, 0, 0.5), semi-transparent overlay
- **Search input:** Full width, no border, Mono Data font, 16px horizontal padding
- **Results:** Compact rows — 8px vertical padding, 10px gap, Mono Data font for names
- **Keyboard hints:** Mono Small (10px), Text Dim color, right-aligned
- **Entrance:** fadeIn 150ms + slideUp 150ms

### Buttons

- **Primary:** Cyan background (#59F6FF), OLED Black text (#000000), 8px 16px padding, 4px radius, Label font (600, 11px). Hover: darken to Cyan Dim (#3AA8B0). Active: 95% scale.
- **Ghost:** Transparent background, Text Muted text (#8B91A0), 6px 12px padding, 4px radius. Hover: Surface Hover background + Text Primary color.
- **Icon-only:** 32x32px, transparent background, centered icon. Hover: Surface Hover. Used for toolbar actions.
- **All buttons:** 120ms ease-out transition. No decorative motion.

### Inputs / Fields

- **Background:** OLED Black (#000000), one step darker than panel surface
- **Border:** 1px Border (#1E1F25)
- **Border-radius:** 4px
- **Padding:** 8px 12px
- **Font:** Mono Data (12px)
- **Text color:** Text Primary (#E0E4EC)
- **Placeholder:** Text Dim (#5A6070)
- **Focus:** 2px solid Cyan outline, 2px offset
- **Error:** 1px Error Red border
- **Disabled:** 50% opacity

### Tree View (Sidebar nested list)

- **Indentation:** 12px per depth level
- **Row height:** 24px (py-1)
- **Font:** Mono Data (11px)
- **Active:** Text Primary color + Surface background
- **Hover:** Surface Hover background
- **Expand arrow:** 8px chevron, Text Dim color, 16px hit area
- **Kind dot:** 6px circle, Node Kind Color, left of name
- **Child count badge:** 9px mono, Surface Dim background, Text Dim color

### Search Results / List Items

- **Row height:** 32px
- **Padding:** 8px horizontal, 12px gap
- **Font:** Mono Data (11px) for names, Mono Small (10px) for metadata
- **Active:** Surface background + Cyan text
- **Hover:** Surface Hover background
- **Kind badge:** 10px mono, Surface Dim background, Text Dim color, 6px horizontal padding
- **Line number:** 10px mono, Text Dim color, right-aligned

### Chips / Tags (Language badges, kind filters)

- **Background:** Surface Dim (#0A0B0E)
- **Border:** 1px Border (#1E1F25)
- **Border-radius:** 4px
- **Padding:** 2px 8px
- **Font:** Mono Small (10px)
- **Text:** Text Muted (#8B91A0)
- **Selected state:** 10% Cyan background + Cyan border + Cyan text

### Skeleton Loading

- **Background:** Shimmer gradient across Surface → Surface Dim → Surface
- **Animation:** 1.5s ease-in-out infinite shimmer
- **Shape:** 4px radius, matches target element dimensions
- **Reduced motion:** Static Surface background, no animation

### Tooltips

- **Background:** Surface (#0E0F12)
- **Border:** 1px Border (#1E1F25)
- **Border-radius:** 6px
- **Padding:** 4px 8px
- **Font:** Mono Small (10px)
- **Text:** Text Primary (#E0E4EC)
- **Position:** 8px offset from trigger, clamped to viewport
- **Entrance:** fadeIn 150ms
- **z-index:** 60

### Context Menu

- **Width:** 200px
- **Background:** Surface (#0E0F12) with Border (#1E1F25) outline
- **Border-radius:** 8px
- **Header:** 8px vertical, 12px horizontal, bottom Border divider
- **Items:** 32px height, 12px horizontal padding, 10px gap
- **Hover:** Surface Hover background
- **Separator:** 1px Border, 8px horizontal margin
- **Font:** Body (12px) for labels, Mono Small (10px) for kind badges
- **Entrance:** fadeIn 150ms

### Graph Canvas (2D Canvas)

- **Background:** Pure OLED Black (#000000)
- **Particle constellation:** ~150 tiny white dots at 8% opacity, connected by faint cyan-tinted lines when within 100px. Spring-based mouse parallax (stiffness 0.06, damping 0.85). Drift speed 0.04. Respects prefers-reduced-motion.
- **Nodes:** Colored circles by kind, radius by hierarchy: File/Module=10px, Class/Interface/Enum=8px, Function/Method=6px, other=5px. Vivid spectral Node Kind Colors.
- **Edges:** 1.2px stroke, Edge Default (#3A506B) at 85% opacity. Selected edges: 2.0px cyan. Cascade glow edges: 1.5px cyan at hop-distance opacity.
- **Labels:** Mono Data (10px), center-aligned below node. Smooth crossfade: visible at zoom ≥0.7x, full opacity at ≥1.0x.
- **Selection ring:** 1px cyan ring at 25% opacity, 6px outside node radius. Animated from 0.6→1.0 scale, 180ms ease-out.
- **Reticle pulse:** Expanding ring (0→25px beyond selection ring) that fades out over 400ms on node select. Precision instrument "acquiring target" feel.
- **Hover glow:** Faint 1px cyan ring at 15% opacity, exponential lerp per-frame (0.12 decay). Not binary — smoothly fades in/out.
- **Ambient breathing:** Perpetual sine-based node drift (0.3-0.7 rad/s, 0.8-2px amplitude). Each node has unique phase and speed. Edges follow their endpoints. Graph never feels still. Respects prefers-reduced-motion.
- **Constellation beams:** Radial cyan lines from selected node to 1-hop neighbors. 300ms ease-out fade in, 600ms linger, 400ms ease-out fade out. Center glow halo at 15% opacity.
- **Connected-edge cascade:** BFS from selected node (2-hop max, 500 cap). Hop distance 0 = full opacity, hop 1 = 65%, hop 2 = 30%.
- **Same-kind highlight:** Hovering a node brightens all nodes of the same kind (40% strength boost).
- **Orbital reveal:** First load starts camera at 3.5x zoom, spirals out to fitted view via exponential lerp.
- **Interaction:** Click to select, double-click to drill into containers, scroll to zoom toward cursor, drag to pan.

## 6. Do's and Don'ts

### Do:

- **Do** use OLED black (#000000) as the primary background — never tinted, never warmed, never gradiented. The graph needs maximum contrast.
- **Do** use tonal layering for depth — OLED black → Surface (#0E0F12) → Surface Hover (#16171C) is the entire elevation vocabulary.
- **Do** reserve electric cyan (#59F6FF) for selection, focus, and active states only. It is the instrument's reticle, not a decorative accent.
- **Do** use vivid spectral colors for node kinds — they must remain visible and distinguishable on pure black.
- **Do** use IBM Plex Mono for all code, paths, IDs, and technical data. The monospace-for-data rule creates instant visual categorization.
- **Do** keep body text at ≥4.5:1 contrast ratio against dark backgrounds. Text Muted (#8B91A0) on Surface (#0E0F12) passes; Text Dim on Surface does not — reserve it for truly tertiary metadata.
- **Do** use 1px borders for structural separation. Borders are always functional, never decorative.
- **Do** honor `prefers-reduced-motion` — disable ambient breathing, particle drift, and all entrance animations. Use static surfaces for skeletons, instant transitions for panels.
- **Do** maintain the sidebar → panel → content hierarchy. The sidebar is the deepest surface (Surface Dim), panels are Surface, content is OLED Black.
- **Do** use skeleton loading states, never spinners in the middle of content areas.
- **Do** keep the graph alive — ambient breathing ensures nodes are never perfectly still. This is the "living codebase" principle.
- **Do** use edge lineWidth 1.2px minimum for default edges — thinner edges vanish on OLED black.

### Don't:

- **Don't** use shadows, drop-shadows, or backdrop-blur anywhere. Depth is tonal, not optical. If it looks like it's floating, it's wrong.
- **Don't** use glassmorphism, glass effects, or decorative transparency. The observatory is solid, not transparent.
- **Don't** use gradient text (`background-clip: text` with gradient). Use a single solid color. Emphasis via weight or size.
- **Don't** use side-stripe borders (`border-left` > 1px as accent). Never intentional. Use full borders, background tints, or nothing.
- **Don't** use oversized rounded corners (>12px). The design language is structured and geometric, not bubbly. Border-radius: 4px for small elements, 8px for containers, 12px max.
- **Don't** use neon glow, RGB effects, or scanline overlays. This is not a cyberpunk terminal. It's a precision instrument.
- **Don't** use identical card grids with icon + heading + text repeated endlessly. Each section should have its own structural logic.
- **Don't** use decorative motion — no bounce, no elastic, no orchestrated page-load sequences. Motion conveys state, not personality.
- **Don't** put display fonts (Space Grotesk) in UI labels, buttons, or data. Labels and data use IBM Plex Sans or Mono.
- **Don't** use Text Dim (#5A6070) for body text or any text that carries meaning. It is for timestamps, metadata, and decorative labels only.
- **Don't** use modal as first thought. Exhaust inline and progressive alternatives first.
- **Don't** use the hero-metric template (big number, small label, supporting stats, gradient accent). This is not a SaaS dashboard.
- **Don't** use tiny uppercase tracked eyebrows above every section. One named kicker is voice; an eyebrow on every section is AI grammar.
- **Don't** use numbered section markers (01 / 02 / 03) as default scaffolding. Numbers earn their place only when the section is a real ordered sequence.
- **Don't** let the graph become perfectly still after force simulation settles. Ambient breathing must keep nodes in perpetual subtle motion.
- **Don't** use edge lineWidth below 1.0px. Edges below this threshold are invisible on OLED black.
