import { connectWorkerClient, type GatewayWorkerRequest, type GatewayWorkerResponse, type WorkerClient, type WorkerClientOptions } from "@carmediahub/sdk";

export interface AListWebBridgeOptions extends WorkerClientOptions { binding?: string; }
export type AListWebBridgeConnector = (options: WorkerClientOptions) => Promise<WorkerClient>;

const responseHeaders = new Set(["accept-ranges", "cache-control", "content-length", "content-range", "content-type", "etag", "last-modified"]);

function relativePath(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.startsWith("/") || value.includes("\\") || value.split("/").includes("..") || value.length > 2048) return undefined;
  return value;
}

function safeHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).filter(([name]) => responseHeaders.has(name.toLowerCase())));
}

/** Bridges an operator-approved AList HTTP binding without changing AList itself. */
export async function startWorker(input: AListWebBridgeOptions, connect: AListWebBridgeConnector = connectWorkerClient) {
  const client = await connect(input);
  const binding = input.binding ?? "alist-web";
  client.onGatewayRequest(async (request: GatewayWorkerRequest): Promise<GatewayWorkerResponse> => {
    if (request.method !== "GET" && request.method !== "HEAD" && request.method !== "POST") return { status: 405, body: { code: "CMH.ALIST.METHOD_NOT_ALLOWED" } };
    if (request.path === "/health") return { status: 200, body: { status: "ok", adapter: "alist-web-bridge", binding } };
    if (request.path !== "/proxy") return { status: 404, body: { code: "CMH.ALIST.ROUTE_NOT_FOUND" } };
    const path = relativePath(request.query?.path);
    if (path === undefined) return { status: 400, body: { code: "CMH.ALIST.RELATIVE_PATH_REQUIRED" } };
    if (request.method === "POST" && !new Set(["/api/fs/list", "/api/fs/get", "/api/fs/search"]).has(path)) return { status: 403, body: { code: "CMH.ALIST.POST_PATH_NOT_ALLOWED" } };
    let body: string | undefined;
    if (request.method === "POST") {
      if (request.body === undefined || typeof request.body !== "object" || request.body === null || Array.isArray(request.body)) return { status: 400, body: { code: "CMH.ALIST.JSON_BODY_REQUIRED" } };
      body = JSON.stringify(request.body);
      if (Buffer.byteLength(body, "utf8") > 64 * 1024) return { status: 413, body: { code: "CMH.ALIST.BODY_TOO_LARGE" } };
    }
    const result = await client.network().request({ binding, method: request.method, path, ...(body === undefined ? {} : { body }), headers: { ...(request.headers?.accept === undefined ? {} : { accept: request.headers.accept }), ...(request.headers?.range === undefined ? {} : { range: request.headers.range }), ...(body === undefined ? {} : { "content-type": "application/json" }) } });
    return { status: result.status, headers: safeHeaders(result.headers), ...(request.method === "HEAD" || result.bodyBase64 === undefined ? {} : { body: Buffer.from(result.bodyBase64, "base64") }) };
  });
  return { stop: () => client.close() };
}
