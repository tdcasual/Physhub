import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "@/app/page";

describe("Home", () => {
  it("describes the shipped workbench rather than package foundations", () => {
    render(<Home />);

    expect(screen.getByText("Harness-first workbench")).toBeInTheDocument();
    expect(
      screen.getByText(/Unlock the editor, save drafts, promote official questions/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/package foundations are ready/),
    ).not.toBeInTheDocument();
  });
});
