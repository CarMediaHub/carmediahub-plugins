# CarMediaHub Plugins

Status: v0 Draft

Language: English · [简体中文](readme_zh.md) · [한국어](readme_ko.md)

The public catalog structure and package governance boundaries for CarMediaHub plugins.

## Categories

| Category | Scope |
|---|---|
| [Core companion](plugins/core-companion/readme.md) | Platform-wide capability examples |
| [Official](plugins/official/readme.md) | Organization-maintained packages |
| [Adapters](plugins/adapters/readme.md) | Bounded protocol or service adapters |
| [Browser bridge](plugins/browser-bridge/readme.md) | Revocable named browser bridge sessions |
| [Community](plugins/community/readme.md) | Curated third-party packages |

Catalog metadata is defined in [`catalog/plugins.json`](catalog/plugins.json). The SDK defines package manifests and public capability contracts.

## Contribution boundary

Packages declare identity, publisher, routes, capabilities, resources, data lifecycle, and SDK compatibility. They do not import Core internals or receive raw host paths, database credentials, copied browser profile data, tunnel internals, or undeclared network access.

Read the [contribution draft](contributing.md) before proposing a package.

## Development

```powershell
pnpm install
pnpm test
pnpm check
```

The first runnable packages are the WDR media delivery example and a generic shared-adapter example. Existing private site implementations are migration references only; packages enter this catalog only after an SDK-aligned rewrite and review.
# CarMediaHub Plugins

This repository groups official, Core companion, upstream adapter, browser bridge, and community plugins. Each plugin owns its manifest, source, tests, and localized documentation.

Run `pnpm build` to produce Core-installable packages under `dist/packages/<plugin-id>`. The build normalizes compiled runtime entries and includes manifests, UI assets, and localized READMEs. Run `pnpm verify:packages` to validate package layout.
