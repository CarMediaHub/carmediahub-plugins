import { connectWorkerClient, type GatewayWorkerRequest, type GatewayWorkerResponse, type WorkerClient, type WorkerClientOptions } from "@carmediahub/sdk";

export interface HistoryWorkerHandle { stop(): void; }
export type HistoryWorkerConnector = (options: WorkerClientOptions) => Promise<WorkerClient>;

/**
 * The common history UI talks only to the SDK history capability. Core owns
 * storage, filtering, retention and user/installation scope.
 */
export async function startHistoryWorker(input: WorkerClientOptions, connect: HistoryWorkerConnector = connectWorkerClient): Promise<HistoryWorkerHandle> {
  const client = await connect(input);
  client.onGatewayRequest((request) => respond(client, request));
  return { stop: () => client.close() };
}

export const startWorker = startHistoryWorker;

function queryValue(request: GatewayWorkerRequest, name: string): string | undefined {
  const value = request.query?.[name];
  return Array.isArray(value) ? value[0] : value;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined || !/^\d{1,4}$/u.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, 500) : fallback;
}

async function respond(client: WorkerClient, request: GatewayWorkerRequest): Promise<GatewayWorkerResponse> {
  if (request.path === "/health") {
    if (request.method === "HEAD") return { status: 200 };
    if (request.method === "GET") return { status: 200, body: { status: "ok", worker: "history", locale: request.context?.locale ?? client.context.locale } };
    return { status: 405, body: { code: "CMH.HISTORY.METHOD_NOT_ALLOWED" } };
  }
  if (request.path !== "/" && request.path !== "") return { status: 404, body: { code: "CMH.HISTORY.ROUTE_NOT_FOUND" } };
  if (request.method === "GET") {
    const keyword = queryValue(request, "keyword");
    const category = queryValue(request, "category");
    const options = { limit: positiveInteger(queryValue(request, "limit"), 100), offset: positiveInteger(queryValue(request, "offset"), 1) - 1, ...(keyword === undefined ? {} : { keyword }), ...(category === undefined ? {} : { category }) };
    const page = await client.history().queryPage(options);
    return { status: 200, body: page };
  }
  if (request.method === "DELETE") {
    const category = queryValue(request, "category");
    return { status: 200, body: { cleared: await client.history().clear(category === undefined ? {} : { category }) } };
  }
  if (request.method === "POST") {
    if (typeof request.body !== "object" || request.body === null || Array.isArray(request.body)) return { status: 400, body: { code: "CMH.HISTORY.INVALID_ENTRY" } };
    const input = request.body as Record<string, unknown>;
    if (typeof input.subjectType !== "string" || typeof input.subjectId !== "string" || typeof input.title !== "string" || typeof input.route !== "string" || (input.category !== undefined && typeof input.category !== "string")) return { status: 400, body: { code: "CMH.HISTORY.INVALID_ENTRY" } };
    const entry = await client.history().record({ subjectType: input.subjectType, subjectId: input.subjectId, title: input.title, route: input.route, ...(input.category === undefined ? {} : { category: input.category }), ...(request.context === undefined ? {} : { sourceDevice: request.context.display.deviceClass }) });
    return { status: 201, body: { entry } };
  }
  return { status: 405, body: { code: "CMH.HISTORY.METHOD_NOT_ALLOWED" } };
}
