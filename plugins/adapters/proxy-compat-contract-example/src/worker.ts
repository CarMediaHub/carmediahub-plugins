import { connectWorkerClient, type GatewayWorkerRequest, type GatewayWorkerResponse, type WorkerClient, type WorkerClientOptions } from "@carmediahub/sdk";

export interface ProxyCompatOptions extends WorkerClientOptions { binding?: string; }
export type ProxyCompatConnector = (options: WorkerClientOptions) => Promise<WorkerClient>;

const responseHeaders = new Set(["accept-ranges", "cache-control", "content-length", "content-range", "content-type", "etag", "last-modified"]);
const forwardedRequestHeaders = new Set(["accept", "accept-language", "range"]);
const maxResponseBytes = 8 * 1024 * 1024;

function relativePath(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048 || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.split("/").includes("..")) return undefined;
  return value;
}

function safeHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).filter(([name]) => responseHeaders.has(name.toLowerCase())));
}

/** Demonstrates a proxy-compatible adapter without exposing upstream redirects, cookies, or arbitrary headers. */
export async function startWorker(input: ProxyCompatOptions, connect: ProxyCompatConnector = connectWorkerClient) {
  const client = await connect(input);
  const binding = input.binding ?? "approved-upstream";
  client.onGatewayRequest(async (request: GatewayWorkerRequest): Promise<GatewayWorkerResponse> => {
    if (request.method !== "GET" && request.method !== "HEAD") return { status: 405, body: { code: "CMH.PROXY_COMPAT.METHOD_NOT_ALLOWED" } };
    if (request.path === "/health") return { status: 200, body: { status: "ok", adapter: "proxy-compat-contract-example", binding } };
    if (request.path !== "/proxy") return { status: 404, body: { code: "CMH.PROXY_COMPAT.ROUTE_NOT_FOUND" } };
    const path = relativePath(request.query?.path);
    if (path === undefined) return { status: 400, body: { code: "CMH.PROXY_COMPAT.RELATIVE_PATH_REQUIRED" } };
    const headers = Object.fromEntries(Object.entries(request.headers ?? {}).filter(([name]) => forwardedRequestHeaders.has(name.toLowerCase())));
    const result = await client.network().request({ binding, method: request.method, path, headers });
    const outputHeaders = safeHeaders(result.headers);
    if (result.status >= 300 && result.status < 400) return { status: result.status, headers: outputHeaders };
    if (result.bodyBase64 === undefined || request.method === "HEAD") return { status: result.status, headers: outputHeaders };
    const body = Buffer.from(result.bodyBase64, "base64");
    if (body.byteLength > maxResponseBytes) return { status: 413, body: { code: "CMH.PROXY_COMPAT.RESPONSE_TOO_LARGE" } };
    return { status: result.status, headers: outputHeaders, body };
  });
  return { stop: () => client.close() };
}

export const startProxyCompatWorker = startWorker;
