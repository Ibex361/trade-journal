import { describe, it, expect } from "vitest";
import { NAV_TABS, isTabActive } from "../navTabs";

describe("isTabActive", () => {
  it("Dashboard is active only on exactly '/', never on other pages", () => {
    expect(isTabActive("/", "/")).toBe(true);
    for (const p of ["/trades", "/backtests", "/backtests/abc", "/settings"]) {
      expect(isTabActive(p, "/")).toBe(false);
    }
  });

  it("a tab is active on its own path", () => {
    expect(isTabActive("/backtests", "/backtests")).toBe(true);
    expect(isTabActive("/trades", "/trades")).toBe(true);
  });

  it("a tab stays active on nested pages (the /backtests/<id> detail page)", () => {
    expect(isTabActive("/backtests/1b4e28ba-2fa1-11d2-883f-0016d3cca427", "/backtests")).toBe(true);
    expect(isTabActive("/backtests/abc/", "/backtests")).toBe(true);
  });

  it("does not match a different path that merely shares a prefix", () => {
    expect(isTabActive("/backtests-old", "/backtests")).toBe(false);
    expect(isTabActive("/tradesX", "/trades")).toBe(false);
    expect(isTabActive("/notes", "/not")).toBe(false);
  });

  it("does not activate sibling tabs while on a nested page", () => {
    const active = NAV_TABS.filter((t) => isTabActive("/backtests/abc", t.href)).map((t) => t.href);
    expect(active).toEqual(["/backtests"]);
  });

  it("every tab is active on its own path, and exactly one tab is active per path", () => {
    for (const tab of NAV_TABS) {
      const active = NAV_TABS.filter((t) => isTabActive(tab.href, t.href));
      expect(active.map((t) => t.href)).toEqual([tab.href]);
    }
  });
});

describe("NAV_TABS", () => {
  it("lists Backtests, once", () => {
    expect(NAV_TABS.filter((t) => t.href === "/backtests")).toHaveLength(1);
  });
  it("has no duplicate hrefs", () => {
    const hrefs = NAV_TABS.map((t) => t.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
