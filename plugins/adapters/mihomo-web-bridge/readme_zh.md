# Mihomo Web 兼容桥

`mihomo-web-bridge` 是面向运营者自主管理 Mihomo 控制 API 的受限 CarMediaHub 适配器。

它不修改 Mihomo、不新增公网端口、不转发浏览器凭据，也不提供 WebSocket 流量实时面板。首版仅通过 Core 服务绑定转发受限 JSON 控制路径：`/configs`、`/proxies`、`/providers`、`/rules`、`/connections` 和 `/version`。

服务绑定必须由运营者显式配置。适配器不会自动发现本地服务，也不会推断凭据。
