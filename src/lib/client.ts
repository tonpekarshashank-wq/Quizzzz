export class ClientError extends Error {
  constructor(
    message: string,
    public code: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api/v1/${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: body === undefined ? undefined : JSON.stringify(body),
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
