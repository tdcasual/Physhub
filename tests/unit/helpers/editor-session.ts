import { computeEditorSessionCookieValue } from "@/lib/auth/human-auth";

export function editorSessionHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);

  headers.set(
    "X-Physhub-Editor-Session",
    computeEditorSessionCookieValue(process.env.EDITOR_SESSION_SECRET ?? ""),
  );

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
