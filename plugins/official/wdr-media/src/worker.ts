import crypto from "node:crypto";
import { connectWorkerClient, type GatewayWorkerRequest, type GatewayWorkerResponse, type MediaTransformRequest, type PluginJob, type WorkerClient, type WorkerClientOptions, type MediaSourceService } from "@carmediahub/sdk";

export interface WdrMediaItem { id: string; title: string; contentType: string; size: number; }
export interface WdrMediaSource {
  list(): Promise<readonly WdrMediaItem[]>;
  open(id: string, range: { start: number; end: number }, signal: AbortSignal, playbackSessionId?: string): Promise<AsyncIterable<Uint8Array>>;
}

export interface WdrWorkerStart extends WorkerClientOptions { source?: WdrMediaSource; }

export interface WdrWorkerHandle {
  stop(): void;
}

export type WdrWorkerConnector = (options: WorkerClientOptions) => Promise<WorkerClient>;
const TRANSFORM_WAIT_MS = 10 * 60 * 1000;
const TRANSFORM_POLL_MS = 100;

/**
 * Worker entrypoint for the public WDR package. The worker uses Core media
 * capabilities for discovery and playback; it never executes FFmpeg itself.
 * When conversion is needed, the Worker requests a scoped Core transform and
 * consumes its output through the SDK. HLS follows the same Core-owned session
 * and asset-token boundary; the Worker never executes media tools itself.
 */
export async function startWdrWorker(input: WdrWorkerStart, connect: WdrWorkerConnector = connectWorkerClient): Promise<WdrWorkerHandle> {
  const client = await connect(input);
  const source = input.source ?? remoteSource(client);
  const createPlayback = input.source === undefined ? async (mediaId: string) => (await client.media().createPlayback(mediaId)).sessionId : undefined;
  const mediaSourceService = typeof client.mediaSources === "function" ? () => client.mediaSources!() : undefined;
  client.onGatewayRequest((request, signal) => respond(request, signal, source, createPlayback, input.source === undefined ? client : undefined, mediaSourceService));
  return { stop: () => client.close() };
}

function remoteSource(client: WorkerClient): WdrMediaSource {
  return {
    list: async () => (await client.call<{ media: readonly WdrMediaItem[] }>("media.list")).media,
    open: async (id, slice, signal, playbackSessionId) => (async function* () {
      for (let start = slice.start; start <= slice.end && !signal.aborted; start += 262_144) {
        const end = Math.min(slice.end, start + 262_144 - 1);
        const result = await client.call<{ data: string; completed: boolean }>("media.read", { mediaId: id, sessionId: playbackSessionId, start, end });
        yield Buffer.from(result.data, "base64");
        if (result.completed) return;
      }
    })()
  };
}

function configuredMediaSource(mediaSources: MediaSourceService, sourceHandle: string): WdrMediaSource {
  return {
    list: async () => (await mediaSources.list({ sourceHandle })).items.filter((item) => item.kind === "file").map((item) => ({ id: item.itemHandle, title: item.name, contentType: item.contentType ?? "application/octet-stream", size: item.size ?? 0 })),
    open: async (id, slice, signal, playbackSessionId) => (async function* () {
      let sessionId = playbackSessionId;
      if (sessionId === undefined) sessionId = (await mediaSources.createPlayback(sourceHandle, id)).sessionId;
      for (let start = slice.start; start <= slice.end && !signal.aborted; start += 262_144) {
        const end = Math.min(slice.end, start + 262_144 - 1);
        const result = await mediaSources.read({ sessionId, start, end });
        yield Buffer.from(result.data, "base64");
        if (result.completed) return;
      }
    })()
  };
}

export const startWorker = startWdrWorker;

function range(value: string | undefined, size: number): { start: number; end: number } | undefined {
  if (!Number.isSafeInteger(size) || size <= 0) return undefined;
  if (value === undefined) return { start: 0, end: size - 1 };
  const match = /^bytes=(\d*)-(\d*)$/u.exec(value);
  if (match === null || (match[1] === "" && match[2] === "")) return undefined;
  const start = match[1] === "" ? Math.max(0, size - Number(match[2])) : Number(match[1]);
  const end = match[2] === "" ? size - 1 : Number(match[2]);
  const clampedEnd = Math.min(end, size - 1);
  return Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 0 && start <= clampedEnd ? { start, end: clampedEnd } : undefined;
}

