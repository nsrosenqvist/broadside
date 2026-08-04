// Renders Open Graph card images for a built Broadside site.
//
// Run it from your site root, after `zola build`:
//
//   node themes/broadside/scripts/build-og-images.mjs
//
// It needs `playwright-core` and a Chromium:
//
//   npm install --save-dev playwright-core
//   npx playwright install chromium
//
// How it works:
//   - Set `og_card = "og.png"` under [extra] in config.toml. The theme then
//     points every post without an explicit `og_image` at <permalink>/og.png.
//   - This script scans public/ for pages whose og:image ends in that filename,
//     reads title/date/category/author from the page's own JSON-LD, renders a
//     1200x630 card in headless Chromium and writes it beside the page.
//   - It also renders a site-wide fallback card at public/og-default.png for
//     the home page, sections and taxonomy pages. Point config.extra
//     .default_og_image at it.
//
// Nothing here is configured by hand: the site's name, description and host
// are read from the WebSite JSON-LD the theme already emits on every page, so
// this file needs no editing to be dropped into another site.
//
// Environment:
//   OG_IMAGE_SKIP=1   skip generation entirely (quick local builds)
//   OG_CARD_NAME      card filename, if you set `og_card` to something else
//   OG_LOCALE         date locale (default en-US)
//   OG_SITE_KICKER    kicker on the site-wide card (default: none)
//   OG_SITE_TAGLINE   tagline on the site-wide card (default: site description)
//   SITE_ROOT         site root, if not the current working directory

import {
  readFileSync,
  readdirSync,
  statSync,
  existsSync,
  copyFileSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const ROOT = process.env.SITE_ROOT ?? process.cwd();
const DIST = join(ROOT, "public");
const CARD_NAME = process.env.OG_CARD_NAME ?? "og.png";
const LOCALE = process.env.OG_LOCALE ?? "en-US";
// The site card is the one card with no post to derive from. Its kicker has no
// natural source at all, and the site description is written for a <meta> tag,
// which often repeats the site name the card already sets in 84px type.
const SITE_KICKER = process.env.OG_SITE_KICKER ?? "";
const SITE_TAGLINE = process.env.OG_SITE_TAGLINE ?? null;

// Content-addressed card cache: keyed by the sha256 of each card's rendered
// HTML, so a card only re-renders when its data or this template changes.
// Persist it across CI runs to skip Chromium entirely on most builds.
const CACHE = join(ROOT, ".og-cache");

if (process.env.OG_IMAGE_SKIP === "1") {
  console.log("OG_IMAGE_SKIP=1 — skipping og image generation");
  process.exit(0);
}

if (!existsSync(DIST)) {
  console.error(`og: no build found at ${DIST} — run \`zola build\` first`);
  process.exit(1);
}

// --- Read the site's own metadata -------------------------------------------

// Tera HTML-escapes attribute values (e.g. "/" becomes &#x2F;) — decode before matching.
const decodeEntities = (s) =>
  s
    .replace(/&#x2F;/g, "/")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

function jsonLd(html, type) {
  for (const m of html.matchAll(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
  )) {
    let data;
    try {
      data = JSON.parse(m[1]);
    } catch {
      continue;
    }
    if ([].concat(type).includes(data["@type"])) return data;
  }
  return null;
}

function siteInfo() {
  const home = join(DIST, "index.html");
  const site = existsSync(home)
    ? jsonLd(readFileSync(home, "utf8"), "WebSite")
    : null;
  let host = "";
  try {
    host = new URL(site?.url ?? "").host;
  } catch {
    host = "";
  }
  return {
    name: site?.name ?? "",
    description: site?.description ?? "",
    host,
  };
}

const SITE = siteInfo();

// --- Collect pages that need a generated card -------------------------------

function* htmlFiles(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* htmlFiles(path);
    else if (entry === "index.html") yield path;
  }
}

function pageData(file) {
  const html = readFileSync(file, "utf8");
  const og = html.match(/<meta property="og:image" content="([^"]+)"/);
  if (!og || !decodeEntities(og[1]).endsWith(`/${CARD_NAME}`)) return null;

  // The theme emits Article JSON-LD on every post — use it as the data source
  // so the card always matches the page's actual metadata.
  const data = jsonLd(html, ["Article", "BlogPosting"]);
  if (!data) return null;

  return {
    out: join(dirname(file), CARD_NAME),
    title: data.headline ?? "",
    date: data.datePublished ?? null,
    category: data.articleSection ?? null,
    author: data.author?.name ?? null,
  };
}

const posts = [...htmlFiles(DIST)].map(pageData).filter(Boolean);

// --- Card template ----------------------------------------------------------

