import type { PluginManifest } from "@carmediahub/sdk";

export const manifests: readonly PluginManifest[] = [
  {
    id: "wdr-media", version: "0.1.0", sdk: "^0.1.0",
    name: { en: "WDR Media", "zh-CN": "WDR 媒体", ko: "WDR 미디어" },
    description: { en: "A vehicle-oriented media delivery example.", "zh-CN": "面向车载显示的媒体交付示例。", ko: "차량용 화면을 위한 미디어 전달 예제입니다." },
    category: "official", runtime: "isolated-worker",
    capabilities: ["db", "storage", "media", "history", "catalog", "display", "jobs", "events"], routes: [{ path: "/", methods: ["GET"] }, { path: "/health", methods: ["GET"] }],
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
    category: "adapter", runtime: "isolated-worker", capabilities: ["gateway", "network"], routes: [{ path: "/", methods: ["GET", "HEAD"] }, { path: "/health", methods: ["GET", "HEAD"] }, { path: "/proxy", methods: ["GET", "HEAD"] }],
    worker: { entry: "./worker.js", protocol: "0.1" }, ui: { entry: "./ui/index.html", vehicleSupported: true }
  }
];
