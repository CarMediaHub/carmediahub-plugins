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
});

test("rejects catalog entries whose source is missing", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cmh-plugin-catalog-"));
  fs.mkdirSync(path.join(root, "catalog"), { recursive: true });
  fs.writeFileSync(path.join(root, "catalog/plugins.json"), JSON.stringify({ schemaVersion: "0.1", plugins: [{ id: "missing-plugin", path: "plugins/missing-plugin", category: "official", runtime: "isolated-worker" }] }));
  assert.throws(() => loadPackageCatalog(root), /source is unavailable/);
});

test("rejects a symlinked catalog source", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cmh-plugin-catalog-link-"));
  fs.mkdirSync(path.join(root, "catalog"), { recursive: true });
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "cmh-plugin-outside-"));
  fs.writeFileSync(path.join(outside, "manifest.json"), "{}\n");
  fs.writeFileSync(path.join(root, "catalog/plugins.json"), JSON.stringify({ schemaVersion: "0.1", plugins: [{ id: "linked-plugin", path: "plugins/linked-plugin", category: "official", runtime: "isolated-worker" }] }));
  fs.mkdirSync(path.join(root, "plugins"));
  try {
    fs.symlinkSync(outside, path.join(root, "plugins/linked-plugin"), "junction");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error.code === "EPERM" || error.code === "EACCES")) { t.skip("junctions are unavailable in this environment"); return; }
    throw error;
  }
  assert.throws(() => loadPackageCatalog(root), /symbolic link/);
});
