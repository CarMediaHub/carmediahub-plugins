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
    ids.add(entry.id);
  }
  return matrix.entries;
}
