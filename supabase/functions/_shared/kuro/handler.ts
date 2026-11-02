// The kuro-chat function's request handling (backend FR3), without Deno, the database client or
// the SDK: those come in as `deps`, so the tests run it with a mocked model and an in-memory store.
// index.ts only wires real dependencies to this.
import { buildSystem, citableIds, JUDGE_ASK, localeOf } from "./prompt.ts";
import { DEFAULT_MODEL, judgeRequest, readJudgement, readReply, turnRequest, type MessageRequest, type MessageResponse } from "./llm.ts";
import { appendExchange, appendLayered, clipSummary, decideTurn } from "./turns.ts";
import type { ChatResponse, Judgement, KuroContent, LogEvent, Memory, StoredJudgement } from "./types.ts";
import { affinityFrom, composeReply, enforceLocked, variableLayer } from "./variable.ts";

export interface HandlerDeps {
  readonly content: KuroContent;
  readonly model?: string;
  /** The caller's run exists and is theirs (RLS). */
  runVisible(runId: string): Promise<boolean>;
  loadMemory(runId: string): Promise<Memory>;
  saveMemory(runId: string, m: Memory): Promise<void>;
  saveJudgement(runId: string, day: number, j: Judgement): Promise<void>;
  /** The run's stored judgements, for the affinity bucket (variable layer); none when absent. */
  loadJudgements?(runId: string): Promise<readonly StoredJudgement[]>;
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
    const locale = localeOf(body.locale);

    if (mode === "turn") {
      const said = typeof body.said === "string" ? body.said.slice(0, 500) : "";
      if (!said.trim()) return { status: 400, body: { error: "nothing said" } };
      // Server-side count: the sixth call gets the constant bedtime line; the model is not called.
      const decision = decideTurn(memory.turns, day, deps.content.turnsPerDay);
      if (decision.kind === "bedtime") return { status: 200, body: { mode, reply: deps.content.bedtime, turnsLeft: 0, bedtime: true, taboo: null } };
      // The variable layer (2026-11-02): the bucket from the stored judgements, the day's dice,
      // this turn's locked line and its d100. The model sees only derived values.
      const q = Number.isInteger(body.q) && (body.q as number) >= 1 ? (body.q as number) : null;
      const rows = deps.loadJudgements ? await deps.loadJudgements(runId) : [];
      const affinity = deps.content.affinity ? affinityFrom(rows, deps.content.affinity) : 0;
      const layer = variableLayer({ content: deps.content, day, locale, runId, memory, affinity, q, said });
      if (layer.outcome === "failure") {
        // 大失败: the reply is forgotten (the model is not asked); the turn is spent; the judgement may cite the asking.
        await deps.saveMemory(runId, appendLayered(memory, day, said, null, "flicker"));
        return { status: 200, body: { mode, reply: "", turnsLeft: decision.turnsLeft, taboo: "flicker" } };
      }
      const system = buildSystem(deps.content, day, events, memory, "turn", locale, layer);
      let raw = "";
      if (!layer.locked) raw = readReply(await deps.create(turnRequest(model, system, said)));
      else {
        // A locked turn stands on its own: if the model refuses, fails or says nothing, the locked text alone.
        try {
          raw = readReply(await deps.create(turnRequest(model, system, said)));
        } catch {
          raw = "";
        }
      }
      if (!layer.locked) {
        // A free reply never carries a taboo (the model has no such channel).
        await deps.saveMemory(runId, appendExchange(memory, day, said, raw));
        return { status: 200, body: { mode, reply: raw, turnsLeft: decision.turnsLeft, taboo: null } };
      }
      // Locked: the text verbatim first, whatever the model wrote; on 大成功 the server's word and the follow-up.
      const enforced = enforceLocked(raw, layer.locked);
      const reply = composeReply(layer, enforced);
      // Memory keeps what the model may recall: never the word or the mechanism.
      const remembered = composeReply({ ...layer, glyph: null, followup: null }, enforced);
      await deps.saveMemory(runId, appendLayered(memory, day, said, remembered, layer.taboo));
      return { status: 200, body: { mode, reply, turnsLeft: decision.turnsLeft, taboo: layer.taboo } };
    }

    const system = buildSystem(deps.content, day, events, memory, "judge", locale);
    const judgement = readJudgement(await deps.create(judgeRequest(model, system, JUDGE_ASK)), citableIds(events, day, deps.content.gate));
    await deps.saveJudgement(runId, day, judgement);
    if (judgement.summary !== undefined) await deps.saveMemory(runId, { turns: memory.turns, summary: clipSummary(judgement.summary) });
    return { status: 200, body: { mode, judgement } };
  } catch (error) {
    // Refusal, timeout, network, bad output: the client falls back to the offline answer.
    return { status: 502, body: { error: error instanceof Error ? error.message : "unavailable" } };
  }
}
