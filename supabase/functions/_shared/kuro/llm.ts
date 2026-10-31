// The model call's request and response, without the SDK (the function passes these to
// `client.messages.create`). Pure, so tests check them against a mocked response.
// Request: max_tokens 1024, output_config.effort "low", no `thinking`, no temperature. A refusal
// (`stop_reason === "refusal"`) is an error like a network one: the client falls back offline.
import { JUDGEMENT_SCHEMA, validateJudgement } from "./judgement.ts";
import type { SystemBlock } from "./prompt.ts";
import type { Judgement } from "./types.ts";

export const DEFAULT_MODEL = "claude-sonnet-5-5";
export const MAX_TOKENS = 1024;
export const TIMEOUT_MS = 20_000;

export interface MessageRequest {
  readonly model: string;
  readonly max_tokens: number;
  readonly output_config: { readonly effort: "low"; readonly format?: { readonly type: "json_schema"; readonly schema: unknown } };
  readonly system: readonly SystemBlock[];
  readonly messages: readonly { readonly role: "user"; readonly content: string }[];
}

/** A chat turn: the player's line. */
export function turnRequest(model: string, system: readonly SystemBlock[], said: string): MessageRequest {
  return { model, max_tokens: MAX_TOKENS, output_config: { effort: "low" }, system, messages: [{ role: "user", content: said }] };
}

/** The end-of-beat judgement: structured output against the schema. */
export function judgeRequest(model: string, system: readonly SystemBlock[], ask: string): MessageRequest {
  return {
    model,
    max_tokens: MAX_TOKENS,
    output_config: { effort: "low", format: { type: "json_schema", schema: JUDGEMENT_SCHEMA } },
    system,
    messages: [{ role: "user", content: ask }],
  };
}

/** The parts of a Messages API response these read. */
export interface MessageResponse {
  readonly stop_reason?: string | null;
  readonly content: readonly { readonly type: string; readonly text?: string }[];
}

export class RefusalError extends Error {
  constructor() {
    super("the model refused");
  }
}

function textOf(r: MessageResponse): string {
  if (r.stop_reason === "refusal") throw new RefusalError();
  return r.content.filter((b) => b.type === "text" && typeof b.text === "string").map((b) => b.text).join("").trim();
}

/** Kuro's reply; an empty one counts as a failure. */
export function readReply(r: MessageResponse): string {
  const text = textOf(r);
  if (!text) throw new Error("empty reply");
  return text;
}

/** The judgement, validated (uncited evidence dropped); a malformed one is a failure. */
export function readJudgement(r: MessageResponse, ids: ReadonlySet<string>): Judgement {
  const text = textOf(r);
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("the judgement is not JSON");
  }
  const j = validateJudgement(raw, ids);
  if (!j) throw new Error("the judgement has the wrong shape");
  return j;
}
