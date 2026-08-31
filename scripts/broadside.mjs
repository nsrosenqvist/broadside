#!/usr/bin/env node
// Broadside's build entry point. One command for a site to call, so adding the
// theme costs the site a single line rather than a dependency list, two script
// invocations and a pair of gitignore entries.
//
//   node themes/broadside/scripts/broadside.mjs build [zola args...]
//
// `build` runs `zola build`, then the two post-build steps that need the
// rendered site: diagram prerendering and og card generation. Arguments after
// the command are passed to zola untouched, so `--drafts`, `--base-url` and
// friends work as they always did.
//
// Commands:
//   build [args]        zola build + diagrams + og cards
//   diagrams            just the diagram pass, on an existing build
//   og                  just the og card pass, on an existing build
//   bootstrap [--with-deps]
//                       install the theme's build dependencies and Chromium
//                       ahead of time, rather than on first use
//
// Options:
//   --no-zola           skip `zola build` (the site built it another way)
//
// Environment:
//   BROADSIDE_NO_BOOTSTRAP=1  never install anything; fail with instructions
//                             instead. For hermetic or offline builds.
//   SITE_ROOT                 site root, if not the current working directory
//
// The individual scripts remain runnable on their own — this only saves a site
// from wiring them up in order.

import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { bootstrap, THEME_DIR } from "./lib/deps.mjs";

const ROOT = process.env.SITE_ROOT ?? process.cwd();
const [command, ...rest] = process.argv.slice(2);

const step = (script, label) => {
  const path = join(THEME_DIR, "scripts", script);
  const result = spawnSync(process.execPath, [path], {
    stdio: "inherit",
    cwd: ROOT,
    env: process.env,
  });
  if (result.status !== 0) {
    console.error(`broadside: ${label} failed`);
    process.exit(result.status ?? 1);
  }
};

const zola = (args) => {
  const result = spawnSync("zola", ["build", ...args], { stdio: "inherit", cwd: ROOT });
  if (result.error) {
    console.error(
      "broadside: could not run `zola`. Install it, or pass --no-zola if the\n" +
        "  site is built some other way before this runs.",
    );
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
};

switch (command) {
  case "build": {
    const args = rest.filter((a) => a !== "--no-zola");
    if (!rest.includes("--no-zola")) zola(args);
    step("build-diagrams.mjs", "diagram rendering");
    step("build-og-images.mjs", "og card generation");
    break;
  }

  case "diagrams":
    step("build-diagrams.mjs", "diagram rendering");
    break;

  case "og":
    step("build-og-images.mjs", "og card generation");
    break;

  case "bootstrap":
    process.exit(bootstrap({ withDeps: rest.includes("--with-deps"), siteRoot: ROOT }) ? 0 : 1);
    break;

  default:
    console.error(
      `broadside: unknown command ${command ? `\`${command}\`` : "(none given)"}\n` +
        "  usage: node themes/broadside/scripts/broadside.mjs " +
        "<build|diagrams|og|bootstrap> [args...]\n" +
        `  see the header of ${fileURLToPath(import.meta.url)} for the full list`,
    );
    process.exit(1);
}
