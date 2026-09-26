import assert from "node:assert/strict";
import test from "node:test";
import { isSdkVersionCompatible, validatePackagedLayout, validatePackagedManifest } from "./verify-packages.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

test("checks exact, tilde, and caret SDK ranges", () => {
  assert.equal(isSdkVersionCompatible("0.1.0", "0.1.0"), true);
  assert.equal(isSdkVersionCompatible("0.1.0", "0.1.1"), false);
  assert.equal(isSdkVersionCompatible("~0.1.0", "0.1.9"), true);
  assert.equal(isSdkVersionCompatible("~0.1.0", "0.2.0"), false);
  assert.equal(isSdkVersionCompatible("^0.1.0", "0.1.9"), true);
  assert.equal(isSdkVersionCompatible("^0.1.0", "0.2.0"), false);
  assert.equal(isSdkVersionCompatible("^1.2.3", "1.9.0"), true);
  assert.equal(isSdkVersionCompatible("^1.2.3", "2.0.0"), false);
});

test("rejects malformed or below-minimum SDK versions", () => {
  assert.equal(isSdkVersionCompatible("latest", "0.1.0"), false);
  assert.equal(isSdkVersionCompatible("^0.1.0", "0.0.9"), false);
  assert.equal(isSdkVersionCompatible("^0.0.3", "0.0.4"), false);
  assert.equal(isSdkVersionCompatible("^0.0.3", "0.0.3"), true);
});

test("rejects a tampered packaged Manifest before loading its entry", () => {
  assert.throws(() => validatePackagedManifest({ id: "tampered" }, { id: "example", runtimeField: "worker", entry: "worker.js" }), /packaged Manifest is invalid/);
});

test("requires a declared UI entry to be present in the distributable package", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cmh-package-layout-"));
  fs.mkdirSync(path.join(directory, "ui"), { recursive: true });
  for (const file of ["worker.js", "readme.md", "readme_zh.md", "readme_ko.md"]) fs.writeFileSync(path.join(directory, file), "fixture");
  const item = { id: "fixture", entry: "worker.js" };
  const manifest = { ui: { entry: "./ui/index.html" } };
  assert.throws(() => validatePackagedLayout(directory, manifest, item), /ui entry is missing/);
  fs.writeFileSync(path.join(directory, "ui", "index.html"), "<!doctype html>");
  assert.doesNotThrow(() => validatePackagedLayout(directory, manifest, item));
});

test("rejects a UI entry that escapes the distributable package", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cmh-package-layout-"));
  for (const file of ["worker.js", "readme.md", "readme_zh.md", "readme_ko.md"]) fs.writeFileSync(path.join(directory, file), "fixture");
  assert.throws(() => validatePackagedLayout(directory, { ui: { entry: "./../outside.html" } }, { id: "fixture", entry: "worker.js" }), /ui entry escapes the package/);
});
