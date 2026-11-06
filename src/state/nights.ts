// The hand at night (work-v2 §4 and its 2026-11-03 addition; the old night-raid mechanism of the
// night-hand spec was removed 2026-11-06). The hand comes on nights 10–17 (`handNight` in
// days/board.ts) for the gods' work: `raids[night]` keeps what was handed over that night. Pure.

/** One hand night's outcome, stored in `raids[night]`. */
export interface RaidOutcome {
  /** The deliverable id handed over, or null for nothing. */
  readonly gave: string | null;
}
