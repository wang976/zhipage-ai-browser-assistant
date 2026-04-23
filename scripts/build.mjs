import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import { build as bundle } from "esbuild";
import { build as viteBuild } from "vite";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = resolve(rootDir, "dist");
const iconSource = resolve(rootDir, "images/icon.svg");
const iconOutputDir = resolve(rootDir, "public/icons");

async function generateIcons() {
  const svg = await readFile(iconSource);
  await mkdir(iconOutputDir, { recursive: true });

  for (const size of [16, 32, 48, 128]) {
    const resvg = new Resvg(svg, {
      fitTo: {
        mode: "width",
        value: size,
      },
    });

    const pngData = resvg.render().asPng();
    await writeFile(resolve(iconOutputDir, `icon${size}.png`), pngData);
  }
}

async function buildScripts() {
  await bundle({
    entryPoints: [resolve(rootDir, "src/background/index.ts")],
    outfile: resolve(distDir, "background.js"),
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "chrome116",
    sourcemap: true,
  });

  await bundle({
    entryPoints: [resolve(rootDir, "src/content/index.ts")],
    outfile: resolve(distDir, "content.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "chrome116",
    sourcemap: true,
  });
}

await rm(distDir, { recursive: true, force: true });
await generateIcons();
await viteBuild();
await buildScripts();
