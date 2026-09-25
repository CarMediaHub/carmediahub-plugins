import { connectWorkerClient, type GatewayWorkerRequest, type GatewayWorkerResponse, type WorkerClient, type WorkerClientOptions } from "@carmediahub/sdk";

export interface RcloneWebDavBridgeOptions extends WorkerClientOptions { binding?: string; }
export type RcloneWebDavBridgeConnector = (options: WorkerClientOptions) => Promise<WorkerClient>;

const responseHeaders = new Set(["accept-ranges", "cache-control", "content-length", "content-range", "content-type", "etag", "last-modified"]);

function relativePath(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.startsWith("/") || value.includes("\\") || value.split("/").includes("..") || value.length > 2048) return undefined;
  return value;
}

function safeHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).filter(([name]) => responseHeaders.has(name.toLowerCase())));
}

function depthHeader(value: unknown): "0" | "1" | undefined {
  return value === "0" || value === "1" ? value : undefined;
}

/** Bridges an operator-approved, read-only rclone WebDAV binding. */
export async function startWorker(input: RcloneWebDavBridgeOptions, connect: RcloneWebDavBridgeConnector = connectWorkerClient) {
  const client = await connect(input);
  const binding = input.binding ?? "rclone-webdav";
  client.onGatewayRequest(async (request: GatewayWorkerRequest): Promise<GatewayWorkerResponse> => {
    if (request.method !== "GET" && request.method !== "HEAD" && request.method !== "PROPFIND") return { status: 405, body: { code: "CMH.RCLONE.METHOD_NOT_ALLOWED" } };
    if (request.path === "/health") return { status: 200, body: { status: "ok", adapter: "rclone-webdav-bridge", binding } };
    if (request.path !== "/resource") return { status: 404, body: { code: "CMH.RCLONE.ROUTE_NOT_FOUND" } };
    const path = relativePath(request.query?.path);
    if (path === undefined) return { status: 400, body: { code: "CMH.RCLONE.RELATIVE_PATH_REQUIRED" } };
    const depth = depthHeader(request.headers?.depth);
    if (request.method === "PROPFIND" && request.headers?.depth !== undefined && depth === undefined) return { status: 400, body: { code: "CMH.RCLONE.DEPTH_NOT_ALLOWED" } };
    const result = await client.network().request({ binding, method: request.method, path, headers: { ...(request.headers?.accept === undefined ? {} : { accept: request.headers.accept }), ...(request.headers?.range === undefined ? {} : { range: request.headers.range }), ...(depth === undefined ? {} : { depth }) } });
    return { status: result.status, headers: safeHeaders(result.headers), ...(request.method === "HEAD" || result.bodyBase64 === undefined ? {} : { body: Buffer.from(result.bodyBase64, "base64") }) };
  });
  return { stop: () => client.close() };
}
