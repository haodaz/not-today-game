// Fills {calledBy} {bossCalls} {nick} {login} from `names` at render time. State and plans always
// hold the raw text; only a view calls this.
import { PLACEHOLDERS } from "@state/replies/table";
import type { State } from "@state/types.gen";

const pattern = new RegExp(`\\{(${PLACEHOLDERS.join("|")})\\}`, "g");

export function fillPlaceholders(text: string, names: State["names"]): string {
  return text.replace(pattern, (_match, key: (typeof PLACEHOLDERS)[number]) => names[key] ?? "");
}
