# AList Web Bridge

An isolated-worker reference adapter for an operator-managed AList service binding.

The adapter does not modify AList, expose a new public port, carry credentials, or discover an upstream. Core supplies the approved binding and filters the request headers. `GET`/`HEAD` read relative paths, while `POST` is limited to `/api/fs/list`, `/api/fs/get`, and `/api/fs/search` with a 64 KiB JSON body limit.
