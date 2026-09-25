import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { validateManifest, type PluginManifest } from "@carmediahub/sdk";
import { manifests } from "./catalog.js";
import { loadMigrationMatrix } from "./migration.js";

const packageCatalog = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "../catalog/plugins.json"), "utf8")) as { plugins: Array<{ id: string; path: string }> };

test("every catalog manifest satisfies the public SDK contract", () => {
  assert.equal(manifests.length, 10);
  for (const manifest of manifests) validateManifest(manifest);
});

test("official media and generic adapter remain separate", () => {
  assert.equal(manifests.find((item) => item.id === "wdr-media")?.category, "official");
  assert.equal(manifests.find((item) => item.id === "shared-adapter-example")?.category, "core-companion");
  assert.equal(manifests.find((item) => item.id === "service-binding-adapter-example")?.runtime, "isolated-worker");
  assert.deepEqual(manifests.find((item) => item.id === "mihomo-web-bridge")?.serviceBindings, ["mihomo-web"]);
});

test("the distributable WDR manifest remains compatible with the SDK", () => {
  const file = path.resolve(import.meta.dirname, "../plugins/official/wdr-media/manifest.json");
  const distributable = JSON.parse(fs.readFileSync(file, "utf8")) as typeof manifests[number];
  validateManifest(distributable);
  const aggregated = manifests.find((item) => item.id === "wdr-media");
  assert.deepEqual(aggregated?.routes, distributable.routes);
  assert.deepEqual(aggregated?.components, distributable.components);
});

test("the aggregated AList manifest keeps its bounded POST route", () => {
  const manifest = manifests.find((item) => item.id === "alist-web-bridge");
  assert.deepEqual(manifest?.routes.find((route) => route.path === "/proxy")?.methods, ["GET", "HEAD", "POST"]);
  const file = path.resolve(import.meta.dirname, "../plugins/adapters/alist-web-bridge/manifest.json");
  const distributable = JSON.parse(fs.readFileSync(file, "utf8")) as typeof manifest;
  assert.deepEqual(distributable?.routes.find((route) => route.path === "/proxy")?.methods, manifest?.routes.find((route) => route.path === "/proxy")?.methods);
});

test("migration matrix classifies legacy adapters without exposing private targets", () => {
  const entries = loadMigrationMatrix(path.resolve(import.meta.dirname, ".."));
  assert.equal(entries.length, 25);
  assert.equal(entries.find((entry) => entry.id === "wdr-media")?.status, "example");
  assert.equal(entries.find((entry) => entry.id === "pornhub-adapter")?.public, false);
  assert.equal(entries.find((entry) => entry.id === "itv-adapter")?.public, false);
  assert.equal(entries.find((entry) => entry.id === "service-binding-adapter-example")?.status, "example");
  assert.equal(entries.find((entry) => entry.id === "alist-web-bridge")?.implementation, "local-service-bridge");
  assert.equal(entries.find((entry) => entry.id === "mihomo-web-bridge")?.public, true);
  assert.equal(entries.find((entry) => entry.id === "browser-session-contract-example")?.public, true);
  assert.equal(entries.find((entry) => entry.id === "uyous-media-contract")?.public, true);
  assert.equal(entries.find((entry) => entry.id === "proxy-compat-contract-example")?.implementation, "upstream-adapter");
  assert.ok(entries.filter((entry) => entry.status !== "example").every((entry) => entry.public === false));
  assert.ok(entries.filter((entry) => entry.implementation === "local-service-bridge").every((entry) => entry.category === "adapter" || entry.category === "browser-bridge"));
  assert.ok(entries.every((entry) => !entry.risk.includes("http") && !entry.risk.includes("127.0.0.1")));
});

test("legacy site key snapshot covers every migrated source exactly once", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const snapshot = JSON.parse(fs.readFileSync(path.join(root, "catalog", "legacy-site-keys.json"), "utf8")) as { keys: Array<{ key: string }> };
  const entries = loadMigrationMatrix(root);
  assert.equal(snapshot.keys.length, 16);
  assert.ok(snapshot.keys.every((item) => entries.some((entry) => entry.sourceKey === item.key)));
});

