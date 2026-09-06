import { describe, expect, it } from "vitest";
import { buildAgentEditDiff } from "./agent-diff";

const base = {
  name: "explain-steps",
  tagline: "Turn how-do-I into numbered steps",
  problem_solved: "Tutorials skip the failure path",
  description: "A short description.",
};

describe("buildAgentEditDiff", () => {
  it("reports no visible change when nothing differs", () => {
    const diff = buildAgentEditDiff(base, {
      name: base.name,
      tagline: base.tagline,
      problemSolved: base.problem_solved,
      description: base.description,
    });
    expect(diff).toBe("No visible field changed.");
  });

  it("lists only the fields that actually changed", () => {
    const diff = buildAgentEditDiff(base, {
      name: "explain-steps-v2",
      tagline: base.tagline,
      problemSolved: base.problem_solved,
      description: base.description,
    });
    expect(diff).toBe(`Name: "${base.name}" → "explain-steps-v2"`);
  });

  it("calls out the description by length instead of quoting it in full", () => {
    const longer = base.description + " Extra detail.";
    const diff = buildAgentEditDiff(base, {
      name: base.name,
      tagline: base.tagline,
      problemSolved: base.problem_solved,
      description: longer,
    });
    expect(diff).toBe(`Description changed (${base.description.length} → ${longer.length} characters).`);
    expect(diff).not.toContain(longer);
  });

  it("lists every changed field together, one per line", () => {
    const diff = buildAgentEditDiff(base, {
      name: "new-name",
      tagline: "new-tagline",
      problemSolved: base.problem_solved,
      description: base.description,
    });
    expect(diff.split("\n")).toHaveLength(2);
    expect(diff).toContain("Name:");
    expect(diff).toContain("Tagline:");
  });
});
