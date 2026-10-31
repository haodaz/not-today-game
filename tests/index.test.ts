import { describe, expect, it } from "vitest";
import * as api from "@state/index";

describe("public API", () => {
  it("does not expose the profile reader or the profile key", () => {
    const names = Object.keys(api);
    expect(names).not.toContain("readProfile");
    expect(names).not.toContain("PROFILE_KEY");
    expect(names).not.toContain("PROFILE_SPEC");
  });

  it("exposes the pieces a view needs", () => {
    for (const name of ["createStore", "computeState", "stageOf", "ringOf", "createRunSlot", "debugStartDay", "fakeClock"]) {
      expect(api, name).toHaveProperty(name);
    }
  });

  it("end to end: play, save, reload, same state", () => {
    const storage = api.memoryStorage();
    const store = api.createStore();
    store.appendEvent({ kind: "lieDown" });
    store.appendEvent({ kind: "pokeReset" });
    const run = api.createRunSlot(storage);
    run.save(store);
    const again = api.createStore(run.load()!);
    expect(again.getState()).toEqual(store.getState());
    expect(again.getState().day).toBe(2);
  });
});
