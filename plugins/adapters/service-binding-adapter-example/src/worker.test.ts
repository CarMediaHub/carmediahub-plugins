import assert from "node:assert/strict";
import test from "node:test";
import type { GatewayWorkerRequest, WorkerClient } from "@carmediahub/sdk";
import { startWorker } from "./worker.js";

const context = { scope: { deploymentId: "d", organizationId: "o", userId: "u", deviceId: "vehicle", sessionId: "s", installationId: "adapter" }, locale: "zh-CN" as const, timeZone: "UTC", theme: "system" as const, density: "comfortable" as const, entry: "navigation" as const, display: { deviceClass: "vehicle" as const, input: ["touch" as const], fullscreenAvailable: true, viewport: { width: 1, height: 1 } }, policyVersion: 1 };

test("forwards only a relative path through the named binding", async () => {
  let handler: ((request: GatewayWorkerRequest) => Promise<unknown>) | undefined;
  let request: unknown;
  const client = { context, close() {}, call: async () => undefined, jobs: () => ({ enqueue: async () => { throw new Error("unused"); }, list: async () => [], cancel: async () => undefined }), history: () => ({ record: async () => { throw new Error("unused"); }, query: async () => [], clear: async () => 0 }), catalog: () => ({ register: async () => { throw new Error("unused"); }, query: async () => [], remove: async () => false }), display: () => ({ capabilities: () => context.display, requestMode: async () => ({ mode: "normal" as const, accepted: true }) }), media: () => ({ createPlayback: async () => { throw new Error("unused"); }, probe: async () => { throw new Error("unused"); }, requestTransform: async () => { throw new Error("unused"); } }), network: () => ({ request: async (input: unknown) => { request = input; return { status: 206, headers: { "content-type": "text/plain" }, bodyBase64: Buffer.from("ok").toString("base64") }; } }), notifications: () => ({ publish: async () => { throw new Error("unused"); }, list: async () => [], markRead: async () => false }), onGatewayRequest(registered: (request: GatewayWorkerRequest) => Promise<unknown>) { handler = registered; }, onContextChanged() {} } as unknown as WorkerClient;
  const worker = await startWorker({ endpoint: "local", installationId: "adapter", runtimeCredential: "credential", binding: "alist-web" }, async () => client);
  const response = await handler!({ method: "GET", path: "/proxy", query: { path: "/dav/library" }, headers: { accept: "text/plain", range: "bytes=0-1", authorization: "secret" } });
  assert.deepEqual(request, { binding: "alist-web", method: "GET", path: "/dav/library", headers: { accept: "text/plain", range: "bytes=0-1" } });
  assert.deepEqual(response, { status: 206, headers: { "content-type": "text/plain" }, body: Buffer.from("ok") });
  assert.deepEqual(await handler!({ method: "GET", path: "/proxy", query: { path: "../secret" } }), { status: 400, body: { code: "CMH.ADAPTER.RELATIVE_PATH_REQUIRED" } });
  worker.stop();
});
