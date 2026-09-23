import assert from "node:assert/strict";
import test from "node:test";
import type { GatewayWorkerRequest, WorkerClient } from "@carmediahub/sdk";
import { startWorker } from "./worker.js";

const context = { scope: { deploymentId: "d", organizationId: "o", userId: "u", deviceId: "vehicle", sessionId: "s", installationId: "proxy" }, locale: "zh-CN" as const, timeZone: "UTC", theme: "system" as const, density: "comfortable" as const, entry: "navigation" as const, display: { deviceClass: "vehicle" as const, input: ["touch" as const], fullscreenAvailable: true, viewport: { width: 1, height: 1 } }, policyVersion: 1 };

test("proxy compatibility forwards bounded inputs and strips response leakage", async () => {
  let handler: ((request: GatewayWorkerRequest) => Promise<unknown>) | undefined;
  let request: unknown;
  const client = { context, close() {}, call: async () => undefined, jobs: () => ({ enqueue: async () => { throw new Error("unused"); }, list: async () => [], cancel: async () => undefined }), history: () => ({ record: async () => { throw new Error("unused"); }, query: async () => [], clear: async () => 0 }), catalog: () => ({ register: async () => { throw new Error("unused"); }, query: async () => [], remove: async () => false }), display: () => ({ capabilities: () => context.display, requestMode: async () => ({ mode: "normal" as const, accepted: true }) }), media: () => ({ createPlayback: async () => { throw new Error("unused"); }, probe: async () => { throw new Error("unused"); }, requestTransform: async () => { throw new Error("unused"); } }), network: () => ({ request: async (input: unknown) => { request = input; return { status: 302, headers: { location: "https://private.invalid", "set-cookie": "secret", "content-type": "text/html" }, bodyBase64: Buffer.from("ignored").toString("base64") }; } }), notifications: () => ({ publish: async () => { throw new Error("unused"); }, list: async () => [], markRead: async () => false }), onGatewayRequest(registered: (request: GatewayWorkerRequest) => Promise<unknown>) { handler = registered; }, onContextChanged() {} } as unknown as WorkerClient;
  const worker = await startWorker({ endpoint: "local", installationId: "proxy", runtimeCredential: "credential" }, async () => client);
  const response = await handler!({ method: "GET", path: "/proxy", query: { path: "/library" }, headers: { accept: "text/html", range: "bytes=0-1", authorization: "secret", cookie: "private" } });
  assert.deepEqual(request, { binding: "approved-upstream", method: "GET", path: "/library", headers: { accept: "text/html", range: "bytes=0-1" } });
  assert.deepEqual(response, { status: 302, headers: { "content-type": "text/html" } });
  assert.deepEqual(await handler!({ method: "GET", path: "/proxy", query: { path: "../secret" } }), { status: 400, body: { code: "CMH.PROXY_COMPAT.RELATIVE_PATH_REQUIRED" } });
  worker.stop();
});

test("proxy compatibility refuses oversized response bodies", async () => {
  let handler: ((request: GatewayWorkerRequest) => Promise<unknown>) | undefined;
  const client = { context, close() {}, call: async () => undefined, jobs: () => ({ enqueue: async () => { throw new Error("unused"); }, list: async () => [], cancel: async () => undefined }), history: () => ({ record: async () => { throw new Error("unused"); }, query: async () => [], clear: async () => 0 }), catalog: () => ({ register: async () => { throw new Error("unused"); }, query: async () => [], remove: async () => false }), display: () => ({ capabilities: () => context.display, requestMode: async () => ({ mode: "normal" as const, accepted: true }) }), media: () => ({ createPlayback: async () => { throw new Error("unused"); }, probe: async () => { throw new Error("unused"); }, requestTransform: async () => { throw new Error("unused"); } }), network: () => ({ request: async () => ({ status: 200, headers: {}, bodyBase64: Buffer.alloc(8 * 1024 * 1024 + 1).toString("base64") }) }), notifications: () => ({ publish: async () => { throw new Error("unused"); }, list: async () => [], markRead: async () => false }), onGatewayRequest(registered: (request: GatewayWorkerRequest) => Promise<unknown>) { handler = registered; }, onContextChanged() {} } as unknown as WorkerClient;
  const worker = await startWorker({ endpoint: "local", installationId: "proxy", runtimeCredential: "credential" }, async () => client);
  assert.deepEqual(await handler!({ method: "GET", path: "/proxy", query: { path: "/large" } }), { status: 413, body: { code: "CMH.PROXY_COMPAT.RESPONSE_TOO_LARGE" } });
  worker.stop();
});
