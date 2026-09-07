import { computeEditorSessionCookieValue } from "@/lib/auth/human-auth";

export const dashboardCookieStore = {
  get: vi.fn(),
};

export function setDashboardCookie(present: boolean) {
  if (!present) {
    dashboardCookieStore.get.mockReturnValue(undefined);
    return;
  }

  dashboardCookieStore.get.mockReturnValue({
    value: computeEditorSessionCookieValue(
      process.env.EDITOR_SESSION_SECRET ?? "",
    ),
  });
}
