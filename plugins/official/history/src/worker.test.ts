import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import type { GatewayWorkerRequest, WorkerClient } from "@carmediahub/sdk";
import { startHistoryWorker } from "./worker.js";

const context = { scope: { deploymentId: "d", organizationId: "o", userId: "u", deviceId: "vehicle", sessionId: "s", installationId: "history" }, locale: "zh-CN" as const, timeZone: "UTC", theme: "system" as const, density: "comfortable" as const, entry: "navigation" as const, display: { deviceClass: "vehicle" as const, input: ["touch" as const], fullscreenAvailable: true, viewport: { width: 1280, height: 720 } }, policyVersion: 1 };

test("history plugin delegates scoped query, record and clear to Core", async () => {
  const calls: Array<{ method: string; input?: unknown }> = [];
  let handler: ((request: GatewayWorkerRequest) => Promise<unknown>) | undefined;
  const client = { context, close() {}, history: () => ({
    query: async (input: unknown) => { calls.push({ method: "query", input }); return [{ id: "h1" }]; },
    record: async (input: unknown) => { calls.push({ method: "record", input }); return { id: "h1", ...(input as object) }; },
    clear: async (input: unknown) => { calls.push({ method: "clear", input }); return 2; },
  }), onGatewayRequest(registered: (request: GatewayWorkerRequest) => Promise<unknown>) { handler = registered; } } as unknown as WorkerClient;
  const worker = await startHistoryWorker({ endpoint: "local", installationId: "history", runtimeCredential: "credential" }, async () => client);
  assert.deepEqual(await handler!({ method: "GET", path: "/", query: { keyword: "road", category: "video", limit: "2" } }), { status: 200, body: { entries: [{ id: "h1" }] } });
  assert.deepEqual(await handler!({ method: "POST", path: "/", context, body: { subjectType: "media", subjectId: "m1", title: "Road", route: "/watch", category: "video" } }), { status: 201, body: { entry: { id: "h1", subjectType: "media", subjectId: "m1", title: "Road", route: "/watch", category: "video", sourceDevice: "vehicle" } } });
  assert.deepEqual(await handler!({ method: "DELETE", path: "/", query: { category: "video" } }), { status: 200, body: { cleared: 2 } });
  assert.deepEqual(calls, [
    { method: "query", input: { keyword: "road", category: "video", limit: 2, offset: 0 } },
    { method: "record", input: { subjectType: "media", subjectId: "m1", title: "Road", route: "/watch", category: "video", sourceDevice: "vehicle" } },
    { method: "clear", input: { category: "video" } },
  ]);
  worker.stop();
});

test("history plugin rejects malformed entries and unknown routes", async () => {
  let handler: ((request: GatewayWorkerRequest) => Promise<unknown>) | undefined;
  const client = { context, close() {}, history: () => ({ query: async () => [], record: async () => { throw new Error("unused"); }, clear: async () => 0 }), onGatewayRequest(registered: (request: GatewayWorkerRequest) => Promise<unknown>) { handler = registered; } } as unknown as WorkerClient;
  const worker = await startHistoryWorker({ endpoint: "local", installationId: "history", runtimeCredential: "credential" }, async () => client);
  assert.deepEqual(await handler!({ method: "POST", path: "/", body: { title: "missing route" } }), { status: 400, body: { code: "CMH.HISTORY.INVALID_ENTRY" } });
  assert.deepEqual(await handler!({ method: "GET", path: "/private" }), { status: 404, body: { code: "CMH.HISTORY.ROUTE_NOT_FOUND" } });
  worker.stop();
});

test("history UI uses the same-origin logical route and safe text rendering", () => {
  const html = fs.readFileSync(path.resolve(import.meta.dirname, "../ui/index.html"), "utf8");
  assert.match(html, /request\("\.\.\//u);
  assert.match(html, /credentials: "same-origin"/u);
  assert.match(html, /textContent = String\(text/u);
  assert.doesNotMatch(html, /innerHTML\s*=/u);
  assert.doesNotMatch(html, /https?:\/\//u);
});