// Locked to the Broadside dark palette so rendering is deterministic
// regardless of the headless browser's color-scheme emulation. Change these
// four values to match a customised palette.
const BG = "#1a1a1e";
const FG = "#e8e6e3";
const MUTED = "#9a9a9a";
const ACCENT = "#d4605a";

const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString(LOCALE, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

const shell = (body) => `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.bunny.net">
<link href="https://fonts.bunny.net/css2?family=Inter:wght@400;500&family=Playfair+Display:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; overflow: hidden; }
  body {
    background: ${BG};
    color: ${FG};
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 72px 80px 64px;
    border-top: 10px solid ${ACCENT};
  }
  .category {
    font: 500 22px/1 'Inter', sans-serif;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: ${ACCENT};
  }
  .headline {
    font-family: 'Playfair Display', Georgia, serif;
    font-weight: 500;
    color: ${FG};
    text-wrap: balance;
  }
  .meta {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font: 400 24px/1 'Inter', sans-serif;
    color: ${MUTED};
  }
  .meta .site {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 28px;
    color: ${FG};
  }
  .tagline {
    font: 400 30px/1.5 'Inter', sans-serif;
    color: ${MUTED};
    max-width: 850px;
  }
</style>
</head>
<body>${body}</body>
</html>`;

function postCard({ title, date, category, author }) {
  // Three sizes rather than a fitting loop: a headline long enough to need a
  // fourth is long enough to be worth shortening.
  const size = title.length < 40 ? 84 : title.length < 80 ? 66 : 52;
  const meta = [author, date ? formatDate(date) : null]
    .filter(Boolean)
    .map(escape)
    .join(" &middot; ");
  return shell(`
    <div class="category">${category ? escape(category) : "&nbsp;"}</div>
    <div class="headline" style="font-size:${size}px; line-height:1.15">${escape(title)}</div>
    <div class="meta"><span>${meta}</span><span class="site">${escape(SITE.host)}</span></div>
  `);
}

function defaultCard() {
  return shell(`
    <div class="category">${SITE_KICKER ? escape(SITE_KICKER) : "&nbsp;"}</div>
    <div>
      <div class="headline" style="font-size:84px; line-height:1.1; margin-bottom:28px">${escape(SITE.name)}</div>
      <div class="tagline">${escape(SITE_TAGLINE ?? SITE.description)}</div>
    </div>
    <div class="meta"><span>${escape(SITE.host)}</span></div>
  `);
}

// Resolved lazily, and from the *site* rather than from this file: a plain
// import would resolve relative to themes/broadside/ and walk out of the site
// entirely when the theme is symlinked rather than vendored. Lazily, because a
// run that skips generation or hits the cache for every card never needs a
// browser at all — and shouldn't fail for want of one.
function loadChromium() {
  try {
    return createRequire(join(ROOT, "package.json"))("playwright-core").chromium;
  } catch {
    console.error(
      "og: playwright-core not found. Install it in your site:\n" +
        "      npm install --save-dev playwright-core\n" +
        "      npx playwright install chromium",
    );
    process.exit(1);
  }
}

// --- Render -----------------------------------------------------------------

mkdirSync(CACHE, { recursive: true });

const cards = [
  { out: join(DIST, "og-default.png"), html: defaultCard() },
  ...posts.map((p) => ({ out: p.out, html: postCard(p) })),
].map((card) => ({
  ...card,
  cached: join(
    CACHE,
    createHash("sha256").update(card.html).digest("hex") + ".png",
  ),
}));

// Cache hits are plain file copies; Chromium only launches for misses.
const misses = cards.filter((c) => !existsSync(c.cached));

if (misses.length > 0) {
  const browser = await loadChromium().launch();
  try {
    const context = await browser.newContext({
      viewport: { width: 1200, height: 630 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    for (const { cached, out, html } of misses) {
      await page.setContent(html, { waitUntil: "networkidle" });
      // Without this the screenshot can land before the webfonts swap in.
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: cached,
        clip: { x: 0, y: 0, width: 1200, height: 630 },
      });
      console.log(`og: rendered ${out.slice(DIST.length)}`);
    }
  } finally {
    await browser.close();
  }
}

for (const { cached, out } of cards) copyFileSync(cached, out);

// Drop cache entries no card referenced this run (deleted or renamed posts,
// template redesigns) so the cache doesn't grow without bound.
const live = new Set(cards.map((c) => c.cached));
for (const entry of readdirSync(CACHE)) {
  const path = join(CACHE, entry);
  if (!live.has(path)) rmSync(path);
}

console.log(
  `og images: ${cards.length} total, ${misses.length} rendered, ${cards.length - misses.length} from cache`,
);
