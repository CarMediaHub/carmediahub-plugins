# CarMediaHub 插件

状态：v0 草案

语言：[English](readme.md) · 简体中文 · [한국어](readme_ko.md)

CarMediaHub 插件的公开目录结构与插件包治理边界。

## 分类

| 分类 | 范围 |
|---|---|
| [Core 伴生](plugins/core-companion/readme_zh.md) | 平台通用能力示例 |
| [官方](plugins/official/readme_zh.md) | 组织维护的插件包 |
| [适配型](plugins/adapters/readme_zh.md) | 范围受限的本地服务与上游协议适配器 |
| [浏览器桥接](plugins/browser-bridge/readme_zh.md) | 可撤销的命名 Browser Bridge 会话 |
| [社区](plugins/community/readme_zh.md) | 精选第三方插件包 |

目录元数据定义在 [`catalog/plugins.json`](catalog/plugins.json)。SDK 定义插件包清单和公开 capability 契约。

迁移矩阵与公开目录刻意分离。迁移条目只有同时满足 `example`、标记为公开、存在于 `catalog/plugins.json` 并通过已验证的包构建，才会成为公开插件。历史 site_gateway 适配器在完成安全和兼容性评审前只保留为迁移元数据。

## 贡献边界

插件包声明身份、发布者、路由、能力、资源、数据生命周期和 SDK 兼容范围。它们不导入 Core 内部模块，也不获得原始宿主路径、数据库凭据、复制的浏览器 Profile 数据、隧道内部信息或未声明网络访问。

提议插件包前请阅读[贡献草案](contributing_zh.md)。

## 本地开发

```powershell
pnpm install
pnpm test
pnpm check
```

目录提供 WDR 媒体交付示例和通用共享适配器示例。私有实现只能用于迁移设计参考；只有符合 SDK、通过安全和兼容性评审的包才能进入公开目录。
# 插件集合

本仓库按插件属性聚合官方插件、Core 伴生插件、代理兼容插件、浏览器桥接和社区插件。每个插件独立维护清单、代码、测试和三语说明。

运行 `pnpm build` 会生成可供 Core staging 安装器使用的 `dist/packages/<plugin-id>` 发布包。包内入口统一为编译后的相对路径，构建后可用 `pnpm verify:packages` 检查 Manifest、入口、UI 和文档是否一致。
