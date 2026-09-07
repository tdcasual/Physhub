import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Nav } from "@/components/nav";

describe("Nav", () => {
  it("links to Questions, Drafts, New draft, and Taxonomy", () => {
    render(<Nav />);

    expect(screen.getByRole("link", { name: "Questions" })).toHaveAttribute(
      "href",
      "/questions",
    );
    expect(screen.getByRole("link", { name: "Drafts" })).toHaveAttribute(
      "href",
      "/drafts",
    );
    expect(screen.getByRole("link", { name: "New draft" })).toHaveAttribute(
      "href",
      "/questions/new",
    );
    expect(screen.getByRole("link", { name: "Taxonomy" })).toHaveAttribute(
      "href",
      "/taxonomy",
    );
  });
});
