import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadPackageCatalog } from "./catalog-packages.mjs";

test("loads only catalog entries with matching manifests and runtime entries", () => {
  const root = process.cwd();
  const packages = loadPackageCatalog(root);
  assert.deepEqual(packages.map((item) => item.id).sort(), ["service-binding-adapter-example", "shared-adapter-example", "wdr-media"]);
  assert.equal(packages.find((item) => item.id === "shared-adapter-example")?.runtimeField, "runtimeEntry");
});

test("rejects catalog entries whose source is missing", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cmh-plugin-catalog-"));
  fs.mkdirSync(path.join(root, "catalog"), { recursive: true });
  fs.writeFileSync(path.join(root, "catalog/plugins.json"), JSON.stringify({ schemaVersion: "0.1", plugins: [{ id: "missing-plugin", path: "plugins/missing-plugin", category: "official", runtime: "isolated-worker" }] }));
  assert.throws(() => loadPackageCatalog(root), /source is unavailable/);
});
