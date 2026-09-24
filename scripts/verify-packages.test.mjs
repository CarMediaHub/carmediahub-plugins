import assert from "node:assert/strict";
import test from "node:test";
import { isSdkVersionCompatible, validatePackagedManifest } from "./verify-packages.mjs";

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
