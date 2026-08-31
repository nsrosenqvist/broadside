// Prerenders ```mermaid fences in a built Broadside site to inline SVG.
//
// Run it from your site root, after `zola build`:
//
//   node themes/broadside/scripts/build-diagrams.mjs
//
// It needs `mermaid` and `playwright-core`, plus a Chromium:
//
//   npm install --save-dev mermaid playwright-core
//   npx playwright install chromium
//
// How it works:
//   - Zola highlights a ```mermaid fence as an ordinary code block and tags it
//     `data-lang="mermaid"` (giallo ships a mermaid syntax, so the fence also
//     passes `error_on_missing_language`). This script finds those blocks in
//     public/, recovers the source, renders it in headless Chromium and swaps
//     the <pre> for a <figure class="diagram"> holding the SVG.
//   - Each diagram is rendered twice, once per colour scheme, because mermaid
//     bakes concrete colours into the SVG it emits — it derives shades from
//     them, so a CSS custom property cannot be passed through. The two copies
//     are swapped by `prefers-color-scheme` in the stylesheet.
//   - Colours come from the site's own compiled style.css, so a site that
//     retunes the palette gets diagrams that match without touching this file.
//
// Nothing is rendered at `zola serve` time — a fence shows as its source text
// during `zola serve`, and as a diagram in `zola build` output. That is also
// the no-JavaScript fallback, since the SVG is static and there is no client
// runtime at all.
//
// Environment:
//   MERMAID_SKIP=1   skip rendering entirely (quick local builds)
//   MERMAID_FONT     label font family (default: the theme's Inter stack)
//   SITE_ROOT        site root, if not the current working directory

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  existsSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const ROOT = process.env.SITE_ROOT ?? process.cwd();
const DIST = join(ROOT, "public");
const FONT = process.env.MERMAID_FONT ?? "Inter, Helvetica Neue, Arial, sans-serif";

// Content-addressed cache: keyed by the sha256 of each diagram's source, the
// palette it is rendered against and the mermaid version, so a diagram only
// re-renders when one of those changes. Persist it across CI runs to skip
// Chromium entirely on most builds.
const CACHE = join(ROOT, ".mermaid-cache");

// Bump when the render options below change in a way that should invalidate
// every cached diagram. The palette and mermaid version are already part of
// the key and don't need this.
const RENDER_VERSION = 1;

const require = createRequire(join(ROOT, "package.json"));

if (process.env.MERMAID_SKIP === "1") {
  console.log("MERMAID_SKIP=1 — skipping diagram rendering");
  process.exit(0);
}

if (!existsSync(DIST)) {
  console.error(`diagrams: no build found at ${DIST} — run \`zola build\` first`);
  process.exit(1);
}

// --- Find the diagrams ------------------------------------------------------

const decodeEntities = (s) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&amp;/g, "&");

// Matches the block whether highlighting is on (giallo tags the <code> with
// `data-lang`) or off (Zola falls back to `class="language-mermaid"`). The
// source is recovered by dropping the per-token markup giallo wraps each line
// in — it emits no tokens for mermaid today, but stripping tags is exact
// either way, and the line breaks are real newlines outside the spans.
const BLOCK =
  /<pre[^>]*>\s*<code[^>]*(?:data-lang="mermaid"|class="[^"]*language-mermaid[^"]*")[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/g;

function* htmlFiles(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* htmlFiles(path);
    else if (entry.endsWith(".html")) yield path;
  }
}

const pages = [];
for (const file of htmlFiles(DIST)) {
  const html = readFileSync(file, "utf8");
  const blocks = [];
  for (const m of html.matchAll(BLOCK)) {
    blocks.push({
      raw: m[0],
      source: decodeEntities(m[1].replace(/<[^>]*>/g, "")).trim(),
    });
  }
  if (blocks.length > 0) pages.push({ file, html, blocks });
}

// Returns before the prune pass on purpose. A build with no diagrams at all —
// a production build of a site whose only diagram is in a draft, say — should
// leave the cache alone rather than empty it and make the next real build
// launch Chromium for everything.
if (pages.length === 0) {
  console.log("diagrams: none found");
  process.exit(0);
}

// --- Palette ----------------------------------------------------------------

