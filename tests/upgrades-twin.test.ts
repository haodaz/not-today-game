// upgrades-twin (2026-11-05): content/en/upgrades.json is the strict twin of content/upgrades.json;
// the content locale picks offer / nag / kuroNote / finalOffer; the judgement stays the source's.
import { afterEach, describe, expect, it } from "vitest";
import zhRaw from "@content/upgrades.json";
import enRaw from "@content/en/upgrades.json";
import { setContentLocale } from "@state/content-locale";
import { localiseUpgrades, parseUpgrades, upgradeTable } from "@state/upgrades";

afterEach(() => setContentLocale("zh"));

const clone = <T>(v: T): any => JSON.parse(JSON.stringify(v));
const zh = () => parseUpgrades(zhRaw);
const twin = (edit: (raw: any) => void) => {
  const raw = clone(enRaw);
  edit(raw);
  return () => localiseUpgrades(zh(), parseUpgrades(raw, "en/upgrades.json"));
};
const firstId = Object.keys((zhRaw as any).objects)[0]!;

describe("the twin's shape", () => {
  it("today's twin loads: the same objects, in order, with the same days", () => {
    expect([...upgradeTable.objects.keys()]).toEqual(Object.keys((zhRaw as any).objects));
    expect(upgradeTable.finalOfferDay).toBe((zhRaw as any).finalOfferDay);
    expect(upgradeTable.nagAfterDays).toBe((zhRaw as any).nagAfterDays);
  });

  it("a missing twin key fails, named in the twin's file", () => {
    expect(twin((r) => delete r.objects[firstId].nag)).toThrow(new RegExp(`content/en/upgrades\\.json objects\\.${firstId}\\.nag`));
    expect(twin((r) => delete r.finalOffer)).toThrow(/content\/en\/upgrades\.json finalOffer/);
    expect(twin((r) => delete r.objects[firstId])).toThrow(new RegExp(`objects\\.${firstId}: missing`));
  });

  it("an unknown key, an extra object, another day or another judgement fails", () => {
    expect(twin((r) => (r.objects[firstId].extra = "x"))).toThrow(/unknown key "extra"/);
    expect(twin((r) => (r.objects[firstId].offerFrom += 1))).toThrow(/offerFrom/);
    expect(twin((r) => (r.finalOfferDay += 1))).toThrow(/finalOfferDay/);
    expect(twin((r) => (r.judgement.accept.evidence = "other"))).toThrow(/judgement\.accept/);
    expect(twin((r) => (r.objects = Object.fromEntries(Object.entries(r.objects).reverse())))).toThrow(/order/);
  });
});

describe("the content locale picks the text", () => {
  const table = () =>
    localiseUpgrades(
      parseUpgrades(zhRaw),
      parseUpgrades(
        (() => {
          const r = clone(enRaw);
          r.finalOffer = "EN final";
          r.objects[firstId] = { ...r.objects[firstId], offer: "EN offer", nag: "EN nag", kuroNote: "EN note", gain: "EN gain", cost: "EN cost" };
          return r;
        })(),
        "en/upgrades.json",
      ),
    );

  it("zh reads the source's text, en the twin's; gain / cost and the evidence stay the source's", () => {
    const src = (zhRaw as any).objects[firstId];
    const t = table();
    setContentLocale("zh");
    expect([t.objects.get(firstId)!.offer, t.objects.get(firstId)!.nag, t.objects.get(firstId)!.kuroNote, t.finalOffer]).toEqual([src.offer, src.nag, src.kuroNote, (zhRaw as any).finalOffer]);
    setContentLocale("en");
    expect([t.objects.get(firstId)!.offer, t.objects.get(firstId)!.nag, t.objects.get(firstId)!.kuroNote, t.finalOffer]).toEqual(["EN offer", "EN nag", "EN note", "EN final"]);
    expect([t.objects.get(firstId)!.gain, t.objects.get(firstId)!.cost]).toEqual([src.gain, src.cost]);
    expect(t.judgement.accept.evidence).toBe((zhRaw as any).judgement.accept.evidence);
  });
});
