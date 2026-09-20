import assert from "node:assert/strict";
import test from "node:test";
import { MemoryRuntime, type PlatformContext } from "@carmediahub/sdk";
import { WdrMediaPlugin } from "./wdr-media.js";

const context: PlatformContext = {
  scope: { deploymentId: "deployment", organizationId: "organization", userId: "user-a", deviceId: "vehicle", sessionId: "session", installationId: "wdr" },
  locale: "en", timeZone: "UTC", theme: "system", density: "comfortable", entry: "navigation",
  display: { deviceClass: "vehicle", input: ["touch"], fullscreenAvailable: true, viewport: { width: 1280, height: 720 } }, grantedCapabilities: ["db", "history", "events"], policyVersion: 1
};

test("WDR stores recent playback in the current user and installation scope", async () => {
  const data = new Map();
  const wdr = new WdrMediaPlugin();
  const first = new MemoryRuntime(context, data);
  const second = new MemoryRuntime({ ...context, scope: { ...context.scope, userId: "user-b" } }, data);
  await wdr.savePlayback(first, { mediaId: "media-1", title: "Road trip", positionSeconds: 42, durationSeconds: 120 });
  assert.equal((await wdr.recentPlayback(first))[0]?.positionSeconds, 42);
  assert.deepEqual(await wdr.recentPlayback(second), []);
  assert.equal(first.events[0]?.type, "wdr.playback.saved");
});
