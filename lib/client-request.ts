/** Mutations reject HTTP failures so callers keep selection/state on failure. */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(input, init);
  if (!response.ok) {
    const body = await response
      .clone()
      .json()
      .catch(() => ({}));
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return response;
}
