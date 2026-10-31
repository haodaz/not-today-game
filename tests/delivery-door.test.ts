import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { deliveryTable, mealOf } from "@state/delivery/table";
import { f } from "@state/fday";
import { constants } from "@state/variables";
import { doorCaption, DOOR_STATES, nextInputs, startDoor, stepDoor, type DoorBeat, type DoorInput } from "@world/delivery/door";
import { mealView } from "@world/delivery/meals";
import { stampLog } from "./helpers";

const lunchEnd = deliveryTable.windows.lunch[1];
const delivered = () => startDoor(mealView(1, "lunch", f(1), [], lunchEnd)!)!;
const walk: DoorInput[] = ["walk", "openChain", "reach", "close", "place"];

describe("door machine", () => {
  it("has one state per content step, captioned by it", () => {
    expect(DOOR_STATES.map(doorCaption)).toEqual(deliveryTable.doorSteps);
  });

  it("walks delivered → onDesk in five moves; only the last emits the pickup", () => {
    let beat: DoorBeat = delivered();
    expect(beat.state).toBe("delivered");
    const emitted = walk.map((input) => {
      const result = stepDoor(beat, input);
      beat = result.beat;
      return result.emit;
    });
    expect(beat.state).toBe("onDesk");
    expect(emitted).toEqual([null, null, null, null, { kind: "pickup", meal: "lunch" }]);
  });

  it("offers exactly one input per state until onDesk", () => {
    DOOR_STATES.forEach((state, i) => {
      expect(nextInputs(state)).toEqual(i < walk.length ? [walk[i]] : []);
    });
  });

  it("property: any input that is not the next one is rejected and changes nothing", () => {
    fc.assert(
      fc.property(fc.constantFrom(...DOOR_STATES), fc.constantFrom(...walk), (state, input) => {
        const beat: DoorBeat = { day: 1, meal: "lunch", state };
        if (nextInputs(state).includes(input)) expect(() => stepDoor(beat, input)).not.toThrow();
        else expect(() => stepDoor(beat, input)).toThrow(/not possible/);
      }),
    );
  });

  it("does not mutate the beat it was given", () => {
    const beat = delivered();
    stepDoor(beat, "walk");
    expect(beat.state).toBe("delivered");
  });
});

describe("startDoor", () => {
  it("is null before 已送达 and for a meal that never comes", () => {
    expect(startDoor(mealView(1, "lunch", f(1), [], deliveryTable.windows.lunch[0])!)).toBeNull();
    const day = Array.from({ length: constants.lastDay }, (_, i) => i + 1).find((d) => mealOf(d, "dinner")!.arrives === null)!;
    expect(startDoor(mealView(day, "dinner", f(day), [], "23:00")!)).toBeNull();
  });

  it("starts at onDesk once the bag was taken in", () => {
    const events = stampLog(1, [{ kind: "pickup", meal: "lunch" }]);
    expect(startDoor(mealView(1, "lunch", f(1), events, lunchEnd)!)!.state).toBe("onDesk");
  });
});
