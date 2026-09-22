import { connectWorkerClient, type GatewayWorkerRequest, type GatewayWorkerResponse, type WorkerClient, type WorkerClientOptions } from "@carmediahub/sdk";

export interface BrowserSessionExampleHandle { stop(): void; }
export type BrowserSessionExampleConnector = (options: WorkerClientOptions) => Promise<WorkerClient>;

/** Contract fixture only: no browser process, profile, cookie or CDP access. */
export async function startBrowserSessionExample(input: WorkerClientOptions, connect: BrowserSessionExampleConnector = connectWorkerClient): Promise<BrowserSessionExampleHandle> {
  const client = await connect(input);
  client.onGatewayRequest((request) => respond(client, request));
  return { stop: () => client.close() };
}

async function respond(client: WorkerClient, request: GatewayWorkerRequest): Promise<GatewayWorkerResponse> {
  if (request.method === "HEAD") return { status: request.path === "/" || request.path === "/health" ? 200 : 404 };
  if (request.method !== "GET") return { status: 405, body: { code: "CMH.BROWSER_EXAMPLE.METHOD_NOT_ALLOWED" } };
  if (request.path === "/health") return { status: 200, body: { status: "ok", worker: "browser-session-contract-example", browserDriver: "none" } };
  if (request.path === "/") return { status: 200, body: { adapter: "browser-session-contract-example", browserDriver: "none", profileAccess: false, cookieAccess: false, cdpAccess: false } };
  if (request.path === "/session") {
    const session = await client.browser().request({ name: "contract-fixture", purpose: "validate opaque browser session lifecycle", expiresInSeconds: 300 });
    return { status: 200, body: session };
  }
  if (request.path === "/task") {
    const session = await client.browser().request({ name: "task-fixture", purpose: "validate restricted browser task lifecycle", expiresInSeconds: 300 });
    const task = await client.browser().enqueue({ sessionId: session.id, kind: "navigate-and-capture", input: { target: "contract-fixture", label: "Contract fixture" } });
    const listed = await client.browser().tasks();
    const cancelled = await client.browser().cancelTask(task.id);
    return { status: 200, body: { session, task, listed, cancelled } };
  }
  return { status: 404, body: { code: "CMH.BROWSER_EXAMPLE.ROUTE_NOT_FOUND" } };
}

export const startWorker = startBrowserSessionExample;
