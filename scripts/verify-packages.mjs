import fs from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "dist", "packages");
const packages = [
  { id: "wdr-media", entry: "worker.js", runtimeField: "worker" },
  { id: "shared-adapter-example", entry: "worker.js", runtimeField: "runtimeEntry" }
  ,{ id: "service-binding-adapter-example", entry: "worker.js", runtimeField: "worker" }
];
for (const item of packages) {
  const directory = path.join(root, item.id);
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, "manifest.json"), "utf8"));
  const declared = manifest[item.runtimeField]?.entry;
  if (declared !== `./${item.entry}`) throw new Error(`${item.id}: manifest entry does not match package layout`);
  if (!fs.statSync(path.join(directory, item.entry)).isFile()) throw new Error(`${item.id}: runtime entry is missing`);
  for (const language of ["readme.md", "readme_zh.md", "readme_ko.md"]) if (!fs.statSync(path.join(directory, language)).isFile()) throw new Error(`${item.id}: ${language} is missing`);
}
console.log(`Verified ${packages.length} plugin packages.`);