function queryValue(request: GatewayWorkerRequest, name: string): string | undefined {
  const value = request.query?.[name];
  return Array.isArray(value) ? value[0] : value;
}

function transformRequest(request: GatewayWorkerRequest): MediaTransformRequest | null | undefined {
  const mode = queryValue(request, "mode");
  if (mode === undefined) return undefined;
  if (mode !== "remux" && mode !== "transcode") return null;
  const container = queryValue(request, "container");
  const videoCodec = queryValue(request, "videoCodec");
  const audioCodec = queryValue(request, "audioCodec");
  if (container !== undefined && !["mp4", "fmp4", "ts"].includes(container)) return null;
  if (videoCodec !== undefined && !["copy", "h264", "h265"].includes(videoCodec)) return null;
  if (audioCodec !== undefined && !["copy", "aac", "opus"].includes(audioCodec)) return null;
  const result: MediaTransformRequest = { mode };
  if (container !== undefined) result.container = container as NonNullable<MediaTransformRequest["container"]>;
  if (videoCodec !== undefined) result.videoCodec = videoCodec as NonNullable<MediaTransformRequest["videoCodec"]>;
  if (audioCodec !== undefined) result.audioCodec = audioCodec as NonNullable<MediaTransformRequest["audioCodec"]>;
  return result;
}

async function waitForTransform(client: WorkerClient, job: PluginJob, signal: AbortSignal): Promise<PluginJob> {
  const deadline = Date.now() + TRANSFORM_WAIT_MS;
  while (Date.now() < deadline) {
    if (signal.aborted) {
      await client.jobs().cancel(job.id).catch(() => undefined);
      throw new Error("Transform cancelled");
    }
    const current = (await client.jobs().list({ limit: 50 })).find((candidate) => candidate.id === job.id);
    if (current?.status === "succeeded" || current?.status === "failed" || current?.status === "cancelled") return current;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, TRANSFORM_POLL_MS);
      signal.addEventListener("abort", () => { clearTimeout(timer); reject(new Error("Transform cancelled")); }, { once: true });
    });
  }
  await client.jobs().cancel(job.id).catch(() => undefined);
  throw new Error("Transform timed out");
}

async function transformedStream(client: WorkerClient, outputId: string, requested: { start: number; end: number }, signal: AbortSignal): Promise<AsyncIterable<Uint8Array>> {
  return (async function* () {
    for (let start = requested.start; start <= requested.end && !signal.aborted; start += 262_144) {
      const end = Math.min(requested.end, start + 262_144 - 1);
      const result = await client.media().readOutput(outputId, start, end);
      yield Buffer.from(result.data, "base64");
      if (result.completed) return;
    }
  })();
}

async function transformedResponse(client: WorkerClient, mediaId: string, request: MediaTransformRequest, requestedRange: string | undefined, signal: AbortSignal): Promise<GatewayWorkerResponse> {
  const probe = await client.media().probe(mediaId);
  if (!probe.availableModes.includes(request.mode)) return { status: 409, body: { code: "CMH.WDR.MEDIA_TRANSFORM_UNAVAILABLE" } };
  const job = await client.media().requestTransform(mediaId, request);
  const completed = await waitForTransform(client, job, signal);
  if (completed.status !== "succeeded" || typeof completed.result !== "object" || completed.result === null) return { status: 503, body: { code: "CMH.WDR.MEDIA_TRANSFORM_FAILED" } };
  const output = completed.result as { outputId?: unknown; contentType?: unknown; bytes?: unknown };
  if (typeof output.outputId !== "string" || typeof output.contentType !== "string" || typeof output.bytes !== "number" || !Number.isSafeInteger(output.bytes) || output.bytes <= 0) return { status: 503, body: { code: "CMH.WDR.MEDIA_TRANSFORM_INVALID" } };
  const outputBytes = output.bytes;
  const requested = range(requestedRange, outputBytes);
  if (requested === undefined) return { status: 416, headers: { "content-range": `bytes */${outputBytes}` }, body: { code: "CMH.WDR.INVALID_RANGE" } };
  const partial = requestedRange !== undefined;
  return {
    status: partial ? 206 : 200,
    headers: { "content-type": output.contentType, "content-length": String(requested.end - requested.start + 1), ...(partial ? { "content-range": `bytes ${requested.start}-${requested.end}/${outputBytes}` } : {}), "accept-ranges": "bytes" },
    body: await transformedStream(client, output.outputId, requested, signal)
  };
}

