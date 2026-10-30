import type { Metadata } from "next";
import { DEMO_VIDEOS } from "@/lib/demo-data";
import { VideoShareClient } from "./video-share-client";

export const instant = false;

export async function generateMetadata({
  params,
}: PageProps<"/v/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const video = DEMO_VIDEOS.find((v) => v.slug === slug && v.status === "published");
  if (!video) {
    return { title: "Video not found" };
  }
  return {
    title: video.title,
    description: video.description,
    openGraph: {
      title: video.title,
      description: video.description,
      images: [{ url: video.thumbnailUrl }],
      type: "video.other",
    },
    twitter: {
      card: "summary_large_image",
      title: video.title,
      description: video.description,
      images: [video.thumbnailUrl],
    },
  };
}

export default async function VideoSharePage({
  params,
}: PageProps<"/v/[slug]">) {
  const { slug } = await params;
  return <VideoShareClient slug={slug} />;
}
