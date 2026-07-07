import { describe, it, expect } from "bun:test";
import { plannedTodoAdds } from "./todoSync.ts";
import type { Pr } from "./types.ts";

function pr(over: Partial<Pr>): Pr {
  return {
    repo: "wolfSSL/wolfssl",
    number: 1,
    title: "Some change",
    url: "https://github.com/wolfSSL/wolfssl/pull/1",
    ci: "passing",
    review: "none",
    draft: false,
    conflict: false,
    authored: false,
    assigned: false,
    review_requested_of_me: false,
    author: "",
    assignees: [],
    updated_at: "",
    ...over,
  };
}

describe("plannedTodoAdds", () => {
  it("adds authored PRs with a plain repo tag", () => {
    const adds = plannedTodoAdds([pr({ authored: true, title: "Fix RNG", url: "u1" })], new Set(), new Set());
    expect(adds).toEqual([{ title: "Fix RNG #wolfssl", url: "u1" }]);
  });

  it("adds review-requested PRs with a Review: label and #review tag", () => {
    const adds = plannedTodoAdds(
      [pr({ review_requested_of_me: true, title: "Add API", url: "u2", repo: "wolfSSL/wolfTPM" })],
      new Set(),
      new Set(),
    );
    expect(adds).toEqual([{ title: "Review: Add API #wolfTPM #review", url: "u2" }]);
  });

  it("adds both kinds together", () => {
    const adds = plannedTodoAdds(
      [
        pr({ authored: true, title: "Mine", url: "a" }),
        pr({ review_requested_of_me: true, title: "Theirs", url: "b" }),
        pr({ assigned: true, title: "Just assigned", url: "c" }), // neither authored nor review -> skipped
      ],
      new Set(),
      new Set(),
    );
    expect(adds.map((a) => a.url)).toEqual(["a", "b"]);
  });

  it("skips PRs already seen or already on the board", () => {
    const prs = [
      pr({ authored: true, url: "seen" }),
      pr({ review_requested_of_me: true, url: "onboard" }),
      pr({ authored: true, url: "fresh" }),
    ];
    const adds = plannedTodoAdds(prs, new Set(["seen"]), new Set(["onboard"]));
    expect(adds.map((a) => a.url)).toEqual(["fresh"]);
  });
});
