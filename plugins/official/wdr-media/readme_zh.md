# WDR 媒体

WDR 媒体是 CarMediaHub 面向车载显示的官方媒体交付示例，用于演示插件组合运营者授权的存储、只读 Media Source、媒体任务、目录、浏览记录、显示能力和车载播放状态。

该包按照 SDK 契约实现，不修改 AList、rclone、FFmpeg 或其他上游项目。媒体来源必须通过 Core 服务绑定配置。

当前包包含按用户与安装实例隔离的播放记录行为和 direct-range 播放。流媒体请求可以通过 `mode=remux` 或 `mode=transcode` 选择由 Core 执行的转换；`/hls?id=<媒体 ID>` 提供基于短期清单和分片 token 的点播 HLS。Worker 负责探测媒体、等待受作用域约束的任务，只重写逻辑 asset 路由，并通过 SDK 分段读取。Core 提供本地媒体根和可选的 opaque Media Source 句柄、媒体处理、目录访问和服务绑定；插件不获得数据库凭据、WebDAV endpoint、上游 Cookie、宿主机文件系统路径、FFmpeg 访问权或命令执行权。访问远程源时，在入口追加已授权的 `source` 句柄；媒体转换和 HLS 仍只对 Core 管理的本地媒体可用。

签名包内置响应式媒体库界面，提供搜索、直接播放和全屏命令。Core 仅在登录后且重新计算完整包摘要通过时，才从签名包提供根页面及 `/ui/*` 资源；界面不由 Worker 提供，也不会暴露包路径。界面通过受作用域限制的健康响应继承当前 Core 语言。桌面、手机和车机的实际播放兼容性仍是发布验证要求，不构成已支持声明。

状态：`draft` · 分类：`official` · 运行时：`isolated-worker`
