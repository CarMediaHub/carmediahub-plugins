import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { validateManifest } from "@carmediahub/sdk";
import { manifests } from "./catalog.js";
import { loadMigrationMatrix } from "./migration.js";

test("every catalog manifest satisfies the public SDK contract", () => {
  assert.ok(manifests.length >= 5);
  for (const manifest of manifests) validateManifest(manifest);
});

test("official media and generic adapter remain separate", () => {
  assert.equal(manifests.find((item) => item.id === "wdr-media")?.category, "official");
  assert.equal(manifests.find((item) => item.id === "shared-adapter-example")?.category, "core-companion");
  assert.equal(manifests.find((item) => item.id === "service-binding-adapter-example")?.runtime, "isolated-worker");
});

test("the distributable WDR manifest remains compatible with the SDK", () => {
  const file = path.resolve(import.meta.dirname, "../plugins/official/wdr-media/manifest.json");
  validateManifest(JSON.parse(fs.readFileSync(file, "utf8")));
});

test("migration matrix classifies legacy adapters without exposing private targets", () => {
  const entries = loadMigrationMatrix(path.resolve(import.meta.dirname, ".."));
  assert.equal(entries.length, 20);
  assert.equal(entries.find((entry) => entry.id === "wdr-media")?.status, "example");
  assert.equal(entries.find((entry) => entry.id === "pornhub-adapter")?.public, false);
  assert.equal(entries.find((entry) => entry.id === "service-binding-adapter-example")?.status, "example");
  assert.equal(entries.find((entry) => entry.id === "alist-web-bridge")?.implementation, "local-service-bridge");
  assert.equal(entries.find((entry) => entry.id === "mihomo-web-bridge")?.public, false);
  assert.equal(entries.find((entry) => entry.id === "browser-session-contract-example")?.public, true);
  assert.ok(entries.filter((entry) => entry.status !== "example").every((entry) => entry.public === false));
  assert.ok(entries.filter((entry) => entry.implementation === "local-service-bridge").every((entry) => entry.category === "adapter" || entry.category === "browser-bridge"));
  assert.ok(entries.every((entry) => !entry.risk.includes("http") && !entry.risk.includes("127.0.0.1")));
});

test("keeps public catalog and migration metadata aligned", () => {
  const entries = loadMigrationMatrix(path.resolve(import.meta.dirname, ".."));
  const publicExamples = entries.filter((entry) => entry.public && entry.status === "example");
  assert.deepEqual(publicExamples.map((entry) => entry.id).sort(), ["alist-web-bridge", "browser-session-contract-example", "service-binding-adapter-example", "shared-adapter-example", "wdr-media"]);
});
