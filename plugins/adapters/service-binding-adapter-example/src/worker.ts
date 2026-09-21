import { connectWorkerClient, type GatewayWorkerRequest, type GatewayWorkerResponse, type WorkerClientOptions } from "@carmediahub/sdk";

export interface ServiceBindingAdapterOptions extends WorkerClientOptions { binding?: string; }

/** A generic, upstream-free adapter for operator-approved service bindings. */
export async function startWorker(input: ServiceBindingAdapterOptions) {
  const client = await connectWorkerClient(input);
  const binding = input.binding ?? "local-service";
  client.onGatewayRequest(async (request): Promise<GatewayWorkerResponse> => {
    if (request.method !== "GET" && request.method !== "HEAD") return { status: 405, body: { code: "CMH.ADAPTER.METHOD_NOT_ALLOWED" } };
    if (request.path === "/health") return { status: 200, body: { status: "ok", adapter: "service-binding-adapter-example", binding } };
    if (request.path !== "/proxy") return { status: 200, body: { adapter: "service-binding-adapter-example", binding, route: "/proxy" } };
    const path = request.query?.path;
    if (typeof path !== "string" || !path.startsWith("/") || path.includes("\\") || path.split("/").includes("..")) return { status: 400, body: { code: "CMH.ADAPTER.RELATIVE_PATH_REQUIRED" } };
    const result = await client.network().request({ binding, method: request.method, path, headers: { ...(request.headers?.accept === undefined ? {} : { accept: request.headers.accept }), ...(request.headers?.range === undefined ? {} : { range: request.headers.range }) } });
    return { status: result.status, headers: result.headers, ...(request.method === "HEAD" || result.bodyBase64 === undefined ? {} : { body: Buffer.from(result.bodyBase64, "base64") }) };
  });
  return { stop: () => client.close() };
}
