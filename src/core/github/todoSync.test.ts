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
  it("prefixes authored PRs with PR <repo>:", () => {
    const adds = plannedTodoAdds([pr({ authored: true, title: "Fix RNG", url: "u1" })], new Set(), new Set());
    expect(adds).toEqual([{ title: "PR wolfssl: Fix RNG", url: "u1" }]);
  });

  it("prefixes review-requested PRs with REVIEW <repo>:", () => {
    const adds = plannedTodoAdds(
      [pr({ review_requested_of_me: true, title: "Add API", url: "u2", repo: "wolfSSL/wolfTPM" })],
      new Set(),
      new Set(),
    );
    expect(adds).toEqual([{ title: "REVIEW wolfTPM: Add API", url: "u2" }]);
  });

  it("prefixes assigned PRs with ASSIGNED <repo>:", () => {
    const adds = plannedTodoAdds(
      [pr({ assigned: true, title: "Assigned to me", url: "u3", repo: "wolfSSL/wolfMQTT" })],
      new Set(),
      new Set(),
    );
    expect(adds).toEqual([{ title: "ASSIGNED wolfMQTT: Assigned to me", url: "u3" }]);
  });

  it("adds all three kinds together", () => {
    const adds = plannedTodoAdds(
      [
        pr({ authored: true, title: "Mine", url: "a" }),
        pr({ review_requested_of_me: true, title: "Theirs", url: "b" }),
        pr({ assigned: true, title: "Just assigned", url: "c" }),
      ],
      new Set(),
      new Set(),
    );
    expect(adds.map((a) => a.url)).toEqual(["a", "b", "c"]);
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
