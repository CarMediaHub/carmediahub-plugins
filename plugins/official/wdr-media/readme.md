# WDR Media

WDR Media is the official vehicle-oriented media delivery example for CarMediaHub. It demonstrates how an SDK plugin can combine operator-authorized storage, media jobs, catalog metadata, history, display capabilities and vehicle playback status.

This package follows the SDK contract and does not modify AList, rclone, FFmpeg or another upstream project. Media sources are configured through Core service bindings.

The current package includes scoped playback-history behavior. Core supplies storage handles, media processing, catalog access and service bindings; this plugin does not receive database credentials, upstream cookies or host filesystem paths.

Status: `draft` · Category: `official` · Runtime: `isolated-worker`
