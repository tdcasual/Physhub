import "@testing-library/jest-dom/vitest";

if (!process.env.EDITOR_SESSION_SECRET) {
  process.env.EDITOR_SESSION_SECRET = "test-editor-session-secret";
}
