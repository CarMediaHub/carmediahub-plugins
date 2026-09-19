# CarMediaHub 插件

状态：v0 草案

CarMediaHub 插件的公开目录结构与插件包治理边界。

## 分类

| 分类 | 范围 |
|---|---|
| [Core 伴生](plugins/core-companion/readme_zh.md) | 平台通用能力示例 |
| [官方](plugins/official/readme_zh.md) | 组织维护的插件包 |
| [适配型](plugins/adapters/readme_zh.md) | 范围受限的协议或服务适配器 |
| [浏览器桥接](plugins/browser-bridge/readme_zh.md) | 可撤销的命名 Browser Bridge 会话 |
| [社区](plugins/community/readme_zh.md) | 精选第三方插件包 |

目录元数据定义在 [`catalog/plugins.json`](catalog/plugins.json)。SDK 定义插件包清单和公开 capability 契约。

## 贡献边界

插件包声明身份、发布者、路由、能力、资源、数据生命周期和 SDK 兼容范围。它们不导入 Core 内部模块，也不获得原始宿主路径、数据库凭据、复制的浏览器 Profile 数据、隧道内部信息或未声明网络访问。

提议插件包前请阅读[贡献草案](contributing_zh.md)。
