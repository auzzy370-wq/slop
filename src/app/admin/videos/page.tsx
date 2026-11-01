import VideosClient from "./videos-client";

/** Admin tooling is fully client-interactive; skip instant-nav validation. */
export const instant = false;

export default function AdminVideosPage() {
  return <VideosClient />;
}
