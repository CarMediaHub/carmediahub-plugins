import assert from "node:assert/strict";
import test from "node:test";
import type { GatewayWorkerRequest, WorkerClient } from "@carmediahub/sdk";
import { startWorker } from "./worker.js";

const context = { scope: { deploymentId: "d", organizationId: "o", userId: "u", deviceId: "vehicle", sessionId: "s", installationId: "rclone" }, locale: "zh-CN" as const, timeZone: "UTC", theme: "system" as const, density: "comfortable" as const, entry: "navigation" as const, display: { deviceClass: "vehicle" as const, input: ["touch" as const], fullscreenAvailable: true, viewport: { width: 1, height: 1 } }, policyVersion: 1 };

test("forwards a bounded read-only resource and strips sensitive headers", async () => {
  let handler: ((request: GatewayWorkerRequest) => Promise<unknown>) | undefined;
  let forwarded: unknown;
  const client = { context, close() {}, call: async () => undefined, jobs: () => ({ enqueue: async () => { throw new Error("unused"); }, list: async () => [], cancel: async () => undefined }), history: () => ({ record: async () => { throw new Error("unused"); }, query: async () => [], clear: async () => 0 }), catalog: () => ({ register: async () => { throw new Error("unused"); }, query: async () => [], remove: async () => false }), display: () => ({ capabilities: () => context.display, requestMode: async () => ({ mode: "normal" as const, accepted: true }) }), media: () => ({ createPlayback: async () => { throw new Error("unused"); }, probe: async () => { throw new Error("unused"); }, requestTransform: async () => { throw new Error("unused"); } }), network: () => ({ request: async (input: unknown) => { forwarded = input; return { status: 206, headers: { "content-type": "video/mp4", location: "https://private.invalid", "set-cookie": "secret" }, bodyBase64: Buffer.from("ok").toString("base64") }; } }), notifications: () => ({ publish: async () => { throw new Error("unused"); }, list: async () => [], markRead: async () => false }), onGatewayRequest(registered: (request: GatewayWorkerRequest) => Promise<unknown>) { handler = registered; }, onContextChanged() {} } as unknown as WorkerClient;
  const worker = await startWorker({ endpoint: "local", installationId: "rclone", runtimeCredential: "credential" }, async () => client);
  const response = await handler!({ method: "GET", path: "/resource", query: { path: "/movie.mp4" }, headers: { accept: "video/*", range: "bytes=0-1", authorization: "secret", cookie: "secret" } });
  assert.deepEqual(forwarded, { binding: "rclone-webdav", method: "GET", path: "/movie.mp4", headers: { accept: "video/*", range: "bytes=0-1" } });
  assert.deepEqual(response, { status: 206, headers: { "content-type": "video/mp4" }, body: Buffer.from("ok") });
  const propfind = await handler!({ method: "PROPFIND", path: "/resource", query: { path: "/" }, headers: { accept: "application/xml" } });
  assert.deepEqual(forwarded, { binding: "rclone-webdav", method: "PROPFIND", path: "/", headers: { accept: "application/xml" } });
  assert.deepEqual(propfind, { status: 206, headers: { "content-type": "video/mp4" }, body: Buffer.from("ok") });
  assert.deepEqual(await handler!({ method: "POST", path: "/resource", query: { path: "/movie.mp4" } }), { status: 405, body: { code: "CMH.RCLONE.METHOD_NOT_ALLOWED" } });
  assert.deepEqual(await handler!({ method: "GET", path: "/resource", query: { path: "../secret" } }), { status: 400, body: { code: "CMH.RCLONE.RELATIVE_PATH_REQUIRED" } });
  worker.stop();
});
