---
name: Astera
description: Local-first static analysis engine — 2D code graph explorer
colors:
  primary: "#59F6FF"
  primary-dim: "#3AA8B0"
  neutral-bg: "#1F2128"
  neutral-surface: "#2A2D35"
  neutral-surface-dim: "#252830"
  neutral-surface-hover: "#32353D"
  neutral-border: "#3A3D45"
  neutral-border-light: "#454850"
  neutral-text: "#E0E4EC"
  neutral-text-muted: "#8B91A0"
  neutral-text-dim: "#5A6070"
  neutral-label: "#AEB8C7"
  success: "#4ADE80"
  error: "#F87171"
  warning: "#FBBF24"
  ai: "#B388FF"
  graph-node-default: "#A7B5C9"
  graph-node-hover: "#DCE8FF"
  graph-node-selected: "#59F6FF"
  graph-edge-default: "#B4BED238"
  graph-edge-hover: "#59F6FF"
  graph-label: "#AEB8C7"
  bg-gradient-top: "#23252D"
  bg-gradient-bottom: "#1B1D23"
  inactive: "#5A6070"
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

Astera's visual system borrows from observatories, radar screens, and modern code editors. The warm charcoal background is deep space. The electric cyan accent is the instrument's reticle — the thing that draws your eye to what matters. The muted, desaturated node colors are distant objects: visible, distinguishable, but never fighting for attention against the data itself.

This system explicitly rejects: generic SaaS dashboards with card grids and gradient heroes; cyberpunk "hacker" UIs with scanlines, neon glow, and RGB effects; glassmorphism-heavy interfaces with decorative blurs and transparency; oversized rounded cards; and any visual language that prioritizes aesthetic display over information density. Astera is closer to Obsidian, Linear, and modern developer tools than to a marketing dashboard or sci-fi terminal.

**Key Characteristics:**
- Tonal depth only — no shadows, no glass effects, no decorative blur
- Information density over visual spectacle
- Precision geometry — clean borders, consistent spacing, mechanical feel
- One accent color (electric cyan) reserved for active states and primary actions
- Dark by necessity, not by style — the graph needs contrast to breathe

## 2. Colors

The palette is built for a dark observatory field: warm charcoal surfaces, cool-tinted neutrals, and a single electric cyan instrument accent. Every color earns its place through function, never decoration.

### Primary

