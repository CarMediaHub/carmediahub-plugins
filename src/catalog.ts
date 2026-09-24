import type { PluginManifest } from "@carmediahub/sdk";

export const manifests: readonly PluginManifest[] = [
  {
    id: "wdr-media", version: "0.1.0", sdk: "^0.1.0",
    name: { en: "WDR Media", "zh-CN": "WDR 媒体", ko: "WDR 미디어" },
    description: { en: "A vehicle-oriented media delivery example.", "zh-CN": "面向车载显示的媒体交付示例。", ko: "차량용 화면을 위한 미디어 전달 예제입니다." },
    category: "official", runtime: "isolated-worker",
    capabilities: ["db", "storage", "media", "media-source", "history", "catalog", "display", "jobs", "events"],
    components: [{ id: "ffmpeg", roles: ["media-processing"] }, { id: "rclone", roles: ["webdav"], optional: true }, { id: "alist", roles: ["storage-service"], optional: true }],
    routes: [{ path: "/", methods: ["GET"] }, { path: "/library", methods: ["GET"] }, { path: "/stream", methods: ["GET", "HEAD"] }, { path: "/health", methods: ["GET"] }, { path: "/hls", methods: ["GET"] }, { path: "/recent", methods: ["GET", "DELETE"] }, { path: "/progress", methods: ["POST"] }],
    worker: { entry: "./worker.js", protocol: "0.1" },
    ui: { entry: "./ui/index.html", vehicleSupported: true }
  },
  {
    id: "shared-adapter-example", version: "0.1.0", sdk: "^0.1.0",
    name: { en: "Shared Adapter Example", "zh-CN": "共享适配器示例", ko: "공유 어댑터 예제" },
    description: { en: "A generic adapter contract example with no upstream target.", "zh-CN": "不连接真实上游的通用适配器契约示例。", ko: "실제 상류 대상이 없는 일반 어댑터 계약 예제입니다." },
    category: "core-companion", runtime: "shared-adapter-host", runtimeEntry: { entry: "./worker.js", protocol: "0.1" }, capabilities: ["config", "gateway", "events"], routes: [{ path: "/", methods: ["GET", "HEAD"] }, { path: "/health", methods: ["GET", "HEAD"] }],
    ui: { entry: "./ui/index.html", vehicleSupported: true }
  },
  {
    id: "service-binding-adapter-example", version: "0.1.0", sdk: "^0.1.0",
    name: { en: "Service Binding Adapter Example", "zh-CN": "服务绑定适配器示例", ko: "서비스 바인딩 어댑터 예제" },
    description: { en: "A bounded proxy adapter for an approved local service binding.", "zh-CN": "面向批准本地服务绑定的受限代理适配器。", ko: "승인된 로컬 서비스 바인딩을 위한 제한된 프록시 어댑터입니다." },
    category: "adapter", runtime: "isolated-worker", capabilities: ["gateway", "network"], serviceBindings: ["approved-service"], routes: [{ path: "/", methods: ["GET", "HEAD"] }, { path: "/health", methods: ["GET", "HEAD"] }, { path: "/proxy", methods: ["GET", "HEAD"] }],
    worker: { entry: "./worker.js", protocol: "0.1" }, ui: { entry: "./ui/index.html", vehicleSupported: true }
  },
  {
    id: "proxy-compat-contract-example", version: "0.1.0", sdk: "^0.1.0",
    name: { en: "Proxy Compatibility Contract Example", "zh-CN": "代理兼容契约示例", ko: "프록시 호환 계약 예제" },
    description: { en: "A bounded proxy-compatibility example with response leakage guards.", "zh-CN": "带响应泄露防护的受限代理兼容示例。", ko: "응답 누출 방어를 포함한 제한된 프록시 호환성 예제입니다." },
    category: "adapter", runtime: "isolated-worker", capabilities: ["gateway", "network"], serviceBindings: ["approved-upstream"], routes: [{ path: "/", methods: ["GET", "HEAD"] }, { path: "/health", methods: ["GET", "HEAD"] }, { path: "/proxy", methods: ["GET", "HEAD"] }],
    worker: { entry: "./worker.js", protocol: "0.1" }, ui: { entry: "./ui/index.html", vehicleSupported: true }
  },
  {
    id: "alist-web-bridge", version: "0.1.0", sdk: "^0.1.0",
    name: { en: "AList Web Bridge", "zh-CN": "AList Web 兼容桥", ko: "AList Web 브리지" },
    description: { en: "A bounded adapter for an operator-managed AList binding.", "zh-CN": "面向运营者自主管理 AList 绑定的受限适配器。", ko: "운영자가 관리하는 AList 바인딩을 위한 제한된 어댑터입니다." },
    category: "adapter", runtime: "isolated-worker", capabilities: ["gateway", "network"], serviceBindings: ["alist-web"], routes: [{ path: "/", methods: ["GET", "HEAD"] }, { path: "/health", methods: ["GET", "HEAD"] }, { path: "/proxy", methods: ["GET", "HEAD", "POST"] }],
    worker: { entry: "./worker.js", protocol: "0.1" }, ui: { entry: "./ui/index.html", vehicleSupported: true }
  },
  {
    id: "mihomo-web-bridge", version: "0.1.0", sdk: "^0.1.0",
    name: { en: "Mihomo Web Bridge", "zh-CN": "Mihomo Web 兼容桥", ko: "Mihomo Web 브리지" },
    description: { en: "A bounded adapter for an operator-managed Mihomo binding.", "zh-CN": "面向运营者自主管理 Mihomo 绑定的受限适配器。", ko: "운영자가 관리하는 Mihomo 바인딩을 위한 제한된 어댑터입니다." },
    category: "adapter", runtime: "isolated-worker", capabilities: ["gateway", "network"], serviceBindings: ["mihomo-web"], routes: [{ path: "/", methods: ["GET", "HEAD"] }, { path: "/health", methods: ["GET", "HEAD"] }, { path: "/proxy", methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"] }],
    worker: { entry: "./worker.js", protocol: "0.1" }, ui: { entry: "./ui/index.html", vehicleSupported: true }
  },
  {
    id: "browser-session-contract-example", version: "0.1.0", sdk: "^0.1.0",
    name: { en: "Browser Session Contract Example", "zh-CN": "浏览器会话契约示例", ko: "브라우저 세션 계약 예제" },
    description: { en: "A local fixture for the opaque browser session contract.", "zh-CN": "用于验证不透明浏览器会话契约的本地夹具。", ko: "불투명 브라우저 세션 계약을 검증하는 로컬 픽스처입니다." },
    category: "browser-bridge", runtime: "isolated-worker", capabilities: ["browser", "gateway"], routes: [{ path: "/", methods: ["GET", "HEAD"] }, { path: "/health", methods: ["GET", "HEAD"] }, { path: "/session", methods: ["GET"] }],
    worker: { entry: "./worker.js", protocol: "0.1" }
  }
];