async function hlsAssetStream(client: WorkerClient, sessionId: string, asset: string, requestedRange: string | undefined, signal: AbortSignal): Promise<{ headers: Record<string, string>; body: AsyncIterable<Uint8Array> }> {
  const first = await client.media().readHlsAsset(sessionId, asset, 0, 262143);
  const requested = range(requestedRange, first.size);
  if (requested === undefined) throw new Error("Invalid HLS range");
  const partial = requestedRange !== undefined;
  return {
    headers: { "content-type": first.contentType, "content-length": String(requested.end - requested.start + 1), ...(partial ? { "content-range": `bytes ${requested.start}-${requested.end}/${first.size}` } : {}), "accept-ranges": "bytes" },
    body: (async function* () {
      for (let start = requested.start; start <= requested.end && !signal.aborted; start += 262144) {
        const end = Math.min(requested.end, start + 262143);
        const result = start === 0 ? first : await client.media().readHlsAsset(sessionId, asset, start, end);
        yield Buffer.from(result.data, "base64");
        if (result.completed && end >= requested.end) return;
      }
    })()
  };
}

async function hlsResponse(client: WorkerClient, mediaId: string | undefined, sessionId: string | undefined, asset: string | undefined, requestedRange: string | undefined, signal: AbortSignal): Promise<GatewayWorkerResponse> {
  if (sessionId !== undefined && asset !== undefined) {
    const output = await hlsAssetStream(client, sessionId, asset, requestedRange, signal);
    return { status: requestedRange === undefined ? 200 : 206, headers: output.headers, body: output.body };
  }
  if (mediaId === undefined) return { status: 400, body: { code: "CMH.WDR.MEDIA_ID_REQUIRED" } };
  const probe = await client.media().probe(mediaId);
  if (!probe.seekable) return { status: 409, body: { code: "CMH.WDR.MEDIA_NOT_SEEKABLE" } };
  const job = await client.media().requestHls(mediaId, { segmentDurationSeconds: 4 });
  const completed = await waitForTransform(client, job, signal);
  if (completed.status !== "succeeded" || typeof completed.result !== "object" || completed.result === null) return { status: 503, body: { code: "CMH.WDR.MEDIA_HLS_FAILED" } };
  const result = completed.result as { sessionId?: unknown; playlistAsset?: unknown };
  if (typeof result.sessionId !== "string" || typeof result.playlistAsset !== "string") return { status: 503, body: { code: "CMH.WDR.MEDIA_HLS_INVALID" } };
  const playlist = await client.media().readHlsAsset(result.sessionId, result.playlistAsset, 0, 262143);
  const text = Buffer.from(playlist.data, "base64").toString("utf8").replace(/^segment_\d{5}\.ts$/gmu, (name) => `hls?session=${encodeURIComponent(result.sessionId as string)}&asset=${encodeURIComponent(name)}`);
  const bytes = Buffer.from(text, "utf8");
  return { status: 200, headers: { "content-type": "application/vnd.apple.mpegurl", "content-length": String(bytes.length), "cache-control": "no-store" }, body: (async function* () { yield bytes; })() };
}

async function recordPlaybackStart(client: WorkerClient | undefined, item: WdrMediaItem): Promise<void> {
  if (client === undefined || client.database === undefined) return;
  const database = client.database;
  try {
    const updatedAt = new Date().toISOString();
    const value = { mediaId: item.id, title: item.title, positionSeconds: 0, updatedAt };
    const key = `media_${crypto.createHash("sha256").update(item.id).digest("hex").slice(0, 48)}`;
    await database().put("playback", key, value);
  } catch {
    // Playback remains available when the optional history/data side effect fails.
  }
}

