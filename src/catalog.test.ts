import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { validateManifest } from "@carmediahub/sdk";
import { manifests } from "./catalog.js";
import { loadMigrationMatrix } from "./migration.js";

test("every catalog manifest satisfies the public SDK contract", () => {
  assert.ok(manifests.length >= 2);
  for (const manifest of manifests) validateManifest(manifest);
});

test("official media and generic adapter remain separate", () => {
  assert.equal(manifests.find((item) => item.id === "wdr-media")?.category, "official");
  assert.equal(manifests.find((item) => item.id === "shared-adapter-example")?.category, "core-companion");
});

test("the distributable WDR manifest remains compatible with the SDK", () => {
  const file = path.resolve(import.meta.dirname, "../plugins/official/wdr-media/manifest.json");
  validateManifest(JSON.parse(fs.readFileSync(file, "utf8")));
});

test("migration matrix classifies legacy adapters without exposing private targets", () => {
  const entries = loadMigrationMatrix(path.resolve(import.meta.dirname, ".."));
  assert.equal(entries.length, 16);
  assert.equal(entries.find((entry) => entry.id === "wdr-media")?.status, "example");
  assert.equal(entries.find((entry) => entry.id === "pornhub-adapter")?.public, false);
  assert.ok(entries.every((entry) => !entry.risk.includes("http") && !entry.risk.includes("127.0.0.1")));
});
