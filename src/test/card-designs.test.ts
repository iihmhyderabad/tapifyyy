import { describe, expect, it } from "vitest";
import { DESIGN_CARD_COUNT, designCodes, isDesignCode } from "@/lib/card-designs";

describe("Separate card collections", () => {
  it("allocates 500 Google Review codes", () => {
    expect(designCodes("google")).toHaveLength(DESIGN_CARD_COUNT);
  });
  it("allocates 500 Instagram codes", () => {
    expect(designCodes("instagram")).toHaveLength(DESIGN_CARD_COUNT);
  });
  it("keeps all codes unique and outside existing GREV IDs", () => {
    const codes = [...designCodes("google"), ...designCodes("instagram")];
    expect(new Set(codes).size).toBe(DESIGN_CARD_COUNT * 2);
    expect(codes.every(isDesignCode)).toBe(true);
    expect(isDesignCode("GREV-001")).toBe(false);
  });
});
