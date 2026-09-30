export const dashboardCookieStore = {
  get: vi.fn(),
};

export function setDashboardCookie(present: boolean) {
  if (!present) {
    dashboardCookieStore.get.mockReturnValue(undefined);
    return;
  }

  dashboardCookieStore.get.mockReturnValue({
    value: process.env.PHYSHUB_TEST_SESSION_TOKEN ?? "physhub-test-session-token",
  });
}
