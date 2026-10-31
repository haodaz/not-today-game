import type { State } from "./types.gen";

/** Adds flags that are not there yet. Returns the same state when nothing changes. Flags stay a set. */
export function withFlags(state: State, added: readonly string[] | undefined): State {
  if (!added?.length) return state;
  const missing = [...new Set(added)].filter((flag) => !state.flags.includes(flag));
  return missing.length ? { ...state, flags: [...state.flags, ...missing] } : state;
}
