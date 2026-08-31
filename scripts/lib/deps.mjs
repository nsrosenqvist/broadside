// Dependency resolution and bootstrap, shared by the theme's build scripts.
//
// The theme is consumed as a git submodule, so its package.json is never
// installed by the site's own `npm install` — nothing descends into
// themes/broadside. Rather than making every site declare mermaid and
// playwright-core in its own manifest, the scripts install them here, into the
// theme, the first time they are needed.
//
// Resolution order is theme first, then the site root. The site fallback is
// permanent, not a migration step: a site that already declares these
// dependencies (every Broadside site predating the theme manifest) keeps
// working untouched, and a site that would rather own its versions still can.

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// scripts/lib/deps.mjs -> scripts/lib -> scripts -> the theme root.
export const THEME_DIR = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

const themeRequire = createRequire(join(THEME_DIR, "package.json"));

// Two candidate resolvers, tried in order. The site one is built lazily per
// call because ROOT is the caller's to decide (SITE_ROOT overrides cwd).
function resolvers(siteRoot) {
  const out = [themeRequire];
  if (siteRoot) out.push(createRequire(join(siteRoot, "package.json")));
  return out;
}

/** Resolve a dependency, or null if it isn't installed anywhere we look. */
export function tryRequire(name, siteRoot) {
  for (const require of resolvers(siteRoot)) {
    try {
      return require(name);
    } catch {
      // Not here; try the next candidate.
    }
  }
  return null;
}

/** Filesystem path of a dependency's entry point, or null. */
export function tryResolve(name, siteRoot) {
  for (const require of resolvers(siteRoot)) {
    try {
      return require.resolve(name);
    } catch {
      // Not here; try the next candidate.
    }
  }
  return null;
}

const NO_BOOTSTRAP = process.env.BROADSIDE_NO_BOOTSTRAP === "1";

function run(cmd, args, label) {
  console.log(`broadside: ${label}`);
  const result = spawnSync(cmd, args, { stdio: "inherit", cwd: THEME_DIR });
  if (result.error || result.status !== 0) {
    return false;
  }
  return true;
}

/**
 * Make sure `names` can be resolved, installing the theme's dependencies if
 * they cannot. Returns true if everything is available afterwards.
 *
 * Installing during a build is deliberately surprising behaviour, so it
 * announces itself, runs at most once per process, and can be turned off with
 * BROADSIDE_NO_BOOTSTRAP=1 — which is what a site wanting a hermetic build
 * should set, having installed the dependencies itself.
 */
let bootstrapped = false;
export function ensureDeps(names, siteRoot) {
  const missing = names.filter((n) => tryResolve(n, siteRoot) === null);
  if (missing.length === 0) return true;

  if (NO_BOOTSTRAP) {
    console.error(
      `broadside: missing build dependencies: ${missing.join(", ")}\n` +
        "  BROADSIDE_NO_BOOTSTRAP=1 is set, so they will not be installed.\n" +
        "  Install them with: node themes/broadside/scripts/broadside.mjs bootstrap",
    );
    return false;
  }

  if (bootstrapped) return false;
  bootstrapped = true;

  // npm rather than the site's package manager: it ships with Node, and these
  // dependencies are the theme's own, not part of the site's dependency graph.
  // A plain node_modules directory here resolves the same either way.
  const ok = run(
    "npm",
    ["install", "--prefix", THEME_DIR, "--no-audit", "--no-fund", "--loglevel", "error"],
    `installing build dependencies (${missing.join(", ")}) into ${THEME_DIR}`,
  );
  if (!ok) {
    console.error(
      "broadside: dependency install failed. Install them by hand with:\n" +
        `      npm install --prefix ${THEME_DIR}`,
    );
    return false;
  }
  return names.every((n) => tryResolve(n, siteRoot) !== null);
}

/** Path to playwright-core's CLI, used to install browsers. */
function playwrightCli(siteRoot) {
  const entry = tryResolve("playwright-core", siteRoot);
  return entry ? join(dirname(entry), "cli.js") : null;
}

/**
 * Resolve Chromium, installing the browser binary if playwright has none.
 *
 * `--with-deps` is deliberately not passed here: it runs a package manager as
 * root, which a build should never do behind the user's back. On a bare CI
 * image that lacks the shared libraries, run `broadside.mjs bootstrap
 * --with-deps` as an explicit step instead — the example workflow in the
 * README does exactly that.
 */
export function loadChromium(siteRoot) {
  if (!ensureDeps(["playwright-core"], siteRoot)) process.exit(1);
  const { chromium } = tryRequire("playwright-core", siteRoot);

  if (existsSync(chromium.executablePath())) return chromium;

  if (NO_BOOTSTRAP) {
    console.error(
      "broadside: no Chromium found for playwright-core, and " +
        "BROADSIDE_NO_BOOTSTRAP=1 is set.\n" +
        "  Install it with: node themes/broadside/scripts/broadside.mjs bootstrap",
    );
    process.exit(1);
  }

  const cli = playwrightCli(siteRoot);
  if (!cli || !run("node", [cli, "install", "chromium"], "installing Chromium")) {
    console.error(
      "broadside: could not install Chromium. Install it by hand with:\n" +
        "      node themes/broadside/scripts/broadside.mjs bootstrap --with-deps",
    );
    process.exit(1);
  }
  return chromium;
}

/** Explicit bootstrap, for a CI step that would rather not install mid-build. */
export function bootstrap({ withDeps = false, siteRoot } = {}) {
  if (!ensureDeps(["mermaid", "playwright-core"], siteRoot)) return false;
  const cli = playwrightCli(siteRoot);
  if (!cli) return false;
  const args = ["install", ...(withDeps ? ["--with-deps"] : []), "chromium"];
  return run("node", [cli, ...args], `installing Chromium${withDeps ? " and its system libraries" : ""}`);
}

/** Where a build script should keep its cache, unless the site says otherwise. */
export function cacheDir(name, override) {
  return override ?? join(THEME_DIR, ".cache", name);
}
