import fs from "node:fs";
import path from "node:path";
import { loadPackageCatalog } from "./catalog-packages.mjs";

const root = process.cwd();
const dist = path.join(root, "dist", "packages");
const packages = loadPackageCatalog(root);

function copy(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function copyDirectory(source, target) {
  fs.cpSync(source, target, { recursive: true, dereference: true });
}

fs.rmSync(dist, { recursive: true, force: true });
for (const item of packages) {
  const output = path.join(dist, item.id);
  fs.mkdirSync(output, { recursive: true });
  copy(path.join(item.source, "manifest.json"), path.join(output, "manifest.json"));
  for (const language of ["readme.md", "readme_zh.md", "readme_ko.md"]) copy(path.join(item.source, language), path.join(output, language));
  copy(path.join(root, "dist", path.relative(root, item.source), "src", item.entry), path.join(output, item.entry));
  const ui = path.join(item.source, "ui", "index.html");
  if (fs.existsSync(ui)) copy(ui, path.join(output, "ui", "index.html"));
  const sdkRoot = path.join(root, "node_modules", "@carmediahub", "sdk");
  copy(path.join(sdkRoot, "package.json"), path.join(output, "node_modules", "@carmediahub", "sdk", "package.json"));
  copyDirectory(path.join(sdkRoot, "dist"), path.join(output, "node_modules", "@carmediahub", "sdk", "dist"));
}