- **Electric Cyan** (#59F6FF): The instrument's reticle. Used exclusively for selection, active states, focus rings, and primary interactive feedback. Appears on ≤10% of any given screen. Its rarity is the point — when cyan appears, something important is happening.
- **Cyan Dim** (#3AA8B0): A muted version of the primary for backgrounds and hover states where full cyan would be too intense. Tonal container fills, selection backgrounds at 10% opacity.

### Semantic

- **Success Green** (#4ADE80): Positive states — no circular dependencies, healthy metrics, clean analysis results. Used in small doses: status badges, checkmarks, success messages.
- **Error Red** (#F87171): Failure states — circular dependencies detected, API errors, failed indexing. Never decorative; always signals a real problem.
- **Warning Amber** (#FBBF24): Caution states — high complexity, borderline metrics. Less urgent than error, more attention than info.
- **AI Violet** (#B388FF): Reserved for the AI analysis panel. A distinct identity that signals "this is not static analysis — this is inference."

### Neutral

- **Deep Space** (#1F2128): The primary background. Warm-tinted charcoal, not pure black. The warmth prevents the UI from feeling clinical while maintaining the contrast the graph needs.
- **Panel Surface** (#2A2D35): Sidebar, panels, cards. One step lighter than background, creating tonal layering without shadows.
- **Surface Dim** (#252830): Sidebar active state, secondary containers. A subtle intermediate step.
- **Surface Hover** (#32353D): Interactive hover state across all surfaces. Consistent across sidebar items, buttons, list rows.
- **Border** (#3A3D45): Structural dividers — sidebar edge, panel borders, input outlines, card edges. Always 1px, never decorative.
- **Border Light** (#454850): Lighter variant for subtle separation within panels — section dividers, nested containers.
- **Text Primary** (#E0E4EC): Body text, node names, primary labels. High contrast against dark backgrounds, never gray-on-dark.
- **Text Muted** (#8B91A0): Secondary text — descriptions, placeholder text, inactive labels. Must maintain ≥4.5:1 contrast ratio.
- **Text Dim** (#5A6070): Tertiary text — timestamps, metadata, tertiary labels. Used sparingly; never for text that carries meaning.
- **Label** (#AEB8C7): Node labels in the graph, medium-emphasis text in panels. Distinct from primary text for visual separation.

### Graph-Specific

- **Node Default** (#A7B5C9): Default fill for graph nodes. Muted, desaturated — the baseline from which selection and hover depart.
- **Node Hover** (#DCE8FF): Hovered node fill. Shifts toward blue-white, signaling interactivity without committing to selection.
- **Node Selected** (#59F6FF): Selected node fill. Full cyan — the most intense use of color in the entire graph, reserved for the user's current focus.
- **Edge Default** (#B4BED238): Default edge stroke at 22% opacity. Visible but subordinate — edges connect nodes, they don't compete with them.
- **Edge Hover** (#59F6FF): Hovered/highlighted edge. Full cyan, matching the selection color for consistency.

### Node Kind Colors

Each symbol kind gets a distinct muted hue for visual categorization in the graph:
- Module: #A78BFA (violet)
- Class: #7DD3FC (sky blue)
- Interface: #67E8F9 (cyan-light)
- Function: #A7B5C9 (cool gray — default, matches node-default)
- Method: #B0BAC9 (lighter cool gray)
- Enum: #FCD34D (amber)
- Variable: #F9A8D4 (pink)
- TypeAlias: #6EE7B7 (mint)
- Import: #6B7280 (neutral gray)

### Named Rules

**The Reticle Rule.** Electric cyan (#59F6FF) is used on ≤10% of any given screen. It appears only on: the currently selected node, active sidebar item, focus rings, primary action buttons, and highlighted edges. Everywhere else, it does not exist. Its rarity is the point — the eye follows it because it is rare.

**The Tonal Depth Rule.** Depth is conveyed through surface color steps (bg → surface → surface-hover), never through shadows, drop-shadows, or backdrop-blur. If it looks like it's floating, it's wrong. Everything sits on the same plane; hierarchy comes from color, not elevation.

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

This system uses flat tonal layering exclusively. No shadows exist anywhere in the interface. Depth is conveyed through three surface color steps: the background (#1F2128), the panel surface (#2A2D35), and hover states (#32353D). These create a clear visual hierarchy without any illusion of floating.

The graph canvas sits at the deepest layer (background). Panels and sidebars sit one step above (surface). Interactive elements shift one more step on hover (surface-hover). This is the entire elevation vocabulary.

The command palette and context menu are exceptions that float above the panel layer — they use a slightly lighter surface with a thin border, but no shadow or blur. If it looks like it's floating, it's wrong.

### Named Rules

**The Flat-By-Default Rule.** Surfaces are flat at rest. No shadows, no backdrop-blur, no lift on hover. Interactive feedback comes from surface color shifts (hover → surface-hover) and border color changes (border → primary), never from elevation changes. The only "lifted" elements are the command palette and context menu, which use z-index layering, not shadow.

**The Three-Step Rule.** There are exactly three surface depths: background, surface, surface-hover. No more. If a design needs a fourth surface color, it's over-decorated. Simplify.

## 5. Components

Every component is engineered — clean geometry, consistent spacing, crisp borders. The interface disappears so the graph remains the primary focus.

### Navigation Sidebar

- **Collapsed width:** 48px (icon rail only)
- **Expanded width:** 200px (icon + label + shortcut)
- **Background:** Surface Dim (#252830), one step darker than panel surface
- **Border:** 1px right border using Border (#3A3D45)
- **Nav items:** 10px vertical padding, 12px horizontal. Active state: 2px left accent bar + 10% cyan background. Hover: Surface Hover (#32353D).
- **Typography:** Label weight (600), 11px, icons 16px
- **Behavior:** Auto-expands on mouse-enter, auto-collapses on mouse-leave with 300ms delay
- **Active indicator:** 2px wide, 20px tall, rounded right, full cyan, positioned at left edge

### Panels (Symbols, Files, Metrics, Impact, Settings)

- **Width:** 380px fixed
- **Background:** Panel Surface (#2A2D35)
- **Border:** 1px left border using Border (#3A3D45)
- **Padding:** 16px consistent
- **Header:** Subtitle weight (1rem bold), 16px bottom margin
- **Sections:** Separated by 1px Border Light dividers
- **Entrance:** slideInRight 250ms cubic-bezier(0.16, 1, 0.3, 1)
- **Scrolling:** Custom scrollbar — 5px wide, Border thumb, transparent track

### Command Palette

- **Width:** max-w-lg (512px), centered
- **Background:** Surface (#2A2D35) with Border (#3A3D45) outline
- **Border-radius:** 12px (rounded-lg)
- **Shadow:** None — uses z-index (40) for layering only
- **Backdrop:** rgba(0, 0, 0, 0.5), semi-transparent overlay
- **Search input:** Full width, no border, Mono Data font, 16px horizontal padding
- **Results:** Compact rows — 8px vertical padding, 10px gap, Mono Data font for names
- **Keyboard hints:** Mono Small (10px), Text Dim color, right-aligned
- **Entrance:** fadeIn 150ms + slideUp 150ms

### Buttons

- **Primary:** Cyan background (#59F6FF), Deep Space text (#1F2128), 8px 16px padding, 4px radius, Label font (600, 11px). Hover: darken to Cyan Dim (#3AA8B0). Active: 95% scale.
- **Ghost:** Transparent background, Text Muted text (#8B91A0), 6px 12px padding, 4px radius. Hover: Surface Hover background + Text Primary color.
- **Icon-only:** 32x32px, transparent background, centered icon. Hover: Surface Hover. Used for toolbar actions.
- **All buttons:** 120ms ease-out transition. No decorative motion.

### Inputs / Fields

- **Background:** Deep Space (#1F2128), one step darker than panel surface
- **Border:** 1px Border (#3A3D45)
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

- **Background:** Surface Dim (#252830)
- **Border:** 1px Border (#3A3D45)
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

- **Background:** Surface (#2A2D35)
- **Border:** 1px Border (#3A3D45)
- **Border-radius:** 6px
- **Padding:** 4px 8px
- **Font:** Mono Small (10px)
- **Text:** Text Primary (#E0E4EC)
- **Position:** 8px offset from trigger, clamped to viewport
- **Entrance:** fadeIn 150ms
- **z-index:** 60

### Context Menu

- **Width:** 200px
- **Background:** Surface (#2A2D35) with Border (#3A3D45) outline
- **Border-radius:** 8px
- **Header:** 8px vertical, 12px horizontal, bottom Border divider
- **Items:** 32px height, 12px horizontal padding, 10px gap
- **Hover:** Surface Hover background
- **Separator:** 1px Border, 8px horizontal margin
- **Font:** Body (12px) for labels, Mono Small (10px) for kind badges
- **Entrance:** fadeIn 150ms

### Graph Canvas

- **Background:** Deep Space (#1F2128) with radial gradient vignette (top: #23252D → bottom: #1B1D23)
- **Nodes:** Geometry per NODE_SHAPES mapping (spheres, cubes, capsules, diamonds), muted Node Kind Colors at 92% opacity
- **Edges:** 1px stroke, Edge Default at 22% opacity, cyan on hover/selection
- **Labels:** Mono Data (11px), Label color (#AEB8C7) at 75% opacity
- **Selection glow:** 4px cyan ring around selected node
- **Hover highlight:** Edge color shift to cyan, node opacity increase

## 6. Do's and Don'ts

### Do:

- **Do** use tonal layering for depth — background → surface → surface-hover is the entire elevation vocabulary.
- **Do** reserve electric cyan (#59F6FF) for selection, focus, and active states only. It is the instrument's reticle, not a decorative accent.
- **Do** use IBM Plex Mono for all code, paths, IDs, and technical data. The monospace-for-data rule creates instant visual categorization.
- **Do** keep body text at ≥4.5:1 contrast ratio against dark backgrounds. Text Muted (#8B91A0) on surface (#2A2D35) passes; Text Dim on surface does not — reserve it for truly tertiary metadata.
- **Do** use 1px borders for structural separation. Borders are always functional, never decorative.
- **Do** honor `prefers-reduced-motion` — disable all animations, use static surfaces for skeletons, instant transitions for panels.
- **Do** maintain the sidebar → panel → content hierarchy. The sidebar is the deepest surface (Dim), panels are Surface, content is Background.
- **Do** use skeleton loading states, never spinners in the middle of content areas.

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
