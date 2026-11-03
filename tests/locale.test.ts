// title-page correction 2026-11-03 "the language is remembered". The language the player picks is
// kept across runs in localStorage under `nt_lang`, outside the run save. A boot resolves the
// language in order: `?lang=` (a shared link's choice), then the stored `nt_lang`, then English (the
// README default). Storage access is wrapped: a throwing or absent store never crashes a boot.
import { describe, expect, it } from "vitest";
import { memoryStorage } from "@state/slot";
import { initialLocale, persistLocale, storedLocale } from "@world/i18n";

describe("persisting the language under nt_lang", () => {
  it("writes the choice and reads it back", () => {
    const storage = memoryStorage();
    persistLocale("en", storage);
    expect(storage.getItem("nt_lang")).toBe("en");
    expect(storedLocale(storage)).toBe("en");
    persistLocale("zh", storage);
    expect(storage.getItem("nt_lang")).toBe("zh");
    expect(storedLocale(storage)).toBe("zh");
  });

  it("stored is undefined when nothing is saved, or when the value is not a locale", () => {
    const storage = memoryStorage();
    expect(storedLocale(storage)).toBeUndefined();
    storage.setItem("nt_lang", "fr");
    expect(storedLocale(storage)).toBeUndefined();
  });

  it("never throws when storage is blocked (private mode)", () => {
    const thrower = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
    };
    expect(() => persistLocale("zh", thrower)).not.toThrow();
    expect(storedLocale(thrower)).toBeUndefined();
  });
});

describe("the boot language: url, then storage, then English", () => {
  it("falls back to English with no url and no storage", () => {
    expect(initialLocale("", memoryStorage())).toBe("en");
  });

  it("uses the remembered language when there is no ?lang=", () => {
    const storage = memoryStorage();
    persistLocale("zh", storage);
    expect(initialLocale("", storage)).toBe("zh");
    expect(initialLocale("?day=3", storage)).toBe("zh");
  });

  it("?lang= wins over the stored language (a shared link)", () => {
    const storage = memoryStorage();
    persistLocale("zh", storage);
    expect(initialLocale("?lang=en", storage)).toBe("en");
    persistLocale("en", storage);
    expect(initialLocale("?lang=zh", storage)).toBe("zh");
  });

  it("an unknown ?lang= is ignored; it falls through to storage then English", () => {
    const storage = memoryStorage();
    expect(initialLocale("?lang=fr", storage)).toBe("en");
    persistLocale("zh", storage);
    expect(initialLocale("?lang=fr", storage)).toBe("zh");
  });
});
