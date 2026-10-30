import Link from "next/link";

export function LegalShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="slop-grid-bg min-h-[100dvh] px-4 pb-28 pt-10">
      <article className="mx-auto max-w-2xl space-y-4 text-sm leading-relaxed text-white/75 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:text-white [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        <Link href="/" className="text-[var(--slop-violet)]">
          ← SLOP
        </Link>
        <h1 className="font-display text-3xl font-bold text-white">
          {title}
        </h1>
        {children}
      </article>
    </div>
  );
}
