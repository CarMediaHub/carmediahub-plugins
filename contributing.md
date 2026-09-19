# Contributing

Status: Draft

Contributions begin with a package manifest and the public SDK contracts. A proposed package must describe its publisher, license, runtime group, routes, capabilities, resource needs, data lifecycle, support scope, and security considerations.

Packages must be independently buildable and testable. They must not import Core internals, share runtime state with another package, expose host ports, include credentials, or require undeclared host, database, network, or browser access.

The catalog accepts immutable signed versions. Package review checks manifest validity, SDK compatibility, signature, checksum, SBOM, license, declared capabilities, and risk classification.
