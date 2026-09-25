# rclone WebDAV Bridge

Read-only isolated-worker reference adapter for an operator-managed rclone WebDAV binding.

The adapter does not modify rclone, expose a new public port, carry credentials, or discover an upstream. Core supplies the approved binding and filters request and response headers. Relative resource paths support read-only `GET`, `HEAD`, and `PROPFIND` requests.
