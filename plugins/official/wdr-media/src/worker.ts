import { connectWorkerClient, type GatewayWorkerRequest, type GatewayWorkerResponse, type MediaTransformRequest, type PluginJob, type WorkerClient, type WorkerClientOptions } from "@carmediahub/sdk";

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
 * When conversion is needed, a plugin must request a scoped Core transform and
 * consume its output through the SDK. This example currently serves direct
 * range playback and does not yet wire transformed output into its route.
 */
export async function startWdrWorker(input: WdrWorkerStart, connect: WdrWorkerConnector = connectWorkerClient): Promise<WdrWorkerHandle> {
  const client = await connect(input);
  const source = input.source ?? remoteSource(client);
  const createPlayback = input.source === undefined ? async (mediaId: string) => (await client.media().createPlayback(mediaId)).sessionId : undefined;
  client.onGatewayRequest((request, signal) => respond(request, signal, source, createPlayback, input.source === undefined ? client : undefined));
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

async function respond(request: GatewayWorkerRequest, signal: AbortSignal, source: WdrMediaSource | undefined, createPlayback?: (mediaId: string) => Promise<string>, transformClient?: WorkerClient): Promise<GatewayWorkerResponse> {
  if (request.method !== "GET" && request.method !== "HEAD") return { status: 405, body: { code: "CMH.WDR.METHOD_NOT_ALLOWED" } };
  if (request.path === "/health") return { status: 200, body: { status: "ok", worker: "wdr-media", ...(request.context === undefined ? {} : { locale: request.context.locale, entry: request.context.entry, display: request.context.display }) } };
  if (source === undefined) return { status: 503, body: { code: "CMH.WDR.MEDIA_NOT_CONFIGURED" } };
  if (request.path === "/" || request.path === "" || request.path === "/library") return { status: 200, body: { media: await source.list() } };
  if (request.path === "/stream") {
    const mediaId = request.query?.id;
    if (typeof mediaId !== "string") return { status: 400, body: { code: "CMH.WDR.MEDIA_ID_REQUIRED" } };
    const item = (await source.list()).find((candidate) => candidate.id === mediaId);
    if (item === undefined) return { status: 404, body: { code: "CMH.WDR.MEDIA_NOT_FOUND" } };
    const requestedTransform = transformRequest(request);
    if (requestedTransform === null) return { status: 400, body: { code: "CMH.WDR.INVALID_TRANSFORM" } };
    if (requestedTransform !== undefined) {
      if (request.method === "HEAD") return { status: 405, body: { code: "CMH.WDR.TRANSFORM_GET_ONLY" } };
      if (transformClient === undefined) return { status: 503, body: { code: "CMH.WDR.MEDIA_TRANSFORM_UNAVAILABLE" } };
      try { return await transformedResponse(transformClient, item.id, requestedTransform, request.headers?.range, signal); } catch { return { status: 503, body: { code: "CMH.WDR.MEDIA_TRANSFORM_FAILED" } }; }
    }
    const requested = range(request.headers?.range, item.size);
    if (requested === undefined) return { status: 416, headers: { "content-range": `bytes */${item.size}` }, body: { code: "CMH.WDR.INVALID_RANGE" } };
    const partial = request.headers?.range !== undefined;
    const playbackSessionId = request.method === "GET" && createPlayback !== undefined ? await createPlayback(item.id) : undefined;
    return { status: partial ? 206 : 200, headers: { "content-type": item.contentType, "content-length": String(requested.end - requested.start + 1), ...(partial ? { "content-range": `bytes ${requested.start}-${requested.end}/${item.size}` } : {}), "accept-ranges": "bytes" }, ...(request.method === "HEAD" ? {} : { body: await source.open(item.id, requested, signal, playbackSessionId) }) };
  }
  return { status: 404, body: { code: "CMH.WDR.ROUTE_NOT_FOUND" } };
}
