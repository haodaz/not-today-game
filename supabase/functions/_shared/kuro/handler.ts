// The kuro-chat function's request handling (backend FR3), without Deno, the database client or
// the SDK: those come in as `deps`, so the tests run it with a mocked model and an in-memory store.
// index.ts only wires real dependencies to this.
import { buildSystem, citableIds, JUDGE_ASK } from "./prompt.ts";
import { DEFAULT_MODEL, judgeRequest, readJudgement, readReply, turnRequest, type MessageRequest, type MessageResponse } from "./llm.ts";
import { appendExchange, clipSummary, decideTurn } from "./turns.ts";
import type { ChatResponse, Judgement, KuroContent, LogEvent, Memory } from "./types.ts";

export interface HandlerDeps {
  readonly content: KuroContent;
  readonly model?: string;
  /** The caller's run exists and is theirs (RLS). */
  runVisible(runId: string): Promise<boolean>;
  loadMemory(runId: string): Promise<Memory>;
  saveMemory(runId: string, m: Memory): Promise<void>;
  saveJudgement(runId: string, day: number, j: Judgement): Promise<void>;
  /** `client.messages.create` with the 20 s timeout. */
  create(params: MessageRequest): Promise<MessageResponse>;
}

export interface HandlerResult {
  readonly status: number;
  readonly body: ChatResponse | { readonly error: string };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Only what the function accepts from the client: events with an id, a day and a kind. */
function eventsOf(v: unknown): LogEvent[] {
  if (!Array.isArray(v)) return [];
  return v.filter((e): e is LogEvent => isRecord(e) && typeof e.id === "string" && typeof e.day === "number" && typeof e.kind === "string");
}

export async function handle(body: unknown, deps: HandlerDeps): Promise<HandlerResult> {
  if (!isRecord(body)) return { status: 400, body: { error: "bad request" } };
  const mode = body.mode === "judge" ? "judge" : "turn";
  const runId = typeof body.run_id === "string" ? body.run_id : "";
  const day = Number(body.day);
  if (!runId || !Number.isInteger(day) || day < 1) return { status: 400, body: { error: "bad request" } };
  try {
    if (!(await deps.runVisible(runId))) return { status: 404, body: { error: "no such run" } };
    const memory = await deps.loadMemory(runId);
    const events = eventsOf(body.events);
    const model = deps.model || DEFAULT_MODEL;

    if (mode === "turn") {
      const said = typeof body.said === "string" ? body.said.slice(0, 500) : "";
      if (!said.trim()) return { status: 400, body: { error: "nothing said" } };
      // Server-side count: the sixth call gets the constant bedtime line; the model is not called.
      const decision = decideTurn(memory.turns, day, deps.content.turnsPerDay);
      if (decision.kind === "bedtime") return { status: 200, body: { mode, reply: deps.content.bedtime, turnsLeft: 0, bedtime: true } };
      const system = buildSystem(deps.content, day, events, memory, "turn");
      const reply = readReply(await deps.create(turnRequest(model, system, said)));
      await deps.saveMemory(runId, appendExchange(memory, day, said, reply));
      return { status: 200, body: { mode, reply, turnsLeft: decision.turnsLeft } };
    }

    const system = buildSystem(deps.content, day, events, memory, "judge");
    const judgement = readJudgement(await deps.create(judgeRequest(model, system, JUDGE_ASK)), citableIds(events, day, deps.content.gate));
    await deps.saveJudgement(runId, day, judgement);
    if (judgement.summary !== undefined) await deps.saveMemory(runId, { turns: memory.turns, summary: clipSummary(judgement.summary) });
    return { status: 200, body: { mode, judgement } };
  } catch (error) {
    // Refusal, timeout, network, bad output: the client falls back to the offline answer.
    return { status: 502, body: { error: error instanceof Error ? error.message : "unavailable" } };
  }
}
