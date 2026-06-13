import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const buildDir = path.join(rootDir, "dist-portable");
const portableDir = path.join(rootDir, "portable");
const outputPath = path.join(portableDir, "smart-board-2.0.html");
const indexPath = path.join(buildDir, "index.html");

async function readAsset(assetPath) {
  const normalized = assetPath.replace(/^\.\//, "").replace(/^\//, "");
  return fs.readFile(path.join(buildDir, normalized), "utf8");
}

let html = await fs.readFile(indexPath, "utf8");

html = await replaceAsync(
  html,
  /<link rel="stylesheet" crossorigin href="([^"]+)">/g,
  async (_match, href) => {
    const css = await readAsset(href);
    return `<style>\n${css}\n</style>`;
  },
);

html = await replaceAsync(
  html,
  /<script type="module" crossorigin src="([^"]+)"><\/script>/g,
  async (_match, src) => {
    const js = await readAsset(src);
    return `<script type="module">\n${js}\n</script>`;
  },
);

await fs.mkdir(portableDir, { recursive: true });
await fs.writeFile(outputPath, html, "utf8");

console.log(`Portable build saved to ${outputPath}`);

async function replaceAsync(value, pattern, replacer) {
  const matches = [...value.matchAll(pattern)];
  let output = value;

  for (const match of matches.reverse()) {
    const replacement = await replacer(...match);
    output = `${output.slice(0, match.index)}${replacement}${output.slice(match.index + match[0].length)}`;
  }

  return output;
}
