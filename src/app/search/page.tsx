"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SlopWordmark } from "@/components/brand/logo";
import { DramaCard } from "@/components/browse/drama-card";
import { useSlopStore } from "@/store/slop-store";
import { getFeed } from "@/lib/feed";
import { formatCount } from "@/lib/utils";
import { watchHref } from "@/lib/watch-url";

function SearchInner() {
  const params = useSearchParams();
  const router = useRouter();
  const initial = params.get("q") ?? "";
  const [q, setQ] = useState(initial);
  const videos = useSlopStore((s) => s.videos);
  const dramas = useSlopStore((s) => s.dramas);

  const dramaResults = useMemo(() => {
    if (!initial) return [];
    const needle = initial.toLowerCase().trim();
    return dramas.filter(
      (d) =>
        d.status === "published" &&
        `${d.title} ${d.synopsis} ${d.tags.join(" ")}`
          .toLowerCase()
          .includes(needle),
    );
  }, [dramas, initial]);

  const episodeResults = useMemo(
    () => (initial ? getFeed(videos, "search", { query: initial }) : []),
    [videos, initial],
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = q.trim();
    router.push(next ? `/search?q=${encodeURIComponent(next)}` : "/search");
  };

  return (
    <div className="slop-cinematic slop-safe-page min-h-[100dvh] px-4 pb-28 lg:pb-16 lg:pt-20">
      <div className="mx-auto max-w-2xl lg:max-w-4xl">
        <SlopWordmark className="mb-6 lg:hidden" />
        <h1 className="mb-4 font-display text-3xl font-bold lg:text-4xl">
          Search SLOP
        </h1>
        <form onSubmit={submit} className="mb-6 flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--slop-slate)]" />
            <Input
              className="pl-10"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Dramas, episodes, genres…"
              aria-label="Search"
            />
          </div>
          <Button type="submit">Search</Button>
        </form>

        {!initial && (
          <p className="text-sm text-[var(--slop-slate)]">
            Try “second key”, “execute”, “unsent”, or “thriller”.
          </p>
        )}

        {initial && dramaResults.length === 0 && episodeResults.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-[var(--slop-panel)] p-8 text-center">
            <p className="font-semibold">No results for “{initial}”</p>
            <Link href="/explore" className="mt-4 inline-block text-[var(--slop-violet)]">
              Explore genres
            </Link>
          </div>
        )}

        {dramaResults.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--slop-slate)]">
              Dramas
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none lg:grid lg:grid-cols-4 lg:gap-4 lg:overflow-visible xl:grid-cols-5">
              {dramaResults.map((d) => (
                <DramaCard key={d.id} drama={d} />
              ))}
            </div>
          </section>
        )}

        {episodeResults.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--slop-slate)]">
              Episodes
            </h2>
            <div className="space-y-3">
              {episodeResults.map((video) => {
                const series = dramas.find((d) => d.id === video.dramaId);
                return (
                <Link
                  key={video.id}
                  href={watchHref({
                    episodeId: video.id,
                    dramaId: video.dramaId,
                    dramaSlug: series?.slug,
                  })}
                  className="flex gap-3 overflow-hidden rounded-2xl border border-white/10 bg-black/30"
                >
                  <div
                    className="h-24 w-16 shrink-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${video.thumbnailUrl})` }}
                  />
                  <div className="min-w-0 py-3 pr-3">
                    <p className="text-[11px] uppercase tracking-wide text-[var(--slop-violet)]">
                      {video.sourceAttribution} · EP {video.episodeNumber}
                    </p>
                    <p className="truncate font-semibold">{video.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-white/55">
                      {video.description}
                    </p>
                    <p className="mt-2 text-[11px] text-[var(--slop-slate)]">
                      {formatCount(video.viewCount)} views
                    </p>
                  </div>
                </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-[var(--slop-violet)]" />
        </div>
      }
    >
      <SearchInner />
    </Suspense>
  );
}
