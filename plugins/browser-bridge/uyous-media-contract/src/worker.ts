import { connectWorkerClient, type GatewayWorkerRequest, type GatewayWorkerResponse, type WorkerClient, type WorkerClientOptions } from "@carmediahub/sdk";

export interface UyousMediaContractHandle { stop(): void; }
export type UyousMediaContractConnector = (options: WorkerClientOptions) => Promise<WorkerClient>;

/** Contract only: Core owns browser identity, targets, limits and result validation. */
export async function startUyousMediaContract(input: WorkerClientOptions, connect: UyousMediaContractConnector = connectWorkerClient): Promise<UyousMediaContractHandle> {
  const client = await connect(input);
  client.onGatewayRequest((request, signal) => respond(client, request, signal));
  return { stop: () => client.close() };
}

async function respond(client: WorkerClient, request: GatewayWorkerRequest, signal: AbortSignal): Promise<GatewayWorkerResponse> {
  if (request.method === "HEAD") return { status: request.path === "/" || request.path === "/health" ? 200 : 404 };
  if (request.path === "/health" && request.method === "GET") return { status: 200, body: { status: "ok", worker: "uyous-media-contract", browserDriver: "core-owned", profileAccess: false, cookieAccess: false, cdpAccess: false, locale: request.context?.locale ?? client.context.locale } };
  if (request.path === "/" && request.method === "GET") return { status: 200, body: { adapter: "uyous-media-contract", mode: "contract-only", profileAccess: false, cookieAccess: false, cdpAccess: false } };
  if (request.path !== "/extract") return { status: 404, body: { code: "CMH.UYOUS_CONTRACT.ROUTE_NOT_FOUND" } };
  if (request.method !== "POST") return { status: 405, body: { code: "CMH.UYOUS_CONTRACT.METHOD_NOT_ALLOWED" } };
  const input = request.body as { target?: unknown } | undefined;
  if (typeof input?.target !== "string" || !/^[a-z][a-z0-9_.:-]{0,80}$/u.test(input.target)) return { status: 400, body: { code: "CMH.UYOUS_CONTRACT.INVALID_TARGET" } };
  if (signal.aborted) return { status: 499, body: { code: "CMH.UYOUS_CONTRACT.CANCELLED" } };
  const session = await client.browser().request({ name: "uyous-contract", purpose: "bounded media extraction contract", expiresInSeconds: 120 });
  const task = await client.browser().enqueue({ sessionId: session.id, kind: "navigate-and-capture", input: { target: input.target, label: "bounded media metadata" } });
  if (signal.aborted) { await client.browser().cancelTask(task.id); return { status: 499, body: { code: "CMH.UYOUS_CONTRACT.CANCELLED" } }; }
  return { status: 202, body: { sessionId: session.id, taskId: task.id, target: input.target, result: "core-owned-task" } };
}

export const startWorker = startUyousMediaContract;
