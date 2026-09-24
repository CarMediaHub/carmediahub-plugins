import fs from "node:fs";
import path from "node:path";
import type { PluginManifest, RuntimeGroup } from "@carmediahub/sdk";

export type MigrationStatus = "example" | "planned" | "planned-review" | "excluded";
export type PluginImplementation = "native" | "upstream-adapter" | "local-service-bridge";
export interface MigrationEntry {
  id: string;
  sourceKey: string;
  category: PluginManifest["category"];
  targetClass: string;
  implementation: PluginImplementation;
  runtime: RuntimeGroup;
  status: MigrationStatus;
  public: boolean;
  risk: string;
}

interface MatrixFile { schemaVersion: 1; entries: MigrationEntry[]; }
interface CatalogFile { schemaVersion: string; plugins: Array<{ id: string; category: string; runtime: string; targetClass: string; status: string; }>; }
interface LegacySiteKeysFile { schemaVersion: 1; source: "site_gateway"; keys: Array<{ key: string; riskClass: string }>; }

export function loadMigrationMatrix(root: string): readonly MigrationEntry[] {
  const matrix = JSON.parse(fs.readFileSync(path.join(root, "catalog", "migration-matrix.json"), "utf8")) as MatrixFile;
  if (matrix.schemaVersion !== 1 || !Array.isArray(matrix.entries)) throw new Error("Unsupported migration matrix");
  const ids = new Set<string>();
  for (const entry of matrix.entries) {
    if (!/^[a-z][a-z0-9-]{2,63}$/u.test(entry.id) || ids.has(entry.id)) throw new Error(`Invalid or duplicate migration id: ${entry.id}`);
    if (!/^[a-z0-9][a-z0-9-]{1,63}$/u.test(entry.sourceKey) && entry.sourceKey !== "none") throw new Error(`Invalid migration source key: ${entry.id}`);
    if (!entry.risk || !entry.targetClass || !["example", "planned", "planned-review", "excluded"].includes(entry.status)) throw new Error(`Incomplete migration entry: ${entry.id}`);
    if (entry.status !== "example" && entry.public) throw new Error(`Non-example migration cannot be public: ${entry.id}`);
    if (entry.status === "excluded" && entry.implementation !== "native") throw new Error(`Excluded migration has an implementation: ${entry.id}`);
    if (entry.implementation === "local-service-bridge" && entry.category !== "adapter" && entry.category !== "browser-bridge") throw new Error(`Local service bridge has an invalid category: ${entry.id}`);
    if (entry.runtime === "shared-adapter-host" && entry.category !== "core-companion") throw new Error(`Shared adapter host is restricted to core companions: ${entry.id}`);
    if (entry.runtime === "shared-adapter-host" && entry.implementation === "local-service-bridge") throw new Error(`Local service bridge cannot use shared adapter host: ${entry.id}`);
    if (entry.category === "browser-bridge" && entry.runtime === "shared-adapter-host") throw new Error(`Browser bridge requires an isolated runtime: ${entry.id}`);
    ids.add(entry.id);
  }
  const legacyPath = path.join(root, "catalog", "legacy-site-keys.json");
  if (fs.existsSync(legacyPath)) {
    const legacy = JSON.parse(fs.readFileSync(legacyPath, "utf8")) as LegacySiteKeysFile;
    if (legacy.schemaVersion !== 1 || legacy.source !== "site_gateway" || !Array.isArray(legacy.keys) || legacy.keys.length === 0) throw new Error("Legacy site key snapshot is invalid");
    const legacyKeys = new Set<string>();
    for (const item of legacy.keys) {
      if (!/^[a-z0-9][a-z0-9-]{1,63}$/u.test(item.key) || !item.riskClass || legacyKeys.has(item.key)) throw new Error(`Invalid or duplicate legacy site key: ${item.key}`);
      legacyKeys.add(item.key);
      const matches = matrix.entries.filter((entry) => entry.sourceKey === item.key);
      if (matches.length !== 1) throw new Error(`Legacy site key must have exactly one migration entry: ${item.key}`);
    }
  }
  const catalogPath = path.join(root, "catalog", "plugins.json");
  if (fs.existsSync(catalogPath)) {
    const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8")) as CatalogFile;
    if (!Array.isArray(catalog.plugins)) throw new Error("Plugin catalog is invalid");
    const matrixById = new Map(matrix.entries.map((entry) => [entry.id, entry]));
    for (const plugin of catalog.plugins) {
      const entry = matrixById.get(plugin.id);
      if (entry === undefined) throw new Error(`Plugin catalog entry is missing from migration matrix: ${plugin.id}`);
      if (entry.category !== plugin.category || entry.runtime !== plugin.runtime || entry.targetClass !== plugin.targetClass) throw new Error(`Plugin catalog and migration matrix disagree: ${plugin.id}`);
      if (plugin.status === "draft" && entry.status === "example" && entry.public !== true) throw new Error(`Public example is not exposed in migration matrix: ${plugin.id}`);
    }
    for (const entry of matrix.entries.filter((item) => item.public && item.status === "example")) {
      if (!catalog.plugins.some((plugin) => plugin.id === entry.id)) throw new Error(`Public example is missing from plugin catalog: ${entry.id}`);
    }
  }
  return matrix.entries;
}
