import { connectWorkerClient, type GatewayWorkerRequest, type GatewayWorkerResponse, type WorkerClient, type WorkerClientOptions } from "@carmediahub/sdk";

export interface MihomoWebBridgeOptions extends WorkerClientOptions { binding?: string; }
export type MihomoWebBridgeConnector = (options: WorkerClientOptions) => Promise<WorkerClient>;

const methods = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"]);
const allowedPrefixes = ["/configs", "/proxies", "/providers", "/rules", "/connections", "/version"];
const responseHeaders = new Set(["accept-ranges", "cache-control", "content-length", "content-range", "content-type", "etag", "last-modified"]);

function relativeApiPath(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.startsWith("/") || value.includes("\\") || value.split("/").includes("..") || value.length > 1024) return undefined;
  if (!allowedPrefixes.some((prefix) => value === prefix || value.startsWith(`${prefix}/`) || value.startsWith(`${prefix}?`))) return undefined;
  return value;
}

function requestBody(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string") return value.length <= 64 * 1024 ? value : undefined;
  if (value instanceof Buffer) return value.length <= 64 * 1024 ? value.toString("utf8") : undefined;
  return undefined;
}

function safeHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).filter(([name]) => responseHeaders.has(name.toLowerCase())));
}

/** Bridges an operator-approved Mihomo control API without changing Mihomo or forwarding credentials. */
export async function startWorker(input: MihomoWebBridgeOptions, connect: MihomoWebBridgeConnector = connectWorkerClient) {
  const client = await connect(input);
  const binding = input.binding ?? "mihomo-web";
  client.onGatewayRequest(async (request: GatewayWorkerRequest): Promise<GatewayWorkerResponse> => {
    if (!methods.has(request.method)) return { status: 405, body: { code: "CMH.MIHOMO.METHOD_NOT_ALLOWED" } };
    if (request.path === "/health") return { status: 200, body: { status: "ok", adapter: "mihomo-web-bridge", binding, websocket: false } };
    if (request.path === "/") return { status: 200, body: { adapter: "mihomo-web-bridge", mode: "bounded-control-api", websocket: false } };
    if (request.path !== "/proxy") return { status: 404, body: { code: "CMH.MIHOMO.ROUTE_NOT_FOUND" } };
    const path = relativeApiPath(request.query?.path);
    if (path === undefined) return { status: 400, body: { code: "CMH.MIHOMO.PATH_NOT_ALLOWED" } };
    const body = requestBody(request.body);
    if (request.body !== undefined && body === undefined) return { status: 400, body: { code: "CMH.MIHOMO.BODY_NOT_ALLOWED" } };
    const result = await client.network().request({ binding, method: request.method, path, ...(body === undefined ? {} : { body }), headers: { ...(request.headers?.accept === undefined ? {} : { accept: request.headers.accept }), ...(request.headers?.["content-type"] === undefined ? {} : { "content-type": request.headers["content-type"] }), ...(request.headers?.["if-none-match"] === undefined ? {} : { "if-none-match": request.headers["if-none-match"] }) } });
    return { status: result.status, headers: safeHeaders(result.headers), ...(request.method === "HEAD" || result.bodyBase64 === undefined ? {} : { body: Buffer.from(result.bodyBase64, "base64") }) };
  });
  return { stop: () => client.close() };
}
