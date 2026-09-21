# Shared Adapter Example

This example verifies the shared adapter host and logical route contract without connecting to a real website or upstream service. It is the first safe migration target for the plugin collection.

It must remain independent of private domains, cookies, browser profiles and host environment variables.

The runnable reference worker exposes only `/health` and `/`. It receives the Core-injected locale and policy version as read-only context and never opens a listener or connects to an upstream target. Adapter implementations must preserve this boundary before adding a declared service binding.
