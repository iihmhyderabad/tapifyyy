import { describe, expect, it } from "vitest";
import { CARD_EXPORT_PIXELS } from "@/lib/card-export";
import { CARD_PRINT_INCHES, PSD_EXPORT_PIXELS, PSD_PRINT_DPI } from "@/lib/export-formats";

describe("Print-ready card output", () => {
  it("uses an 8K output edge of 8192 pixels", () => {
    expect(CARD_EXPORT_PIXELS).toBe(8192);
  });
  it("preserves the 4 inch print size", () => {
    expect(CARD_PRINT_INCHES).toBe(4);
  });
  it("provides 600 PPI layered Photoshop output", () => {
    expect(PSD_PRINT_DPI).toBe(600);
    expect(PSD_EXPORT_PIXELS).toBe(2400);
  });
});