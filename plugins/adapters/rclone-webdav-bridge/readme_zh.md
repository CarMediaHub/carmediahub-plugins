# rclone WebDAV 兼容桥

面向运营者自主管理 rclone WebDAV 绑定的只读 isolated-worker 参考适配器。

适配器不修改 rclone、不新增公网端口、不携带凭据，也不会自动发现上游。Core 提供已批准的绑定并过滤请求和响应头；只允许通过相对资源路径执行 `GET` 或 `HEAD` 读取。
