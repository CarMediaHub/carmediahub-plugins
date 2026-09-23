# AList Web 兼容桥

面向运营者自主管理 AList 服务绑定的 isolated-worker 参考适配器。

适配器不修改 AList，不新增公网端口，不携带凭据，也不会自动发现上游。Core 提供已批准的服务绑定并过滤请求头；`GET`/`HEAD` 可读取绑定内的相对路径，`POST` 只允许 `/api/fs/list`、`/api/fs/get` 和 `/api/fs/search`，并限制为 64 KiB JSON 请求体。
