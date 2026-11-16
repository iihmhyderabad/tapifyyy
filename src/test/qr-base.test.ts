import { describe, it, expect } from "vitest";
import { permanentUrl } from "@/lib/qr";
import { PUBLIC_SITE_URL } from "@/lib/qr-base";

describe("permanent QR url", () => {
  it("always uses the public site, never the preview", () => {
    expect(permanentUrl("GREV-001")).toBe(`${PUBLIC_SITE_URL}/r/GREV-001`);
  });
});
