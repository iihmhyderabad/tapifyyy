import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "@/routeTree.gen";
import { keepAliveConfig } from "@/config/keep-alive-config";
import { generateRandomString } from "@/lib/keep-alive-helper";

describe("Supabase Pause Prevention Keep-Alive", () => {
  it("generates a random string of requested length", () => {
    const s1 = generateRandomString(12);
    expect(s1).toHaveLength(12);
    expect(typeof s1).toBe("string");

    const s2 = generateRandomString(24);
    expect(s2).toHaveLength(24);
  });

  it("has valid configuration matching pause prevention specifications", () => {
    expect(keepAliveConfig.table).toBeDefined();
    expect(keepAliveConfig.column).toBeDefined();
    expect(typeof keepAliveConfig.allowInsertionAndDeletion).toBe("boolean");
    expect(keepAliveConfig.sizeBeforeDeletions).toBeGreaterThan(0);
  });

  it("registers /api/keep-alive route in the application route tree", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    const matches = router.matchRoutes("/api/keep-alive");

    expect(matches.at(-1)?.routeId).toBe("/api/keep-alive");
  });
});

