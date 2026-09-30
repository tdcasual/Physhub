export const TEST_SESSION_TOKEN = "physhub-test-session-token";

export function editorSessionHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  const token = process.env.PHYSHUB_TEST_SESSION_TOKEN ?? TEST_SESSION_TOKEN;

  headers.set("X-Physhub-Editor-Session", token);
  headers.set("Cookie", `physhub_session=${token}`);

  return headers;
}

export function editorSessionRequest(
  input: string,
  init: RequestInit = {},
): Request {
  return new Request(input, {
    ...init,
    headers: editorSessionHeaders(init.headers),
  });
}
