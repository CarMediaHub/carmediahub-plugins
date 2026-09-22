# WDR 媒体

WDR 媒体是 CarMediaHub 面向车载显示的官方媒体交付示例，用于演示插件组合运营者授权的存储、媒体任务、目录、浏览记录、显示能力和车载播放状态。

该包按照 SDK 契约实现，不修改 AList、rclone、FFmpeg 或其他上游项目。媒体来源必须通过 Core 服务绑定配置。

当前包包含按用户与安装实例隔离的播放记录行为和 direct-range 播放。流媒体请求可以通过 `mode=remux` 或 `mode=transcode` 选择由 Core 执行的转换；`/hls?id=<媒体 ID>` 提供基于短期清单和分片 token 的点播 HLS。Worker 负责探测媒体、等待受作用域约束的任务，只重写逻辑 asset 路由，并通过 SDK 分段读取。Core 提供存储句柄、媒体处理、目录访问和服务绑定；插件不获得数据库凭据、上游 Cookie、宿主机文件系统路径、FFmpeg 访问权或命令执行权。

状态：`draft` · 分类：`official` · 运行时：`isolated-worker`
