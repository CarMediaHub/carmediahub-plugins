import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadPackageCatalog } from "./catalog-packages.mjs";

test("loads only catalog entries with matching manifests and runtime entries", () => {
  const root = process.cwd();
  const packages = loadPackageCatalog(root);
  assert.deepEqual(packages.map((item) => item.id).sort(), ["alist-web-bridge", "browser-session-contract-example", "mihomo-web-bridge", "service-binding-adapter-example", "shared-adapter-example", "wdr-media"]);
  assert.equal(packages.find((item) => item.id === "shared-adapter-example")?.runtimeField, "runtimeEntry");
  assert.equal(packages.find((item) => item.id === "wdr-media")?.integrationKind, "self-authored-media");
  assert.equal(packages.find((item) => item.id === "alist-web-bridge")?.integrationKind, "local-service-bridge");
  assert.equal(packages.find((item) => item.id === "alist-web-bridge")?.targetClass, "local-file-service");
});

test("rejects catalog entries whose source is missing", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cmh-plugin-catalog-"));
  fs.mkdirSync(path.join(root, "catalog"), { recursive: true });
  fs.writeFileSync(path.join(root, "catalog/plugins.json"), JSON.stringify({ schemaVersion: "0.1", plugins: [{ id: "missing-plugin", path: "plugins/missing-plugin", category: "official", runtime: "isolated-worker", integrationKind: "self-authored-media", targetClass: "local-media" }] }));
  assert.throws(() => loadPackageCatalog(root), /source is unavailable/);
});

test("rejects catalog entries with an SDK-invalid manifest", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cmh-plugin-catalog-manifest-"));
  fs.mkdirSync(path.join(root, "catalog"), { recursive: true });
  fs.mkdirSync(path.join(root, "plugins", "invalid-plugin"), { recursive: true });
  fs.writeFileSync(path.join(root, "catalog/plugins.json"), JSON.stringify({ schemaVersion: "0.1", plugins: [{ id: "invalid-plugin", path: "plugins/invalid-plugin", category: "adapter", runtime: "isolated-worker", integrationKind: "local-service-bridge", targetClass: "operator-approved-service" }] }));
  fs.writeFileSync(path.join(root, "plugins", "invalid-plugin", "manifest.json"), JSON.stringify({ id: "invalid-plugin", version: "0.1.0", sdk: "^0.1.0", category: "adapter", runtime: "isolated-worker", capabilities: ["network"], routes: [], worker: { entry: "./worker.js", protocol: "0.1" } }));
  assert.throws(() => loadPackageCatalog(root), /manifest is invalid/);
});

test("rejects a symlinked catalog source", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cmh-plugin-catalog-link-"));
  fs.mkdirSync(path.join(root, "catalog"), { recursive: true });
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "cmh-plugin-outside-"));
  fs.writeFileSync(path.join(outside, "manifest.json"), "{}\n");
  fs.writeFileSync(path.join(root, "catalog/plugins.json"), JSON.stringify({ schemaVersion: "0.1", plugins: [{ id: "linked-plugin", path: "plugins/linked-plugin", category: "official", runtime: "isolated-worker", integrationKind: "self-authored-media", targetClass: "local-media" }] }));
  fs.mkdirSync(path.join(root, "plugins"));
  try {
    fs.symlinkSync(outside, path.join(root, "plugins/linked-plugin"), "junction");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error.code === "EPERM" || error.code === "EACCES")) { t.skip("junctions are unavailable in this environment"); return; }
    throw error;
  }
  assert.throws(() => loadPackageCatalog(root), /symbolic link/);
});
