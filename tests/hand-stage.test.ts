// texture-pass R5: the gods' hands behind the box on nights 10–17.
import { describe, expect, it } from "vitest";
import { handMedia, handStage } from "@world/room/hand";

describe("handMedia", () => {
  it("has a still on every hand night, a clip from night 11, nothing elsewhere", () => {
    expect(handMedia(9)).toBeNull();
    expect(handMedia(18)).toBeNull();
    expect(handMedia(10)).toEqual({ still: "/night/hand_d10.jpg", clip: null });
    expect(handMedia(13)).toEqual({ still: "/night/hand_d13.jpg", clip: "/night/hand_d13.mp4" });
  });
  it("renders the still alone on night 10 and still + loop on 11–17", () => {
    const n10 = handStage(10)!.value;
    expect(n10).toContain('data-night="10"');
    expect(n10).not.toContain("<video");
    const n16 = handStage(16)!.value;
    expect(n16).toContain('src="/night/hand_d16.mp4"');
    expect(n16).toContain('poster="/night/hand_d16.jpg"');
    expect(handStage(5)).toBeNull();
  });
});