// Read from the site's compiled stylesheet rather than hardcoded here: the
// custom properties are the theme's design tokens, and a site that overrides
// them should get diagrams in its own colours. Falls back to the Broadside
// defaults if the stylesheet is missing or shaped unexpectedly.
const FALLBACK = {
  light: {
    bg: "#faf8f5",
    "text-primary": "#1a1a1a",
    "text-secondary": "#6b6b6b",
    "text-tertiary": "#999",
    border: "#e0ddd8",
    "code-bg": "#f5f3f0",
  },
  dark: {
    bg: "#1a1a1e",
    "text-primary": "#e8e6e3",
    "text-secondary": "#9a9a9a",
    "text-tertiary": "#6b6b6b",
    border: "#2e2e32",
    "code-bg": "#222226",
  },
};

function readPalettes() {
  const css = join(DIST, "style.css");
  if (!existsSync(css)) return FALLBACK;
  const text = readFileSync(css, "utf8");

  const declarations = (block) => {
    const out = {};
    for (const m of block.matchAll(/--([\w-]+)\s*:\s*([^;}]+)/g)) {
      out[m[1]] = m[2].trim();
    }
    return out;
  };

  const dark = {};
  const darkBlocks =
    /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([^}]*)\}/g;
  let plain = text;
  for (const m of text.matchAll(darkBlocks)) {
    Object.assign(dark, declarations(m[1]));
    plain = plain.replace(m[0], "");
  }

  // Whatever is left is scheme-independent, so it seeds both palettes: a token
  // declared once outside a media query has the same value in either scheme.
  const light = {};
  for (const m of plain.matchAll(/:root\s*\{([^}]*)\}/g)) {
    Object.assign(light, declarations(m[1]));
  }

  if (!light.bg) return FALLBACK;
  return { light, dark: { ...light, ...dark } };
}

const PALETTES = readPalettes();

// Deliberately monochrome: the theme's palette is one accent and a range of
// greys, and a diagram drawn in greys with a thin border is what the rest of
// the page looks like. A diagram that needs colour should ask for it with
// mermaid's own `classDef`/`style` statements rather than getting it here.
function themeVariables(p) {
  const fg = p["text-primary"];
  const line = p["text-secondary"];
  const fill = p["code-bg"];
  return {
    background: p.bg,
    // Core tokens — mermaid derives most other colours from these.
    primaryColor: fill,
    primaryTextColor: fg,
    primaryBorderColor: fg,
    secondaryColor: p.bg,
    tertiaryColor: p.bg,
    lineColor: line,
    textColor: fg,
    // Tokens whose defaults are otherwise off-palette in one scheme or both.
    mainBkg: fill,
    nodeBorder: fg,
    nodeTextColor: fg,
    edgeLabelBackground: p.bg,
    clusterBkg: p.bg,
    clusterBorder: p.border,
    titleColor: fg,
    noteBkgColor: fill,
    noteTextColor: fg,
    noteBorderColor: p.border,
    actorBkg: fill,
    actorBorder: fg,
    actorTextColor: fg,
    actorLineColor: line,
    signalColor: fg,
    signalTextColor: fg,
    labelBoxBkgColor: fill,
    labelBoxBorderColor: fg,
    labelTextColor: fg,
    loopTextColor: fg,
    fontFamily: FONT,
    fontSize: "15px",
  };
}

const CONFIG = {
  startOnLoad: false,
  securityLevel: "strict",
  theme: "base",
  // Labels must be SVG <text>, not the default <foreignObject><div><p>. A
  // foreignObject label is styled by the *host* page once the SVG is inlined,
  // so `.article-body p` margins land inside the node box and push the text
  // out of it. <text> is self-contained and travels intact.
  htmlLabels: false,
  flowchart: { htmlLabels: false, useMaxWidth: true, curve: "linear" },
  fontFamily: FONT,
};

// --- Cache ------------------------------------------------------------------

mkdirSync(CACHE, { recursive: true });

const MERMAID_ENTRY = require.resolve("mermaid/dist/mermaid.min.js");
const MERMAID_VERSION = require("mermaid/package.json").version;

const key = (source) =>
  createHash("sha256")
    .update(
      JSON.stringify({
        source,
        palettes: PALETTES,
        config: CONFIG,
        version: MERMAID_VERSION,
        render: RENDER_VERSION,
      }),
    )
    .digest("hex");

// One entry per diagram holding both schemes — they are rendered together and
// expire together, so splitting them across two files would only make the
// prune pass harder to reason about.
const diagrams = new Map();
for (const page of pages) {
  for (const block of page.blocks) {
    const hash = key(block.source);
    block.hash = hash;
    if (!diagrams.has(hash)) {
      diagrams.set(hash, { hash, source: block.source, path: join(CACHE, `${hash}.json`) });
    }
  }
}