async function respond(request: GatewayWorkerRequest, signal: AbortSignal, source: WdrMediaSource | undefined, createPlayback?: (mediaId: string) => Promise<string>, transformClient?: WorkerClient, mediaSources?: () => MediaSourceService): Promise<GatewayWorkerResponse> {
  if (request.method !== "GET" && request.method !== "HEAD") return { status: 405, body: { code: "CMH.WDR.METHOD_NOT_ALLOWED" } };
  if (request.path === "/health") return { status: 200, body: { status: "ok", worker: "wdr-media", ...(request.context === undefined ? {} : { locale: request.context.locale, entry: request.context.entry, display: request.context.display }) } };
  const sourceHandle = queryValue(request, "source");
  const selectedSource = sourceHandle !== undefined && mediaSources !== undefined ? configuredMediaSource(mediaSources(), sourceHandle) : source;
  if (selectedSource === undefined) return { status: 503, body: { code: "CMH.WDR.MEDIA_NOT_CONFIGURED" } };
  if (sourceHandle !== undefined && mediaSources === undefined) return { status: 503, body: { code: "CMH.WDR.MEDIA_SOURCE_UNAVAILABLE" } };
  if (request.path === "/" || request.path === "" || request.path === "/library") return { status: 200, body: { media: await selectedSource.list() } };
  if (request.path === "/stream") {
    const mediaId = request.query?.id;
    if (typeof mediaId !== "string") return { status: 400, body: { code: "CMH.WDR.MEDIA_ID_REQUIRED" } };
    const item = (await selectedSource.list()).find((candidate) => candidate.id === mediaId);
    if (item === undefined) return { status: 404, body: { code: "CMH.WDR.MEDIA_NOT_FOUND" } };
    const requestedTransform = transformRequest(request);
    if (requestedTransform === null) return { status: 400, body: { code: "CMH.WDR.INVALID_TRANSFORM" } };
    if (requestedTransform !== undefined) {
      if (request.method === "HEAD") return { status: 405, body: { code: "CMH.WDR.TRANSFORM_GET_ONLY" } };
      if (transformClient === undefined || sourceHandle !== undefined) return { status: 503, body: { code: "CMH.WDR.MEDIA_TRANSFORM_UNAVAILABLE" } };
      try { return await transformedResponse(transformClient, item.id, requestedTransform, request.headers?.range, signal); } catch { return { status: 503, body: { code: "CMH.WDR.MEDIA_TRANSFORM_FAILED" } }; }
    }
    const requested = range(request.headers?.range, item.size);
    if (requested === undefined) return { status: 416, headers: { "content-range": `bytes */${item.size}` }, body: { code: "CMH.WDR.INVALID_RANGE" } };
    const partial = request.headers?.range !== undefined;
    const playbackSessionId = request.method === "GET" && createPlayback !== undefined ? await createPlayback(item.id) : undefined;
    if (request.method === "HEAD") return { status: partial ? 206 : 200, headers: { "content-type": item.contentType, "content-length": String(requested.end - requested.start + 1), ...(partial ? { "content-range": `bytes ${requested.start}-${requested.end}/${item.size}` } : {}), "accept-ranges": "bytes" } };
    const sourceBody = await selectedSource.open(item.id, requested, signal, playbackSessionId);
    const body = (async function* () {
      await recordPlaybackStart(transformClient, item);
      for await (const chunk of sourceBody) {
        yield chunk;
      }
    })();
    return { status: partial ? 206 : 200, headers: { "content-type": item.contentType, "content-length": String(requested.end - requested.start + 1), ...(partial ? { "content-range": `bytes ${requested.start}-${requested.end}/${item.size}` } : {}), "accept-ranges": "bytes" }, body };
  }
  if (request.path === "/hls") {
    if (request.method !== "GET" || transformClient === undefined) return { status: 405, body: { code: "CMH.WDR.HLS_GET_ONLY" } };
    try { return await hlsResponse(transformClient, queryValue(request, "id"), queryValue(request, "session"), queryValue(request, "asset"), request.headers?.range, signal); } catch { return { status: 503, body: { code: "CMH.WDR.MEDIA_HLS_FAILED" } }; }
  }
  return { status: 404, body: { code: "CMH.WDR.ROUTE_NOT_FOUND" } };
}
