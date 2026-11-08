// login-first (author 2026-11-09, asked many times): before 新游戏 / 继续 the title asks for an
// account — email + password to register or log in — or 游客身份进入. With a stored session the
// gate is skipped; a guest's choice is remembered; offline (no env) there is no gate at all.
import { afterEach, describe, expect, it } from "vitest";
import { net, setSupabaseForTests, type SupabaseLike } from "@net/supabase";
import { EMPTY_COLLECTION } from "@world/room/collection";
import { setLocale } from "@world/i18n";
import { GUEST_KEY, mountTitle } from "../src/ui/title/mount";
import { gateFor, initialTitle, needsGate, pastGate } from "../src/ui/title/model";
import { renderTitle } from "../src/ui/title/view";

afterEach(() => {
  setSupabaseForTests(undefined);
  setLocale("zh");
});

type User = { id: string; email?: string | null; is_anonymous?: boolean };
/** A client with a stored session (or none) and password sign-in that accepts one pair. */
function fakeClient(session: User | null, opts: { confirm?: boolean; good?: { email: string; password: string } } = {}) {
  const calls: string[] = [];
  let current: User | null = session;
  const c: SupabaseLike = {
    auth: {
      getSession: async () => ({ data: { session: current ? { user: current } : null } }),
      signInAnonymously: async () => ({ data: { user: { id: "anon-1" } }, error: null }),
      updateUser: async () => ({ data: null, error: null }),
      signInWithOtp: async () => ({ data: null, error: null }),
      signUp: async ({ email }) => {
        calls.push(`signUp ${email}`);
        if (opts.confirm) return { data: { user: { id: "u-new", email }, session: null }, error: null };
        current = { id: "u-new", email };
        return { data: { user: current, session: { user: current } }, error: null };
      },
      signInWithPassword: async ({ email, password }) => {
        calls.push(`login ${email}`);
        if (opts.good && opts.good.email === email && opts.good.password === password) {
          current = { id: "u-1", email };
          return { data: { user: current, session: { user: current } }, error: null };
        }
        return { data: { user: null, session: null }, error: { message: "Invalid login credentials" } };
      },
      signOut: async () => {
        calls.push("signOut");
        current = null;
        return { error: null };
      },
    },
    from: () => ({ upsert: async () => ({ error: null }), select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
    functions: { invoke: async () => ({ data: null, error: null }) },
  };
  return { c, calls };
}

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

const flush = () => new Promise((r) => setTimeout(r, 0));

async function mount(storage = new MemStorage(), account = true) {
  const { Window } = await import("happy-dom");
  const win = new Window();
  const root = win.document.createElement("div") as unknown as HTMLElement;
  win.document.body.appendChild(root as never);
  const sound = { muted: false, setMuted() {}, apply() {}, unlock() {}, onTuneEnd() {}, armGestures() {}, idle: async () => {}, destroy() {} } as never;
  const started: unknown[] = [];
  const title = mountTitle(root, { save: null, collection: EMPTY_COLLECTION, onContinue() {}, onStart: (n: unknown) => started.push(n), random: () => 0.5, sound, ...(account ? { account: { storage, origin: "http://t" } } : {}) } as never);
  const click = (sel: string) => {
    const el = root.querySelector(sel) as unknown as { dispatchEvent: (e: unknown) => void } | null;
    el?.dispatchEvent(new win.MouseEvent("click", { bubbles: true }) as never);
  };
  const type = (sel: string, value: string) => {
    const el = root.querySelector(sel) as unknown as HTMLInputElement;
    el.value = value;
    el.dispatchEvent(new win.Event("input", { bubbles: true }) as never);
  };
  await flush();
  await flush();
  return { win, root, title, click, type, started, html: () => root.innerHTML, model: () => title.model() };
}

describe("the gate", () => {
  it("no session: the menu as usual and no chip; 新游戏 opens the card (email, password, 注册, 登录 switch, 游客, 取消) in place of the menu", async () => {
    setSupabaseForTests(fakeClient(null).c);
    const t = await mount();
    expect(t.model().account).toEqual({ kind: "none" });
    expect(needsGate(t.model().account)).toBe(true);
    expect(t.html()).toContain('data-action="title-new"');
    expect(t.html()).not.toContain("title-account");
    expect(t.html()).not.toContain("title-auth");
    t.click('[data-action="title-new"]');
    expect(t.model().account).toEqual(gateFor("new"));
    const h = t.html();
    expect(h).toContain('class="stage title-page screen-menu gated"');
    expect(h).toContain('data-action="auth-cancel"');
    t.click('[data-action="auth-cancel"]');
    expect(t.model().account).toEqual({ kind: "none" });
    t.click('[data-action="title-new"]');
    expect(h).toContain('class="title-card title-auth"');
    expect(h).toContain('data-input="auth-email"');
    expect(h).toContain('data-input="auth-password"');
    expect(h).toContain('data-action="auth-submit"');
    expect(h).toContain('data-action="auth-guest"');
    expect(h).not.toContain('data-action="title-new"');
    expect(h).toContain("注册账号");
    expect(h).toContain("保存游戏存档与成就");
  });

  it("游客身份进入 from 新游戏: the choice remembered, the chip says 游客, and the game goes on to the questions; a later visit passes straight through", async () => {
    setSupabaseForTests(fakeClient(null).c);
    const storage = new MemStorage();
    const t = await mount(storage);
    t.click('[data-action="title-new"]');
    t.click('[data-action="auth-guest"]');
    expect(t.model().account).toEqual({ kind: "guest" });
    expect(t.model().screen).toBe("questions"); // the pressed action went on
    expect(storage.getItem(GUEST_KEY)).toBe("1");
    const again = await mount(storage);
    expect(again.model().account).toEqual({ kind: "guest" });
    expect(again.html()).toContain('<div class="title-account guest"><span class="who">游客身份</span></div>');
    again.click('[data-action="title-new"]');
    expect(again.model().screen).toBe("questions"); // no card for a remembered guest
  });

  it("登录 with the right pair: signed in as the email, the menu; a wrong pair shows the error and stays", async () => {
    const { c, calls } = fakeClient(null, { good: { email: "a@b.co", password: "secret1" } });
    setSupabaseForTests(c);
    const t = await mount();
    t.click('[data-action="title-new"]');
    t.click('[data-action="auth-mode"][data-mode="login"]');
    expect(t.html()).toContain("<h2 id=\"title-auth-h\">登录</h2>");
    t.type('[data-input="auth-email"]', "a@b.co");
    t.type('[data-input="auth-password"]', "nope123");
    t.click('[data-action="auth-submit"]');
    await flush();
    await flush();
    expect(t.model().account).toMatchObject({ kind: "gate", status: "error" });
    expect(t.html()).toContain("邮箱或密码不对");
    t.type('[data-input="auth-password"]', "secret1");
    expect(t.model().account).toMatchObject({ kind: "gate", status: "idle" }); // typing clears the error
    t.click('[data-action="auth-submit"]');
    await flush();
    await flush();
    expect(t.model().account).toEqual({ kind: "user", email: "a@b.co" });
    expect(t.model().screen).toBe("questions"); // 新游戏 went on after the login
    expect(calls).toEqual(["login a@b.co", "login a@b.co"]);
    expect(net.signedIn()).toBe(true);
  });

  it("注册: a project that confirms by mail shows the note and switches to 登录; one that signs in at once passes", async () => {
    setSupabaseForTests(fakeClient(null, { confirm: true }).c);
    const t = await mount();
    t.click('[data-action="title-new"]');
    t.click('[data-action="auth-mode"][data-mode="register"]');
    expect(t.model().account).toMatchObject({ kind: "gate", mode: "register" });
    t.type('[data-input="auth-email"]', "new@b.co");
    t.type('[data-input="auth-password"]', "secret1");
    t.click('[data-action="auth-submit"]');
    await flush();
    await flush();
    expect(t.model().account).toMatchObject({ kind: "gate", mode: "login", status: "confirm", password: "" });
    expect(t.html()).toContain("去邮箱点一下确认链接");

    setSupabaseForTests(fakeClient(null).c);
    const u = await mount();
    u.click('[data-action="title-new"]');
    u.click('[data-action="auth-mode"][data-mode="register"]');
    u.type('[data-input="auth-email"]', "new@b.co");
    u.type('[data-input="auth-password"]', "secret1");
    u.click('[data-action="auth-submit"]');
    await flush();
    await flush();
    expect(u.model().account).toEqual({ kind: "user", email: "new@b.co" });
  });

  it("a short password or a bad address never calls the backend", async () => {
    const { c, calls } = fakeClient(null);
    setSupabaseForTests(c);
    const t = await mount();
    t.click('[data-action="title-new"]');
    t.click('[data-action="auth-mode"][data-mode="login"]');
    t.type('[data-input="auth-email"]', "not-an-email");
    t.type('[data-input="auth-password"]', "secret1");
    t.click('[data-action="auth-submit"]');
    await flush();
    expect(t.model().account).toMatchObject({ kind: "gate", status: "error" });
    t.type('[data-input="auth-email"]', "a@b.co");
    t.type('[data-input="auth-password"]', "12345");
    t.click('[data-action="auth-submit"]');
    await flush();
    expect(t.model().account).toMatchObject({ kind: "gate", status: "error" });
    expect(calls).toEqual([]);
  });

  it("a stored session: an email account shows its chip with 退出登录 and 新游戏 goes straight on; an anonymous one is a guest; 退出登录 leaves nobody", async () => {
    const { c, calls } = fakeClient({ id: "u-9", email: "me@b.co" });
    setSupabaseForTests(c);
    const t = await mount();
    expect(t.model().account).toEqual({ kind: "user", email: "me@b.co" });
    expect(t.html()).toContain('<div class="title-account user"><span class="who">me@b.co</span><button type="button" class="auth-logout" data-action="auth-logout">退出登录</button></div>');
    t.click('[data-action="auth-logout"]');
    await flush();
    await flush();
    expect(calls).toContain("signOut");
    expect(t.model().account).toEqual({ kind: "none" });
    expect(t.html()).not.toContain("title-account");

    setSupabaseForTests(fakeClient({ id: "anon-2", is_anonymous: true }).c);
    const g = await mount();
    expect(g.model().account).toEqual({ kind: "guest" });
  });

  it("offline (no env) or no account wiring: no gate, the menu as before", async () => {
    setSupabaseForTests(null);
    const t = await mount();
    expect(t.model().account).toEqual({ kind: "offline" });
    expect(t.html()).toContain('data-action="title-new"');
    expect(t.html()).not.toContain("title-auth");
    const plain = await mount(new MemStorage(), false);
    expect(plain.model().account).toBeUndefined();
    expect(renderTitle(initialTitle(null, EMPTY_COLLECTION)).value).not.toContain("title-auth");
    expect(pastGate(undefined)).toBe(true);
    expect(needsGate(undefined)).toBe(false);
    expect(needsGate({ kind: "offline" })).toBe(false);
  });
});
