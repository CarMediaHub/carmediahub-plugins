import assert from "node:assert/strict";
import test from "node:test";
import type { GatewayWorkerRequest, WorkerClient } from "@carmediahub/sdk";
import { startWorker } from "./worker.js";

const context = { scope: { deploymentId: "d", organizationId: "o", userId: "u", deviceId: "vehicle", sessionId: "s", installationId: "mihomo" }, locale: "zh-CN" as const, timeZone: "UTC", theme: "system" as const, density: "comfortable" as const, entry: "navigation" as const, display: { deviceClass: "vehicle" as const, input: ["touch" as const], fullscreenAvailable: true, viewport: { width: 1, height: 1 } }, policyVersion: 1 };

test("forwards only an allowlisted Mihomo API path and safe request fields", async () => {
  let handler: ((request: GatewayWorkerRequest) => Promise<unknown>) | undefined;
  let forwarded: unknown;
  const client = { context, close() {}, call: async () => undefined, jobs: () => ({ enqueue: async () => { throw new Error("unused"); }, list: async () => [], cancel: async () => undefined }), history: () => ({ record: async () => { throw new Error("unused"); }, query: async () => [], clear: async () => 0 }), catalog: () => ({ register: async () => { throw new Error("unused"); }, query: async () => [], remove: async () => false }), display: () => ({ capabilities: () => context.display, requestMode: async () => ({ mode: "normal" as const, accepted: true }) }), media: () => ({ createPlayback: async () => { throw new Error("unused"); }, probe: async () => { throw new Error("unused"); }, requestTransform: async () => { throw new Error("unused"); } }), network: () => ({ request: async (input: unknown) => { forwarded = input; return { status: 200, headers: { "content-type": "application/json" }, bodyBase64: Buffer.from('{"mode":"rule"}').toString("base64") }; } }), browser: () => ({ request: async () => { throw new Error("unused"); }, list: async () => [], revoke: async () => false, enqueue: async () => { throw new Error("unused"); }, tasks: async () => [], cancelTask: async () => undefined }), notifications: () => ({ publish: async () => { throw new Error("unused"); }, list: async () => [], markRead: async () => false, markAllRead: async () => 0 }), onGatewayRequest(registered: (request: GatewayWorkerRequest) => Promise<unknown>) { handler = registered; }, onContextChanged() {} } as unknown as WorkerClient;
  const worker = await startWorker({ endpoint: "local", installationId: "mihomo", runtimeCredential: "credential" }, async () => client);
  const response = await handler!({ method: "POST", path: "/proxy", query: { path: "/configs" }, headers: { accept: "application/json", "content-type": "application/json", authorization: "secret", cookie: "secret" }, body: '{"mode":"rule"}' });
  assert.deepEqual(forwarded, { binding: "mihomo-web", method: "POST", path: "/configs", body: '{"mode":"rule"}', headers: { accept: "application/json", "content-type": "application/json" } });
  assert.deepEqual(response, { status: 200, headers: { "content-type": "application/json" }, body: Buffer.from('{"mode":"rule"}') });
  assert.deepEqual(await handler!({ method: "GET", path: "/proxy", query: { path: "/traffic" } }), { status: 400, body: { code: "CMH.MIHOMO.PATH_NOT_ALLOWED" } });
  assert.deepEqual(await handler!({ method: "GET", path: "/proxy", query: { path: "/configs/../secret" } }), { status: 400, body: { code: "CMH.MIHOMO.PATH_NOT_ALLOWED" } });
  worker.stop();
});
