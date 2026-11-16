import { describe, expect, it } from "vitest";
import { activationLinkSchema, scanState } from "@/lib/qr-activation";

describe("Direct card activation", () => {
  it("opens activation for a blank card, including an unactivated disabled card", () => {
    expect(scanState({ destination_url: null, is_active: true })).toBe("activation");
    expect(scanState({ destination_url: null, is_active: false })).toBe("activation");
    expect(scanState({ destination_url: "", is_active: true })).toBe("activation");
  });
  it("directly redirects an activated card with a saved destination", () => {
    expect(scanState({ destination_url: "https://example.com/review", is_active: true })).toBe("redirect");
  });
  it("does not reactivate a configured card disabled in the dashboard", () => {
    expect(scanState({ destination_url: "https://example.com", is_active: false })).toBe("inactive");
  });
  it("accepts Google Review and website URLs, trimming pasted whitespace", () => {
    expect(activationLinkSchema.parse(" https://g.page/r/review ")).toBe("https://g.page/r/review");
    expect(activationLinkSchema.parse("http://example.com")).toBe("http://example.com");
  });
  it("rejects empty, invalid, executable and credential-bearing destinations", () => {
    for (const value of ["", "example", "javascript:alert(1)", "ftp://example.com", "https://user:pass@example.com"]) {
      expect(activationLinkSchema.safeParse(value).success).toBe(false);
    }
  });
});