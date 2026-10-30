import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-display text-6xl font-bold text-[var(--slop-violet)]">
        404
      </p>
      <h1 className="font-display text-2xl">
        Lost in the slop
      </h1>
      <p className="max-w-sm text-sm text-white/55">
        That page is not part of the feed. Head back and keep scrolling.
      </p>
      <Link
        href="/"
        className="inline-flex h-11 items-center rounded-xl bg-[var(--slop-violet)] px-5 text-sm font-semibold text-[var(--slop-ink)]"
      >
        Back to feed
      </Link>
    </div>
  );
}
