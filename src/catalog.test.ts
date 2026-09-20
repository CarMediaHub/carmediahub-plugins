import assert from "node:assert/strict";
import test from "node:test";
import { validateManifest } from "@carmediahub/sdk";
import { manifests } from "./catalog.js";

test("every catalog manifest satisfies the public SDK contract", () => {
  assert.ok(manifests.length >= 2);
  for (const manifest of manifests) validateManifest(manifest);
});

test("official media and generic adapter remain separate", () => {
  assert.equal(manifests.find((item) => item.id === "wdr-media")?.category, "official");
  assert.equal(manifests.find((item) => item.id === "shared-adapter-example")?.category, "core-companion");
});
