import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateManifest } from "@carmediahub/sdk";
import { loadPackageCatalog, validateManifestSchema } from "./catalog-packages.mjs";

const root = path.join(process.cwd(), "dist", "packages");
const packages = loadPackageCatalog(process.cwd());

function parseVersion(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/u.exec(value);
  return match === null ? undefined : { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

function compareVersion(left, right) {
  return left.major - right.major || left.minor - right.minor || left.patch - right.patch;
}

export function isSdkVersionCompatible(range, version) {
  const match = /^(\^|~)?(\d+\.\d+\.\d+)$/u.exec(range);
  const minimum = match === null ? undefined : parseVersion(match[2]);
  const actual = parseVersion(version);
  if (minimum === undefined || actual === undefined || compareVersion(actual, minimum) < 0) return false;
  if (match[1] === undefined) return compareVersion(actual, minimum) === 0;
  if (match[1] === "~") return actual.major === minimum.major && actual.minor === minimum.minor;
  if (minimum.major === 0 && minimum.minor === 0) return actual.major === 0 && actual.minor === 0 && actual.patch === minimum.patch;
  if (minimum.major === 0) return actual.major === 0 && actual.minor === minimum.minor;
  return actual.major === minimum.major;
}

export function validatePackagedManifest(manifest, item) {
  try { validateManifestSchema(manifest, `${item.id}: packaged Manifest`); } catch (error) { throw new Error(`${item.id}: packaged Manifest is invalid`, { cause: error }); }
  try { validateManifest(manifest); } catch (error) { throw new Error(`${item.id}: packaged Manifest is invalid`, { cause: error }); }
  if (manifest.id !== item.id || manifest[item.runtimeField]?.entry !== `./${item.entry}`) throw new Error(`${item.id}: packaged Manifest identity or entry drifted`);
}

export async function verifyPackages() {
for (const item of packages) {
  const directory = path.join(root, item.id);
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, "manifest.json"), "utf8"));
  validatePackagedManifest(manifest, item);
  const declared = manifest[item.runtimeField]?.entry;
  if (declared !== `./${item.entry}`) throw new Error(`${item.id}: manifest entry does not match package layout`);
  if (!fs.statSync(path.join(directory, item.entry)).isFile()) throw new Error(`${item.id}: runtime entry is missing`);
  for (const language of ["readme.md", "readme_zh.md", "readme_ko.md"]) if (!fs.statSync(path.join(directory, language)).isFile()) throw new Error(`${item.id}: ${language} is missing`);
  const sdkPackage = path.join(directory, "node_modules", "@carmediahub", "sdk");
  if (!fs.statSync(path.join(sdkPackage, "package.json")).isFile() || !fs.statSync(path.join(sdkPackage, "dist", "index.js")).isFile()) throw new Error(`${item.id}: bundled SDK runtime is missing`);
  const sdkVersion = JSON.parse(fs.readFileSync(path.join(sdkPackage, "package.json"), "utf8")).version;
  if (typeof sdkVersion !== "string" || !isSdkVersionCompatible(manifest.sdk, sdkVersion)) throw new Error(`${item.id}: bundled SDK ${sdkVersion ?? "unknown"} does not satisfy ${manifest.sdk}`);
  await import(pathToFileURL(path.join(directory, item.entry)).href);
}
console.log(`Verified ${packages.length} plugin packages.`);
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await verifyPackages();
