/**
 * Hosted runtimes cannot persist files under the project directory.
 * Local `next dev` / `next start` stay false so `./data` still works.
 */
export function isCloudflareWorker() {
  if (process.env.CLOUDFLARE_WORKER === "1" || process.env.CF_PAGES === "1") {
    return true;
  }
  try {
    return (
      typeof navigator !== "undefined" &&
      navigator.userAgent === "Cloudflare-Workers"
    );
  } catch {
    return false;
  }
}

export function isHostedRuntime() {
  return Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      isCloudflareWorker(),
  );
}
