import assert from "node:assert/strict";
import test from "node:test";
import { MemoryRuntime, type PlatformContext, type GatewayWorkerRequest, type WorkerClient } from "@carmediahub/sdk";
import { WdrMediaPlugin } from "./wdr-media.js";
import { startWdrWorker } from "./worker.js";

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

test("WDR worker exposes only its initial logical health and entry routes", async () => {
  let handler: ((request: GatewayWorkerRequest, signal: AbortSignal) => Promise<unknown> | unknown) | undefined;
  let closed = false;
  const client: WorkerClient = { close: () => { closed = true; }, onGatewayRequest: (registered) => { handler = registered; } };
  const worker = await startWdrWorker({ endpoint: "local", installationId: "wdr", runtimeCredential: "one-time" }, async () => client);
  const signal = new AbortController().signal;
  assert.deepEqual(await handler!({ method: "GET", path: "/health" }, signal), { status: 200, body: { status: "ok", worker: "wdr-media" } });
  assert.deepEqual(await handler!({ method: "GET", path: "/missing" }, signal), { status: 404, body: { code: "CMH.WDR.ROUTE_NOT_FOUND" } });
  assert.deepEqual(await handler!({ method: "POST", path: "/" }, signal), { status: 405, body: { code: "CMH.WDR.METHOD_NOT_ALLOWED" } });
  worker.stop();
  assert.equal(closed, true);
});
