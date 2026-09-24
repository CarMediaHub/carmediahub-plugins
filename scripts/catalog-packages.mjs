import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { validateManifest } from "@carmediahub/sdk";

const schema = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "..", "carmediahub-sdk", "spec", "v0", "manifest.schema.json"), "utf8"));
const schemaValidator = new Ajv2020({ allErrors: true, strict: true }).compile(schema);

export function validateManifestSchema(manifest, label = "manifest") {
  if (!schemaValidator(manifest)) throw new Error(`${label} does not satisfy the published Manifest JSON Schema: ${schemaValidator.errors?.map((error) => `${error.instancePath || "/"} ${error.message}`).join("; ")}`);
}

function assertSafePath(root, target, label) {
  let current = root;
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`${label} escapes repository root`);
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return;
      throw error;
    }
    if (stat.isSymbolicLink()) throw new Error(`${label} contains a symbolic link`);
  }
}

export function loadPackageCatalog(root) {
  const catalog = JSON.parse(fs.readFileSync(path.join(root, "catalog", "plugins.json"), "utf8"));
  if (catalog.schemaVersion !== "0.1" || !Array.isArray(catalog.plugins)) throw new Error("Plugin catalog is invalid");
  const migration = JSON.parse(fs.readFileSync(path.join(root, "catalog", "migration-matrix.json"), "utf8"));
  if (migration.schemaVersion !== 1 || !Array.isArray(migration.entries)) throw new Error("Migration matrix is invalid");
  const migrationById = new Map(migration.entries.map((entry) => [entry.id, entry]));
  const ids = new Set();
  const integrationKinds = new Set(["self-authored-media", "core-companion", "local-service-bridge", "browser-session", "proxy-compat", "community"]);
  const targetClasses = new Set(["local-media", "generic-upstream", "operator-approved-service", "local-file-service", "browser-session-contract", "local-network-management", "video-platform", "broadcaster", "adult-video", "anime-video", "media-aggregator", "remote-desktop", "messaging"]);
  const categoryForIntegration = new Map([
    ["self-authored-media", "official"],
    ["core-companion", "core-companion"],
    ["local-service-bridge", "adapter"],
    ["browser-session", "browser-bridge"],
    ["proxy-compat", "adapter"],
    ["community", "community"]
  ]);
  return catalog.plugins.map((item) => {
    const migrationEntry = migrationById.get(item.id);
    if (typeof item.id !== "string" || ids.has(item.id) || typeof item.path !== "string" || !item.path.startsWith("plugins/") || item.path.includes("..") || typeof item.category !== "string" || typeof item.integrationKind !== "string" || !integrationKinds.has(item.integrationKind) || categoryForIntegration.get(item.integrationKind) !== item.category || typeof item.targetClass !== "string" || !targetClasses.has(item.targetClass) || migrationEntry === undefined || item.sourceKey !== migrationEntry.sourceKey || item.migrationStatus !== migrationEntry.status || item.implementation !== migrationEntry.implementation || item.risk !== migrationEntry.risk) throw new Error(`Invalid plugin catalog entry: ${item.id ?? "unknown"}`);
    ids.add(item.id);
    const source = path.resolve(root, item.path);
    assertSafePath(root, source, `Plugin catalog source: ${item.id}`);
    const manifestPath = path.join(source, "manifest.json");
    if (!fs.existsSync(source) || !fs.statSync(source).isDirectory() || !fs.existsSync(manifestPath)) throw new Error(`Plugin catalog source is unavailable: ${item.id}`);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    try { validateManifestSchema(manifest, `Plugin catalog Manifest: ${item.id}`); } catch (error) { throw new Error(`Plugin catalog manifest is invalid: ${item.id}`, { cause: error }); }
    try { validateManifest(manifest); } catch (error) { throw new Error(`Plugin catalog manifest is invalid: ${item.id}`, { cause: error }); }
    if (manifest.id !== item.id || manifest.category !== item.category || manifest.runtime !== item.runtime) throw new Error(`Plugin catalog and manifest disagree: ${item.id}`);
    const runtimeField = manifest.worker !== undefined ? "worker" : manifest.runtimeEntry !== undefined ? "runtimeEntry" : undefined;
    const entry = runtimeField === undefined ? undefined : manifest[runtimeField]?.entry;
    if (typeof entry !== "string" || !entry.startsWith("./")) throw new Error(`Plugin runtime entry is missing: ${item.id}`);
    return { id: item.id, source, entry: entry.slice(2), runtimeField, integrationKind: item.integrationKind, targetClass: item.targetClass };
  });
}
