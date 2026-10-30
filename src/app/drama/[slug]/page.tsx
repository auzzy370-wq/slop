import { Suspense } from "react";
import { DramaDetail } from "./drama-detail";

export const instant = false;

export default async function DramaPage({
  params,
}: PageProps<"/drama/[slug]">) {
  const { slug } = await params;
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-[var(--slop-violet)]" />
        </div>
      }
    >
      <DramaDetail slug={slug} />
    </Suspense>
  );
}
