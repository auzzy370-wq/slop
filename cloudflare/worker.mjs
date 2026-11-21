/**
 * OpenNext's generated worker only exports fetch. Cron Triggers need scheduled().
 * Each cron calls the existing Next.js route with CRON_SECRET, same as Vercel Cron.
 */
import handler, {
  BucketCachePurge,
  DOQueueHandler,
  DOShardedTagCache,
} from "../.open-next/worker.js";

const CRON_PATHS = {
  "0 11 * * *": "/api/cron/migrate-blob",
  "5 0 * * *": "/api/cron/publish-scheduled",
};

async function runCron(event, env) {
  const pathname = CRON_PATHS[event.cron];
  if (!pathname) {
    console.error(`cron: no route for schedule ${event.cron}`);
    return;
  }
  if (!env.WORKER_SELF_REFERENCE) {
    throw new Error(
      "WORKER_SELF_REFERENCE binding is missing. It is declared in wrangler.jsonc.",
    );
  }
  const headers = new Headers();
  if (env.CRON_SECRET) {
    headers.set("authorization", `Bearer ${env.CRON_SECRET}`);
  }
  const response = await env.WORKER_SELF_REFERENCE.fetch(
    new Request(`https://slop.internal${pathname}`, { headers }),
  );
  if (!response.ok) {
    const body = await response.text();
    console.error(
      `cron ${event.cron} ${pathname} failed: ${response.status} ${body.slice(0, 400)}`,
    );
  }
}

export default {
  fetch: handler.fetch,
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runCron(event, env));
  },
};

export { BucketCachePurge, DOQueueHandler, DOShardedTagCache };
