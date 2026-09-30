import "@testing-library/jest-dom/vitest";

if (!process.env.PHYSHUB_TEST_SESSION_TOKEN) {
  process.env.PHYSHUB_TEST_SESSION_TOKEN = "physhub-test-session-token";
}

if (!process.env.AGENT_KEY_WRAP_SECRET) {
  process.env.AGENT_KEY_WRAP_SECRET =
    "a1b2c3d4e5f60718293a4b5c6d7e8f90112233445566778899aabbccddeeff00";
}
