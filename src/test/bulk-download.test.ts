import { describe, expect, it } from "vitest";
import { extractCardNumber } from "@/components/bulk-card-download-modal";
import type { QrRecord } from "@/data/qr-queries";

describe("Bulk / Range Download Logic", () => {
  describe("extractCardNumber", () => {
    it("extracts numeric suffix from standard GREV codes", () => {
      expect(extractCardNumber("GREV-001", 0)).toBe(1);
      expect(extractCardNumber("GREV-050", 49)).toBe(50);
      expect(extractCardNumber("GREV-500", 499)).toBe(500);
    });

    it("extracts numeric suffix from Card Designs codes", () => {
      expect(extractCardNumber("CD-GOOGLE-001", 0)).toBe(1);
      expect(extractCardNumber("CD-GOOGLE-250", 249)).toBe(250);
      expect(extractCardNumber("CD-INSTAGRAM-075", 74)).toBe(75);
      expect(extractCardNumber("CD-INSTAGRAM-500", 499)).toBe(500);
    });

    it("falls back to index + 1 when code has no trailing digits", () => {
      expect(extractCardNumber("CUSTOM-CARD", 4)).toBe(5);
      expect(extractCardNumber("UNKNOWN", 12)).toBe(13);
    });
  });

  describe("Range filtering", () => {
    const mockRecords: QrRecord[] = Array.from({ length: 500 }, (_, i) => ({
      id: `id-${i + 1}`,
      qr_code: `GREV-${String(i + 1).padStart(3, "0")}`,
      client_name: `Client ${i + 1}`,
      destination_url: `https://example.com/${i + 1}`,
      is_active: true,
      scan_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    it("correctly filters cards in range 1 to 50", () => {
      const start = 1;
      const end = 50;
      const filtered = mockRecords.filter((r, i) => {
        const n = extractCardNumber(r.qr_code, i);
        return n >= start && n <= end;
      });
      expect(filtered).toHaveLength(50);
      expect(filtered[0]?.qr_code).toBe("GREV-001");
      expect(filtered[49]?.qr_code).toBe("GREV-050");
    });

    it("correctly filters cards in range 51 to 100", () => {
      const start = 51;
      const end = 100;
      const filtered = mockRecords.filter((r, i) => {
        const n = extractCardNumber(r.qr_code, i);
        return n >= start && n <= end;
      });
      expect(filtered).toHaveLength(50);
      expect(filtered[0]?.qr_code).toBe("GREV-051");
      expect(filtered[49]?.qr_code).toBe("GREV-100");
    });

    it("handles arbitrary ranges like 120 to 135", () => {
      const start = 120;
      const end = 135;
      const filtered = mockRecords.filter((r, i) => {
        const n = extractCardNumber(r.qr_code, i);
        return n >= start && n <= end;
      });
      expect(filtered).toHaveLength(16);
      expect(filtered[0]?.qr_code).toBe("GREV-120");
      expect(filtered[15]?.qr_code).toBe("GREV-135");
    });

    it("handles inverted range inputs where start > end gracefully", () => {
      const rawStart = 100;
      const rawEnd = 50;
      const s = Math.min(rawStart, rawEnd);
      const e = Math.max(rawStart, rawEnd);
      const filtered = mockRecords.filter((r, i) => {
        const n = extractCardNumber(r.qr_code, i);
        return n >= s && n <= e;
      });
      expect(filtered).toHaveLength(51);
      expect(filtered[0]?.qr_code).toBe("GREV-050");
      expect(filtered[50]?.qr_code).toBe("GREV-100");
    });
  });
});
