# AList Web 兼容桥

面向运营者自主管理 AList 服务绑定的 isolated-worker 参考适配器。

适配器不修改 AList，不新增公网端口，不携带凭据，也不会自动发现上游。Core 提供已批准的服务绑定并过滤请求头；只接受相对路径以及 `GET`/`HEAD` 请求。
