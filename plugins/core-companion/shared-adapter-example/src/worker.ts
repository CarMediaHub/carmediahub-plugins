import { connectWorkerClient, type GatewayWorkerRequest, type GatewayWorkerResponse, type WorkerClient, type WorkerClientOptions } from "@carmediahub/sdk";

export interface SharedAdapterHandle { stop(): void; }
export type SharedAdapterConnector = (options: WorkerClientOptions) => Promise<WorkerClient>;

/** A public, upstream-free reference adapter for the shared host contract. */
export async function startSharedAdapter(input: WorkerClientOptions, connect: SharedAdapterConnector = connectWorkerClient): Promise<SharedAdapterHandle> {
  const client = await connect(input);
  client.onGatewayRequest((request) => respond(request));
  return { stop: () => client.close() };
}

async function respond(request: GatewayWorkerRequest): Promise<GatewayWorkerResponse> {
  if (request.method !== "GET" && request.method !== "HEAD") return { status: 405, body: { code: "CMH.SHARED_ADAPTER.METHOD_NOT_ALLOWED" } };
  if (request.path === "/health") return { status: 200, body: { status: "ok", worker: "shared-adapter-example", locale: request.context?.locale ?? "en", policyVersion: request.context?.policyVersion ?? 0 } };
  if (request.path === "/" || request.path === "") return { status: 200, body: { adapter: "shared-adapter-example", upstream: "none", capabilities: ["context", "gateway"] } };
  return { status: 404, body: { code: "CMH.SHARED_ADAPTER.ROUTE_NOT_FOUND" } };
}

export const startWorker = startSharedAdapter;
