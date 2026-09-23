# WDR Media

WDR Media is the official vehicle-oriented media delivery example for CarMediaHub. It demonstrates how an SDK plugin can combine operator-authorized storage, read-only Media Sources, media jobs, catalog metadata, history, display capabilities and vehicle playback status.

This package follows the SDK contract and does not modify AList, rclone, FFmpeg or another upstream project. Media sources are configured through Core service bindings.

The current package includes scoped playback-history behavior and direct-range playback. A stream request may opt into Core-owned `remux` or `transcode` with the `mode` query parameter. The `/hls?id=<media-id>` route provides VOD HLS through short-lived playlist and segment tokens; the worker probes media, waits for scoped jobs, rewrites only logical asset routes, and reads assets through the SDK. Core supplies local media roots and optional opaque Media Source handles, media processing, catalog access and service bindings; this plugin does not receive database credentials, WebDAV endpoints, upstream cookies, host filesystem paths, FFmpeg access or command execution. Authorized remote sources are selected with the `source` entry query value; transforms and HLS remain available only for Core-managed local media.

Status: `draft` · Category: `official` · Runtime: `isolated-worker`
