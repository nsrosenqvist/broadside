# AGENTS.md

## What this is

Broadside is a Zola blog theme with a newspaper-inspired aesthetic. The design is typography-first: high-contrast serifs carry the visual weight, thin rules provide structure, and generous whitespace lets content breathe. Think of a well-typeset broadsheet adapted for the web — professional, calm, confident. Every design decision should pass the test: "Would a well-designed opinion section in a quality newspaper do this?"

The theme is meant for long-form technical writing — engineering essays, security analysis, architecture discussions — where restraint and editorial rigor signal that the author cares about craft. No gradients, no shadows, no rounded corners. The typography does the talking.

JavaScript is acceptable for progressive enhancement (e.g. mobile menu toggle, smooth scroll) but the site must degrade gracefully — all content and navigation must remain fully accessible with JS disabled.

## Project structure

This is a **standalone Zola theme repository**, not a full site. It gets pulled into a site's `themes/` directory as a Git submodule. The site's `config.toml` sets `theme = "broadside"`.

- `theme.toml` — Theme metadata
- `config.toml` — Demo site config (used by `dev.sh` and the Zola theme gallery)
- `content/` — Demo content exercising all theme features
- `screenshot.png` — Theme screenshot for the Zola gallery
- `sass/` — `style.scss` is the entry point; it imports partials (`_variables.scss`, `_reset.scss`, `_layout.scss`, etc.). Design tokens live in `_variables.scss`.
- `templates/` — Zola templates. `base.html` is the shell; all others extend it.
- `dev.sh` — Local dev server launcher (see below)
- `README.md` — User-facing documentation

## Development workflow

Run `./dev.sh` from the repo root. It creates a temp site at `/tmp/broadside-dev`, symlinks the theme, `content/`, and `config.toml` into it, and starts `zola serve` with live reload on port 1111. Edits to templates, Sass, or content trigger instant rebuilds.

Requires Zola installed (`zola` on PATH).

## Key design tokens

Colors are CSS custom properties in `sass/_variables.scss`, with both light and dark palettes via `prefers-color-scheme`. Sass variables alias the custom properties so they can be used throughout the partials. Fonts, layout, and transitions remain plain Sass variables.

- **Colors (CSS custom properties):** `--bg`, `--text-primary`, `--text-secondary`, `--text-tertiary`, `--accent`, `--border`, `--code-bg`, `--selection-bg`, `--header-bg`, `--nav-hover-bg`, `--nav-shadow`
- **Syntax highlighting:** `--syn-base`, `--syn-comment`, `--syn-keyword`, `--syn-string`, `--syn-number`, `--syn-function`, `--syn-type`, `--syn-punct`, `--syn-operator`, `--syn-variable` (in `_syntax.scss`)
- **Fonts:** `$serif` (Playfair Display — headlines), `$body-serif` (Source Serif 4 — body), `$sans` (Inter — UI/metadata), `$mono` (JetBrains Mono — code)
- **Layout:** `$content-width` (680px), `$wide-width` (960px), `$mobile-break` (640px)
- **Transitions:** `$transition-fast` (150ms), `$transition-base` (200ms), `$transition-slow` (300ms)

## Interactions

Hover effects are subtle and intentional — never flashy:

- Body links: underline fades in via `text-decoration-color` transition
- Headlines in post lists/cards: color shifts to accent on hover
- Images: very subtle scale (1.02) with overflow hidden
- Navigation: tertiary → primary color shift
- Pagination arrows: slight translateX nudge

All transitions use `ease` timing, 150–300ms range.

## Template conventions

- All templates extend `base.html`
- `base.html` generates OpenGraph, Twitter Card, and Schema.org JSON-LD metadata
- Posts use `page.lower` / `page.higher` for prev/next navigation (not `page.earlier`/`page.later`)
- Taxonomy URLs use `get_taxonomy_url(kind='categories', name=cat)`
- Featured images are co-located with posts (`extra.image` in frontmatter)
- The `extra.subtitle` field falls back to `page.description`
- Author falls back from `page.extra.author` → `config.extra.author`
- Syntax highlighting requires `highlight_theme = "css"` in `config.toml` so that dark mode token colors work

## Content structure for dev site

The `content/` directory demonstrates the recommended site structure:

- `_index.md` — root section with `paginate_by` and `sort_by = "date"`
- `essays/` — section with `transparent = true` so posts bubble up to the root paginator
- `notes/` — same pattern
- `about/` — section using `static_page.html` template for standalone pages without dates

Sections marked `transparent = true` make their pages visible to the parent section's paginator while also having their own listing page.
