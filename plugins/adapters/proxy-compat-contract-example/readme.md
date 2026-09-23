# Proxy Compatibility Contract Example

This isolated-worker example demonstrates a bounded proxy compatibility layer without naming or connecting to a real website. It uses one operator-approved Core service binding, accepts only relative paths, forwards a small request-header allowlist, never forwards cookies or credentials, strips redirect and cookie response headers, and rejects bodies over 8 MiB.

It is a contract and security example, not a public relay or an endorsement of any upstream service. A real adapter requires a separate target review, narrow host policy, redirect handling, content rewriting, legal review, and leakage tests before publication.
