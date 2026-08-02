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
- `templates/` — Zola templates. `base.html` is the shell; all others extend it. `macros/` holds Tera macro modules, `shortcodes/` the shortcodes authors call from markdown, and `rss.xml` is a deliberate copy of Zola's built-in feed template (see below)
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
- Feed discovery goes in `base.html`'s `feed_links` block; `taxonomy_single.html`
  overrides it with `super()` to add the term's own feed. The
  `config.generate_feeds` guard must stay *inside* that block — Tera cannot
  resolve `super()` for a block nested in control flow
- The header's Subscribe control is a `<details>` dropdown listing every term
  of every taxonomy with `feed = true`, and falls back to a plain link to the
  site feed when no taxonomy has one. It is a `<summary>` rather than scripted
  markup so it opens, closes and takes keyboard focus with JS off; the script
  in `base.html` only adds click-away and Escape
- `base.html` generates OpenGraph, Twitter Card, and Schema.org JSON-LD metadata
- Posts use `page.lower` / `page.higher` for prev/next navigation (not `page.earlier`/`page.later`)
- Taxonomy URLs use `get_taxonomy_url(kind='categories', name=cat)`
- Two taxonomies, with a deliberate hierarchy: `categories` is primary — only
  its **first** entry is rendered as the kicker above a headline and as the
  label in post lists, so a post's top line reads the same whether it has one
  category or four. Any further categories join `tags` in the article
  header's topics row, below the metadata rule, styled as lowercase
  `#hashtags` (`.topic-label`) rather than as kickers. `tags` is optional;
  guard it with `page.taxonomies.tags | default(value=[])` so sites that
  don't declare the taxonomy never reach `get_taxonomy_url(kind='tags')`
- Featured images are co-located with posts (`extra.image` in frontmatter).
  In the homepage two-column grid they are cropped to 3:2 (`object-fit:
  cover`) so a row's images are always the same height, and the cards
  subgrid onto a shared image band so headlines align even when only one
  post in the row has an image. That band is why the card's text lives in
  a `.post-card__content` wrapper — don't unwrap it
- The `extra.subtitle` field falls back to `page.description`
- Author falls back from `page.extra.author` → `config.extra.author`
- Syntax highlighting requires `highlight_theme = "css"` in `config.toml` so that dark mode token colors work

## Callouts

`templates/shortcodes/callout.html` exists because Zola does not render GFM
alerts — verified against 0.22.1, where `> [!NOTE]` emits the marker as
literal text inside the blockquote and no `[markdown]` option changes it. If a
later Zola gains them, this shortcode can stay as the styled path and the raw
syntax will simply start rendering as something plainer.

The body is run through the `markdown` filter, so callouts take lists, links
and code. The argument is `label` rather than `title` because `title` is also
a Tera filter and the two collide unreadably in one expression. An unknown
`kind` is not an error: it gets its own capitalised label, which surfaces a
typo on the page instead of silently rendering a note.

Only `warning` and `caution` take the accent. Giving all five their own colour
was considered and rejected — the palette is one accent and a range of greys,
and five hues would make callouts the loudest thing on the page. A callout
also has to stay distinguishable from a blockquote near it; they are told
apart by weight rather than decoration, so don't give the callout an accent
rule or italic serif.

## AI transparency

The user-facing contract is in the README; this is what an editor of the
templates needs to know. `templates/macros/ai.html` is the single place a
post's posture is resolved — page furniture, image credits and the feed
sentence all come out of it, so a wording or precedence change happens once.
The postures map onto EU AI Act Art. 50 and the header comment in that file
explains which clause each one answers; keep them in step if you rename any.

A post's `ai_note` replaces the posture's sentence but never its label — the
labels are the comparable part of the scheme and per-post wording would let
two posts claim the same posture in different words. `ai_note` also forces
visibility everywhere the text disclosure is decided (byline, note, feed):
someone who wrote a sentence meant it to be read, and silently dropping it
under `show_when_none = false` would be the worst possible failure here.

The disclosure prose lives in one macro, `statement`, which the article note
and the feed item both wrap — the page in a `<p>`, the feed in escaped
entities. They share one visibility rule too, so `show_when_none` cannot mean
one thing on the page and another in a reader. Add a posture and you add it
once. Don't inline a sentence into either caller.

Four things in here will look like mistakes and are not:

- **Config prose is piped through `| safe`.** A macro's interpolations are
  escaped by the macro's own template *and* again by the caller, so an
  apostrophe in a note came out as `&amp;#x27;` on the page. `| safe` leaves
  exactly one pass. It also means these strings are inserted as authored,
  which the README states
- **`templates/rss.xml` is a vendored copy of Zola's built-in.** It exists so
  the disclosure travels with the feed item; Art. 50(5) counts a subscriber's
  reader as first exposure. Re-sync it when bumping Zola
- **The feed macro writes `&lt;p&gt;` rather than `<p>`.** An RSS
  `<description>` carries HTML escaped *into* the XML — a literal `<p>` would
  become an XML child element of `<description>` instead of part of the item's
  content. Template literals are never escaped, so the entities are written by
  hand to match the escaped `page.content` beside them
- **The separator before an image credit is emitted by the template, not
  CSS.** A caption is a text node, so no selector can distinguish "credit
  after a caption" from "credit standing alone", and `:not(:first-child)`
  silently never fires

Provenance narrows across three levels — `ai_image` (whole post) → `image_ai`
(featured image) → `figure(ai=…)` (one body image). Body images deliberately
do not inherit the post-level claim; a blanket statement must not credit a
photograph somebody took with a camera. When adding a fifth posture or a new
site, check all four render sites: metadata line, foot note, image caption,
feed item.

The feature is off unless a site declares `[extra.ai_transparency]`. Any
change here should be re-checked against a build with that block deleted —
existing sites must see byte-identical output.

## Content structure for dev site

The `content/` directory demonstrates the recommended site structure:

- `_index.md` — root section with `paginate_by` and `sort_by = "date"`
- `essays/` — section with `transparent = true` so posts bubble up to the root paginator
- `notes/` — same pattern
- `about/` — section using `static_page.html` template for standalone pages without dates

Sections marked `transparent = true` make their pages visible to the parent section's paginator while also having their own listing page.