const all = [...diagrams.values()];
const misses = all.filter((d) => !existsSync(d.path));

// --- Render -----------------------------------------------------------------

// Resolved lazily, and from the *site* rather than from this file: a plain
// import would resolve relative to themes/broadside/ and walk out of the site
// entirely when the theme is symlinked rather than vendored. Lazily, because a
// run where every diagram hits the cache never needs a browser at all.
function loadChromium() {
  try {
    return require("playwright-core").chromium;
  } catch {
    console.error(
      "diagrams: playwright-core not found. Install it in your site:\n" +
        "      npm install --save-dev playwright-core\n" +
        "      npx playwright install chromium",
    );
    process.exit(1);
  }
}

if (misses.length > 0) {
  const browser = await loadChromium().launch();
  try {
    const page = await browser.newPage();
    // The same font stack the page will render the SVG in. Mermaid measures
    // label text to size the boxes around it, so rendering before the webfont
    // arrives lays the diagram out against a fallback face and every box comes
    // out the wrong width.
    await page.setContent(
      `<!DOCTYPE html><html><head><meta charset="utf-8">
       <link rel="preconnect" href="https://fonts.bunny.net">
       <link href="https://fonts.bunny.net/css2?family=Inter:wght@400;500&display=swap" rel="stylesheet">
       </head><body></body></html>`,
      { waitUntil: "networkidle" },
    );
    await page.evaluate(() => document.fonts.ready);
    await page.addScriptTag({ path: MERMAID_ENTRY });

    for (const diagram of misses) {
      const out = {};
      for (const scheme of ["light", "dark"]) {
        const result = await page.evaluate(
          async ([source, config, vars, id]) => {
            try {
              window.mermaid.initialize({ ...config, themeVariables: vars });
              const { svg } = await window.mermaid.render(id, source);
              return { svg };
            } catch (err) {
              return { error: String(err?.message ?? err) };
            }
          },
          [
            diagram.source,
            CONFIG,
            themeVariables(PALETTES[scheme]),
            // Namespaces the <style> mermaid embeds in the SVG, so two
            // diagrams on one page cannot style each other.
            `mermaid-${diagram.hash.slice(0, 12)}-${scheme}`,
          ],
        );

        if (result.error) {
          // Loud, like `error_on_missing_language`: a diagram that doesn't
          // parse is a mistake in the post, and shipping the source text in
          // its place would hide it.
          console.error(
            `diagrams: failed to render a diagram\n` +
              `  ${result.error}\n` +
              diagram.source
                .split("\n")
                .map((l) => `  | ${l}`)
                .join("\n"),
          );
          process.exit(1);
        }
        out[scheme] = normalize(result.svg);
      }
      writeFileSync(diagram.path, JSON.stringify(out));
      console.log(`diagrams: rendered ${diagram.hash.slice(0, 12)}`);
    }
  } finally {
    await browser.close();
  }
}

// `useMaxWidth` pins the SVG to its natural width so a three-box diagram isn't
// blown up to the width of the column. Kept, but floored by the column: past
// that the diagram has to scale down or it would run into the margin.
function normalize(svg) {
  return svg.replace(
    /style="max-width:\s*([\d.]+)px;?"/,
    'style="max-width: min(100%, $1px)"',
  );
}

// --- Substitute -------------------------------------------------------------

let count = 0;
for (const page of pages) {
  let html = page.html;
  for (const block of page.blocks) {
    const { light, dark } = JSON.parse(readFileSync(diagrams.get(block.hash).path, "utf8"));
    // Both schemes sit in the DOM and the stylesheet hides one. `display: none`
    // takes it out of the accessibility tree too, so a screen reader reads the
    // diagram once rather than twice.
    const figure =
      `<figure class="diagram">` +
      `<div class="diagram__scheme diagram__scheme--light">${light}</div>` +
      `<div class="diagram__scheme diagram__scheme--dark">${dark}</div>` +
      `</figure>`;
    html = html.split(block.raw).join(figure);
    count += 1;
  }
  writeFileSync(page.file, html);
}

// Drop cache entries no diagram referenced this run (edited or deleted posts,
// a retuned palette) so the cache doesn't grow without bound.
const live = new Set(all.map((d) => d.path));
for (const entry of readdirSync(CACHE)) {
  const path = join(CACHE, entry);
  if (!live.has(path)) rmSync(path);
}

console.log(
  `diagrams: ${count} on ${pages.length} page(s), ` +
    `${all.length} unique, ${misses.length} rendered, ${all.length - misses.length} from cache`,
);
