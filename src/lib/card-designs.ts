export const DESIGN_CARD_COUNT = 500;
export type CardDesign = "google" | "instagram";
export const cardDesigns = {
  google: { name: "Google Review NFC Card", prefix: "CD-GOOGLE-" },
  instagram: { name: "Instagram NFC Card", prefix: "CD-INSTAGRAM-" },
} as const;

export function designCodes(design: CardDesign): string[] {
  return Array.from({ length: DESIGN_CARD_COUNT }, (_, i) => `${cardDesigns[design].prefix}${String(i + 1).padStart(3, "0")}`);
}

export function isDesignCode(code: string): boolean {
  return Object.values(cardDesigns).some((design) => code.startsWith(design.prefix));
}