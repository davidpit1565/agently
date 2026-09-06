import { describe, it, expect } from "vitest";
import { embeddableText, cosineSimilarity } from "./embeddings";

describe("embeddableText", () => {
  it("joins name, tagline, and problem_solved into one sentence-separated string", () => {
    expect(
      embeddableText({ name: "Agent X", tagline: "Does things", problem_solved: "Solves stuff" })
    ).toBe("Agent X. Does things. Solves stuff");
  });
});

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });

  it("returns -1 for opposite vectors", () => {
    expect(cosineSimilarity([1, 2], [-1, -2])).toBeCloseTo(-1);
  });

  it("returns 0 when vectors have mismatched lengths", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2])).toBe(0);
  });

  it("returns 0 for empty vectors", () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it("returns 0 when one vector is all zeros (avoids division by zero)", () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
  });
});
