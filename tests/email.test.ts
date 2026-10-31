// backend FR1, 绑定邮箱: the settings row's three states (hidden, input, bound), the call's arguments
// with a mocked client, hidden when offline; in the game's panel and the title's. Strings are read
// through t().
import { afterEach, describe, expect, it } from "vitest";
import { emailRow, emailRowModel, looksLikeEmail, onEmailChange, resetEmailForTests, sendEmailLink, setEmailDraft } from "@net/email";
import { net, setSupabaseForTests, type SupabaseLike } from "@net/supabase";
import { escapeHtml } from "@world/html";
import { setLocale, t } from "@world/i18n";
import { emailRowHtml, settingsPanel } from "@world/room/hud";

afterEach(() => {
  setSupabaseForTests(undefined);
  resetEmailForTests();
  setLocale("zh");
});

const ORIGIN = "https://nottoday.example";

/** A mocked client: the session's user (or none), and every auth call recorded. */
function mockClient(user: { id: string; email?: string | null; is_anonymous?: boolean } | null, error: unknown = null) {
  const calls: { fn: string; args: unknown[] }[] = [];
  const c: SupabaseLike = {
    auth: {
      getSession: async () => ({ data: { session: user ? { user } : null } }),
      signInAnonymously: async () => ({ data: { user: { id: "anon-1" } }, error: null }),
      updateUser: async (...args) => (calls.push({ fn: "updateUser", args }), { data: {}, error }),
      signInWithOtp: async (...args) => (calls.push({ fn: "signInWithOtp", args }), { data: {}, error }),
    },
    from: () => ({ upsert: async () => ({ error: null }), select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
    functions: { invoke: async () => ({ data: null, error: null }) },
  };
  return { c, calls };
}

const open = { settingsOpen: true, muted: false };

describe("the row model (pure)", () => {
  it("hidden offline or without env; input when anonymous; bound when the session has an email", () => {
    const base = { draft: "", status: "idle" as const };
    expect(emailRowModel({ ...base, configured: false, signedIn: false, bound: null })).toEqual({ kind: "hidden" });
    expect(emailRowModel({ ...base, configured: true, signedIn: false, bound: null })).toEqual({ kind: "hidden" });
    expect(emailRowModel({ ...base, configured: true, signedIn: true, bound: null })).toEqual({ kind: "input", draft: "", status: "idle" });
    expect(emailRowModel({ ...base, configured: true, signedIn: true, bound: "a@b.co" })).toEqual({ kind: "bound", email: "a@b.co" });
    expect(looksLikeEmail("a@b.co")).toBe(true);
    expect(looksLikeEmail("a@b")).toBe(false);
    expect(looksLikeEmail("no")).toBe(false);
  });
});

describe("the row's markup: three states", () => {
  it("hidden: no row at all in the panel", () => {
    const out = settingsPanel(open, { home: true, email: { kind: "hidden" } })!.value;
    expect(out).not.toContain('data-email=');
    expect(out).not.toContain(t("settings.bindEmail"));
    expect(emailRowHtml({ kind: "hidden" })).toBeNull();
  });

  it("input: the label, the email input with its placeholder, 发送链接, and the hint as the status line", () => {
    const out = emailRowHtml({ kind: "input", draft: "me@x.io", status: "idle" })!.value;
    expect(out).toContain(`<label for="settings-email">${t("settings.bindEmail")}</label>`);
    expect(out).toContain('type="email"');
    expect(out).toContain(`placeholder="${t("settings.emailPlaceholder")}"`);
    expect(out).toContain('value="me@x.io"');
    expect(out).toContain('data-enter="settings-email-send"');
    expect(out).toContain(`data-action="settings-email-send">${t("settings.emailSend")}</button>`);
    expect(out).toContain(`role="status" aria-live="polite">${t("settings.emailHint")}</p>`);
    expect(emailRowHtml({ kind: "input", draft: "", status: "sent" })!.value).toContain(t("settings.emailSent"));
    expect(emailRowHtml({ kind: "input", draft: "", status: "error" })!.value).toContain(t("settings.emailError"));
    // While sending, the input and the button wait.
    expect((emailRowHtml({ kind: "input", draft: "", status: "sending" })!.value.match(/ disabled/g) ?? []).length).toBe(2);
  });

  it("bound: settings.emailBound with the address instead of the input (escaped)", () => {
    const email = "a<b>@x.io";
    const out = emailRowHtml({ kind: "bound", email })!.value;
    expect(out).toContain(escapeHtml(t("settings.emailBound", { email })));
    expect(out).not.toContain("<input");
    expect(out).not.toContain("<b>");
  });

  it("in both panels: the game's (with 返回首页) and the title's (without)", () => {
    const row = { kind: "input", draft: "", status: "idle" } as const;
    for (const home of [true, false]) {
      const out = settingsPanel(open, { home, email: row })!.value;
      expect(out).toContain('data-email="input"');
      expect(out.indexOf('data-email="input"')).toBeLessThan(out.indexOf('class="actions"'));
      expect(out.includes('data-action="settings-home"')).toBe(home);
    }
  });

  it("English too", () => {
    setLocale("en");
    expect(emailRowHtml({ kind: "input", draft: "", status: "idle" })!.value).toContain(t("settings.emailSend"));
  });
});

describe("the call, with a mocked client", () => {
  it("offline (no env, no client): the row is hidden and nothing is called", async () => {
    setSupabaseForTests(null);
    expect(net.configured()).toBe(false);
    expect(await net.signIn()).toBe(false);
    expect(emailRow()).toEqual({ kind: "hidden" });
    expect(settingsPanel(open)!.value).not.toContain("data-email=");
  });

  it("the anonymous session: updateUser({ email }, { emailRedirectTo: origin }) links it to the same user; sent", async () => {
    const { c, calls } = mockClient({ id: "anon-1", is_anonymous: true, email: "" });
    setSupabaseForTests(c);
    expect(await net.signIn()).toBe(true);
    expect(emailRow()).toEqual({ kind: "input", draft: "", status: "idle" });
    setEmailDraft("  me@x.io ");
    const statuses: string[] = [];
    await sendEmailLink(ORIGIN, () => void statuses.push((emailRow() as { status: string }).status));
    expect(calls).toEqual([{ fn: "updateUser", args: [{ email: "me@x.io" }, { emailRedirectTo: ORIGIN }] }]);
    expect(statuses).toEqual(["sending", "sent"]);
    expect(emailRowHtml(emailRow())!.value).toContain(t("settings.emailSent"));
  });

  it("no session at all: a magic link (signInWithOtp) with emailRedirectTo = origin", async () => {
    const { c, calls } = mockClient(null);
    setSupabaseForTests(c);
    expect(await net.bindEmail("me@x.io", ORIGIN)).toBe("sent");
    expect(calls).toEqual([{ fn: "signInWithOtp", args: [{ email: "me@x.io", options: { emailRedirectTo: ORIGIN, shouldCreateUser: true } }] }]);
  });

  it("the server says no, or the address is not one: the error line; nothing else changes", async () => {
    const { c, calls } = mockClient({ id: "anon-1", is_anonymous: true }, new Error("rate limited"));
    setSupabaseForTests(c);
    await net.signIn();
    setEmailDraft("me@x.io");
    await sendEmailLink(ORIGIN, () => {});
    expect(emailRow()).toMatchObject({ kind: "input", status: "error" });
    setEmailDraft("not-an-email");
    await sendEmailLink(ORIGIN, () => {});
    expect(calls).toHaveLength(1);
    expect(emailRow()).toMatchObject({ kind: "input", status: "error", draft: "not-an-email" });
    // Typing again clears the error.
    setEmailDraft("me@x.io");
    expect(emailRow()).toMatchObject({ status: "idle" });
  });

  it("the auth-event listener: opening the link (USER_UPDATED with the email) shows bound at once and re-renders", async () => {
    const { c } = mockClient({ id: "anon-1", is_anonymous: true });
    let emit: ((event: string, session: { user: { id: string; email?: string | null; is_anonymous?: boolean } } | null) => void) | null = null;
    let subscriptions = 0;
    let unsubscribed = 0;
    c.auth.onAuthStateChange = (cb) => {
      subscriptions++;
      emit = cb;
      return { data: { subscription: { unsubscribe: () => void unsubscribed++ } } };
    };
    setSupabaseForTests(c);
    await net.signIn();
    await net.signIn();
    expect(subscriptions).toBe(1);
    let renders = 0;
    const stop = onEmailChange(() => void renders++);
    // Still anonymous: nothing changes.
    emit!("TOKEN_REFRESHED", { user: { id: "anon-1", is_anonymous: true } });
    expect(emailRow().kind).toBe("input");
    expect(renders).toBe(0);
    // The link was opened: the same user id, now with an email.
    emit!("USER_UPDATED", { user: { id: "anon-1", is_anonymous: false, email: "me@x.io" } });
    expect(emailRow()).toEqual({ kind: "bound", email: "me@x.io" });
    expect(renders).toBe(1);
    // The same again: no second re-render. A sign-out does not unbind what was seen this session.
    emit!("USER_UPDATED", { user: { id: "anon-1", is_anonymous: false, email: "me@x.io" } });
    emit!("SIGNED_OUT", null);
    expect(renders).toBe(1);
    expect(emailRow().kind).toBe("bound");
    stop();
    setSupabaseForTests(undefined);
    expect(unsubscribed).toBe(1);
  });

  it("a session that already has an email: bound, no input", async () => {
    const { c } = mockClient({ id: "u-1", is_anonymous: false, email: "me@x.io" });
    setSupabaseForTests(c);
    await net.signIn();
    expect(emailRow()).toEqual({ kind: "bound", email: "me@x.io" });
    expect(settingsPanel(open)!.value).toContain('data-email="bound"');
  });
});
