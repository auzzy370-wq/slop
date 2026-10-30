import crypto from "crypto";

/** Minimal OAuth 1.0a signer for Twitter API user-context requests. */
export function oauth1Header(opts: {
  method: string;
  url: string;
  consumerKey: string;
  consumerSecret: string;
  token: string;
  tokenSecret: string;
  extraParams?: Record<string, string>;
}) {
  const nonce = crypto.randomBytes(16).toString("hex");
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const oauth: Record<string, string> = {
    oauth_consumer_key: opts.consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_token: opts.token,
    oauth_version: "1.0",
    ...(opts.extraParams || {}),
  };

  const paramString = Object.keys(oauth)
    .sort()
    .map(
      (k) =>
        `${encodeURIComponent(k)}=${encodeURIComponent(oauth[k])}`,
    )
    .join("&");

  const base = [
    opts.method.toUpperCase(),
    encodeURIComponent(opts.url),
    encodeURIComponent(paramString),
  ].join("&");

  const signingKey = `${encodeURIComponent(opts.consumerSecret)}&${encodeURIComponent(opts.tokenSecret)}`;
  const signature = crypto
    .createHmac("sha1", signingKey)
    .update(base)
    .digest("base64");

  oauth.oauth_signature = signature;

  const header =
    "OAuth " +
    Object.keys(oauth)
      .sort()
      .map(
        (k) =>
          `${encodeURIComponent(k)}="${encodeURIComponent(oauth[k])}"`,
      )
      .join(", ");

  return header;
}
