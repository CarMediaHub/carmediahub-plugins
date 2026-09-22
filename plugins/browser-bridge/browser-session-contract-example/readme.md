# Browser Session Contract Example

This isolated example validates CarMediaHub's opaque browser session contract. It does not start a browser and does not access profiles, cookies, CDP, host paths, or arbitrary scripts.

The `/session` route requests short-lived session metadata through the SDK. It is a fixture for integration tests, not a browser automation feature or a third-party site adapter.
