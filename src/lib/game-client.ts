import { ClientError } from "./client";
export async function gameApi<T>(
  path: string,
  method = "GET",
  body?: unknown,
  token?: string,
  key?: string,
): Promise<T> {
  const response = await fetch(`/api/v1/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  const result = await response.json();
  if (!response.ok)
    throw new ClientError(
      result.error?.message ?? "Request failed.",
      result.error?.code ?? "UNKNOWN",
      result.error?.fields,
    );
  return result.data;
}
