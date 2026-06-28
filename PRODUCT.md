# Product

## Register

product

## Users

Developers and engineering teams who need to understand large codebases quickly. They are in a task — exploring code structure, tracing dependencies, assessing change impact, or onboarding to a new project. They use CLI tools like ripgrep, jq, and cloc daily, and expect the same speed and composability in a graph exploration tool.

## Product Purpose

Astera is a local-first static analysis engine that parses repositories into a queryable Code Property Graph (CPG). It exists to make the invisible architecture of code visible — turning millions of lines of source into an explorable graph of symbols, calls, dependencies, and metrics. Success means a developer can answer "what does this function call?" or "what breaks if I change this file?" in under 2 seconds, without reading source.

## Brand Personality

Precision, depth, calm. The observatory metaphor: you are looking at a vast codebase through a precision instrument. Not flashy, not aggressive — quietly powerful. Three words: **precise, deep, living.**

## Anti-references

- Generic SaaS dashboards with card grids, gradient heroes, and "Welcome back!" headlines
- Cyberpunk "hacker" UIs with scanlines, neon RGB glow, and green-on-black terminals
- Glassmorphism-heavy interfaces with decorative backdrop-blurs and frosted glass
- Oversized rounded cards with icon + heading + text repeated in identical grids
- AI-generated purple-blue gradient overlays

## Design Principles

1. **Dark by necessity, not by style** — the graph needs maximum contrast to breathe. OLED black is the canvas, not a theme choice.
2. **The instrument disappears** — the UI is a precision tool that serves the data. Every pixel of decoration that doesn't serve code comprehension is waste.
3. **The graph is alive** — perpetual ambient breathing, spring-based particle parallax, energy pulses on connections. A codebase is not a static diagram; the interface reflects that.
4. **Local-first, zero-setup** — single binary, embedded frontend, SQLite storage. No server, no build step, no config required.
5. **Density over spectacle** — information-rich surfaces for users in a task. Show more data, not more whitespace.

## Accessibility & Inclusion

- WCAG AA contrast ratios (4.5:1 body text, 3:1 large text)
- `prefers-reduced-motion`: disable ambient breathing, particle drift, entrance animations
- Keyboard navigation: command palette, sidebar, graph node selection via keyboard
- Focus indicators on all interactive elements (cyan outline, 2px offset)
- Screen reader labels on graph canvas and interactive elements
