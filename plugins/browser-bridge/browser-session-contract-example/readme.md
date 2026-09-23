# Browser Session Contract Example

This isolated example validates CarMediaHub's opaque browser session contract. It does not start a browser and does not access profiles, cookies, CDP, host paths, or arbitrary scripts.

The `/session` route requests short-lived session metadata through the SDK. It is a fixture for integration tests, not a browser automation feature or a third-party site adapter.

The `/display` route exposes the host display capabilities passed through the SDK (device class, input, viewport, and fullscreen support) and demonstrates the controlled `unsupported` result when fullscreen is unavailable. A plugin can request a mode and read the result, but cannot control browser windows, profiles, or CDP.
