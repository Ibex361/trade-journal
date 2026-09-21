import { describe, it, expect } from "vitest";
import { decideRoute, PUBLIC_PATHS } from "../proxyRouting";

describe("decideRoute — the login gate", () => {
  it("sends an unauthenticated request for a normal page to /login", () => {
    for (const p of ["/", "/trades", "/analytics", "/backtests", "/backtests/abc", "/settings"]) {
      expect(decideRoute(p, false)).toBe("login");
    }
  });

  it("lets an authenticated request through", () => {
    for (const p of ["/", "/trades", "/backtests", "/backtests/abc"]) {
      expect(decideRoute(p, true)).toBe("next");
    }
  });

  it("bounces a signed-in user off /login", () => {
    expect(decideRoute("/login", true)).toBe("home");
  });

  it("lets an anonymous visitor reach /login", () => {
    expect(decideRoute("/login", false)).toBe("next");
  });

  it("keeps PWA assets servable both signed in and out", () => {
    for (const p of ["/manifest.webmanifest", "/icons/icon-192.png", "/apple-touch-icon.png"]) {
      expect(decideRoute(p, false)).toBe("next");
      expect(decideRoute(p, true)).toBe("next");
    }
  });
});

describe("decideRoute — backtest API exposure (security-critical)", () => {
  it("the webhook is reachable WITHOUT a session (GitHub has no cookie)", () => {
    expect(decideRoute("/api/backtests/webhook", false)).toBe("next");
  });

  it("the trigger route is NOT reachable without a session", () => {
    expect(decideRoute("/api/backtests/trigger", false)).toBe("login");
  });

  it("the backtest chart-data route is NOT reachable without a session", () => {
    expect(decideRoute("/api/backtest-chart-data", false)).toBe("login");
  });

  it("no other /api/backtests/* path became public by prefix accident", () => {
    for (const p of ["/api/backtests", "/api/backtests/", "/api/backtests/anything", "/api/backtests/trigger/x"]) {
      expect(decideRoute(p, false)).toBe("login");
    }
  });

  it("an authenticated request to the webhook is not redirected away (it'd break a manual test from a logged-in browser only if it were — document the actual behavior)", () => {
    // Existing, intentional rule: any PUBLIC path bounces a signed-in
    // user home. GitHub Actions never sends a cookie, so the real caller
    // is always anonymous and unaffected. Pinned so a change is noticed.
    expect(decideRoute("/api/backtests/webhook", true)).toBe("home");
  });

  it("the only public entries are the three deliberate ones", () => {
    expect([...PUBLIC_PATHS]).toEqual(["/login", "/api/cron", "/api/backtests/webhook"]);
  });
});
