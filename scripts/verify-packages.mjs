import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadPackageCatalog } from "./catalog-packages.mjs";

const root = path.join(process.cwd(), "dist", "packages");
const packages = loadPackageCatalog(process.cwd());
for (const item of packages) {
  const directory = path.join(root, item.id);
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, "manifest.json"), "utf8"));
  const declared = manifest[item.runtimeField]?.entry;
  if (declared !== `./${item.entry}`) throw new Error(`${item.id}: manifest entry does not match package layout`);
  if (!fs.statSync(path.join(directory, item.entry)).isFile()) throw new Error(`${item.id}: runtime entry is missing`);
  for (const language of ["readme.md", "readme_zh.md", "readme_ko.md"]) if (!fs.statSync(path.join(directory, language)).isFile()) throw new Error(`${item.id}: ${language} is missing`);
  const sdkPackage = path.join(directory, "node_modules", "@carmediahub", "sdk");
  if (!fs.statSync(path.join(sdkPackage, "package.json")).isFile() || !fs.statSync(path.join(sdkPackage, "dist", "index.js")).isFile()) throw new Error(`${item.id}: bundled SDK runtime is missing`);
  await import(pathToFileURL(path.join(directory, item.entry)).href);
}
console.log(`Verified ${packages.length} plugin packages.`);
