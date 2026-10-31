// 绑定邮箱 in the settings panel (backend FR1). The row's three states come from one pure function;
// what is typed and the last send's result live here, so a re-render (the game's or the title's)
// keeps them. Hidden offline or without env: the anonymous session is what the email binds to.
import { net, onAccountChange } from "./supabase";

export type EmailStatus = "idle" | "sending" | "sent" | "error";

export type EmailRow =
  | { readonly kind: "hidden" }
  | { readonly kind: "input"; readonly draft: string; readonly status: EmailStatus }
  | { readonly kind: "bound"; readonly email: string };

export interface EmailInput {
  readonly configured: boolean;
  readonly signedIn: boolean;
  readonly bound: string | null;
  readonly draft: string;
  readonly status: EmailStatus;
}

/** Hidden unless configured and signed in; bound shows the address instead of the input. Pure. */
export function emailRowModel(i: EmailInput): EmailRow {
  if (!i.configured || !i.signedIn) return { kind: "hidden" };
  if (i.bound) return { kind: "bound", email: i.bound };
  return { kind: "input", draft: i.draft, status: i.status };
}

/** A plausible address (the server decides the rest). */
export const looksLikeEmail = (s: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

let draft = "";
let status: EmailStatus = "idle";

export function emailRow(): EmailRow {
  return emailRowModel({ configured: net.configured(), signedIn: net.signedIn(), bound: net.boundEmail(), draft, status });
}

/** Typing (no re-render): the input's value is kept for the next render. */
export function setEmailDraft(value: string): void {
  draft = value;
  if (status === "error" || status === "sent") status = "idle";
}

/**
 * 发送链接: send the link to the typed address, returning to `origin` (the current origin in the
 * game). `changed` re-renders when the status moves (sending, then sent or error).
 */
export async function sendEmailLink(origin: string, changed: () => void): Promise<void> {
  if (status === "sending") return;
  const email = draft.trim();
  if (!looksLikeEmail(email)) {
    status = "error";
    changed();
    return;
  }
  status = "sending";
  changed();
  status = await net.bindEmail(email, origin);
  changed();
}

/** Re-render the row when the account changes (the link was opened): the controller and the title subscribe. */
export const onEmailChange = onAccountChange;

export function resetEmailForTests(): void {
  draft = "";
  status = "idle";
}
