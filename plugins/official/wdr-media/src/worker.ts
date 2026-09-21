import { connectWorkerClient, type GatewayWorkerRequest, type WorkerClient, type WorkerClientOptions } from "@carmediahub/sdk";

export interface WdrWorkerStart extends WorkerClientOptions {}

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
  client.onGatewayRequest((request) => respond(request));
  return { stop: () => client.close() };
}

export const startWorker = startWdrWorker;

function respond(request: GatewayWorkerRequest): unknown {
  if (request.method !== "GET") return { status: 405, body: { code: "CMH.WDR.METHOD_NOT_ALLOWED" } };
  if (request.path === "/health") return { status: 200, body: { status: "ok", worker: "wdr-media" } };
  if (request.path === "/" || request.path === "") return { status: 200, body: { application: "wdr-media", media: "not-configured" } };
  return { status: 404, body: { code: "CMH.WDR.ROUTE_NOT_FOUND" } };
}
