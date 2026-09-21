import { connectWorkerClient, type GatewayWorkerRequest, type GatewayWorkerResponse, type WorkerClient, type WorkerClientOptions } from "@carmediahub/sdk";

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

/**
 * Worker entrypoint for the public WDR package. Media discovery, range output,
 * and transcoding are intentionally not implemented here until their Core
 * capabilities and resource policies are available.
 */
export async function startWdrWorker(input: WdrWorkerStart, connect: WdrWorkerConnector = connectWorkerClient): Promise<WdrWorkerHandle> {
  const client = await connect(input);
  const source = input.source ?? remoteSource(client);
  const createPlayback = input.source === undefined ? async (mediaId: string) => (await client.media().createPlayback(mediaId)).sessionId : undefined;
  client.onGatewayRequest((request, signal) => respond(request, signal, source, createPlayback));
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

async function respond(request: GatewayWorkerRequest, signal: AbortSignal, source: WdrMediaSource | undefined, createPlayback?: (mediaId: string) => Promise<string>): Promise<GatewayWorkerResponse> {
  if (request.method !== "GET" && request.method !== "HEAD") return { status: 405, body: { code: "CMH.WDR.METHOD_NOT_ALLOWED" } };
  if (request.path === "/health") return { status: 200, body: { status: "ok", worker: "wdr-media", ...(request.context === undefined ? {} : { locale: request.context.locale, entry: request.context.entry, display: request.context.display }) } };
  if (source === undefined) return { status: 503, body: { code: "CMH.WDR.MEDIA_NOT_CONFIGURED" } };
  if (request.path === "/" || request.path === "" || request.path === "/library") return { status: 200, body: { media: await source.list() } };
  if (request.path === "/stream") {
    const mediaId = request.query?.id;
    if (typeof mediaId !== "string") return { status: 400, body: { code: "CMH.WDR.MEDIA_ID_REQUIRED" } };
    const item = (await source.list()).find((candidate) => candidate.id === mediaId);
    if (item === undefined) return { status: 404, body: { code: "CMH.WDR.MEDIA_NOT_FOUND" } };
    const requested = range(request.headers?.range, item.size);
    if (requested === undefined) return { status: 416, headers: { "content-range": `bytes */${item.size}` }, body: { code: "CMH.WDR.INVALID_RANGE" } };
    const partial = request.headers?.range !== undefined;
    const playbackSessionId = createPlayback === undefined ? undefined : await createPlayback(item.id);
    return { status: partial ? 206 : 200, headers: { "content-type": item.contentType, "content-length": String(requested.end - requested.start + 1), ...(partial ? { "content-range": `bytes ${requested.start}-${requested.end}/${item.size}` } : {}), "accept-ranges": "bytes" }, ...(request.method === "HEAD" ? {} : { body: await source.open(item.id, requested, signal, playbackSessionId) }) };
  }
  return { status: 404, body: { code: "CMH.WDR.ROUTE_NOT_FOUND" } };
}
