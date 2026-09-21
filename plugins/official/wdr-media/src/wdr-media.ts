import type { PlatformRuntime } from "@carmediahub/sdk";

export interface MediaHistoryItem {
  mediaId: string;
  title: string;
  positionSeconds: number;
  durationSeconds?: number;
  updatedAt: string;
}

/**
 * The first public WDR migration unit. Storage discovery and transcoding stay
 * behind Core capabilities; this plugin owns only its scoped media behavior.
 */
export class WdrMediaPlugin {
  async savePlayback(runtime: PlatformRuntime, input: Omit<MediaHistoryItem, "updatedAt">): Promise<MediaHistoryItem> {
    runtime.require("events");
    if (!/^[a-zA-Z0-9._-]{1,120}$/u.test(input.mediaId) || input.title.trim().length === 0 || input.positionSeconds < 0 || (input.durationSeconds !== undefined && input.durationSeconds < input.positionSeconds)) {
      throw new Error("Invalid playback history item");
    }
    const item: MediaHistoryItem = { ...input, title: input.title.trim(), updatedAt: new Date().toISOString() };
    await runtime.history().record({ subjectType: "media-playback", subjectId: item.mediaId.toLowerCase(), route: "/stream", title: item.title, category: "playback" });
    await runtime.database().put("playback", input.mediaId.toLowerCase(), item);
    runtime.publish("wdr.playback.saved", { mediaId: item.mediaId, positionSeconds: item.positionSeconds });
    return item;
  }

  async recentPlayback(runtime: PlatformRuntime, limit = 20): Promise<readonly MediaHistoryItem[]> {
    runtime.require("history");
    const records = await runtime.database().list<MediaHistoryItem>("playback", { limit: Math.min(Math.max(limit, 1), 100) });
    return records.map((record) => record.value).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }
}
