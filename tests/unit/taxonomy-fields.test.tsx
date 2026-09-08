import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TaxonomyFields } from "@/components/taxonomy/taxonomy-fields";
import { taxonomyFixtures } from "@/tests/unit/helpers/taxonomy-fixtures";

describe("TaxonomyFields", () => {
  it("emits knowledge point ids from names and does not offer a cuid text box", () => {
    const onChange = vi.fn();

    render(
      <TaxonomyFields
        knowledgePoints={taxonomyFixtures.knowledgePoints}
        tags={taxonomyFixtures.tags}
        value={{
          knowledgePointIds: [],
          tagIds: [],
          difficulty: null,
          type: "SINGLE_CHOICE",
        }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "运动学" }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ knowledgePointIds: ["kp_motion"] }),
    );
    expect(screen.queryByLabelText("Knowledge point ids")).not.toBeInTheDocument();
  });
});
