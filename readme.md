# CarMediaHub Plugins

Status: v0 Draft

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
