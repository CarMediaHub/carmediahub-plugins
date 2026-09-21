import { connectWorkerClient, type GatewayWorkerRequest, type GatewayWorkerResponse, type WorkerClient, type WorkerClientOptions } from "@carmediahub/sdk";

export interface WdrMediaItem { id: string; title: string; contentType: string; size: number; }
export interface WdrMediaSource {
  list(): Promise<readonly WdrMediaItem[]>;
  open(id: string, range: { start: number; end: number }, signal: AbortSignal): Promise<AsyncIterable<Uint8Array>>;
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
  client.onGatewayRequest((request, signal) => respond(request, signal, source));
  return { stop: () => client.close() };
}

function remoteSource(client: WorkerClient): WdrMediaSource {
  return {
    list: async () => (await client.call<{ media: readonly WdrMediaItem[] }>("media.list")).media,
    open: async (id, slice, signal) => (async function* () {
      for (let start = slice.start; start <= slice.end && !signal.aborted; start += 262_144) {
        const end = Math.min(slice.end, start + 262_144 - 1);
        const result = await client.call<{ data: string; completed: boolean }>("media.read", { mediaId: id, start, end });
        yield Buffer.from(result.data, "base64");
        if (result.completed) return;
      }
    })()
  };
}

export const startWorker = startWdrWorker;

function range(value: string | undefined, size: number): { start: number; end: number } | undefined {
  if (value === undefined) return { start: 0, end: size - 1 };
  const match = /^bytes=(\d*)-(\d*)$/u.exec(value);
  if (match === null || (match[1] === "" && match[2] === "")) return undefined;
  const start = match[1] === "" ? Math.max(0, size - Number(match[2])) : Number(match[1]);
  const end = match[2] === "" ? size - 1 : Number(match[2]);
  return Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 0 && start <= end && end < size ? { start, end } : undefined;
}

async function respond(request: GatewayWorkerRequest, signal: AbortSignal, source: WdrMediaSource | undefined): Promise<GatewayWorkerResponse> {
  if (request.method !== "GET") return { status: 405, body: { code: "CMH.WDR.METHOD_NOT_ALLOWED" } };
  if (request.path === "/health") return { status: 200, body: { status: "ok", worker: "wdr-media", ...(request.context?.locale === undefined ? {} : { locale: request.context.locale }) } };
  if (source === undefined) return { status: 503, body: { code: "CMH.WDR.MEDIA_NOT_CONFIGURED" } };
  if (request.path === "/" || request.path === "" || request.path === "/library") return { status: 200, body: { media: await source.list() } };
  if (request.path === "/stream") {
    const mediaId = request.query?.id;
    if (typeof mediaId !== "string") return { status: 400, body: { code: "CMH.WDR.MEDIA_ID_REQUIRED" } };
    const item = (await source.list()).find((candidate) => candidate.id === mediaId);
    if (item === undefined) return { status: 404, body: { code: "CMH.WDR.MEDIA_NOT_FOUND" } };
    const requested = range(request.headers?.range, item.size);
    if (requested === undefined) return { status: 416, headers: { "content-range": `bytes */${item.size}` }, body: { code: "CMH.WDR.INVALID_RANGE" } };
    return { status: request.headers?.range === undefined ? 200 : 206, headers: { "content-type": item.contentType, "content-length": String(requested.end - requested.start + 1), "content-range": `bytes ${requested.start}-${requested.end}/${item.size}`, "accept-ranges": "bytes" }, body: await source.open(item.id, requested, signal) };
  }
  return { status: 404, body: { code: "CMH.WDR.ROUTE_NOT_FOUND" } };
}
