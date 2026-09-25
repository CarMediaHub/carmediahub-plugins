# Uyous Media Contract

This is a T2 SDK contract example for a browser-assisted media workflow. It requests only opaque, short-lived Core browser sessions and bounded task results. It does not access browser profiles, cookies, CDP endpoints, host paths, yt-dlp, FFmpeg, or a real video platform.

The `/extract` route accepts a logical target label and returns the bounded result supplied by Core. A production adapter must add operator authorization, target allowlists, revocation, resource limits, and upstream review before it can be considered an official integration.
