# AList Web Bridge

An isolated-worker reference adapter for an operator-managed AList service binding.

The adapter does not modify AList, expose a new public port, carry credentials, or discover an upstream. Core supplies the approved binding and filters the request headers. Only relative paths and `GET`/`HEAD` requests are accepted.
