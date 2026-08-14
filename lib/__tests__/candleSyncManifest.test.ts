import { describe, it, expect } from "vitest";
import { manifestKey, parseManifest, serializeManifest, daysNeedingSync } from "../../scripts/candleSyncManifest";

describe("manifestKey", () => {
  it("builds the R2 key from the instrument", () => {
    expect(manifestKey("XAUUSD")).toBe("candles/XAUUSD/synced-days.json");
  });
});

describe("parseManifest", () => {
  it("parses a valid JSON array of day strings into a Set", () => {
    expect(parseManifest('["2026-08-10","2026-08-11"]')).toEqual(new Set(["2026-08-10", "2026-08-11"]));
  });

  it("returns an empty Set for null (no manifest object yet — brand-new instrument)", () => {
    expect(parseManifest(null)).toEqual(new Set());
  });

  it("returns an empty Set for undefined", () => {
    expect(parseManifest(undefined)).toEqual(new Set());
  });

  it("returns an empty Set for an empty string", () => {
    expect(parseManifest("")).toEqual(new Set());
  });

  it("returns an empty Set for malformed JSON rather than throwing", () => {
    expect(parseManifest("not json")).toEqual(new Set());
  });

  it("returns an empty Set for valid JSON that isn't an array", () => {
    expect(parseManifest('{"foo":"bar"}')).toEqual(new Set());
  });

  it("filters out non-string entries rather than throwing", () => {
    expect(parseManifest('["2026-08-10", 5, null, "2026-08-11"]')).toEqual(new Set(["2026-08-10", "2026-08-11"]));
  });
});

describe("serializeManifest", () => {
  it("serializes a Set to a sorted JSON array", () => {
    expect(serializeManifest(new Set(["2026-08-11", "2026-08-10"]))).toBe('["2026-08-10","2026-08-11"]');
  });

  it("serializes an empty Set to an empty JSON array", () => {
    expect(serializeManifest(new Set())).toBe("[]");
  });

  it("round-trips through parseManifest", () => {
    const original = new Set(["2026-08-10", "2026-08-11", "2026-08-12"]);
    expect(parseManifest(serializeManifest(original))).toEqual(original);
  });
});

describe("daysNeedingSync", () => {
  it("returns only candidate days not already in the synced set", () => {
    const synced = new Set(["2026-08-10"]);
    expect(daysNeedingSync(synced, ["2026-08-10", "2026-08-11", "2026-08-12"])).toEqual(["2026-08-11", "2026-08-12"]);
  });

  it("returns all candidate days when none are synced yet", () => {
    expect(daysNeedingSync(new Set(), ["2026-08-10", "2026-08-11"])).toEqual(["2026-08-10", "2026-08-11"]);
  });

  it("returns an empty array when every candidate day is already synced", () => {
    const synced = new Set(["2026-08-10", "2026-08-11"]);
    expect(daysNeedingSync(synced, ["2026-08-10", "2026-08-11"])).toEqual([]);
  });

  it("returns an empty array when given no candidate days", () => {
    expect(daysNeedingSync(new Set(["2026-08-10"]), [])).toEqual([]);
  });

  it("preserves candidate order rather than the synced set's insertion order", () => {
    const synced = new Set<string>();
    expect(daysNeedingSync(synced, ["2026-08-12", "2026-08-10", "2026-08-11"])).toEqual(["2026-08-12", "2026-08-10", "2026-08-11"]);
  });
});
