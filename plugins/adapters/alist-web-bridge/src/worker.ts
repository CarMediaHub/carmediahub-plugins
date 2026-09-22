import { connectWorkerClient, type GatewayWorkerRequest, type GatewayWorkerResponse, type WorkerClient, type WorkerClientOptions } from "@carmediahub/sdk";

export interface AListWebBridgeOptions extends WorkerClientOptions { binding?: string; }
export type AListWebBridgeConnector = (options: WorkerClientOptions) => Promise<WorkerClient>;

function relativePath(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.startsWith("/") || value.includes("\\") || value.split("/").includes("..") || value.length > 2048) return undefined;
  return value;
}

/** Bridges an operator-approved AList HTTP binding without changing AList itself. */
export async function startWorker(input: AListWebBridgeOptions, connect: AListWebBridgeConnector = connectWorkerClient) {
  const client = await connect(input);
  const binding = input.binding ?? "alist-web";
  client.onGatewayRequest(async (request: GatewayWorkerRequest): Promise<GatewayWorkerResponse> => {
    if (request.method !== "GET" && request.method !== "HEAD") return { status: 405, body: { code: "CMH.ALIST.METHOD_NOT_ALLOWED" } };
    if (request.path === "/health") return { status: 200, body: { status: "ok", adapter: "alist-web-bridge", binding } };
    if (request.path !== "/proxy") return { status: 404, body: { code: "CMH.ALIST.ROUTE_NOT_FOUND" } };
    const path = relativePath(request.query?.path);
    if (path === undefined) return { status: 400, body: { code: "CMH.ALIST.RELATIVE_PATH_REQUIRED" } };
    const result = await client.network().request({ binding, method: request.method, path, headers: { ...(request.headers?.accept === undefined ? {} : { accept: request.headers.accept }), ...(request.headers?.range === undefined ? {} : { range: request.headers.range }) } });
    return { status: result.status, headers: result.headers, ...(request.method === "HEAD" || result.bodyBase64 === undefined ? {} : { body: Buffer.from(result.bodyBase64, "base64") }) };
  });
  return { stop: () => client.close() };
}
