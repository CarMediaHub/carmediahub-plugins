import assert from "node:assert/strict";
import test from "node:test";
import type { GatewayWorkerRequest, WorkerClient } from "@carmediahub/sdk";
import { startUyousMediaContract } from "./worker.js";

test("uyous contract keeps browser identity opaque and bounds extraction targets", async () => {
  let handler: ((request: GatewayWorkerRequest, signal: AbortSignal) => Promise<unknown>) | undefined;
  let cancelled = false;
  const context = { scope: { deploymentId: "dep", organizationId: "org", userId: "user", deviceId: "vehicle", sessionId: "session", installationId: "uyous-contract" }, locale: "zh-CN" as const, timeZone: "UTC", theme: "system" as const, density: "comfortable" as const, entry: "navigation" as const, display: { deviceClass: "vehicle" as const, input: ["touch" as const], fullscreenAvailable: true, viewport: { width: 1920, height: 1080 } }, policyVersion: 1 };
  const client = {
    context,
    close: () => undefined,
    browser: () => ({
      request: async () => ({ id: "browser_opaque", name: "uyous-contract", purpose: "bounded media extraction contract", status: "active" as const, expiresAt: "2099-01-01T00:00:00.000Z" }),
      enqueue: async () => ({ id: "task_opaque", sessionId: "browser_opaque", kind: "navigate-and-capture" as const, status: "queued" as const, input: { target: "video.example", label: "bounded media metadata" }, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }),
      cancelTask: async () => { cancelled = true; return true; },
      list: async () => [], tasks: async () => []
    }),
    onGatewayRequest: (registered: (request: GatewayWorkerRequest, signal: AbortSignal) => Promise<unknown>) => { handler = registered; }
  } as unknown as WorkerClient;
  await startUyousMediaContract({ endpoint: "local", installationId: "uyous-contract", runtimeCredential: "credential" }, async () => client);
  const health = await handler!({ method: "GET", path: "/health", context }, new AbortController().signal) as { body: Record<string, unknown> };
  assert.equal(health.body.locale, "zh-CN");
  assert.equal(health.body.profileAccess, false);
  const response = await handler!({ method: "POST", path: "/extract", body: { target: "video.example" }, context }, new AbortController().signal) as { status: number; body: Record<string, unknown> };
  assert.equal(response.status, 202);
  assert.equal(response.body.taskId, "task_opaque");
  assert.equal("profilePath" in response.body, false);
  assert.deepEqual(await handler!({ method: "POST", path: "/extract", body: { target: "https://youtube.example/watch" }, context }, new AbortController().signal), { status: 400, body: { code: "CMH.UYOUS_CONTRACT.INVALID_TARGET" } });
  const controller = new AbortController(); controller.abort();
  const cancelledResponse = await handler!({ method: "POST", path: "/extract", body: { target: "video.example" }, context }, controller.signal) as { status: number };
  assert.equal(cancelledResponse.status, 499);
  assert.equal(cancelled, true);
});
