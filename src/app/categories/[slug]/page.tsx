import { Suspense } from "react";
import { CategoryFeed } from "./category-feed";

export const instant = false;

export default async function CategoryPage({
  params,
}: PageProps<"/categories/[slug]">) {
  const { slug } = await params;
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-[var(--slop-violet)]" />
        </div>
      }
    >
      <CategoryFeed slug={slug} />
    </Suspense>
  );
}
