import assert from "node:assert/strict";
import test from "node:test";
import { MemoryRuntime, type PlatformContext, type GatewayWorkerRequest, type WorkerClient } from "@carmediahub/sdk";
import { WdrMediaPlugin } from "./wdr-media.js";
import { startWdrWorker, type WdrMediaSource } from "./worker.js";

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
  let playbackSessions = 0;
  const client: WorkerClient = { context: { scope: context.scope, locale: "en", timeZone: "UTC", theme: "system", density: "comfortable", entry: "navigation", display: context.display, policyVersion: 1 }, close: () => { closed = true; }, call: async <T>() => ({ media: [] } as T), jobs: () => ({ enqueue: async () => { throw new Error("not used"); }, list: async () => [], cancel: async () => undefined }), history: () => ({ record: async () => { throw new Error("not used"); }, query: async () => [], clear: async () => 0 }), catalog: () => ({ register: async () => { throw new Error("not used"); }, query: async () => [], remove: async () => false }), display: () => ({ capabilities: () => context.display, requestMode: async () => ({ mode: "normal" as const, accepted: true }) }), media: () => ({ createPlayback: async () => { playbackSessions += 1; return { sessionId: "playback_test", mediaId: "clip-1", expiresAt: new Date(Date.now() + 1000).toISOString() }; }, probe: async () => ({ mediaId: "clip-1", contentType: "video/mp4", size: 4, updatedAt: new Date().toISOString(), seekable: true, availableModes: ["direct-range" as const], recommendedMode: "direct-range" as const }), requestTransform: async () => { throw new Error("not used"); }, readOutput: async () => ({ data: "", completed: true, contentType: "video/mp4", size: 0 }), requestHls: async () => { throw new Error("not used"); }, readHlsAsset: async () => ({ data: "", completed: true, contentType: "application/vnd.apple.mpegurl", size: 0 }) }), network: () => ({ request: async () => { throw new Error("not used"); } }), browser: () => ({ request: async () => { throw new Error("not used"); }, list: async () => [], revoke: async () => false, enqueue: async () => { throw new Error("not used"); }, tasks: async () => [], cancelTask: async () => undefined }), notifications: () => ({ publish: async () => { throw new Error("not used"); }, list: async () => [], markRead: async () => false, markAllRead: async () => 0 }), onGatewayRequest: (registered) => { handler = registered; }, onContextChanged: () => () => undefined };
  const source: WdrMediaSource = {
    list: async () => [{ id: "clip-1", title: "Road trip", contentType: "video/mp4", size: 4 }],
    open: async (_id, slice) => (async function* () { yield Buffer.from("0123").subarray(slice.start, slice.end + 1); })()
  };
  const worker = await startWdrWorker({ endpoint: "local", installationId: "wdr", runtimeCredential: "one-time", source }, async () => client);
  const signal = new AbortController().signal;
  assert.deepEqual(await handler!({ method: "GET", path: "/health", context: { locale: "en", timeZone: "UTC", theme: "system", density: "comfortable", entry: "navigation", display: context.display, policyVersion: 1 } }, signal), { status: 200, body: { status: "ok", worker: "wdr-media", locale: "en", entry: "navigation", display: context.display } });
  assert.deepEqual(await handler!({ method: "GET", path: "/library" }, signal), { status: 200, body: { media: [{ id: "clip-1", title: "Road trip", contentType: "video/mp4", size: 4 }] } });
  const stream = await handler!({ method: "GET", path: "/stream", query: { id: "clip-1" }, headers: { range: "bytes=1-2" } }, signal) as { status: number; headers: Record<string, string>; body: AsyncIterable<Uint8Array> };
  assert.equal(stream.status, 206);
  assert.equal(stream.headers["content-range"], "bytes 1-2/4");
  let media = "";
  for await (const chunk of stream.body) media += Buffer.from(chunk).toString("utf8");
  assert.equal(media, "12");
  const clamped = await handler!({ method: "GET", path: "/stream", query: { id: "clip-1" }, headers: { range: "bytes=2-99" } }, signal) as { status: number; headers: Record<string, string>; body: AsyncIterable<Uint8Array> };
  assert.equal(clamped.status, 206);
  assert.equal(clamped.headers["content-range"], "bytes 2-3/4");
  const full = await handler!({ method: "GET", path: "/stream", query: { id: "clip-1" } }, signal) as { status: number; headers: Record<string, string> };
  assert.equal(full.status, 200);
  assert.equal(full.headers["content-range"], undefined);
  const head = await handler!({ method: "HEAD", path: "/stream", query: { id: "clip-1" } }, signal) as { status: number; body?: unknown };
  assert.equal(head.status, 200);
  assert.equal(head.body, undefined);
  assert.equal(playbackSessions, 0);
  assert.equal((await handler!({ method: "GET", path: "/stream", query: { id: "clip-1" }, headers: { range: "bytes=9-10" } }, signal) as { status: number }).status, 416);
  assert.deepEqual(await handler!({ method: "GET", path: "/missing" }, signal), { status: 404, body: { code: "CMH.WDR.ROUTE_NOT_FOUND" } });
  assert.deepEqual(await handler!({ method: "POST", path: "/" }, signal), { status: 405, body: { code: "CMH.WDR.METHOD_NOT_ALLOWED" } });
  worker.stop();
  assert.equal(closed, true);

  let remotePlaybackSessions = 0;
  let transformRequests = 0;
  const remoteClient: WorkerClient = { ...client, media: () => ({ ...client.media(), createPlayback: async () => { remotePlaybackSessions += 1; return { sessionId: "playback_remote", mediaId: "clip-1", expiresAt: new Date(Date.now() + 1000).toISOString() }; } }), call: async <T>(method: string) => {
    if (method === "media.list") return { media: [{ id: "clip-1", title: "Road trip", contentType: "video/mp4", size: 4 }] } as T;
    if (method === "media.read") return { data: Buffer.from("0123").toString("base64"), completed: true } as T;
    throw new Error(`Unexpected remote method: ${method}`);
  } };
  const remoteWorker = await startWdrWorker({ endpoint: "local", installationId: "wdr", runtimeCredential: "remote", }, async () => remoteClient);
  const remoteHead = await handler!({ method: "HEAD", path: "/stream", query: { id: "clip-1" } }, signal) as { status: number; body?: unknown };
  assert.equal(remoteHead.status, 200);
  assert.equal(remoteHead.body, undefined);
  assert.equal(remotePlaybackSessions, 0);
  const remoteGet = await handler!({ method: "GET", path: "/stream", query: { id: "clip-1" } }, signal) as { status: number; body: AsyncIterable<Uint8Array> };
  assert.equal(remoteGet.status, 200);
  for await (const _chunk of remoteGet.body) { /* consume the controlled remote source */ }
  assert.equal(remotePlaybackSessions, 1);
  const sourceClient: WorkerClient = { ...remoteClient, mediaSources: () => ({
    list: async () => ({ items: [{ itemHandle: "remote-folder", name: "Folder", kind: "directory" as const }, { itemHandle: "remote-item", name: "Remote trip", kind: "file" as const, size: 4, contentType: "video/mp4" }] }),
    stat: async () => { throw new Error("not used"); },
    probe: async () => { throw new Error("not used"); },
    createPlayback: async () => ({ sessionId: "remote_playback_test", sourceHandle: "remote-source", itemHandle: "remote-item", expiresAt: new Date(Date.now() + 1000).toISOString() }),
    read: async () => ({ data: Buffer.from("wxyz").toString("base64"), contentType: "video/mp4", size: 4, completed: true })
  }) };
  const sourceWorker = await startWdrWorker({ endpoint: "local", installationId: "wdr", runtimeCredential: "source" }, async () => sourceClient);
  const sourceLibrary = await handler!({ method: "GET", path: "/library", query: { source: "remote-source" } }, signal) as { body: { media: Array<{ id: string }> } };
  assert.deepEqual(sourceLibrary.body.media.map((item) => item.id), ["remote-item"]);
  const sourceResponse = await handler!({ method: "GET", path: "/stream", query: { source: "remote-source", id: "remote-item" } }, signal) as { status: number; body: AsyncIterable<Uint8Array> };
  assert.equal(sourceResponse.status, 200);
  let sourceText = "";
  for await (const chunk of sourceResponse.body) sourceText += Buffer.from(chunk).toString("utf8");
  assert.equal(sourceText, "wxyz");
  sourceWorker.stop();
  const transformClient: WorkerClient = { ...remoteClient, media: () => ({ ...remoteClient.media(), probe: async () => ({ mediaId: "clip-1", contentType: "video/x-matroska", size: 4, updatedAt: new Date().toISOString(), seekable: true, availableModes: ["remux" as const], recommendedMode: "remux" as const }), requestTransform: async () => { transformRequests += 1; return { id: "job_transform", type: "media.remux", status: "queued" as const, progress: 0, payload: {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; }, readOutput: async (_outputId, start, end) => ({ data: Buffer.from("abcd").subarray(start, end + 1).toString("base64"), completed: end >= 3, contentType: "video/mp4", size: 4 }), requestHls: async () => ({ id: "job_hls", type: "media.hls", status: "queued" as const, progress: 0, payload: {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }), readHlsAsset: async (_sessionId, asset, start, end) => { const value = asset === "playlist.m3u8" ? "#EXTM3U\n#EXTINF:4,\nsegment_00000.ts\n" : "abcd"; return { data: Buffer.from(value).subarray(start, end + 1).toString("base64"), completed: end >= Buffer.byteLength(value) - 1, contentType: asset === "playlist.m3u8" ? "application/vnd.apple.mpegurl" : "video/mp2t", size: Buffer.byteLength(value) }; } }), jobs: () => ({ ...remoteClient.jobs(), list: async () => [{ id: "job_transform", type: "media.remux", status: "succeeded" as const, progress: 100, payload: {}, result: { outputId: "transform_12345678901234567890", contentType: "video/mp4", bytes: 4 }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, { id: "job_hls", type: "media.hls", status: "succeeded" as const, progress: 100, payload: {}, result: { sessionId: "hls_12345678901234567890", playlistAsset: "playlist.m3u8" }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }] }) };
  const transformedWorker = await startWdrWorker({ endpoint: "local", installationId: "wdr", runtimeCredential: "transform" }, async () => transformClient);
  const transformed = await handler!({ method: "GET", path: "/stream", query: { id: "clip-1", mode: "remux" }, headers: { range: "bytes=1-2" } }, signal) as { status: number; headers: Record<string, string>; body: AsyncIterable<Uint8Array> };
  assert.equal(transformed.status, 206);
  assert.equal(transformed.headers["content-range"], "bytes 1-2/4");
  let transformedMedia = "";
  for await (const chunk of transformed.body) transformedMedia += Buffer.from(chunk).toString("utf8");
  assert.equal(transformedMedia, "bc");
  assert.equal(transformRequests, 1);
  const hlsWorker = await startWdrWorker({ endpoint: "local", installationId: "wdr", runtimeCredential: "hls" }, async () => transformClient);
  const playlist = await handler!({ method: "GET", path: "/hls", query: { id: "clip-1" } }, signal) as { status: number; headers: Record<string, string>; body: AsyncIterable<Uint8Array> };
  assert.equal(playlist.status, 200);
  let playlistText = "";
  for await (const chunk of playlist.body) playlistText += Buffer.from(chunk).toString("utf8");
  assert.equal(playlist.headers["content-type"], "application/vnd.apple.mpegurl");
  assert.match(playlistText, /hls\?session=hls_12345678901234567890&asset=segment_00000\.ts/u);
  const hlsSegment = await handler!({ method: "GET", path: "/hls", query: { session: "hls_12345678901234567890", asset: "segment_00000.ts" } }, signal) as { status: number; body: AsyncIterable<Uint8Array> };
  assert.equal(hlsSegment.status, 200);
  hlsWorker.stop();
  transformedWorker.stop();
  remoteWorker.stop();
});
