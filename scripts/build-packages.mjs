import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist", "packages");
const packages = [
  { id: "wdr-media", category: "official", source: "plugins/official/wdr-media", entry: "worker.js" },
  { id: "shared-adapter-example", category: "core-companion", source: "plugins/core-companion/shared-adapter-example", entry: "worker.js" }
  ,{ id: "service-binding-adapter-example", category: "adapters", source: "plugins/adapters/service-binding-adapter-example", entry: "worker.js" }
];

function copy(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

fs.rmSync(dist, { recursive: true, force: true });
for (const item of packages) {
  const output = path.join(dist, item.id);
  fs.mkdirSync(output, { recursive: true });
  copy(path.join(root, item.source, "manifest.json"), path.join(output, "manifest.json"));
  for (const language of ["readme.md", "readme_zh.md", "readme_ko.md"]) copy(path.join(root, item.source, language), path.join(output, language));
  copy(path.join(root, "dist", item.source, "src", "worker.js"), path.join(output, item.entry));
  const ui = path.join(root, item.source, "ui", "index.html");
  if (fs.existsSync(ui)) copy(ui, path.join(output, "ui", "index.html"));
}
