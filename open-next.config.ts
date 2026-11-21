import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * No incremental-cache R2 bucket. This app reads the catalog from the media
 * bucket at request time; a second cache bucket is optional later.
 */
export default defineCloudflareConfig({});
