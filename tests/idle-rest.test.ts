// @vitest-environment happy-dom
// Idle loops play once, rest, play again (author 2026-11-22: 先循环一次，然后停 10 秒左右再下一次).
import { describe, expect, it, vi } from "vitest";
import { watchIdleLoops } from "@world/dialogue/idle";

describe("watchIdleLoops", () => {
  it("replays a standing figure's loop after the rest, and leaves other videos alone", () => {
    vi.useFakeTimers();
    const off = watchIdleLoops(document, 10_000);
    const v = document.createElement("video");
    v.className = "scene-stand-anim";
    document.body.append(v);
    const play = vi.spyOn(v, "play").mockResolvedValue(undefined);
    v.dispatchEvent(new Event("ended"));
    vi.advanceTimersByTime(9_000);
    expect(play).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000);
    expect(play).toHaveBeenCalledTimes(1);
    const other = document.createElement("video");
    document.body.append(other);
    const play2 = vi.spyOn(other, "play").mockResolvedValue(undefined);
    other.dispatchEvent(new Event("ended"));
    vi.advanceTimersByTime(10_000);
    expect(play2).not.toHaveBeenCalled();
    off();
    vi.useRealTimers();
  });
});
