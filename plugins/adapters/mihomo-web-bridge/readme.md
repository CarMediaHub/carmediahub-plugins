# Mihomo Web Bridge

`mihomo-web-bridge` is a bounded CarMediaHub adapter for an operator-managed Mihomo control API.

It does not modify Mihomo, open a second public port, forward browser credentials, or provide WebSocket traffic streaming. The first contract covers selected JSON control paths through a Core service binding: `/configs`, `/proxies`, `/providers`, `/rules`, `/connections`, and `/version`.

The binding must be explicitly configured by the operator. The adapter does not discover local services or infer credentials.
