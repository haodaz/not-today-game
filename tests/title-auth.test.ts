// login-first (author 2026-11-09, asked many times): before 新游戏 / 继续 the title asks for an
// account — email + password to register or log in — or 游客身份进入. With a stored session the
// gate is skipped; a guest's choice is remembered; offline (no env) there is no gate at all.
import { afterEach, describe, expect, it } from "vitest";
import { net, setSupabaseForTests, type SupabaseLike } from "@net/supabase";
import { EMPTY_COLLECTION } from "@world/room/collection";
import { setLocale } from "@world/i18n";
import { GUEST_KEY, mountTitle } from "../src/ui/title/mount";
import { gateFor, initialTitle, needsGate, pastGate, toMenu, toQuestions } from "../src/ui/title/model";
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

async function mount(storage = new MemStorage(), account = true, extra: Record<string, unknown> = {}) {
  const { Window } = await import("happy-dom");
  const win = new Window();
  const root = win.document.createElement("div") as unknown as HTMLElement;
  win.document.body.appendChild(root as never);
  const sound = { muted: false, setMuted() {}, apply() {}, unlock() {}, onTuneEnd() {}, armGestures() {}, idle: async () => {}, destroy() {} } as never;
  const started: unknown[] = [];
  const title = mountTitle(root, { save: null, collection: EMPTY_COLLECTION, onContinue() {}, onStart: (n: unknown) => started.push(n), random: () => 0.5, sound, ...(account ? { account: { storage, origin: "http://t" } } : {}), ...extra } as never);
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
  it("no session: the menu as usual and no badge; 新游戏 opens the card (email, password, 注册, 登录 switch, 游客, 取消) in place of the menu", async () => {
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

  it("游客身份进入 from 新游戏: the choice remembered, the badge says 游客, and the game goes on to the questions; a later visit passes straight through", async () => {
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
    expect(again.html()).toContain('<span class="name">游客</span>');
    expect(again.html()).not.toContain("title-account");
    again.click('[data-action="title-new"]');
    expect(again.model().screen).toBe("questions"); // no card for a remembered guest
    // A guest who wants an account: the badge's 注册 / 登录 drops the guest choice and opens the card.
    const g = await mount(storage);
    g.click('[data-action="badge-open"]');
    g.click('[data-action="auth-upgrade"]');
    expect(g.model().badgeOpen).toBe(false);
    await flush();
    await flush();
    expect(g.model().account).toMatchObject({ kind: "gate", then: "stay" });
    expect(storage.getItem(GUEST_KEY)).toBeNull();
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

  it("a stored session: an email account wears the badge, 退出登录 inside it and 新游戏 goes straight on; an anonymous one is a guest; 退出登录 leaves nobody", async () => {
    const { c, calls } = fakeClient({ id: "u-9", email: "me@b.co" });
    setSupabaseForTests(c);
    const t = await mount();
    expect(t.model().account).toEqual({ kind: "user", email: "me@b.co" });
    expect(t.html()).toContain('<span class="name">me</span>');
    expect(t.html()).not.toContain("title-account");
    t.click('[data-action="badge-open"]');
    expect(t.html()).toContain("已登录：me@b.co");
    t.click('[data-action="auth-logout"]');
    await flush();
    await flush();
    expect(calls).toContain("signOut");
    expect(t.model().account).toEqual({ kind: "none" });
    expect(t.model().badgeOpen).toBe(false);
    expect(t.html()).not.toContain("title-badge");

    // An old anonymous session alone is nobody yet (the card still comes on 新游戏); a chosen guest is a guest.
    setSupabaseForTests(fakeClient({ id: "anon-2", is_anonymous: true }).c);
    const g = await mount();
    expect(g.model().account).toEqual({ kind: "none" });
    const chosen = new MemStorage();
    chosen.setItem(GUEST_KEY, "1");
    const g2 = await mount(chosen);
    expect(g2.model().account).toEqual({ kind: "guest" });
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

// title-badge (author 2026-11-15): the account is the menu's last card, a staff badge; opened, it
// changes the profile's look and logs out. The top-right chip is gone.
describe("the staff badge", () => {
  const user = { ...initialTitle(null, EMPTY_COLLECTION), account: { kind: "user", email: "kiro.w@b.co" } } as const;
  const lastInMenu = (h: string) => /<nav class="title-menu"[^>]*>.*<\/nav>/.exec(h)?.[0] ?? "";

  it("ends the menu for a user (the email's local part) and a guest (游客); none, checking, offline and gate wear none", () => {
    const u = lastInMenu(renderTitle(user).value);
    expect(u).toMatch(/data-action="title-credits">制作<\/button><button type="button" class="title-badge user" data-action="badge-open"[^>]*aria-label="工牌">.*<\/button><\/nav>$/);
    expect(u).toContain('<span class="name">kiro.w</span><span class="co">未来智能</span>');
    expect(u).toContain('src="/player/');
    const g = renderTitle({ ...user, account: { kind: "guest" } }).value;
    expect(g).toContain('class="title-badge guest"');
    expect(g).toContain('<span class="name">游客</span>');
    for (const account of [{ kind: "none" }, { kind: "checking" }, { kind: "offline" }, gateFor("new")] as const) {
      const h = renderTitle({ ...user, account } as never).value;
      expect(h).not.toContain("title-badge");
    }
    expect(renderTitle(initialTitle(null, EMPTY_COLLECTION)).value).not.toContain("title-badge");
    expect(renderTitle(user).value).not.toContain("title-account");
    expect(renderTitle({ ...user, account: { kind: "guest" } }).value).not.toContain("title-account");
  });

  it("opened: the card with the look, the name, company · role, who is signed in, 退出登录 / 注册 and 返回; the menu inert behind it", () => {
    const h = renderTitle({ ...user, badgeOpen: true, look: "p2" }).value;
    expect(h).toContain('class="title-card title-badge-card" role="dialog" aria-modal="true"');
    expect(h).toContain('data-portrait="p2"');
    expect(h).toContain('data-action="badge-turn" data-by="-1"');
    expect(h).toContain('data-action="badge-turn" data-by="1"');
    expect(h).toContain('<div class="pick-label">形象 2</div>');
    expect(h).toContain('<h2 id="title-badge-h" class="badge-name">kiro.w</h2>');
    expect(h).toContain("未来智能 · 技术 · 居家办公");
    expect(h).toContain("已登录：kiro.w@b.co");
    expect(h).toContain('data-action="auth-logout">退出登录</button>');
    expect(h).not.toContain('data-action="auth-upgrade"');
    expect(h).toContain('data-action="badge-close">返回</button>');
    expect(h).toContain('class="title-badge-dim" data-action="badge-close"');
    expect(h).toMatch(/<nav class="title-menu"[^>]* inert>/);
    const g = renderTitle({ ...user, account: { kind: "guest" }, badgeOpen: true }).value;
    expect(g).toContain("游客的存档只在这台设备上");
    expect(g).toContain('data-action="auth-upgrade">注册 / 登录</button>');
    expect(g).not.toContain('data-action="auth-logout"');
    // Closed, or nobody to wear it: no card.
    expect(renderTitle(user).value).not.toContain("title-badge-card");
    expect(renderTitle({ ...user, account: { kind: "none" }, badgeOpen: true }).value).not.toContain("title-badge-card");
    expect(renderTitle(user).value).not.toMatch(/<nav class="title-menu"[^>]* inert>/);
  });

  it("mounted: badge-open prints the card; ‹ › turn the look and write it at once; badge-close, the dim and Esc close it", async () => {
    setSupabaseForTests(fakeClient({ id: "u-9", email: "me@b.co" }).c);
    const written: string[] = [];
    const t = await mount(new MemStorage(), true, { look: { read: () => "p3", write: (p: string) => written.push(p) } });
    expect(t.model().look).toBe("p3");
    expect(t.model().badgeOpen).toBe(false);
    t.click('[data-action="badge-turn"]'); // closed: nothing to turn
    expect(written).toEqual([]);
    t.click('[data-action="badge-open"]');
    expect(t.model().badgeOpen).toBe(true);
    expect(t.html()).toContain("title-badge-card");
    t.click('[data-action="badge-turn"][data-by="1"]');
    expect(t.model().look).toBe("p1");
    t.click('[data-action="badge-turn"][data-by="1"]');
    t.click('[data-action="badge-turn"][data-by="-1"]');
    t.click('[data-action="badge-turn"][data-by="-1"]');
    expect(written).toEqual(["p1", "p2", "p1", "p3"]);
    expect(t.model().look).toBe("p3");
    expect(t.model().answers.portrait).toBe("p1"); // the badge never touches a run's pick
    t.click('.title-badge-foot [data-action="badge-close"]');
    expect(t.model().badgeOpen).toBe(false);
    expect(t.html()).not.toContain("title-badge-card");
    t.click('[data-action="badge-open"]');
    t.click('.title-badge-dim');
    expect(t.model().badgeOpen).toBe(false);
    t.click('[data-action="badge-open"]');
    t.win.dispatchEvent(new t.win.KeyboardEvent("keydown", { key: "Escape" }) as never);
    expect(t.model().badgeOpen).toBe(false);
    expect(t.model().screen).toBe("menu");
  });

  it("no look dep: the badge wears 形象 1; no account wiring: no badge and badge-open does nothing", async () => {
    setSupabaseForTests(fakeClient({ id: "u-9", email: "me@b.co" }).c);
    const t = await mount();
    expect(t.model().look).toBe("p1");
    setSupabaseForTests(null);
    const off = await mount();
    off.click('[data-action="badge-open"]');
    expect(off.model().badgeOpen).toBe(false);
    expect(off.html()).not.toContain("title-badge");
  });

  it("the question card's portrait starts from the stored look; a pick there is not written back", async () => {
    expect(toQuestions({ ...user, look: "p2" }).answers.portrait).toBe("p2");
    expect(toQuestions({ ...user, look: "p3", badgeOpen: true }).badgeOpen).toBe(false);
    expect(toMenu({ ...user, badgeOpen: true }).badgeOpen).toBe(false);
    setSupabaseForTests(fakeClient({ id: "u-9", email: "me@b.co" }).c);
    const written: string[] = [];
    const t = await mount(new MemStorage(), true, { look: { read: () => "p2", write: (p: string) => written.push(p) } });
    t.click('[data-action="title-new"]');
    expect(t.model().screen).toBe("questions");
    expect(t.model().answers.portrait).toBe("p2");
    const { titleTable } = await import("../src/ui/title/table");
    await new Promise((r) => setTimeout(r, titleTable.start.pushMs + 50));
    expect(t.html()).toContain('data-action="title-pick-turn"');
    expect(t.html()).toContain('<div class="big" data-portrait="p2">');
    t.click('[data-action="title-pick-turn"][data-by="1"]');
    expect(t.model().answers.portrait).toBe("p3");
    expect(written).toEqual([]);
    expect(t.model().look).toBe("p2");
  });
});

describe("readLook", () => {
  it("reads the profile's look when it is one of the portraits, else null", async () => {
    const { readLook } = await import("../src/ui/collection");
    const { createProfileWriter, PROFILE_KEY } = await import("@state/saves");
    const s = new MemStorage();
    expect(readLook(s)).toBeNull();
    createProfileWriter(s).writeLook("p3");
    expect(readLook(s)).toBe("p3");
    s.setItem(PROFILE_KEY, JSON.stringify({ look: "p9" }));
    expect(readLook(s)).toBeNull();
    s.setItem(PROFILE_KEY, JSON.stringify({ look: 2 }));
    expect(readLook(s)).toBeNull();
  });
});
