import assert from "node:assert/strict";
import test from "node:test";
import type { GatewayWorkerRequest, WorkerClient } from "@carmediahub/sdk";
import { startSharedAdapter } from "./worker.js";

test("shared adapter exposes only public context and logical routes", async () => {
  let handler: ((request: GatewayWorkerRequest, signal: AbortSignal) => Promise<unknown>) | undefined;
  let closed = false;
  const client = { context: { scope: { deploymentId: "dep", organizationId: "org", userId: "user", deviceId: "device", sessionId: "session", installationId: "adapter" }, locale: "ko", timeZone: "UTC", theme: "system" as const, density: "comfortable" as const, entry: "navigation" as const, display: { deviceClass: "vehicle" as const, input: ["touch" as const], fullscreenAvailable: false, viewport: { width: 800, height: 480 } }, policyVersion: 3 }, close: () => { closed = true; }, onGatewayRequest: (registered: (request: GatewayWorkerRequest, signal: AbortSignal) => Promise<unknown>) => { handler = registered; } } as unknown as WorkerClient;
  await startSharedAdapter({ endpoint: "local", installationId: "adapter", runtimeCredential: "credential" }, async () => client);
  assert.deepEqual(await handler!({ method: "GET", path: "/health", context: client.context }, new AbortController().signal), { status: 200, body: { status: "ok", worker: "shared-adapter-example", locale: "ko", policyVersion: 3 } });
  assert.deepEqual(await handler!({ method: "GET", path: "/" }, new AbortController().signal), { status: 200, body: { adapter: "shared-adapter-example", upstream: "none", capabilities: ["context", "gateway"] } });
  assert.deepEqual(await handler!({ method: "POST", path: "/" }, new AbortController().signal), { status: 405, body: { code: "CMH.SHARED_ADAPTER.METHOD_NOT_ALLOWED" } });
  client.close();
  assert.equal(closed, true);
});
