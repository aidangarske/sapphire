import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSaver } from "./saver";

describe("createSaver", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("writes the latest content after the debounce delay", () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const s = createSaver(write, 400);
    s.schedule("a.md", "one");
    s.schedule("a.md", "two");
    expect(write).not.toHaveBeenCalled();
    vi.advanceTimersByTime(400);
    expect(write).toHaveBeenCalledExactlyOnceWith("a.md", "two");
  });

  it("flush persists a pending edit immediately (e.g. on tab switch / unmount)", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const s = createSaver(write, 400);
    s.schedule("a.md", "edited");
    await s.flush();
    expect(write).toHaveBeenCalledExactlyOnceWith("a.md", "edited");
    vi.advanceTimersByTime(400);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("cancelFor drops a pending write so a deleted note is not resurrected", () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const s = createSaver(write, 400);
    s.schedule("a.md", "edited");
    s.cancelFor("a.md");
    vi.advanceTimersByTime(400);
    expect(write).not.toHaveBeenCalled();
  });

  it("cancelFor only drops the matching path", () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const s = createSaver(write, 400);
    s.schedule("a.md", "edited");
    s.cancelFor("other.md");
    vi.advanceTimersByTime(400);
    expect(write).toHaveBeenCalledExactlyOnceWith("a.md", "edited");
  });
});
