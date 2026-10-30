export type SocialChannel =
  | "discord"
  | "telegram"
  | "twitter"
  | "facebook"
  | "webhook";

export type SocialPostStatus = "queued" | "posted" | "skipped" | "failed";

export interface SocialAutoPostPayload {
  dramaId: string;
  dramaTitle: string;
  dramaSlug: string;
  episodeId: string;
  episodeNumber: number;
  episodeTitle: string;
  episodeSlug: string;
  description?: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  force?: boolean;
}

export interface SocialPostRecord {
  id: string;
  dramaId: string;
  episodeId: string;
  episodeNumber: number;
  channel: SocialChannel;
  status: SocialPostStatus;
  caption: string;
  watchUrl: string;
  externalId?: string | null;
  error?: string | null;
  createdAt: string;
}

export interface SocialChannelResult {
  channel: SocialChannel;
  status: SocialPostStatus;
  externalId?: string | null;
  error?: string | null;
  detail?: string | null;
}

export interface SocialStoreData {
  posts: SocialPostRecord[];
}