test("rejects a migration entry missing from the legacy site key snapshot", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cmh-legacy-keys-"));
  try {
    fs.mkdirSync(path.join(root, "catalog"));
    fs.writeFileSync(path.join(root, "catalog", "migration-matrix.json"), JSON.stringify({ schemaVersion: 1, entries: [{ id: "foo-adapter", sourceKey: "foo", category: "adapter", targetClass: "generic-upstream", implementation: "upstream-adapter", runtime: "isolated-worker", status: "planned-review", public: false, risk: "review" }] }));
    fs.writeFileSync(path.join(root, "catalog", "legacy-site-keys.json"), JSON.stringify({ schemaVersion: 1, source: "site_gateway", keys: [{ key: "bar", riskClass: "review" }] }));
    assert.throws(() => loadMigrationMatrix(root), /Legacy site key must have exactly one migration entry: bar/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("keeps public catalog and migration metadata aligned", () => {
  const entries = loadMigrationMatrix(path.resolve(import.meta.dirname, ".."));
  const publicExamples = entries.filter((entry) => entry.public && entry.status === "example");
  assert.deepEqual(publicExamples.map((entry) => entry.id).sort(), ["alist-web-bridge", "browser-session-contract-example", "history", "mihomo-web-bridge", "proxy-compat-contract-example", "rclone-webdav-bridge", "service-binding-adapter-example", "shared-adapter-example", "uyous-media-contract", "wdr-media"]);
});

test("keeps catalog metadata aligned with every distributable package", () => {
  const catalog = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "../catalog/plugins.json"), "utf8")) as {
    plugins: Array<{ id: string; category: string; path: string; runtime: string; sdk: string; sourceKey: string; migrationStatus: string; implementation: string; risk: string }>;
  };
  assert.equal(new Set(catalog.plugins.map((plugin) => plugin.id)).size, catalog.plugins.length);
  assert.equal(catalog.plugins.length, manifests.length);
  for (const entry of catalog.plugins) {
    assert.match(entry.path, /^plugins\/[a-z-]+\/[a-z0-9-]+$/u);
    const manifestPath = path.resolve(import.meta.dirname, "..", entry.path, "manifest.json");
    assert.equal(fs.existsSync(manifestPath), true, `catalog package path is missing: ${entry.id}`);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { id: string; category: string; runtime: string; sdk: string };
    assert.equal(manifest.id, entry.id);
    assert.equal(manifest.category, entry.category);
    assert.equal(manifest.runtime, entry.runtime);
    assert.equal(manifest.sdk, entry.sdk);
    assert.equal(typeof entry.sourceKey, "string");
    assert.equal(typeof entry.migrationStatus, "string");
    assert.equal(typeof entry.implementation, "string");
    assert.equal(typeof entry.risk, "string");
  }
});

test("keeps aggregated routes and component dependencies aligned with distributable manifests", () => {
  for (const aggregated of manifests) {
    const catalogEntry = packageCatalog.plugins.find((plugin) => plugin.id === aggregated.id);
    assert.ok(catalogEntry, `${aggregated.id} is missing from package catalog`);
    const entry = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "..", catalogEntry.path, "manifest.json"), "utf8")) as PluginManifest;
    assert.deepEqual(aggregated.routes, entry.routes, `${aggregated.id} routes drifted`);
    assert.deepEqual(aggregated.components ?? [], entry.components ?? [], `${aggregated.id} component dependencies drifted`);
  }
});

test("keeps higher-risk migration classes out of the shared adapter host", () => {
  const entries = loadMigrationMatrix(path.resolve(import.meta.dirname, ".."));
  assert.ok(entries.filter((entry) => entry.runtime === "shared-adapter-host").every((entry) => entry.category === "core-companion"));
  assert.ok(entries.filter((entry) => entry.category === "browser-bridge" || entry.implementation === "local-service-bridge").every((entry) => entry.runtime === "isolated-worker"));
});

test("rejects a browser bridge assigned to the shared adapter host", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cmh-migration-") );
  try {
    fs.mkdirSync(path.join(root, "catalog"));
    fs.writeFileSync(path.join(root, "catalog", "migration-matrix.json"), JSON.stringify({ schemaVersion: 1, entries: [{ id: "unsafe-browser", sourceKey: "none", category: "browser-bridge", targetClass: "browser-session-contract", implementation: "native", runtime: "shared-adapter-host", status: "example", public: true, risk: "opaque-session" }] }));
    assert.throws(() => loadMigrationMatrix(root), /Shared adapter host is restricted/u);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("rejects migration entries with unknown classification values", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cmh-migration-enum-"));
  try {
    fs.mkdirSync(path.join(root, "catalog"));
    const base = { id: "invalid-entry", sourceKey: "none", category: "unknown", targetClass: "generic", implementation: "native", runtime: "isolated-worker", status: "example", public: true, risk: "fixture" };
    fs.writeFileSync(path.join(root, "catalog", "migration-matrix.json"), JSON.stringify({ schemaVersion: 1, entries: [base] }));
    assert.throws(() => loadMigrationMatrix(root), /Incomplete migration entry/u);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("rejects migration entries with unknown target classes", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cmh-migration-target-"));
  try {
    fs.mkdirSync(path.join(root, "catalog"));
    const entry = { id: "invalid-target", sourceKey: "none", category: "adapter", targetClass: "unknown-target", implementation: "native", runtime: "isolated-worker", status: "example", public: true, risk: "fixture" };
    fs.writeFileSync(path.join(root, "catalog", "migration-matrix.json"), JSON.stringify({ schemaVersion: 1, entries: [entry] }));
    assert.throws(() => loadMigrationMatrix(root), /Incomplete migration entry/u);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("public plugin production source does not read host environment variables", () => {
  const roots = [path.resolve(import.meta.dirname), path.resolve(import.meta.dirname, "../plugins")];
  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const location = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(location);
      else if (entry.isFile() && location.endsWith(".ts") && !location.endsWith(".test.ts")) files.push(location);
    }
  };
  for (const root of roots) visit(root);
  const offenders = files.filter((location) => /(?:process\.env|Deno\.env|Bun\.env)/u.test(fs.readFileSync(location, "utf8")));
  assert.deepEqual(offenders, [], `public plugin source must not read host environment variables: ${offenders.join(", ")}`);
});
