# rclone WebDAV Bridge

Read-only isolated-worker reference adapter for an operator-managed rclone WebDAV binding.

The adapter does not modify rclone, expose a new public port, carry credentials, or discover an upstream. Core supplies the approved binding and filters request and response headers. Only a relative resource path can be read with `GET` or `HEAD`.
