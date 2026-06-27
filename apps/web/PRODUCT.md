# Product

## Register

product

## Users

Software engineers and tech leads exploring codebases. Context: sitting at a desk, multi-monitor setup, ambient lighting. Job: understand code structure, trace dependencies, assess impact of changes, review complexity metrics. Primary task on the graph screen: visually orient themselves in a large codebase and navigate between connected symbols.

## Product Purpose

Astera is a local-first static analysis engine that parses codebases into a queryable Code Property Graph. The web frontend is the exploration surface — a 3D knowledge graph that makes code structure immediately visible and navigable. Success: a developer opens the graph and instantly understands how their codebase is structured, where the clusters are, what connects to what.

## Brand Personality

Voice: quiet confidence, technical depth, premium craft. Three words: calm, precise, intelligent. Emotional goals: the user should feel they're using a tool built by engineers who care deeply about quality — not a toy demo, not a SaaS landing page, but a serious instrument.

## Anti-references

- Bright/neon cyberpunk UIs (Unity, Unreal Engine demos)
- SaaS-style gradient hero metrics
- Flashy particle effects that serve no purpose
- Generic dashboard card grids
- Bootstrap/Tailwind default look-and-feel
- Anything that feels like it was generated rather than crafted

## Design Principles

1. **Clarity over decoration** — every visual element communicates structure, never noise
2. **Calm intelligence** — the tool should feel like a quiet expert, not a loud show-off
3. **Performance is a feature** — smooth 60fps rendering is non-negotiable
4. **Progressive density** — show less by default, reveal on demand
5. **Physical metaphor** — the graph is a living network floating in space, not a flat diagram

## Accessibility & Inclusion

- Reduced motion: honor `prefers-reduced-motion` — disable particles, simplify transitions
- Keyboard navigation: all graph interactions accessible via keyboard
- Focus indicators: visible focus rings on interactive elements
- Screen reader: graph is supplementary; data is also available via table views (Symbols, Files pages)
