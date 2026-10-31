// The ONLY reader of the cross-run profile. Import this from the title page (src/ui/) and
// nowhere else: the profile must never feed story or state logic. tests/saves.test.ts fails if
// any other module imports this file or touches the profile key.
import { createSlot, type KeyValueStorage } from "./slot";
import { PROFILE_SPEC, type ProfileData } from "./saves";

/** The saved profile, or null if there is none yet. */
export function readProfile(storage: KeyValueStorage): ProfileData | null {
  const data = createSlot(storage, PROFILE_SPEC).read();
  return data ? (data.data as ProfileData) : null;
}
