import fs from "node:fs";
import path from "node:path";

export function loadPackageCatalog(root) {
  const catalog = JSON.parse(fs.readFileSync(path.join(root, "catalog", "plugins.json"), "utf8"));
  if (catalog.schemaVersion !== "0.1" || !Array.isArray(catalog.plugins)) throw new Error("Plugin catalog is invalid");
  const ids = new Set();
  return catalog.plugins.map((item) => {
    if (typeof item.id !== "string" || ids.has(item.id) || typeof item.path !== "string" || !item.path.startsWith("plugins/") || item.path.includes("..")) throw new Error(`Invalid plugin catalog entry: ${item.id ?? "unknown"}`);
    ids.add(item.id);
    const source = path.resolve(root, item.path);
    const manifestPath = path.join(source, "manifest.json");
    if (!fs.existsSync(source) || !fs.statSync(source).isDirectory() || !fs.existsSync(manifestPath)) throw new Error(`Plugin catalog source is unavailable: ${item.id}`);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    if (manifest.id !== item.id || manifest.category !== item.category || manifest.runtime !== item.runtime) throw new Error(`Plugin catalog and manifest disagree: ${item.id}`);
    const runtimeField = manifest.worker !== undefined ? "worker" : manifest.runtimeEntry !== undefined ? "runtimeEntry" : undefined;
    const entry = runtimeField === undefined ? undefined : manifest[runtimeField]?.entry;
    if (typeof entry !== "string" || !entry.startsWith("./")) throw new Error(`Plugin runtime entry is missing: ${item.id}`);
    return { id: item.id, source, entry: entry.slice(2), runtimeField };
  });
}
