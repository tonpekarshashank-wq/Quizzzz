import { ApiError } from "./security";
const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
export function validateOrigin({
  origin,
  host,
  requestUrl,
  configuredOrigin,
  deployed,
}: {
  origin: string | null;
  host: string | null;
  requestUrl: string;
  configuredOrigin?: string;
  deployed: boolean;
}): string {
  if (deployed && !configuredOrigin)
    throw new ApiError(
      503,
      "CONFIGURATION_REQUIRED",
      "Application origin is not configured.",
    );
  let incoming: URL;
  try {
    incoming = new URL(origin ?? "");
  } catch {
    throw new ApiError(
      403,
      "INVALID_ORIGIN",
      "Request origin is not permitted.",
    );
  }
  if (origin !== incoming.origin)
    throw new ApiError(
      403,
      "INVALID_ORIGIN",
      "Request origin is not permitted.",
    );
  // Next.js can normalize the internal URL host. Local browser requests use the actual Host header.
  // Allow loopback aliases only on the serving port; never trust forwarded headers or arbitrary origins.
  if (!deployed && host) {
    try {
      const serving = new URL(`${new URL(requestUrl).protocol}//${host}`);
      if (
        loopback.has(serving.hostname) &&
        loopback.has(incoming.hostname) &&
        serving.protocol === incoming.protocol &&
        serving.port === incoming.port
      )
        return incoming.origin;
    } catch {
      /* Fall through to explicit configuration. */
    }
  }
  if (configuredOrigin) {
    let expected: URL;
    try {
      expected = new URL(configuredOrigin);
    } catch {
      throw new ApiError(
        503,
        "CONFIGURATION_REQUIRED",
        "Application origin is not configured correctly.",
      );
    }
    if (incoming.origin === expected.origin) return incoming.origin;
  }
  throw new ApiError(403, "INVALID_ORIGIN", "Request origin is not permitted.");
}
