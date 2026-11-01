import type { Metadata } from "next";
import { connection } from "next/server";
import { resolveShareVideoBySlug } from "@/lib/resolve-share-video";
import { VideoShareClient } from "./video-share-client";

export const instant = false;

export async function generateMetadata({
  params,
}: PageProps<"/v/[slug]">): Promise<Metadata> {
  await connection();
  const { slug } = await params;
  const resolved = await resolveShareVideoBySlug(slug);
  if (!resolved) {
    return { title: "Video not found" };
  }
  const { video } = resolved;
  const thumb = video.thumbnailUrl.startsWith("http")
    ? video.thumbnailUrl
    : undefined;
  return {
    title: video.title,
    description: video.description,
    openGraph: {
      title: video.title,
      description: video.description,
      ...(thumb ? { images: [{ url: thumb }] } : {}),
      type: "video.other",
    },
    twitter: {
      card: "summary_large_image",
      title: video.title,
      description: video.description,
      ...(thumb ? { images: [thumb] } : {}),
    },
  };
}

export default async function VideoSharePage({
  params,
}: PageProps<"/v/[slug]">) {
  await connection();
  const { slug } = await params;
  const resolved = await resolveShareVideoBySlug(slug);
  return (
    <VideoShareClient
      slug={slug}
      initialVideo={resolved?.video ?? null}
      initialDramaId={resolved?.drama?.id ?? resolved?.video.dramaId ?? null}
    />
  );
}
