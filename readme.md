# CarMediaHub Plugins

Status: v0 Draft

Language: English · [简体中文](readme_zh.md) · [한국어](readme_ko.md)

The public catalog structure and package governance boundaries for CarMediaHub plugins.

## Categories

| Category | Scope |
|---|---|
| [Core companion](plugins/core-companion/readme.md) | Platform-wide capability examples |
| [Official](plugins/official/readme.md) | Organization-maintained packages |
| [Adapters](plugins/adapters/readme.md) | Bounded local-service and upstream protocol adapters |
| [Browser bridge](plugins/browser-bridge/readme.md) | Revocable named browser bridge sessions |
| [Community](plugins/community/readme.md) | Curated third-party packages |

Catalog metadata is defined in [`catalog/plugins.json`](catalog/plugins.json). The SDK defines package manifests and public capability contracts.

Each catalog entry also declares an `integrationKind`: `self-authored-media`, `core-companion`, `local-service-bridge`, `browser-session`, `proxy-compat`, or `community`, plus a machine-checked `targetClass` such as `local-media`, `local-file-service`, or `browser-session-contract`. These fields describe ownership, target type, and risk boundaries; they are not inferred from a folder name.

The migration matrix is intentionally separate from the public catalog. See [`catalog/migration-matrix.json`](catalog/migration-matrix.json) for the auditable mapping of legacy site-gateway entries. A site-adapter entry becomes a public package only when it is an `example`, marked public, present in `catalog/plugins.json`, and produced by the verified package build. Entries that do not meet these conditions remain review metadata until their security and compatibility review is complete.

Package build and verification are catalog-driven. Adding a public package requires a catalog path, a matching SDK manifest, a declared worker/runtime entry, and all three localized READMEs; build scripts do not maintain a second hard-coded package list.

## Contribution boundary

Packages declare identity, publisher, routes, capabilities, resources, data lifecycle, and SDK compatibility. They do not import Core internals or receive raw host paths, database credentials, copied browser profile data, tunnel internals, or undeclared network access.

Read the [contribution draft](contributing.md) before proposing a package.

## Development

```powershell
pnpm install
pnpm test
pnpm check
```

The catalog provides a WDR media delivery example and a generic shared-adapter example. A private implementation can inform a migration design, but only an SDK-aligned package that passes review enters this catalog.
# CarMediaHub Plugins

This repository groups official, Core companion, upstream adapter, browser bridge, and community plugins. Each plugin owns its manifest, source, tests, and localized documentation.

Run `pnpm build` to produce Core-installable packages under `dist/packages/<plugin-id>`. The build normalizes compiled runtime entries and includes manifests, UI assets, and localized READMEs. Run `pnpm verify:packages` to validate package layout.
