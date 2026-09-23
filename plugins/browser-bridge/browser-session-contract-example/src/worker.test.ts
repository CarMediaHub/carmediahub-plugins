import assert from "node:assert/strict";
import test from "node:test";
import type { GatewayWorkerRequest, WorkerClient } from "@carmediahub/sdk";
import { startBrowserSessionExample } from "./worker.js";

test("browser session fixture exposes only opaque session metadata", async () => {
  let handler: ((request: GatewayWorkerRequest, signal: AbortSignal) => Promise<unknown>) | undefined;
  let requested = false;
  let closed = false;
  const context = { scope: { deploymentId: "dep", organizationId: "org", userId: "user", deviceId: "device", sessionId: "session", installationId: "browser-example" }, locale: "en" as const, timeZone: "UTC", theme: "system" as const, density: "comfortable" as const, entry: "navigation" as const, display: { deviceClass: "desktop" as const, input: ["pointer" as const], fullscreenAvailable: false, viewport: { width: 1280, height: 720 } }, policyVersion: 1 };
  const client = {
    context,
    close: () => { closed = true; },
    display: () => ({ capabilities: () => ({ ...context.display, input: [...context.display.input], viewport: { ...context.display.viewport } }), requestMode: async (mode: "fullscreen") => ({ mode, accepted: false as const, reason: "unsupported" as const }) }),
    browser: () => ({ request: async () => { requested = true; return { id: "browser_fixture", name: "contract-fixture", purpose: "validate opaque browser session lifecycle", status: "active" as const, expiresAt: "2099-01-01T00:00:00.000Z" }; }, list: async () => [], revoke: async () => true, enqueue: async () => ({ id: "browser_task_fixture", sessionId: "browser_fixture", kind: "navigate-and-capture" as const, status: "queued" as const, input: { target: "contract-fixture", label: "Contract fixture" }, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }), tasks: async () => [], cancelTask: async () => ({ id: "browser_task_fixture", sessionId: "browser_fixture", kind: "navigate-and-capture" as const, status: "cancelled" as const, input: { target: "contract-fixture", label: "Contract fixture" }, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }) }),
    onGatewayRequest: (registered: (request: GatewayWorkerRequest, signal: AbortSignal) => Promise<unknown>) => { handler = registered; }
  } as unknown as WorkerClient;
  await startBrowserSessionExample({ endpoint: "local", installationId: "browser-example", runtimeCredential: "credential" }, async () => client);
  assert.deepEqual(await handler!({ method: "GET", path: "/health" }, new AbortController().signal), { status: 200, body: { status: "ok", worker: "browser-session-contract-example", browserDriver: "none" } });
  const response = await handler!({ method: "GET", path: "/session" }, new AbortController().signal) as { body: Record<string, unknown> };
  assert.equal(requested, true);
  assert.equal(response.body.id, "browser_fixture");
  assert.equal("profilePath" in response.body, false);
  assert.equal("cookie" in response.body, false);
  assert.equal("cdpEndpoint" in response.body, false);
  const displayResponse = await handler!({ method: "GET", path: "/display" }, new AbortController().signal) as { body: { capabilities: Record<string, unknown>; fullscreen: Record<string, unknown> } };
  assert.deepEqual(displayResponse.body.capabilities, context.display);
  assert.deepEqual(displayResponse.body.fullscreen, { mode: "fullscreen", accepted: false, reason: "unsupported" });
  const taskResponse = await handler!({ method: "GET", path: "/task" }, new AbortController().signal) as { body: Record<string, unknown> };
  assert.equal((taskResponse.body.task as { kind: string }).kind, "navigate-and-capture");
  assert.equal((taskResponse.body.cancelled as { status: string }).status, "cancelled");
  assert.deepEqual(await handler!({ method: "POST", path: "/session" }, new AbortController().signal), { status: 405, body: { code: "CMH.BROWSER_EXAMPLE.METHOD_NOT_ALLOWED" } });
  client.close();
  assert.equal(closed, true);
});
