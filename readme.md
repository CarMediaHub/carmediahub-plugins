# CarMediaHub Plugins

Official plugins and human-readable reference implementations for the CarMediaHub open plugin platform.

## Plugin catalog

This repository provides SDK-conforming plugins for media, gateway and local-device workflows. `site-gateway-example` is the canonical gateway integration example for learning, testing and extension.

Every plugin:

- declares identity, routes, capabilities, permissions and storage in a manifest;
- uses the Agent lifecycle for install, start, stop, health and upgrade operations;
- accesses databases, media tools, network functions and gateway routing through the SDK;
- receives isolated configuration and data storage from the platform;
- never receives raw host paths, database credentials, browser profile data or tunnel internals;
- contains no credentials, private domains or access tokens.

## Repository layout

```text
plugins/
  site-gateway-example/
  wdr/
  media-library/
  sample-plugin/
```

Each plugin includes a manifest, its own README and tests, and declares a compatible `carmediahub-sdk` version. The public API surface is defined by the SDK and its capability contracts.

## For contributors

Start with the plugin manifest and SDK contracts, then implement lifecycle hooks, capability calls, isolated storage and health checks. Keep user-facing explanations in the plugin README and implementation details in developer documentation.
